import type {
  User, Company, Customer, Loan, Payment, Notification,
  KPIData, ChartDataPoint, Asset, Expense, AmortizationRow
} from "@/types";

export const CURRENT_USER: User = {
  id: "u1",
  name: "Jean Pierre Habimana",
  email: "jp.habimana@ingobyi.rw",
  role: "managing_director",
  companyId: "c1",
  avatar: "",
  phone: "+250 788 123 456",
  createdAt: "2024-01-15",
};

export const COMPANIES: Company[] = [
  {
    id: "c1",
    name: "Ingobyi Finance Ltd",
    email: "info@ingobyi.rw",
    phone: "+250 788 000 001",
    address: "KG 12 Ave, Kigali, Rwanda",
    employeeCount: 24,
    activeLoans: 342,
    totalPortfolio: 458_000_000,
    status: "active",
    createdAt: "2023-03-10",
  },
  {
    id: "c2",
    name: "Ubuzima MFI",
    email: "contact@ubuzima.rw",
    phone: "+250 788 000 002",
    address: "KN 5 Rd, Kigali, Rwanda",
    employeeCount: 12,
    activeLoans: 189,
    totalPortfolio: 220_000_000,
    status: "active",
    createdAt: "2023-06-20",
  },
  {
    id: "c3",
    name: "Ejo Heza Credit",
    email: "hello@ejoheza.rw",
    phone: "+250 788 000 003",
    address: "KG 7 Ave, Musanze, Rwanda",
    employeeCount: 8,
    activeLoans: 95,
    totalPortfolio: 85_000_000,
    status: "trial",
    createdAt: "2024-01-05",
  },
];

export const USERS: User[] = [
  { id: "u1", name: "Jean Pierre Habimana", email: "jp@ingobyi.rw", role: "managing_director", companyId: "c1", createdAt: "2024-01-15" },
  { id: "u2", name: "Alice Mukamana", email: "alice@ingobyi.rw", role: "loan_officer", companyId: "c1", createdAt: "2024-02-01" },
  { id: "u3", name: "Eric Niyonzima", email: "eric@ingobyi.rw", role: "loan_officer", companyId: "c1", createdAt: "2024-02-15" },
  { id: "u4", name: "Grace Uwimana", email: "grace@ingobyi.rw", role: "receptionist", companyId: "c1", createdAt: "2024-03-01" },
  { id: "u5", name: "David Ishimwe", email: "david@ingobyi.rw", role: "shareholder", companyId: "c1", createdAt: "2024-01-20" },
];

export const CUSTOMERS: Customer[] = [
  {
    id: "cust1", names: "Marie Uwase", nationalId: "1199080000001118",
    dateOfBirth: "1990-05-12", gender: "Female",
    province: "Kigali", district: "Nyarugenge", sector: "Nyarugenge", cell: "Biryogo", village: "Nyamirama",
    phone: "+250788111001", email: "marie.uwase@gmail.com",
    maritalStatus: "Married", employmentStatus: "Self-employed",
    isActive: true, companyId: "c1", createdAt: "2024-02-10",
    totalLoans: 3, activeLoans: 1, outstandingBalance: 380_000,
  },
  {
    id: "cust2", names: "Patrick Nzabonimpa", nationalId: "1198580000002119",
    dateOfBirth: "1985-11-23", gender: "Male",
    province: "Kigali", district: "Gasabo", sector: "Remera", cell: "Nyabisindu", village: "Akabahizi",
    phone: "+250788111002", email: "p.nzabonimpa@yahoo.com",
    maritalStatus: "Married", employmentStatus: "Employed", employerName: "RSSB School",
    isActive: true, companyId: "c1", createdAt: "2024-03-05",
    totalLoans: 2, activeLoans: 1, outstandingBalance: 720_000,
  },
  {
    id: "cust3", names: "Claudine Mukamazimpaka", nationalId: "1199280000003120",
    dateOfBirth: "1992-08-30", gender: "Female",
    province: "Kigali", district: "Kicukiro", sector: "Gatenga", cell: "Ruhuha", village: "Agakomeye",
    phone: "+250788111003", email: "claudine.m@gmail.com",
    maritalStatus: "Single", employmentStatus: "Employed", employerName: "King Faisal Hospital",
    isActive: true, companyId: "c1", createdAt: "2024-01-18",
    totalLoans: 5, activeLoans: 2, outstandingBalance: 1_140_000,
  },
  {
    id: "cust4", names: "Samuel Hategekimana", nationalId: "1198880000004121",
    dateOfBirth: "1988-03-15", gender: "Male",
    province: "Western", district: "Rubavu", sector: "Gisenyi", cell: "Amahoro", village: "Kivumu",
    phone: "+250788111004", email: "samuel.h@outlook.com",
    maritalStatus: "Married", employmentStatus: "Self-employed",
    isActive: true, companyId: "c1", createdAt: "2024-04-02",
    totalLoans: 1, activeLoans: 1, outstandingBalance: 480_000,
  },
  {
    id: "cust5", names: "Vestine Nyiramana", nationalId: "1199580000005122",
    dateOfBirth: "1995-12-07", gender: "Female",
    province: "Northern", district: "Musanze", sector: "Muhoza", cell: "Cyabararika", village: "Rwili",
    phone: "+250788111005", email: "vestine.n@gmail.com",
    maritalStatus: "Single", employmentStatus: "Self-employed",
    isActive: true, companyId: "c1", createdAt: "2024-02-28",
    totalLoans: 4, activeLoans: 1, outstandingBalance: 2_100_000,
  },
  {
    id: "cust6", names: "Jean Claude Bizimana", nationalId: "1198280000006123",
    dateOfBirth: "1982-07-19", gender: "Male",
    province: "Southern", district: "Huye", sector: "Tumba", cell: "Rusenge", village: "Gahinga",
    phone: "+250788111006", email: "jc.bizimana@gmail.com",
    maritalStatus: "Married", employmentStatus: "Employed", employerName: "Rwanda Revenue Authority",
    isActive: true, companyId: "c1", createdAt: "2024-03-20",
    totalLoans: 2, activeLoans: 0, outstandingBalance: 0,
  },
];

