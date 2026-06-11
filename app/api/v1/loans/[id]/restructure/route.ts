import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const schema = z.object({
  newAnnualInterestRate: z.number().positive(),
  newTotalInstallments:  z.number().int().positive(),
  newFirstPaymentDate:   z.string().min(1),
  newMgmtFeeRate:        z.number().min(0).default(0),   // annual %
  newProcFeeRate:        z.number().min(0).default(0),   // annual %
  newPrincipalOverride:  z.number().int().positive().optional(), // allow officer to adjust
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer", "super_admin"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const { id } = await params;
    const body   = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const d = parsed.data;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!loan) return notFound("Loan not found.");
    if (!["active", "overdue", "approved", "disbursed"].includes(loan.status)) {
      return badRequest("Only active loans can be restructured.");
    }

    // ── Calculate combined new principal ──────────────────────────────────
    const totalMgmtFeeScheduled = loan.totalMgmtFeeScheduled ?? 0;
    const totalProcFeeScheduled = (loan as any).totalProcessingFeeScheduled ?? 0;
    const totalInterestScheduled = loan.totalInterestScheduled > 0
      ? loan.totalInterestScheduled
      : loan.totalRepayable - loan.amount - totalMgmtFeeScheduled - totalProcFeeScheduled;
    const remainingInterest  = Math.max(0, totalInterestScheduled - loan.amountRepaidInterest);
    const remainingMgmtFee   = Math.max(0, totalMgmtFeeScheduled  - (loan.amountRepaidMgmtFee ?? 0));
    const remainingProcFee   = Math.max(0, totalProcFeeScheduled   - ((loan as any).amountRepaidProcessingFee ?? 0));
    const additionalInterest = (loan as any).additionalInterest ?? 0;
    const additionalMgmtFee  = (loan as any).additionalMgmtFee  ?? 0;
    const additionalProcFee  = (loan as any).additionalProcessingFee ?? 0;

    const combinedPrincipal = d.newPrincipalOverride ?? Math.round(
      loan.balanceOutstanding +
      remainingInterest + additionalInterest +
      remainingMgmtFee  + additionalMgmtFee  +
      remainingProcFee  + additionalProcFee  +
      loan.penaltyAmount
    );

    if (combinedPrincipal <= 0) return badRequest("Computed new principal is zero.");

    const n                  = d.newTotalInstallments;
    const newFirstPaymentDate = new Date(d.newFirstPaymentDate);
    const effectiveRate       = d.newAnnualInterestRate;
    const effectiveMgmtRate   = d.newMgmtFeeRate;
    const effectiveProcRate   = d.newProcFeeRate;

    const periodsPerYear      = 360 / loan.repaymentFrequencyDays;
    const interestPeriodRate  = effectiveRate     / 100 / periodsPerYear;
    const mgmtFeePeriodRate   = effectiveMgmtRate / 100 / periodsPerYear;
    const procFeePeriodRate   = effectiveProcRate / 100 / periodsPerYear;
    const combinedRate        = interestPeriodRate + mgmtFeePeriodRate + procFeePeriodRate;

    let newTotalRepayable: number;
    let newInstallmentAmount: number;
    if (loan.interestMethod === "flat") {
      const totalInterest = combinedPrincipal * interestPeriodRate * n;
      const totalMgmt     = combinedPrincipal * mgmtFeePeriodRate  * n;
      const totalProc     = combinedPrincipal * procFeePeriodRate  * n;
      newTotalRepayable    = Math.round(combinedPrincipal + totalInterest + totalMgmt + totalProc);
      newInstallmentAmount = Math.round(newTotalRepayable / n);
    } else {
      const exactEmi       = combinedRate === 0
        ? combinedPrincipal / n
        : (combinedPrincipal * combinedRate) / (1 - Math.pow(1 + combinedRate, -n));
      newInstallmentAmount = Math.round(exactEmi);
      newTotalRepayable    = Math.round(exactEmi * n);
    }

    const newMaturityDate = new Date(newFirstPaymentDate);
    newMaturityDate.setDate(newMaturityDate.getDate() + (n - 1) * loan.repaymentFrequencyDays);

    const newSchedule = generateSchedule(
      combinedPrincipal, effectiveRate, loan.interestMethod, n,
      newFirstPaymentDate, loan.repaymentFrequencyDays, effectiveMgmtRate, effectiveProcRate,
      0, (loan as any).bulletRepayment ?? false,
    );
    const newTotalMgmtFeeScheduled       = newSchedule.reduce((s, r) => s + r.managementFeeDue, 0);
    const newTotalProcessingFeeScheduled = newSchedule.reduce((s, r) => s + r.processingFeeDue, 0);
    const newTotalInterestScheduled      = newSchedule.reduce((s, r) => s + r.interestDue, 0);

    const { loanClass, provisioningRate } = classifyLoan(0);
    const provisionRequired = Math.round(combinedPrincipal * provisioningRate / 100);

    // ── Generate new loan ID ───────────────────────────────────────────────
    const company = await prisma.company.findUnique({
      where: { id: auth.companyId! }, select: { name: true },
    });
    const prefix   = (company?.name ?? "XX").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    const existing = await prisma.loan.findMany({
      where: { companyId: auth.companyId!, id: { startsWith: `${prefix}-` } },
      select: { id: true },
    });
    const maxSeq   = existing.reduce((max, l) => {
      const n = parseInt(l.id.replace(`${prefix}-`, ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const newLoanId = `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`;

    const newLoan = await prisma.$transaction(async (tx) => {
      // 1. Close old loan — mark completed, zero balances
      await tx.installment.updateMany({
        where: { loanId: id, status: { in: ["pending", "overdue", "partial"] } },
        data:  { status: "paid", amountPaid: 0 },
      });
      await tx.loan.update({
        where: { id },
        data: {
          status:             "completed",
          balanceOutstanding: 0,
          penaltyAmount:      0,
          daysOverdue:        0,
          arrearsStartDate:   null,
          isRestructured:     true,
          additionalInterest:      0,
          additionalMgmtFee:       0,
          additionalProcessingFee: 0,
        },
      });

      // 2. Create new restructured loan — fresh start
      const restructuredLoan = await tx.loan.create({
        data: {
          id:                    newLoanId,
          companyId:             auth.companyId!,
          customerId:            loan.customerId,
          loanOfficerId:         auth.userId,
          branchName:            loan.branchName,
          purpose:               `Restructured from ${id.toUpperCase()}`,
          amount:                combinedPrincipal,
          disbursedAmount:       combinedPrincipal,
          disbursementDate:      new Date(),
          annualInterestRate:    effectiveRate,
          interestMethod:        loan.interestMethod,
          repaymentFrequencyDays: loan.repaymentFrequencyDays,
          gracePeriodDays:       0,
          firstPaymentDate:      newFirstPaymentDate,
          agreedMaturityDate:    newMaturityDate,
          totalInstallments:     n,
          totalRepayable:        newTotalRepayable,
          balanceOutstanding:    combinedPrincipal,
          nextPaymentDate:       newFirstPaymentDate,
          nextPaymentAmount:     newInstallmentAmount,
          managementFeeRate:     effectiveMgmtRate,
          processingFeeRate:     effectiveProcRate,
          totalInterestScheduled:      newTotalInterestScheduled,
          totalMgmtFeeScheduled:       newTotalMgmtFeeScheduled,
          totalProcessingFeeScheduled: newTotalProcessingFeeScheduled,
          penaltyRatePerDay:     Number((loan as any).penaltyRatePerDay ?? 0),
          isRestructured:        true,
          status:                "active",
          loanClass,
          provisioningRate,
          provisionRequired,
        },
      });

      // 3. Fresh installment schedule on new loan
      await tx.installment.createMany({
        data: newSchedule.map((row, i) => ({
          loanId:           newLoanId,
          installmentNo:    i + 1,
          dueDate:          row.dueDate,
          principalDue:     row.principalDue,
          interestDue:      row.interestDue,
          managementFeeDue: row.managementFeeDue,
          processingFeeDue: row.processingFeeDue,
          totalDue:         row.totalDue,
        })),
      });

      // 4. Notify
      await tx.notification.create({
        data: {
          type:      "approval_needed",
          title:     "Loan Restructured",
          message:   `Overdue loan ${id.toUpperCase()} restructured into ${newLoanId.toUpperCase()} with new principal RWF ${combinedPrincipal.toLocaleString()}.`,
          companyId: auth.companyId!,
          link:      `/loans/${newLoanId}`,
        },
      });

      return restructuredLoan;
    });

    return created({
      ...newLoan,
      originalLoanId:     id,
      combinedPrincipal,
      annualInterestRate: Number(newLoan.annualInterestRate),
      provisioningRate:   Number(newLoan.provisioningRate),
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
