import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const createSchema = z.object({
  loanId:    z.string(),
  amount:    z.number().positive(),
  method:    z.enum(["cash", "bank_transfer", "mobile_money"]),
  reference: z.string().min(1),
  notes:     z.string().optional(),
  date:      z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit  = Math.min(100, Number(searchParams.get("limit") ?? 20));
    const search = searchParams.get("search") ?? "";
    const skip   = (page - 1) * limit;

    const loanId = searchParams.get("loanId");

    const where = {
      companyId: auth.companyId!,
      ...(loanId && { loanId }),
      ...(search && {
        OR: [
          { customer: { names: { contains: search } } },
          { reference: { contains: search } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        include: {
          customer:   { select: { names: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    const data = payments.map((p) => ({
      ...p,
      customerName:   p.customer.names,
      recordedByName: p.recordedBy.name,
    }));

    return paginated(data, total, page, limit);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer", "receptionist"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const body   = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const loan = await prisma.loan.findFirst({
      where: { id: parsed.data.loanId, companyId: auth.companyId! },
    });
    if (!loan) return notFound("Loan not found.");
    if (!["active", "overdue", "disbursed"].includes(loan.status)) {
      return badRequest("Payments can only be recorded on active or overdue loans.");
    }

    const { amount, loanId, method, reference, notes, date } = parsed.data;
    const paymentDate = date ? new Date(date) : new Date();

    // Auto-allocate: penalty → interest → principal
    let remaining    = amount;
    const penaltyPaid = Math.min(remaining, loan.penaltyAmount);
    remaining -= penaltyPaid;

    const periodsPerYear = 365 / loan.repaymentFrequencyDays;
    const periodRate     = Number(loan.annualInterestRate) / 100 / periodsPerYear;
    const interest       = Math.min(remaining, Math.round(loan.balanceOutstanding * periodRate));
    remaining -= interest;
    const principal      = Math.min(remaining, loan.balanceOutstanding);

    const maxPayable = loan.penaltyAmount + Math.round(loan.balanceOutstanding * periodRate) + loan.balanceOutstanding;
    if (amount > maxPayable) {
      return badRequest(`Amount exceeds total owed. Maximum payment is RWF ${maxPayable.toLocaleString()}.`);
    }

    const newBalance         = Math.max(0, loan.balanceOutstanding - principal);
    const newPrincipalRepaid = loan.amountRepaidPrincipal + principal;
    const newInterestRepaid  = loan.amountRepaidInterest  + interest;
    const isFullyPaid        = newBalance === 0;

    // BNR: recalculate days overdue & class
    const daysOverdue = isFullyPaid ? 0 : loan.daysOverdue;
    const { loanClass, provisioningRate } = classifyLoan(daysOverdue);
    const provisionRequired = Math.round(newBalance * Number(provisioningRate) / 100);

    const payment = await prisma.$transaction(async (tx) => {
      // Credit company account balance
      const company = await tx.company.findUnique({
        where: { id: auth.companyId! },
        select: { accountBalance: true },
      });
      const balBefore = company?.accountBalance ?? 0;
      const balAfter  = balBefore + amount;
      await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: balAfter } });
      await tx.ledgerEntry.create({
        data: {
          companyId:     auth.companyId!,
          type:          "repayment",
          amount,
          balanceBefore: balBefore,
          balanceAfter:  balAfter,
          description:   `Loan repayment — ${loanId}`,
          referenceId:   loanId,
          createdById:   auth.userId,
        },
      });

      // Record payment
      const p = await tx.payment.create({
        data: {
          loanId,
          customerId: loan.customerId,
          amount,
          penalty:     penaltyPaid,
          interest,
          principal,
          date:        paymentDate,
          method,
          reference,
          notes,
          recordedById: auth.userId,
          companyId:    auth.companyId!,
        },
      });

      // Mark the earliest unpaid installment(s) as paid/partial
      let toAllocate = amount;
      const pendingInstallments = await tx.installment.findMany({
        where: { loanId, status: { in: ["pending", "partial", "overdue"] } },
        orderBy: { installmentNo: "asc" },
      });

      for (const inst of pendingInstallments) {
        if (toAllocate <= 0) break;
        const remaining = inst.totalDue - inst.amountPaid;
        const apply     = Math.min(toAllocate, remaining);
        const newPaid   = inst.amountPaid + apply;
        toAllocate     -= apply;

        await tx.installment.update({
          where: { id: inst.id },
          data: {
            amountPaid: newPaid,
            paidDate:   newPaid >= inst.totalDue ? paymentDate : null,
            status:     newPaid >= inst.totalDue ? "paid" : "partial",
          },
        });
      }

      // Update loan
      const newInstallmentsPaid = await tx.installment.count({
        where: { loanId, status: "paid" },
      });

      // Determine next payment date
      const nextInst = await tx.installment.findFirst({
        where: { loanId, status: { in: ["pending", "partial", "overdue"] } },
        orderBy: { installmentNo: "asc" },
      });

      await tx.loan.update({
        where: { id: loanId },
        data: {
          amountRepaidPrincipal: newPrincipalRepaid,
          amountRepaidInterest:  newInterestRepaid,
          balanceOutstanding:    newBalance,
          penaltyAmount:         loan.penaltyAmount - penaltyPaid,
          installmentsPaid:      newInstallmentsPaid,
          lastPaymentDate:       paymentDate,
          nextPaymentDate:       nextInst?.dueDate ?? null,
          nextPaymentAmount:     nextInst?.totalDue ?? 0,
          daysOverdue:           isFullyPaid ? 0 : daysOverdue,
          arrearsStartDate:      isFullyPaid ? null : loan.arrearsStartDate,
          loanClass,
          provisioningRate,
          provisionRequired,
          status:                isFullyPaid ? "completed" : "active",
        },
      });

      return p;
    });

    return created(payment);
  } catch (e: any) {
    if (e?.code === "P2002") return badRequest("A payment with this reference already exists.");
    console.error(e);
    return serverError();
  }
}