export const LOANS: Loan[] = [
  {
    id: "l001", customerId: "cust1", customerName: "Marie Uwase", amount: 1_000_000,
    interestRate: 2.5, interestType: "declining", frequency: "monthly", installments: 12,
    disbursedAmount: 950_000, status: "active", purpose: "Business expansion",
    fees: [
      { id: "f1", name: "Management Fee", type: "percentage", value: 2, isRecurring: false },
      { id: "f2", name: "Application Fee", type: "fixed", value: 10_000, isRecurring: false },
    ],
    createdById: "u2", approvedById: "u1", createdAt: "2024-03-01",
    approvedAt: "2024-03-03", disbursedAt: "2024-03-05",
    dueDate: "2025-03-05", nextPaymentDate: "2024-10-05",
    nextPaymentAmount: 95_833, totalRepayable: 1_150_000, totalPaid: 574_998,
    outstandingBalance: 575_002, paidInstallments: 6, penaltyAmount: 0, companyId: "c1",
  },
  {
    id: "l002", customerId: "cust2", customerName: "Patrick Nzabonimpa", amount: 1_500_000,
    interestRate: 3, interestType: "flat", frequency: "monthly", installments: 18,
    disbursedAmount: 1_425_000, status: "active", purpose: "Home renovation",
    fees: [
      { id: "f3", name: "Processing Fee", type: "fixed", value: 25_000, isRecurring: false },
      { id: "f4", name: "Management Fee", type: "percentage", value: 2.5, isRecurring: false },
    ],
    createdById: "u2", approvedById: "u1", createdAt: "2024-04-10",
    approvedAt: "2024-04-12", disbursedAt: "2024-04-15",
    dueDate: "2025-10-15", nextPaymentDate: "2024-10-15",
    nextPaymentAmount: 120_000, totalRepayable: 1_882_500, totalPaid: 600_000,
    outstandingBalance: 1_282_500, paidInstallments: 5, penaltyAmount: 12_000, companyId: "c1",
  },
  {
    id: "l003", customerId: "cust3", customerName: "Claudine Mukamazimpaka", amount: 3_000_000,
    interestRate: 2.2, interestType: "declining", frequency: "monthly", installments: 24,
    disbursedAmount: 2_850_000, status: "active", purpose: "Medical equipment",
    fees: [
      { id: "f5", name: "Management Fee", type: "percentage", value: 2, isRecurring: false },
      { id: "f6", name: "Application Fee", type: "fixed", value: 15_000, isRecurring: false },
    ],
    createdById: "u3", approvedById: "u1", createdAt: "2024-02-01",
    approvedAt: "2024-02-03", disbursedAt: "2024-02-05",
    dueDate: "2026-02-05", nextPaymentDate: "2024-10-05",
    nextPaymentAmount: 158_000, totalRepayable: 3_528_000, totalPaid: 1_264_000,
    outstandingBalance: 2_264_000, paidInstallments: 8, penaltyAmount: 0, companyId: "c1",
  },
  {
    id: "l004", customerId: "cust4", customerName: "Samuel Hategekimana", amount: 500_000,
    interestRate: 3.5, interestType: "flat", frequency: "monthly", installments: 6,
    disbursedAmount: 475_000, status: "pending", purpose: "Agricultural inputs",
    fees: [
      { id: "f7", name: "Application Fee", type: "fixed", value: 5_000, isRecurring: false },
    ],
    createdById: "u2", createdAt: "2024-09-20",
    dueDate: "2025-03-20", nextPaymentDate: "2024-10-20",
    nextPaymentAmount: 97_917, totalRepayable: 605_000, totalPaid: 0,
    outstandingBalance: 605_000, paidInstallments: 0, penaltyAmount: 0, companyId: "c1",
  },
  {
    id: "l005", customerId: "cust5", customerName: "Vestine Nyiramana", amount: 5_000_000,
    interestRate: 2, interestType: "declining", frequency: "monthly", installments: 36,
    disbursedAmount: 4_750_000, status: "disbursed", purpose: "Business capital",
    fees: [
      { id: "f8", name: "Management Fee", type: "percentage", value: 1.5, isRecurring: false },
      { id: "f9", name: "Processing Fee", type: "fixed", value: 50_000, isRecurring: false },
    ],
    createdById: "u2", approvedById: "u1", createdAt: "2024-09-01",
    approvedAt: "2024-09-05", disbursedAt: "2024-09-10",
    dueDate: "2027-09-10", nextPaymentDate: "2024-10-10",
    nextPaymentAmount: 192_500, totalRepayable: 6_020_000, totalPaid: 0,
    outstandingBalance: 6_020_000, paidInstallments: 0, penaltyAmount: 0, companyId: "c1",
  },
  {
    id: "l006", customerId: "cust6", customerName: "Jean Claude Bizimana", amount: 800_000,
    interestRate: 2.8, interestType: "flat", frequency: "monthly", installments: 12,
    disbursedAmount: 760_000, status: "completed", purpose: "Vehicle purchase",
    fees: [],
    createdById: "u3", approvedById: "u1", createdAt: "2023-09-01",
    approvedAt: "2023-09-03", disbursedAt: "2023-09-05",
    dueDate: "2024-09-05", nextPaymentDate: "2024-09-05",
    nextPaymentAmount: 0, totalRepayable: 1_068_800, totalPaid: 1_068_800,
    outstandingBalance: 0, paidInstallments: 12, penaltyAmount: 0, companyId: "c1",
  },
];

