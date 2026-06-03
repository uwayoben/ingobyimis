import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const topUpSchema = z.object({
  topUpType:             z.enum(["addon", "refinance"]),
  topUpAmount:           z.number().int().positive(),
  newTotalInstallments:  z.number().int().positive(),
  newFirstPaymentDate:   z.string().min(1),
  newAnnualInterestRate: z.number().positive().optional(),
  // Optional fee on this top-up
  feeType:               z.enum(["none", "per_installment", "one_time"]).default("none"),
  feeRate:               z.number().min(0).optional(), // annual % rate (for per_installment)
  feeAmount:             z.number().int().min(0).optional(), // fixed RWF total (for one_time)
  feeLabel:              z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer", "super_admin"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const { id } = await params;
    const body = await request.json();
    const parsed = topUpSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const d = parsed.data;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!loan) return notFound("Loan not found.");
    if (!["active", "overdue"].includes(loan.status)) {
      return badRequest("Only active or overdue loans can be topped up.");
    }
    if (loan.balanceOutstanding <= 0) {
      return badRequest("This loan has no outstanding balance to top up.");
    }

    const effectiveRate         = d.newAnnualInterestRate ?? Number(loan.annualInterestRate);
    const outstandingPrincipal  = loan.balanceOutstanding;
    const newFirstPaymentDate   = new Date(d.newFirstPaymentDate);
    const n                     = d.newTotalInstallments;

    // ── Fee resolution ──
    // per_installment: feeRate (annual %) gets added to managementFeeRate for the schedule
    // one_time:        feeAmount (fixed RWF) split equally across installments
    const effectiveMgmtFeeRate = Number(loan.managementFeeRate ?? 0) +
      (d.feeType === "per_installment" ? (d.feeRate ?? 0) : 0);
    const effectiveProcFeeRate = Number((loan as any).processingFeeRate ?? 0);
    const oneTimeFeeTotal      = d.feeType === "one_time" ? (d.feeAmount ?? 0) : 0;

    const periodsPerYear     = 360 / loan.repaymentFrequencyDays;
    const interestPeriodRate = effectiveRate        / 100 / periodsPerYear;
    const mgmtFeePeriodRate  = effectiveMgmtFeeRate / 100 / periodsPerYear;
    const procFeePeriodRate  = effectiveProcFeeRate / 100 / periodsPerYear;
    const periodRate         = interestPeriodRate + mgmtFeePeriodRate + procFeePeriodRate;

    const newPrincipal = d.topUpType === "addon"
      ? outstandingPrincipal + d.topUpAmount
      : d.topUpAmount;

    const cashDisbursed = d.topUpType === "addon"
      ? d.topUpAmount
      : Math.max(0, d.topUpAmount - outstandingPrincipal);

    if (d.topUpType === "refinance" && d.topUpAmount < outstandingPrincipal) {
      return badRequest(
        `Refinance amount (RWF ${d.topUpAmount.toLocaleString()}) must be at least the outstanding balance (RWF ${outstandingPrincipal.toLocaleString()}).`
      );
    }

    // Recalculate repayment figures on newPrincipal
    let newTotalRepayable: number;
    let newInstallmentAmount: number;
    if (loan.interestMethod === "flat") {
      const totalInterest = newPrincipal * interestPeriodRate * n;
      const totalMgmtFee  = newPrincipal * mgmtFeePeriodRate  * n;
      const totalProcFee  = newPrincipal * procFeePeriodRate  * n;
      newTotalRepayable    = Math.round(newPrincipal + totalInterest + totalMgmtFee + totalProcFee + oneTimeFeeTotal);
      newInstallmentAmount = Math.round(newTotalRepayable / n);
    } else {
      const exactEmi       = periodRate === 0
        ? newPrincipal / n
        : (newPrincipal * periodRate) / (1 - Math.pow(1 + periodRate, -n));
      newInstallmentAmount = Math.round(exactEmi + oneTimeFeeTotal / n);
      newTotalRepayable    = Math.round(newInstallmentAmount * n);
    }

    const newMaturityDate = new Date(newFirstPaymentDate);
    newMaturityDate.setDate(newMaturityDate.getDate() + (n - 1) * loan.repaymentFrequencyDays);

    const newSchedule = generateSchedule(
      newPrincipal,
      effectiveRate,
      loan.interestMethod,
      n,
      newFirstPaymentDate,
      loan.repaymentFrequencyDays,
      effectiveMgmtFeeRate,
      effectiveProcFeeRate,
      oneTimeFeeTotal,
    );
    const newTotalMgmtFeeScheduled       = newSchedule.reduce((s, r) => s + r.managementFeeDue, 0);
    const newTotalProcessingFeeScheduled = newSchedule.reduce((s, r) => s + r.processingFeeDue, 0);
    const newTotalInterestScheduled      = newSchedule.reduce((s, r) => s + r.interestDue, 0);

    const { loanClass, provisioningRate } = classifyLoan(0);
    const provisionRequired = Math.round(newPrincipal * provisioningRate / 100);

    // ── ADDON: update the existing loan in-place ────────────────────────────
    if (d.topUpType === "addon") {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.installment.deleteMany({ where: { loanId: id, status: { in: ["pending", "overdue"] } } });
        await tx.installment.createMany({
          data: newSchedule.map((row, i) => ({
            loanId: id,
            installmentNo:    loan.installmentsPaid + i + 1,
            dueDate:          row.dueDate,
            principalDue:     row.principalDue,
            interestDue:      row.interestDue,
            managementFeeDue: row.managementFeeDue,
            processingFeeDue: row.processingFeeDue,
            totalDue:         row.totalDue,
          })),
        });

        const company = await tx.company.findUnique({
          where: { id: auth.companyId! }, select: { accountBalance: true },
        });
        const balBefore = company?.accountBalance ?? 0;
        const balAfter  = balBefore - cashDisbursed;
        if (cashDisbursed > 0) {
          await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: balAfter } });
          await tx.ledgerEntry.create({
            data: {
              companyId: auth.companyId!, type: "disbursement",
              amount: cashDisbursed, balanceBefore: balBefore, balanceAfter: balAfter,
              description: `Loan add-on top-up — ${id.slice(0, 8).toUpperCase()} (+RWF ${d.topUpAmount.toLocaleString()})`,
              referenceId: id, createdById: auth.userId,
            },
          });
        }

        // Save fee as LoanFee record if one-time
        if (d.feeType === "one_time" && oneTimeFeeTotal > 0) {
          await tx.loanFee.create({
            data: { loanId: id, name: d.feeLabel || "Top-up fee", type: "fixed", value: oneTimeFeeTotal, isRecurring: false },
          });
        }

        await tx.notification.create({
          data: {
            type: "disbursement", title: "Loan Add-on Top-up Processed",
            message: `Loan ${id.slice(0, 8).toUpperCase()} add-on: +RWF ${d.topUpAmount.toLocaleString()}. New principal: RWF ${newPrincipal.toLocaleString()}.`,
            companyId: auth.companyId!, link: `/loans/${id}`,
          },
        });

        return tx.loan.update({
          where: { id },
          data: {
            amount: newPrincipal, disbursedAmount: loan.disbursedAmount + d.topUpAmount,
            topUpAmount: loan.topUpAmount + d.topUpAmount, balanceOutstanding: newPrincipal,
            totalInstallments: loan.installmentsPaid + n, totalRepayable: newTotalRepayable,
            amountRepaidPrincipal: 0, amountRepaidInterest: 0,
            amountRepaidMgmtFee: 0, amountRepaidProcessingFee: 0,
            totalInterestScheduled: newTotalInterestScheduled,
            totalMgmtFeeScheduled: newTotalMgmtFeeScheduled,
            totalProcessingFeeScheduled: newTotalProcessingFeeScheduled,
            managementFeeRate: effectiveMgmtFeeRate,
            nextPaymentDate: newFirstPaymentDate, nextPaymentAmount: newInstallmentAmount,
            agreedMaturityDate: newMaturityDate, firstPaymentDate: newFirstPaymentDate,
            annualInterestRate: effectiveRate, isRestructured: true,
            daysOverdue: 0, arrearsStartDate: null, penaltyAmount: 0,
            status: "active", loanClass, provisioningRate, provisionRequired,
          },
        });
      });

      return ok({ ...updated, annualInterestRate: Number(updated.annualInterestRate), provisioningRate: Number(updated.provisioningRate) });
    }

    // ── REFINANCE: close existing loan, create a brand-new loan ────────────
    const company = await prisma.company.findUnique({
      where: { id: auth.companyId! },
      select: { name: true, accountBalance: true },
    });
    const prefix  = (company?.name ?? "XX").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    const existing = await prisma.loan.findMany({
      where: { companyId: auth.companyId!, id: { startsWith: `${prefix}-` } },
      select: { id: true },
    });
    const maxSeq = existing.reduce((max, l) => {
      const n = parseInt(l.id.replace(`${prefix}-`, ""), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const newLoanId = `${prefix}-${String(maxSeq + 1).padStart(3, "0")}`;

    const newLoan = await prisma.$transaction(async (tx) => {
      // 1. Close the old loan — zero out balance, mark completed
      await tx.installment.updateMany({
        where: { loanId: id, status: { in: ["pending", "overdue", "partial"] } },
        data:  { status: "paid", amountPaid: 0 },
      });
      await tx.loan.update({
        where: { id },
        data: {
          status: "completed",
          balanceOutstanding: 0,
          isRestructured: true,
          penaltyAmount: 0,
          daysOverdue: 0,
          arrearsStartDate: null,
        },
      });

      // 2. Create the new loan
      const newLoanData = await tx.loan.create({
        data: {
          id:                     newLoanId,
          companyId:              auth.companyId!,
          customerId:             loan.customerId,
          loanOfficerId:          auth.userId,
          branchName:             loan.branchName,
          purpose:                `Refinance of ${id.toUpperCase()}`,
          amount:                 newPrincipal,
          disbursedAmount:        newPrincipal,
          disbursementDate:       new Date(),
          annualInterestRate:     effectiveRate,
          interestMethod:         loan.interestMethod,
          repaymentFrequencyDays: loan.repaymentFrequencyDays,
          gracePeriodDays:        loan.gracePeriodDays ?? 0,
          firstPaymentDate:       newFirstPaymentDate,
          agreedMaturityDate:     newMaturityDate,
          totalInstallments:      n,
          totalRepayable:         newTotalRepayable,
          balanceOutstanding:     newPrincipal,
          nextPaymentDate:        newFirstPaymentDate,
          nextPaymentAmount:      newInstallmentAmount,
          managementFeeRate:      effectiveMgmtFeeRate,
          processingFeeRate:      effectiveProcFeeRate,
          totalInterestScheduled:       newTotalInterestScheduled,
          totalMgmtFeeScheduled:        newTotalMgmtFeeScheduled,
          totalProcessingFeeScheduled:  newTotalProcessingFeeScheduled,
          penaltyRatePerDay:      Number((loan as any).penaltyRatePerDay ?? 0),
          isRestructured:         true,
          topUpAmount:            cashDisbursed,
          status:                 "active",
          loanClass,
          provisioningRate,
          provisionRequired,
        },
      });

      // 3. Create fresh installment schedule on the new loan
      await tx.installment.createMany({
        data: newSchedule.map((row, i) => ({
          loanId: newLoanId,
          installmentNo:    i + 1,
          dueDate:          row.dueDate,
          principalDue:     row.principalDue,
          interestDue:      row.interestDue,
          managementFeeDue: row.managementFeeDue,
          processingFeeDue: row.processingFeeDue,
          totalDue:         row.totalDue,
        })),
      });

      // 4. Save one-time fee record on the new loan
      if (d.feeType === "one_time" && oneTimeFeeTotal > 0) {
        await tx.loanFee.create({
          data: { loanId: newLoanId, name: d.feeLabel || "Refinance fee", type: "fixed", value: oneTimeFeeTotal, isRecurring: false },
        });
      }

      // 5. Ledger: only net new cash leaves the account
      const balBefore = company?.accountBalance ?? 0;
      const balAfter  = balBefore - cashDisbursed;
      if (cashDisbursed > 0) {
        await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: balAfter } });
        await tx.ledgerEntry.create({
          data: {
            companyId: auth.companyId!, type: "disbursement",
            amount: cashDisbursed, balanceBefore: balBefore, balanceAfter: balAfter,
            description: `Refinance — ${id.toUpperCase()} → ${newLoanId.toUpperCase()} (net cash RWF ${cashDisbursed.toLocaleString()})`,
            referenceId: newLoanId, createdById: auth.userId,
          },
        });
      }

      await tx.notification.create({
        data: {
          type: "disbursement", title: "Loan Refinanced",
          message: `Loan ${id.toUpperCase()} was refinanced. New loan ${newLoanId.toUpperCase()} created with principal RWF ${newPrincipal.toLocaleString()}. Net cash to client: RWF ${cashDisbursed.toLocaleString()}.`,
          companyId: auth.companyId!, link: `/loans/${newLoanId}`,
        },
      });

      return newLoanData;
    });

    return created({
      ...newLoan,
      refinancedLoanId: id,
      annualInterestRate: Number(newLoan.annualInterestRate),
      provisioningRate:   Number(newLoan.provisioningRate),
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
