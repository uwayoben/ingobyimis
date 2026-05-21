import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const createSchema = z.object({
  loanId:     z.string(),
  amount:     z.number().positive(),
  method:     z.enum(["cash", "bank_transfer", "mobile_money"]),
  reference:  z.string().min(1),
  notes:      z.string().optional(),
  date:       z.string().optional(),
  receiptUrl: z.string().url().optional(),
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
      const totalSchedInt       = loan.totalInterestScheduled > 0
        ? loan.totalInterestScheduled
        : loan.totalRepayable - loan.amount - (loan.totalMgmtFeeScheduled ?? 0);
      const remainingIntCheck   = Math.max(0, totalSchedInt - loan.amountRepaidInterest);
      const remainingMgmtCheck  = Math.max(0, (loan.totalMgmtFeeScheduled ?? 0) - (loan.amountRepaidMgmtFee ?? 0));
      const stillOwed = loan.balanceOutstanding + remainingIntCheck + remainingMgmtCheck + loan.penaltyAmount;
      if (stillOwed <= 0) {
        return badRequest("This loan is already fully paid.");
      }
    }

    const { amount, loanId, method, reference, notes, date, receiptUrl } = parsed.data;
    const paymentDate = date ? new Date(date) : new Date();

    // Auto-allocate waterfall: penalty → management fee → interest → principal
    let remaining     = amount;
    const penaltyPaid = Math.min(remaining, loan.penaltyAmount);
    remaining        -= penaltyPaid;

    const periodsPerYear     = 360 / loan.repaymentFrequencyDays;
    const periodRate         = Number(loan.annualInterestRate)    / 100 / periodsPerYear;
    const mgmtFeePeriodRate  = Number(loan.managementFeeRate ?? 0) / 100 / periodsPerYear;

    // Management fee tracking
    const totalMgmtFeeScheduled = loan.totalMgmtFeeScheduled ?? 0;
    const remainingMgmtFee      = Math.max(0, totalMgmtFeeScheduled - (loan.amountRepaidMgmtFee ?? 0));

    let currentMgmtFee: number;
    if (loan.interestMethod === "flat") {
      currentMgmtFee = Math.min(Math.round(loan.amount * mgmtFeePeriodRate), remainingMgmtFee);
    } else {
      const periodMgmtFee = loan.balanceOutstanding > 0
        ? Math.round(loan.balanceOutstanding * mgmtFeePeriodRate)
        : remainingMgmtFee;
      currentMgmtFee = Math.min(periodMgmtFee, remainingMgmtFee);
    }

    // Interest tracking — use stored schedule sum to avoid rounding drift vs totalMgmtFeeScheduled
    const totalScheduledInterest = loan.totalInterestScheduled > 0
      ? loan.totalInterestScheduled
      : loan.totalRepayable - loan.amount - totalMgmtFeeScheduled; // fallback for old rows
    const remainingInterest      = Math.max(0, totalScheduledInterest - loan.amountRepaidInterest);

    let currentInterest: number;
    if (loan.interestMethod === "flat") {
      currentInterest = Math.min(Math.round(loan.amount * periodRate), remainingInterest);
    } else {
      const periodInterest = loan.balanceOutstanding > 0
        ? Math.round(loan.balanceOutstanding * periodRate)
        : remainingInterest;
      currentInterest = Math.min(periodInterest, remainingInterest);
    }

    const maxPayable = loan.penaltyAmount + remainingMgmtFee + remainingInterest + loan.balanceOutstanding;
    if (amount > maxPayable) {
      return badRequest(`Amount exceeds total owed. Maximum payment is RWF ${maxPayable.toLocaleString()}.`);
    }

    const isPayoff = amount >= maxPayable;

    // Management fee
    const mgmtFeeToCredit = isPayoff ? remainingMgmtFee : currentMgmtFee;
    const mgmtFeePaid = Math.min(remaining, mgmtFeeToCredit);
    remaining        -= mgmtFeePaid;

    // Interest
    const interestToCredit = isPayoff ? remainingInterest : currentInterest;
    const interest  = Math.min(remaining, interestToCredit);
    remaining      -= interest;

    // Principal
    const principal = Math.min(remaining, loan.balanceOutstanding);

    const newBalance         = Math.max(0, loan.balanceOutstanding - principal);
    const newPrincipalRepaid = loan.amountRepaidPrincipal + principal;
    const newInterestRepaid  = loan.amountRepaidInterest  + interest;
    const newMgmtFeeRepaid   = (loan.amountRepaidMgmtFee ?? 0) + mgmtFeePaid;
    const newPenaltyAmount   = loan.penaltyAmount - penaltyPaid;

    const remainingInterestAfter = Math.max(0, totalScheduledInterest - newInterestRepaid);
    const remainingMgmtFeeAfter  = Math.max(0, totalMgmtFeeScheduled  - newMgmtFeeRepaid);
    const isFullyPaid = newBalance === 0 && newPenaltyAmount === 0 && remainingInterestAfter === 0 && remainingMgmtFeeAfter === 0;

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
          penalty:       penaltyPaid,
          managementFee: mgmtFeePaid,
          interest,
          principal,
          date:        paymentDate,
          method,
          reference,
          notes,
          receiptUrl,
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
          amountRepaidMgmtFee:   newMgmtFeeRepaid,
          balanceOutstanding:    newBalance,
          penaltyAmount:         newPenaltyAmount,
          penaltyPaid:           { increment: penaltyPaid },
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