export const PAYMENTS: Payment[] = [
  {
    id: "p1", loanId: "l001", customerId: "cust1", customerName: "Marie Uwase",
    amount: 95_833, penalty: 0, interest: 22_500, principal: 73_333,
    date: "2024-09-05", method: "mobile_money", reference: "MM-2024-09-001",
    recordedById: "u4", companyId: "c1",
  },
  {
    id: "p2", loanId: "l002", customerId: "cust2", customerName: "Patrick Nzabonimpa",
    amount: 132_000, penalty: 12_000, interest: 45_000, principal: 75_000,
    date: "2024-09-15", method: "bank_transfer", reference: "BT-2024-09-002",
    recordedById: "u4", companyId: "c1", notes: "Late payment - penalty applied",
  },
  {
    id: "p3", loanId: "l003", customerId: "cust3", customerName: "Claudine Mukamazimpaka",
    amount: 158_000, penalty: 0, interest: 52_800, principal: 105_200,
    date: "2024-09-05", method: "cash", reference: "CASH-2024-09-003",
    recordedById: "u4", companyId: "c1",
  },
  {
    id: "p4", loanId: "l001", customerId: "cust1", customerName: "Marie Uwase",
    amount: 95_833, penalty: 0, interest: 20_667, principal: 75_166,
    date: "2024-08-05", method: "mobile_money", reference: "MM-2024-08-001",
    recordedById: "u4", companyId: "c1",
  },
  {
    id: "p5", loanId: "l003", customerId: "cust3", customerName: "Claudine Mukamazimpaka",
    amount: 158_000, penalty: 0, interest: 50_050, principal: 107_950,
    date: "2024-08-05", method: "cash", reference: "CASH-2024-08-004",
    recordedById: "u2", companyId: "c1",
  },
];

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n1", type: "payment_due", title: "Payment Due Tomorrow",
    message: "Patrick Nzabonimpa's payment of RWF 120,000 is due on 2024-10-15",
    isRead: false, createdAt: "2024-10-14T09:00:00Z", link: "/loans/l002",
  },
  {
    id: "n2", type: "approval_needed", title: "Loan Awaiting Approval",
    message: "Samuel Hategekimana's loan application of RWF 500,000 requires your approval",
    isRead: false, createdAt: "2024-09-20T14:30:00Z", link: "/loans/l004",
  },
  {
    id: "n3", type: "overdue", title: "Overdue Payment Alert",
    message: "Patrick Nzabonimpa has an overdue payment with penalty of RWF 12,000",
    isRead: true, createdAt: "2024-09-16T08:00:00Z", link: "/loans/l002",
  },
  {
    id: "n4", type: "disbursement", title: "Loan Disbursed",
    message: "Vestine Nyiramana's loan of RWF 5,000,000 has been disbursed successfully",
    isRead: true, createdAt: "2024-09-10T11:00:00Z", link: "/loans/l005",
  },
  {
    id: "n5", type: "system", title: "Monthly Report Ready",
    message: "The September 2024 financial report is now available for review",
    isRead: false, createdAt: "2024-10-01T06:00:00Z", link: "/reports",
  },
];

