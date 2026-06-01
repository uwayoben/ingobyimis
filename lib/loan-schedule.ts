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
): InstallmentRow[] {
  const periodsPerYear        = 360 / repaymentFrequencyDays;
  const periodRate            = annualInterestRate      / 100 / periodsPerYear;
  const mgmtFeePeriodRate     = annualMgmtFeeRate       / 100 / periodsPerYear;
  const procFeePeriodRate     = annualProcessingFeeRate / 100 / periodsPerYear;
  const combinedRate          = periodRate + mgmtFeePeriodRate + procFeePeriodRate;

  const rows: InstallmentRow[] = [];

  if (interestMethod === "flat") {
    const totalInterest    = principal * periodRate        * totalInstallments;
    const totalMgmtFee     = principal * mgmtFeePeriodRate * totalInstallments;
    const totalProcFee     = principal * procFeePeriodRate * totalInstallments;
    const principalDue     = Math.round(principal      / totalInstallments);
    const interestDue      = Math.round(totalInterest  / totalInstallments);
    const managementFeeDue = Math.round(totalMgmtFee   / totalInstallments);
    const processingFeeDue = Math.round(totalProcFee   / totalInstallments);

    for (let i = 0; i < totalInstallments; i++) {
      const due = new Date(firstPaymentDate);
      due.setDate(due.getDate() + i * repaymentFrequencyDays);
      rows.push({
        installmentNo: i + 1,
        dueDate: due,
        principalDue,
        interestDue,
        managementFeeDue,
        processingFeeDue,
        totalDue: principalDue + interestDue + managementFeeDue + processingFeeDue,
      });
    }
  } else {
    // Declining balance — EMI uses combined rate
    const payment = combinedRate === 0
      ? Math.round(principal / totalInstallments)
      : Math.round((principal * combinedRate) / (1 - Math.pow(1 + combinedRate, -totalInstallments)));

    let balance = principal;
    for (let i = 0; i < totalInstallments; i++) {
      const interestDue      = Math.round(balance * periodRate);
      const managementFeeDue = Math.round(balance * mgmtFeePeriodRate);
      const processingFeeDue = Math.round(balance * procFeePeriodRate);
      const principalDue     = Math.min(payment - interestDue - managementFeeDue - processingFeeDue, balance);
      balance -= principalDue;

      const due = new Date(firstPaymentDate);
      due.setDate(due.getDate() + i * repaymentFrequencyDays);
      rows.push({
        installmentNo: i + 1,
        dueDate: due,
        principalDue,
        interestDue,
        managementFeeDue,
        processingFeeDue,
        totalDue: principalDue + interestDue + managementFeeDue + processingFeeDue,
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
  if (daysOverdue === 0)   return { loanClass: "Normal",      provisioningRate: 1  };
  if (daysOverdue <= 89)   return { loanClass: "Watch",       provisioningRate: 3  };
  if (daysOverdue <= 179)  return { loanClass: "Substandard", provisioningRate: 20 };
  if (daysOverdue <= 359)  return { loanClass: "Doubtful",    provisioningRate: 50 };
  return                          { loanClass: "Loss",        provisioningRate: 100 };
}
