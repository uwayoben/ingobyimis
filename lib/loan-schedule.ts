/** Generate an installment payment schedule for a loan. */
export interface InstallmentRow {
  installmentNo: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  managementFeeDue: number;
  processingFeeDue: number;
  totalDue: number;
}

export function generateSchedule(
  principal: number,
  annualInterestRate: number,   // e.g. 24 for 24% p.a.
  interestMethod: "flat" | "declining",
  totalInstallments: number,
  firstPaymentDate: Date,
  repaymentFrequencyDays: number,
  annualMgmtFeeRate: number = 0,        // e.g. 12 for 1%/month — charged like interest
  annualProcessingFeeRate: number = 0,  // e.g. 6 for 0.5%/month — charged like interest
  oneTimeFeeTotal: number = 0,          // fixed fee divided equally across installments
): InstallmentRow[] {
  const periodsPerYear        = 360 / repaymentFrequencyDays;
  const periodRate            = annualInterestRate      / 100 / periodsPerYear;
  const mgmtFeePeriodRate     = annualMgmtFeeRate       / 100 / periodsPerYear;
  const procFeePeriodRate     = annualProcessingFeeRate / 100 / periodsPerYear;
  const combinedRate          = periodRate + mgmtFeePeriodRate + procFeePeriodRate;

  const rows: InstallmentRow[] = [];
  const baseOneTimeFee   = totalInstallments > 0 ? Math.floor(oneTimeFeeTotal / totalInstallments) : 0;
  let oneTimeFeeSum      = 0;

  if (interestMethod === "flat") {
    const totalInterest    = principal * periodRate        * totalInstallments;
    const totalMgmtFee     = principal * mgmtFeePeriodRate * totalInstallments;
    const totalProcFee     = principal * procFeePeriodRate * totalInstallments;
    const basePrincipal    = Math.floor(principal      / totalInstallments);
    const baseInterest     = Math.round(totalInterest  / totalInstallments);
    const baseMgmtFee      = Math.round(totalMgmtFee   / totalInstallments);
    const baseProcFee      = Math.round(totalProcFee   / totalInstallments);
    // Track running sums so the last installment absorbs any rounding remainder
    let principalSum = 0;
    let interestSum  = 0;
    let mgmtFeeSum   = 0;
    let procFeeSum   = 0;

    for (let i = 0; i < totalInstallments; i++) {
      const isLast = i === totalInstallments - 1;
      const principalDue     = isLast ? principal - principalSum : basePrincipal + (i < principal % totalInstallments ? 1 : 0);
      const interestDue      = isLast ? Math.round(totalInterest)  - interestSum : baseInterest;
      const managementFeeDue = isLast ? Math.round(totalMgmtFee)   - mgmtFeeSum  : baseMgmtFee;
      const processingFeeDue = isLast ? Math.round(totalProcFee)   - procFeeSum  : baseProcFee;

      const oneTimeFeeSlice = isLast ? oneTimeFeeTotal - oneTimeFeeSum : baseOneTimeFee;
      principalSum += principalDue;
      interestSum  += interestDue;
      mgmtFeeSum   += managementFeeDue + oneTimeFeeSlice;
      procFeeSum   += processingFeeDue;
      oneTimeFeeSum += oneTimeFeeSlice;

      const due = new Date(firstPaymentDate);
      due.setDate(due.getDate() + i * repaymentFrequencyDays);
      rows.push({
        installmentNo: i + 1,
        dueDate: due,
        principalDue,
        interestDue,
        managementFeeDue: managementFeeDue + oneTimeFeeSlice,
        processingFeeDue,
        totalDue: principalDue + interestDue + managementFeeDue + oneTimeFeeSlice + processingFeeDue,
      });
    }
  } else {
    // Declining balance — EMI uses combined rate
    const payment = combinedRate === 0
      ? Math.round(principal / totalInstallments)
      : Math.round((principal * combinedRate) / (1 - Math.pow(1 + combinedRate, -totalInstallments)));

    let balance = principal;
    for (let i = 0; i < totalInstallments; i++) {
      const isLast           = i === totalInstallments - 1;
      const interestDue      = Math.round(balance * periodRate);
      const managementFeeDue = Math.round(balance * mgmtFeePeriodRate);
      const processingFeeDue = Math.round(balance * procFeePeriodRate);
      // Last installment: principal = exact remaining balance to prevent rounding drift
      const principalDue     = isLast
        ? balance
        : Math.max(0, Math.min(payment - interestDue - managementFeeDue - processingFeeDue, balance));
      balance -= principalDue;

      const oneTimeFeeSlice = isLast ? oneTimeFeeTotal - oneTimeFeeSum : baseOneTimeFee;
      oneTimeFeeSum += oneTimeFeeSlice;

      const due = new Date(firstPaymentDate);
      due.setDate(due.getDate() + i * repaymentFrequencyDays);
      rows.push({
        installmentNo: i + 1,
        dueDate: due,
        principalDue,
        interestDue,
        managementFeeDue: managementFeeDue + oneTimeFeeSlice,
        processingFeeDue,
        totalDue: principalDue + interestDue + managementFeeDue + oneTimeFeeSlice + processingFeeDue,
      });
    }
  }

  return rows;
}

export const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

/** BNR loan classification based on days overdue */
export function classifyLoan(daysOverdue: number): {
  loanClass: "Normal" | "Watch" | "Substandard" | "Doubtful" | "Loss";
  provisioningRate: number;
} {
  if (daysOverdue === 0)   return { loanClass: "Normal",      provisioningRate: 0   };
  if (daysOverdue <= 89)   return { loanClass: "Watch",       provisioningRate: 1   };
  if (daysOverdue <= 179)  return { loanClass: "Substandard", provisioningRate: 20  };
  if (daysOverdue <= 359)  return { loanClass: "Doubtful",    provisioningRate: 50  };
  return                          { loanClass: "Loss",        provisioningRate: 100 };
}
