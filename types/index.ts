export type UserRole = "super_admin" | "managing_director" | "loan_officer" | "receptionist" | "shareholder";

export type LoanStatus = "pending" | "approved" | "disbursed" | "active" | "completed" | "rejected" | "overdue" | "written_off";

export type InterestMethod = "flat" | "declining";

export type LoanClass = "Normal" | "Watch" | "Substandard" | "Doubtful" | "Loss";

export type InstallmentStatus = "pending" | "paid" | "partial" | "overdue";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  companyName?: string | null;
  avatar?: string;
  phone?: string;
  isActive?: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  email: string;
  phone: string;
  address: string;
  status: "active" | "suspended" | "trial";
  createdAt: string;
  // computed by API
  employeeCount?: number;
  activeLoans?: number;
  totalPortfolio?: number;
}

export interface Customer {
  id: string;
  names: string;
  nationalId: string;
  dateOfBirth: string;
  gender: string;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  phone: string;
  email?: string;
  maritalStatus: string;
  employerName?: string;
  employmentStatus: string;
  relationshipWithNdfsp?: string;
  photo?: string;
  isActive: boolean;
  spouseName?: string;
  spousePhone?: string;
  spouseIdNumber?: string;
  maritalPropertyRegime?: string;
  companyId: string;
  createdAt: string;
  // computed by API
  totalLoans?: number;
  activeLoans?: number;
  outstandingBalance?: number;
}

export interface LoanFee {
  id: string;
  name: string;
  type: "fixed" | "percentage";
  value: number;
  isRecurring: boolean;
}

export interface AmortizationRow {
  installmentNo: number;
  date: string;
  openingBalance: number;
  principal: number;
  interest: number;
  totalPayment: number;
  closingBalance: number;
  status: "paid" | "pending" | "overdue";
}

export interface Installment {
  id: string;
  loanId: string;
  installmentNo: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  amountPaid: number;
  paidDate: string | null;
  status: InstallmentStatus;
  createdAt: string;
}

export interface Loan {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  loanOfficerId: string;
  approvedById?: string;
  branchName?: string;
  purpose: string;
  amount: number;
  disbursedAmount: number;
  disbursementDate?: string;
  annualInterestRate: number;
  interestMethod: InterestMethod;
  repaymentFrequencyDays: number;
  gracePeriodDays: number;
  firstPaymentDate?: string;
  agreedMaturityDate: string;
  totalInstallments: number;
  installmentsPaid: number;
  installmentsOutstanding: number;
  totalRepayable: number;
  amountRepaidPrincipal: number;
  amountRepaidInterest: number;
  balanceOutstanding: number;
  arrearsStartDate?: string;
  daysOverdue: number;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  nextPaymentAmount: number;
  penaltyAmount: number;
  penaltyRatePerDay: number;
  lastPenaltyCalculatedAt?: string;
  collateralType?: string;
  collateralAmount?: number;
  eligibleCollateral?: number;
  loanClass: LoanClass;
  provisioningRate: number;
  provisionRequired: number;
  previousProvision: number;
  additionalProvision: number;
  status: LoanStatus;
  isRestructured: boolean;
  cutoffDate?: string;
  writtenOffDate?: string;
  createdAt: string;
  approvedAt?: string;
  updatedAt: string;
  fees: LoanFee[];
}

export interface Payment {
  id: string;
  loanId: string;
  customerId: string;
  customerName: string;
  recordedByName?: string;
  amount: number;
  penalty: number;
  interest: number;
  principal: number;
  date: string;
  method: "cash" | "bank_transfer" | "mobile_money";
  reference: string;
  recordedById: string;
  companyId: string;
  notes?: string;
}

export interface Notification {
  id: string;
  type: "payment_due" | "overdue" | "approval_needed" | "disbursement" | "system";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface KPIData {
  totalLoans: number;
  activeLoans: number;
  totalRevenue: number;
  outstandingBalance: number;
  totalCustomers: number;
  overdueLoans: number;
  disbursedToday: number;
  collectionRate: number;
}

export interface ChartDataPoint {
  month: string;
  disbursed: number;
  collected: number;
  outstanding: number;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchaseValue: number;
  currentValue: number;
  depreciationRate: number;
  companyId: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  companyId: string;
}