export const KPI_DATA: KPIData = {
  totalLoans: 342,
  activeLoans: 298,
  totalRevenue: 48_320_000,
  outstandingBalance: 458_000_000,
  totalCustomers: 512,
  overdueLoans: 23,
  disbursedToday: 3_500_000,
  collectionRate: 94.2,
};

export const CHART_DATA: ChartDataPoint[] = [
  { month: "Apr", disbursed: 38_000_000, collected: 22_000_000, outstanding: 280_000_000 },
  { month: "May", disbursed: 42_000_000, collected: 28_000_000, outstanding: 295_000_000 },
  { month: "Jun", disbursed: 35_000_000, collected: 31_000_000, outstanding: 300_000_000 },
  { month: "Jul", disbursed: 48_000_000, collected: 35_000_000, outstanding: 315_000_000 },
  { month: "Aug", disbursed: 52_000_000, collected: 38_000_000, outstanding: 330_000_000 },
  { month: "Sep", disbursed: 45_000_000, collected: 42_000_000, outstanding: 335_000_000 },
  { month: "Oct", disbursed: 58_000_000, collected: 44_000_000, outstanding: 458_000_000 },
];

export const LOAN_STATUS_DATA = [
  { name: "Active", value: 298, color: "#10b981" },
  { name: "Pending", value: 18, color: "#f59e0b" },
  { name: "Overdue", value: 23, color: "#ef4444" },
  { name: "Disbursed", value: 3, color: "#6366f1" },
];

export const ASSETS: Asset[] = [
  { id: "a1", name: "Dell Server", category: "IT Equipment", purchaseDate: "2023-01-15", purchaseValue: 4_500_000, currentValue: 3_600_000, depreciationRate: 20, companyId: "c1" },
  { id: "a2", name: "Toyota Hilux", category: "Vehicle", purchaseDate: "2022-06-20", purchaseValue: 28_000_000, currentValue: 21_000_000, depreciationRate: 25, companyId: "c1" },
  { id: "a3", name: "Office Furniture Set", category: "Furniture", purchaseDate: "2023-03-10", purchaseValue: 2_200_000, currentValue: 1_980_000, depreciationRate: 10, companyId: "c1" },
];

export const EXPENSES: Expense[] = [
  { id: "e1", category: "Staff Salaries", description: "October 2024 payroll", amount: 8_500_000, date: "2024-10-01", companyId: "c1" },
  { id: "e2", category: "Rent", description: "Office rent - October", amount: 1_200_000, date: "2024-10-01", companyId: "c1" },
  { id: "e3", category: "Utilities", description: "Electricity & Internet", amount: 280_000, date: "2024-10-05", companyId: "c1" },
  { id: "e4", category: "Marketing", description: "Social media campaign", amount: 450_000, date: "2024-10-08", companyId: "c1" },
];

export function generateAmortization(
  principal: number,
  annualRate: number,
  installments: number,
  interestType: "flat" | "declining",
  startDate: string,
  paidInstallments: number
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  const monthlyRate = annualRate / 100;
  let balance = principal;
  const start = new Date(startDate);

  for (let i = 1; i <= installments; i++) {
    const date = new Date(start);
    date.setMonth(date.getMonth() + i);
    const dateStr = date.toISOString().split("T")[0];

    let interest: number;
    let principalPayment: number;

    if (interestType === "flat") {
      interest = principal * monthlyRate;
      principalPayment = principal / installments;
    } else {
      interest = balance * monthlyRate;
      const totalPayment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -installments));
      principalPayment = totalPayment - interest;
    }

    const totalPayment = interest + principalPayment;
    const openingBalance = balance;
    balance = Math.max(0, balance - principalPayment);

    rows.push({
      installmentNo: i,
      date: dateStr,
      openingBalance,
      principal: Math.round(principalPayment),
      interest: Math.round(interest),
      fees: 0,
      totalPayment: Math.round(totalPayment),
      closingBalance: Math.round(balance),
      status: i <= paidInstallments ? "paid" : i === paidInstallments + 1 ? "pending" : "pending",
    });
  }

  return rows;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-RW").format(n);
}
