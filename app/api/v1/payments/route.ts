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
    // Also allow "completed" status here in case the loan was prematurely closed
    // but still has outstanding balance, penalty, or flat-rate interest.
    if (!["active", "overdue", "disbursed", "completed"].includes(loan.status)) {
      return badRequest("Payments can only be recorded on active or overdue loans.");
    }
    if (loan.status === "completed") {
      const periodsPerYearCheck = 365 / loan.repaymentFrequencyDays;
      const periodRateCheck     = Number(loan.annualInterestRate) / 100 / periodsPerYearCheck;
      const stillOwed =
        loan.balanceOutstanding +
        (loan.interestMethod === "flat"
          ? Math.max(0, (loan.totalRepayable - loan.amount) - loan.amountRepaidInterest)
          : Math.round(loan.balanceOutstanding * periodRateCheck)) +
        loan.penaltyAmount;
      if (stillOwed <= 0) {
        return badRequest("This loan is already fully paid.");
      }
    }

    const { amount, loanId, method, reference, notes, date } = parsed.data;
    const paymentDate = date ? new Date(date) : new Date();

    // Auto-allocate: penalty → interest → principal
    let remaining     = amount;
    const penaltyPaid = Math.min(remaining, loan.penaltyAmount);
    remaining        -= penaltyPaid;

    const periodsPerYear = 365 / loan.repaymentFrequencyDays;
    const periodRate     = Number(loan.annualInterestRate) / 100 / periodsPerYear;

    // For flat rate: each period's interest is fixed on the ORIGINAL principal.
    // For declining balance: interest accrues on the remaining balance.
    let currentInterest: number;
    let maxInterest: number;
    if (loan.interestMethod === "flat") {
      const totalFlatInterest     = loan.totalRepayable - loan.amount;
      const remainingFlatInterest = Math.max(0, totalFlatInterest - loan.amountRepaidInterest);
      const perPeriodInterest     = Math.round(loan.amount * periodRate);
      currentInterest = Math.min(perPeriodInterest, remainingFlatInterest);
      maxInterest     = remainingFlatInterest;
    } else {
      currentInterest = Math.round(loan.balanceOutstanding * periodRate);
      maxInterest     = currentInterest;
    }

    // For flat-rate payoffs: when the payment covers all remaining (balance + all interest + penalty),
    // credit the full remaining interest — not just one period — so the loan can close.
    const isPayoff = amount >= (loan.penaltyAmount + maxInterest + loan.balanceOutstanding);
    const interestToCredit = (loan.interestMethod === "flat" && isPayoff) ? maxInterest : currentInterest;
    const interest  = Math.min(remaining, interestToCredit);
    remaining      -= interest;
    const principal = Math.min(remaining, loan.balanceOutstanding);

    const maxPayable = loan.penaltyAmount + maxInterest + loan.balanceOutstanding;
    if (amount > maxPayable) {
      return badRequest(`Amount exceeds total owed. Maximum payment is RWF ${maxPayable.toLocaleString()}.`);
    }

    const newBalance         = Math.max(0, loan.balanceOutstanding - principal);
    const newPrincipalRepaid = loan.amountRepaidPrincipal + principal;
    const newInterestRepaid  = loan.amountRepaidInterest  + interest;
    const newPenaltyAmount   = loan.penaltyAmount - penaltyPaid;

    // Flat-rate interest is contractually fixed — must all be paid before closing.
    // Declining-balance interest accrues only on remaining principal, so when
    // balance = 0 no more interest accrues and the loan can close.
    const remainingFlatInterest =
      loan.interestMethod === "flat"
        ? Math.max(0, (loan.totalRepayable - loan.amount) - newInterestRepaid)
        : 0;

    const isFullyPaid =
      newBalance === 0 && newPenaltyAmount === 0 && remainingFlatInterest === 0;

    // Classification is determined inside the transaction after we know which
    // installments remain overdue post-payment (computed below).

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

      // For lump-sum payoffs (e.g. declining-balance early payoff), the payment amount may be
      // less than the sum of scheduled installment totals because the schedule assumed per-period
      // interest on a higher balance. Force-mark any stragglers so the schedule shows fully paid.
      if (isFullyPaid) {
        await tx.installment.updateMany({
          where: { loanId, status: { in: ["pending", "partial", "overdue"] } },
          data:  { status: "paid", paidDate: paymentDate },
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

      // Check if any overdue installments remain after this payment.
      // If none remain (but loan not yet fully paid), the borrower has caught up
      // and the loan should revert to Normal / active.
      const stillOverdueCount = await tx.installment.count({
        where: { loanId, status: "overdue" },
      });
      const caughtUp = !isFullyPaid && stillOverdueCount === 0;

      const effectiveDaysOverdue = isFullyPaid || caughtUp ? 0 : loan.daysOverdue;
      const { loanClass, provisioningRate } = classifyLoan(effectiveDaysOverdue);
      const provisionRequired = Math.round(newBalance * Number(provisioningRate) / 100);

      await tx.loan.update({
        where: { id: loanId },
        data: {
          amountRepaidPrincipal: newPrincipalRepaid,
          amountRepaidInterest:  newInterestRepaid,
          balanceOutstanding:    newBalance,
          penaltyAmount:         newPenaltyAmount,
          installmentsPaid:      newInstallmentsPaid,
          lastPaymentDate:       paymentDate,
          nextPaymentDate:       nextInst?.dueDate ?? null,
          nextPaymentAmount:     nextInst?.totalDue ?? 0,
          daysOverdue:           effectiveDaysOverdue,
          arrearsStartDate:      isFullyPaid || caughtUp ? null : loan.arrearsStartDate,
          loanClass,
          provisioningRate,
          provisionRequired,
          // Reset lastPenaltyCalculatedAt so the penalty counter restarts cleanly
          ...(caughtUp && { lastPenaltyCalculatedAt: null }),
          status: isFullyPaid ? "completed" : caughtUp ? "active" : "overdue",
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
