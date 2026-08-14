/**
 * Derived (never persisted) loan overdue calculation.
 *
 * An installment is overdue when its due date has passed and it is not
 * yet fully paid. Everything here is computed fresh from current data —
 * nothing is written back to the database.
 */

const CURRENTLY_ACTIVE_LOAN_STATUSES = new Set(["active", "overdue", "disbursed"]);

export interface OverdueInstallmentInfo {
  id: string;
  installmentNo: number;
  dueDate: Date;
  daysOverdue: number;
  arrearsAmount: number;
}

export interface LoanOverdueInfo {
  isOverdue: boolean;
  daysOverdue: number;
  arrearsStartDate: Date | null;
  totalArrears: number;
  overdueInstallments: OverdueInstallmentInfo[];
}

interface InstallmentLike {
  id: string;
  installmentNo: number;
  dueDate: Date | string;
  totalDue: number;
  amountPaid: number;
}

const NOT_OVERDUE: LoanOverdueInfo = {
  isOverdue: false,
  daysOverdue: 0,
  arrearsStartDate: null,
  totalArrears: 0,
  overdueInstallments: [],
};

function startOfDay(d: Date | string): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * Computes whether a loan is overdue, and if so, which installments are
 * overdue and the arrears owed on each, as of `asOf` (defaults to now).
 * Only loans that are currently in a repayment state (active, overdue,
 * disbursed) are considered — anything pending/approved/completed/
 * rejected/written_off is never overdue.
 */
export function computeLoanOverdue(
  loanStatus: string,
  installments: InstallmentLike[],
  asOf: Date = new Date(),
): LoanOverdueInfo {
  if (!CURRENTLY_ACTIVE_LOAN_STATUSES.has(loanStatus)) return NOT_OVERDUE;

  const today = startOfDay(asOf);

  const overdueInstallments = installments
    .filter((i) => i.amountPaid < i.totalDue && startOfDay(i.dueDate) < today)
    .map((i) => {
      const dueDate = startOfDay(i.dueDate);
      return {
        id: i.id,
        installmentNo: i.installmentNo,
        dueDate,
        daysOverdue: Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000),
        arrearsAmount: Math.max(0, i.totalDue - i.amountPaid),
      };
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  if (overdueInstallments.length === 0) return NOT_OVERDUE;

  const earliest = overdueInstallments[0];

  return {
    isOverdue: true,
    daysOverdue: earliest.daysOverdue,
    arrearsStartDate: earliest.dueDate,
    totalArrears: overdueInstallments.reduce((sum, i) => sum + i.arrearsAmount, 0),
    overdueInstallments,
  };
}
