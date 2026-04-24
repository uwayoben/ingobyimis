export type UserRole = "super_admin" | "managing_director" | "loan_officer" | "receptionist" | "shareholder";

export type LoanStatus = "pending" | "approved" | "disbursed" | "active" | "completed" | "rejected" | "overdue";

export type PaymentFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export type InterestType = "flat" | "declining";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  avatar?: string;
  phone?: string;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  email: string;
  phone: string;
  address: string;
  employeeCount: number;
  activeLoans: number;
  totalPortfolio: number;
  status: "active" | "suspended" | "trial";
  createdAt: string;
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
  totalLoans: number;
  activeLoans: number;
  outstandingBalance: number;
}

export interface LoanFee {
  id: string;
  name: string;
  type: "fixed" | "percentage";
  value: number;
  isRecurring: boolean;
}

export interface Loan {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  interestRate: number;
  interestType: InterestType;
  frequency: PaymentFrequency;
  installments: number;
  disbursedAmount: number;
  status: LoanStatus;
  purpose: string;
  fees: LoanFee[];
  createdById: string;
  approvedById?: string;
  createdAt: string;
  approvedAt?: string;
  disbursedAt?: string;
  dueDate: string;
  nextPaymentDate: string;
  nextPaymentAmount: number;
  totalRepayable: number;
  totalPaid: number;
  outstandingBalance: number;
  paidInstallments: number;
  penaltyAmount: number;
  companyId: string;
}

export interface AmortizationRow {
  installmentNo: number;
  date: string;
  openingBalance: number;
  principal: number;
  interest: number;
  fees: number;
  totalPayment: number;
  closingBalance: number;
  status: "paid" | "pending" | "overdue";
}

export interface Payment {
  id: string;
  loanId: string;
  customerId: string;
  customerName: string;
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
