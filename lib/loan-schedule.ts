/** Generate an installment payment schedule for a loan. */
export interface InstallmentRow {
  installmentNo: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  totalDue: number;
}

export function generateSchedule(
  principal: number,
  annualInterestRate: number,   // e.g. 24 for 24% p.a.
  interestMethod: "flat" | "declining",
  totalInstallments: number,
  firstPaymentDate: Date,
  repaymentFrequencyDays: number,
): InstallmentRow[] {
  const periodsPerYear = 360 / repaymentFrequencyDays;
  const periodRate = annualInterestRate / 100 / periodsPerYear;

  const rows: InstallmentRow[] = [];

  if (interestMethod === "flat") {
    const totalInterest = principal * periodRate * totalInstallments;
    const principalDue = Math.round(principal / totalInstallments);
    const interestDue = Math.round(totalInterest / totalInstallments);

    for (let i = 0; i < totalInstallments; i++) {
      const due = new Date(firstPaymentDate);
      due.setDate(due.getDate() + i * repaymentFrequencyDays);
      rows.push({
        installmentNo: i + 1,
        dueDate: due,
        principalDue,
        interestDue,
        totalDue: principalDue + interestDue,
      });
    }
  } else {
    // Declining balance (standard amortization)
    const payment =
      periodRate === 0
        ? Math.round(principal / totalInstallments)
        : Math.round((principal * periodRate) / (1 - Math.pow(1 + periodRate, -totalInstallments)));

    let balance = principal;
    for (let i = 0; i < totalInstallments; i++) {
      const interestDue = Math.round(balance * periodRate);
      const principalDue = Math.min(payment - interestDue, balance);
      balance -= principalDue;

      const due = new Date(firstPaymentDate);
      due.setDate(due.getDate() + i * repaymentFrequencyDays);
      rows.push({
        installmentNo: i + 1,
        dueDate: due,
        principalDue,
        interestDue,
        totalDue: principalDue + interestDue,
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
