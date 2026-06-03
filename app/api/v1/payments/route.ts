import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const manualAllocationSchema = z.object({
  penalty:                z.number().min(0).default(0),
  additionalInterest:     z.number().min(0).default(0),
  additionalMgmtFee:      z.number().min(0).default(0),
  additionalProcessingFee:z.number().min(0).default(0),
  managementFee:          z.number().min(0).default(0),
  processingFee:          z.number().min(0).default(0),
  interest:               z.number().min(0).default(0),
  principal:              z.number().min(0).default(0),
});

const createSchema = z.object({
  loanId:                z.string(),
  amount:                z.number().positive(),
  method:                z.enum(["cash", "bank_transfer", "mobile_money"]),
  reference:             z.string().optional(),
  notes:                 z.string().optional(),
  date:                  z.string().optional(),
  receiptUrl:            z.string().url().optional(),
  manualAllocation:      manualAllocationSchema.optional(),
  earlySettlementWaiver:    z.boolean().optional(),
  waivedInterestAmount:     z.number().min(0).optional(),
  waivedMgmtFeeAmount:      z.number().min(0).optional(),
  waivedProcFeeAmount:      z.number().min(0).optional(),
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

    const isSuperAdmin = auth.role === "super_admin";

    const where = {
      ...(isSuperAdmin ? {} : { companyId: auth.companyId! }),
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
    if (!["managing_director", "loan_officer", "receptionist", "super_admin"].includes(auth.role)) return forbidden();
    const isSuperAdminPost = auth.role === "super_admin";
    if (!isSuperAdminPost && !auth.companyId) return forbidden("Company context required.");

    const body   = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const loan = await prisma.loan.findFirst({
      where: isSuperAdminPost
        ? { id: parsed.data.loanId }
        : { id: parsed.data.loanId, companyId: auth.companyId! },
    });
    if (!loan) return notFound("Loan not found.");
    // Also allow "completed" status here in case the loan was prematurely closed
    // but still has outstanding balance, penalty, or flat-rate interest.
    if (!["active", "overdue", "disbursed", "completed"].includes(loan.status)) {
      return badRequest("Payments can only be recorded on active or overdue loans.");
    }
    if (loan.status === "completed") {
      const totalSchedInt         = loan.totalInterestScheduled > 0
        ? loan.totalInterestScheduled
        : loan.totalRepayable - loan.amount - (loan.totalMgmtFeeScheduled ?? 0) - ((loan as any).totalProcessingFeeScheduled ?? 0);
      const remainingIntCheck     = Math.max(0, totalSchedInt - loan.amountRepaidInterest);
      const remainingMgmtCheck    = Math.max(0, (loan.totalMgmtFeeScheduled ?? 0) - (loan.amountRepaidMgmtFee ?? 0));
      const remainingProcCheck    = Math.max(0, ((loan as any).totalProcessingFeeScheduled ?? 0) - ((loan as any).amountRepaidProcessingFee ?? 0));
      const stillOwed = loan.balanceOutstanding + remainingIntCheck + remainingMgmtCheck + remainingProcCheck + loan.penaltyAmount + ((loan as any).additionalInterest ?? 0) + ((loan as any).additionalMgmtFee ?? 0) + ((loan as any).additionalProcessingFee ?? 0);
      if (stillOwed <= 0) {
        return badRequest("This loan is already fully paid.");
      }
    }

    const { amount, loanId, method, notes, date, receiptUrl, manualAllocation,
            earlySettlementWaiver, waivedInterestAmount,
            waivedMgmtFeeAmount, waivedProcFeeAmount } = parsed.data;
    const reference = parsed.data.reference?.trim() || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const paymentDate = date ? new Date(date) : new Date();

    const loanAdditionalInt  = (loan as any).additionalInterest      ?? 0;
    const loanAdditionalMgmt = (loan as any).additionalMgmtFee       ?? 0;
    const loanAdditionalProc = (loan as any).additionalProcessingFee ?? 0;

    const periodsPerYear     = 360 / loan.repaymentFrequencyDays;
    const periodRate         = Number(loan.annualInterestRate)             / 100 / periodsPerYear;
    const mgmtFeePeriodRate  = Number(loan.managementFeeRate ?? 0)         / 100 / periodsPerYear;
    const procFeePeriodRate  = Number((loan as any).processingFeeRate ?? 0) / 100 / periodsPerYear;

    const totalProcFeeScheduled  = (loan as any).totalProcessingFeeScheduled ?? 0;
    const remainingProcFee       = Math.max(0, totalProcFeeScheduled - ((loan as any).amountRepaidProcessingFee ?? 0));
    const totalMgmtFeeScheduled  = loan.totalMgmtFeeScheduled ?? 0;
    const remainingMgmtFee       = Math.max(0, totalMgmtFeeScheduled - (loan.amountRepaidMgmtFee ?? 0));
    const totalScheduledInterest = loan.totalInterestScheduled > 0
      ? loan.totalInterestScheduled
      : loan.totalRepayable - loan.amount - totalMgmtFeeScheduled - totalProcFeeScheduled;
    const remainingInterestFull  = Math.max(0, totalScheduledInterest - loan.amountRepaidInterest);

    const waivedAmt     = earlySettlementWaiver ? Math.min(waivedInterestAmount  ?? remainingInterestFull, remainingInterestFull) : 0;
    const waivedMgmtAmt = earlySettlementWaiver ? Math.min(waivedMgmtFeeAmount   ?? 0,                     remainingMgmtFee)       : 0;
    const waivedProcAmt = earlySettlementWaiver ? Math.min(waivedProcFeeAmount   ?? 0,                     remainingProcFee)       : 0;
    const totalWaived   = waivedAmt + waivedMgmtAmt + waivedProcAmt;

    // maxPayable = full outstanding (waivers write off scheduled amounts, not reduce what's owed now)
    const maxPayable = loan.penaltyAmount + loanAdditionalInt + loanAdditionalMgmt + loanAdditionalProc + remainingProcFee + remainingMgmtFee + remainingInterestFull + loan.balanceOutstanding;

    // What the borrower actually needs to pay = outstanding minus all waived portions
    const maxRequired = maxPayable - totalWaived;
    if (amount > maxRequired) {
      return badRequest(`Amount exceeds what is required. Maximum payment is RWF ${maxRequired.toLocaleString()}${totalWaived > 0 ? ` (RWF ${totalWaived.toLocaleString()} is being waived)` : ""}.`);
    }

    // For allocation, each bucket = full remaining minus its waived portion
    const remainingInterest = remainingInterestFull - waivedAmt;
    const remainingMgmtFeeNet = remainingMgmtFee - waivedMgmtAmt;
    const remainingProcFeeNet = remainingProcFee  - waivedProcAmt;

    let penaltyPaid: number;
    let additionalIntPaid: number;
    let additionalMgmtPaid: number;
    let additionalProcPaid: number;
    let mgmtFeePaid: number;
    let procFeePaid: number;
    let interest: number;
    let principal: number;

    if (manualAllocation) {
      // Manual mode — validate each bucket doesn't exceed what's owed
      if (manualAllocation.penalty > loan.penaltyAmount)
        return badRequest(`Penalty allocation (${manualAllocation.penalty}) exceeds outstanding penalty (${loan.penaltyAmount}).`);
      if (manualAllocation.additionalInterest > loanAdditionalInt)
        return badRequest(`Additional interest allocation exceeds outstanding amount.`);
      if (manualAllocation.additionalMgmtFee > loanAdditionalMgmt)
        return badRequest(`Additional management fee allocation exceeds outstanding amount.`);
      if (manualAllocation.additionalProcessingFee > loanAdditionalProc)
        return badRequest(`Additional processing fee allocation exceeds outstanding amount.`);
      if (manualAllocation.managementFee > remainingMgmtFeeNet)
        return badRequest(`Management fee allocation (RWF ${manualAllocation.managementFee.toLocaleString()}) exceeds remaining after waiver (RWF ${remainingMgmtFeeNet.toLocaleString()}).`);
      if (manualAllocation.processingFee > remainingProcFeeNet)
        return badRequest(`Processing fee allocation (RWF ${manualAllocation.processingFee.toLocaleString()}) exceeds remaining after waiver (RWF ${remainingProcFeeNet.toLocaleString()}).`);
      if (waivedMgmtAmt > 0 && manualAllocation.managementFee + waivedMgmtAmt > remainingMgmtFee)
        return badRequest(`Management fee paid plus waived exceeds remaining scheduled management fee.`);
      if (waivedProcAmt > 0 && manualAllocation.processingFee + waivedProcAmt > remainingProcFee)
        return badRequest(`Processing fee paid plus waived exceeds remaining scheduled processing fee.`);
      if (manualAllocation.interest > remainingInterestFull)
        return badRequest(`Interest allocation (RWF ${manualAllocation.interest.toLocaleString()}) exceeds remaining interest (RWF ${remainingInterestFull.toLocaleString()}).`);
      if (waivedAmt > 0 && manualAllocation.interest + waivedAmt > remainingInterestFull)
        return badRequest(`Interest paid (${manualAllocation.interest.toLocaleString()}) plus waived (${waivedAmt.toLocaleString()}) exceeds remaining interest (${remainingInterestFull.toLocaleString()}).`);
      if (manualAllocation.principal > loan.balanceOutstanding)
        return badRequest(`Principal allocation exceeds outstanding balance.`);

      const manualTotal = manualAllocation.penalty + manualAllocation.additionalInterest +
        manualAllocation.additionalMgmtFee + manualAllocation.additionalProcessingFee +
        manualAllocation.managementFee + manualAllocation.processingFee +
        manualAllocation.interest + manualAllocation.principal;
      if (Math.abs(manualTotal - amount) > 1)
        return badRequest(`Manual allocation total (${manualTotal}) does not match payment amount (${amount}).`);

      penaltyPaid        = manualAllocation.penalty;
      additionalIntPaid  = manualAllocation.additionalInterest;
      additionalMgmtPaid = manualAllocation.additionalMgmtFee;
      additionalProcPaid = manualAllocation.additionalProcessingFee;
      mgmtFeePaid        = manualAllocation.managementFee;
      procFeePaid        = manualAllocation.processingFee;
      interest           = manualAllocation.interest;
      principal          = manualAllocation.principal;
    } else {
      // Auto waterfall: penalty → additional interest → additional mgmt → additional proc → mgmt fee → proc fee → interest → principal
      let remaining     = amount;
      penaltyPaid        = Math.min(remaining, loan.penaltyAmount);          remaining -= penaltyPaid;
      additionalIntPaid  = Math.min(remaining, loanAdditionalInt);           remaining -= additionalIntPaid;
      additionalMgmtPaid = Math.min(remaining, loanAdditionalMgmt);         remaining -= additionalMgmtPaid;
      additionalProcPaid = Math.min(remaining, loanAdditionalProc);         remaining -= additionalProcPaid;

      const isPayoff = amount >= maxPayable;

      let currentMgmtFee: number;
      if (loan.interestMethod === "flat") {
        currentMgmtFee = Math.min(Math.round(loan.amount * mgmtFeePeriodRate), remainingMgmtFee);
      } else {
        const periodMgmtFee = loan.balanceOutstanding > 0 ? Math.round(loan.balanceOutstanding * mgmtFeePeriodRate) : remainingMgmtFee;
        currentMgmtFee = Math.min(periodMgmtFee, remainingMgmtFee);
      }

      let currentProcFee: number;
      if (loan.interestMethod === "flat") {
        currentProcFee = Math.min(Math.round(loan.amount * procFeePeriodRate), remainingProcFee);
      } else {
        const periodProcFee = loan.balanceOutstanding > 0 ? Math.round(loan.balanceOutstanding * procFeePeriodRate) : remainingProcFee;
        currentProcFee = Math.min(periodProcFee, remainingProcFee);
      }

      let currentInterest: number;
      if (loan.interestMethod === "flat") {
        currentInterest = Math.min(Math.round(loan.amount * periodRate), remainingInterest);
      } else {
        const periodInterest = loan.balanceOutstanding > 0 ? Math.round(loan.balanceOutstanding * periodRate) : remainingInterest;
        currentInterest = Math.min(periodInterest, remainingInterest);
      }

      mgmtFeePaid = Math.min(remaining, isPayoff ? remainingMgmtFeeNet : currentMgmtFee); remaining -= mgmtFeePaid;
      procFeePaid = Math.min(remaining, isPayoff ? remainingProcFeeNet : currentProcFee);  remaining -= procFeePaid;
      interest    = Math.min(remaining, isPayoff ? remainingInterest   : currentInterest); remaining -= interest;
      principal   = Math.min(remaining, loan.balanceOutstanding);
    }

    const newBalance             = Math.max(0, loan.balanceOutstanding - principal);
    const newPrincipalRepaid     = loan.amountRepaidPrincipal + principal;
    const newInterestRepaid      = loan.amountRepaidInterest  + interest;
    const newMgmtFeeRepaid       = (loan.amountRepaidMgmtFee ?? 0) + mgmtFeePaid;
    const newProcFeeRepaid       = ((loan as any).amountRepaidProcessingFee ?? 0) + procFeePaid;
    const newPenaltyAmount       = loan.penaltyAmount - penaltyPaid;
    const newAdditionalInterest  = Math.max(0, loanAdditionalInt  - additionalIntPaid);
    const newAdditionalMgmt      = Math.max(0, loanAdditionalMgmt - additionalMgmtPaid);
    const newAdditionalProc      = Math.max(0, loanAdditionalProc - additionalProcPaid);

    const remainingInterestAfter = Math.max(0, totalScheduledInterest - newInterestRepaid - waivedAmt);
    const remainingMgmtFeeAfter  = Math.max(0, totalMgmtFeeScheduled  - newMgmtFeeRepaid  - waivedMgmtAmt);
    const remainingProcFeeAfter  = Math.max(0, totalProcFeeScheduled   - newProcFeeRepaid  - waivedProcAmt);
    const isFullyPaid = newBalance === 0 && newPenaltyAmount === 0 && newAdditionalInterest === 0 && newAdditionalMgmt === 0 && newAdditionalProc === 0 && remainingInterestAfter === 0 && remainingMgmtFeeAfter === 0 && remainingProcFeeAfter === 0;

    // Classification is determined inside the transaction after we know which
    // installments remain overdue post-payment (computed below).

    const effectiveCompanyId = auth.companyId ?? loan.companyId;

    const payment = await prisma.$transaction(async (tx) => {
      // Credit company account balance
      const company = await tx.company.findUnique({
        where: { id: effectiveCompanyId },
        select: { accountBalance: true },
      });
      const balBefore = company?.accountBalance ?? 0;
      const balAfter  = balBefore + amount;
      await tx.company.update({ where: { id: effectiveCompanyId }, data: { accountBalance: balAfter } });
      await tx.ledgerEntry.create({
        data: {
          companyId:     effectiveCompanyId,
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
          penalty:                penaltyPaid,
          additionalInterest:     additionalIntPaid,
          additionalMgmtFee:      additionalMgmtPaid,
          additionalProcessingFee: additionalProcPaid,
          managementFee:          mgmtFeePaid,
          processingFee:          procFeePaid,
          interest,
          principal,
          date:        paymentDate,
          method,
          reference,
          notes,
          receiptUrl,
          recordedById: auth.userId,
          companyId:    effectiveCompanyId,
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
          amountRepaidPrincipal:    newPrincipalRepaid,
          amountRepaidInterest:     newInterestRepaid,
          amountRepaidMgmtFee:      newMgmtFeeRepaid,
          amountRepaidProcessingFee: newProcFeeRepaid,
          balanceOutstanding:    newBalance,
          penaltyAmount:         newPenaltyAmount,
          penaltyPaid:           { increment: penaltyPaid },
          additionalInterest:         newAdditionalInterest,
          additionalInterestPaid:     { increment: additionalIntPaid },
          additionalMgmtFee:          newAdditionalMgmt,
          additionalMgmtFeePaid:      { increment: additionalMgmtPaid },
          additionalProcessingFee:    newAdditionalProc,
          additionalProcessingFeePaid: { increment: additionalProcPaid },
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
          // Early settlement: reduce scheduled totals so remaining = 0 for waived portions
          ...(waivedAmt     > 0 && { totalInterestScheduled:       { decrement: waivedAmt     } }),
          ...(waivedMgmtAmt > 0 && { totalMgmtFeeScheduled:        { decrement: waivedMgmtAmt } }),
          ...(waivedProcAmt > 0 && { totalProcessingFeeScheduled:  { decrement: waivedProcAmt } }),
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
