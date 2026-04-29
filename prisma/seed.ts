import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateSchedule, classifyLoan } from "../lib/loan-schedule";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. Companies ────────────────────────────────────────────────────────────
  const ingobyi = await prisma.company.upsert({
    where: { email: "info@ingobyi.rw" },
    update: {},
    create: {
      name: "Ingobyi Finance Ltd",
      email: "info@ingobyi.rw",
      phone: "+250 788 000 001",
      address: "KG 12 Ave, Kigali, Rwanda",
      status: "active",
    },
  });

  const ubuzima = await prisma.company.upsert({
    where: { email: "contact@ubuzima.rw" },
    update: {},
    create: {
      name: "Ubuzima MFI",
      email: "contact@ubuzima.rw",
      phone: "+250 788 000 002",
      address: "KN 5 Rd, Kigali, Rwanda",
      status: "active",
    },
  });

  await prisma.company.upsert({
    where: { email: "hello@ejoheza.rw" },
    update: {},
    create: {
      name: "Ejo Heza Credit",
      email: "hello@ejoheza.rw",
      phone: "+250 788 000 003",
      address: "KG 7 Ave, Musanze, Rwanda",
      status: "trial",
    },
  });

  console.log("✅ Companies created");

  // ── 2. Users ────────────────────────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hash(p, 12);

  const users = await Promise.all([
    // Super admin — belongs to the platform, not any single company
    prisma.user.upsert({
      where: { email: "admin@ingobyi.rw" },
      update: {},
      create: {
        name: "System Admin",
        email: "admin@ingobyi.rw",
        password: await hash("Admin@1234"),
        role: "super_admin",
        phone: "+250 788 000 000",
      },
    }),
    prisma.user.upsert({
      where: { email: "jp@ingobyi.rw" },
      update: {},
      create: {
        name: "Jean Pierre Habimana",
        email: "jp@ingobyi.rw",
        password: await hash("Manager@1234"),
        role: "managing_director",
        phone: "+250 788 123 456",
        companyId: ingobyi.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "alice@ingobyi.rw" },
      update: {},
      create: {
        name: "Alice Mukamana",
        email: "alice@ingobyi.rw",
        password: await hash("Officer@1234"),
        role: "loan_officer",
        phone: "+250 788 234 567",
        companyId: ingobyi.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "eric@ingobyi.rw" },
      update: {},
      create: {
        name: "Eric Niyonzima",
        email: "eric@ingobyi.rw",
        password: await hash("Officer@1234"),
        role: "loan_officer",
        phone: "+250 788 345 678",
        companyId: ingobyi.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "grace@ingobyi.rw" },
      update: {},
      create: {
        name: "Grace Uwimana",
        email: "grace@ingobyi.rw",
        password: await hash("Staff@1234"),
        role: "receptionist",
        phone: "+250 788 456 789",
        companyId: ingobyi.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "david@ingobyi.rw" },
      update: {},
      create: {
        name: "David Ishimwe",
        email: "david@ingobyi.rw",
        password: await hash("Share@1234"),
        role: "shareholder",
        phone: "+250 788 567 890",
        companyId: ingobyi.id,
      },
    }),
  ]);

  const [, md, alice] = users;
  console.log("✅ Users created");

  // ── 3. Customers ────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { nationalId: "1199080000001118" },
      update: {},
      create: {
        names: "Marie Uwase", nationalId: "1199080000001118",
        dateOfBirth: new Date("1990-05-12"), gender: "Female",
        province: "Kigali", district: "Nyarugenge", sector: "Nyarugenge", cell: "Biryogo", village: "Nyamirama",
        phone: "+250788111001", email: "marie.uwase@gmail.com",
        maritalStatus: "Married", maritalPropertyRegime: "Community of Property",
        spouseName: "Jean Uwase", spousePhone: "+250788111010", spouseIdNumber: "1198880000010001",
        employmentStatus: "Self-employed", employerName: "Self-employed",
        relationshipWithNdfsp: "Client", companyId: ingobyi.id,
      },
    }),
    prisma.customer.upsert({
      where: { nationalId: "1198580000002119" },
      update: {},
      create: {
        names: "Patrick Nzabonimpa", nationalId: "1198580000002119",
        dateOfBirth: new Date("1985-11-23"), gender: "Male",
        province: "Kigali", district: "Gasabo", sector: "Remera", cell: "Nyabisindu", village: "Akabahizi",
        phone: "+250788111002", email: "p.nzabonimpa@yahoo.com",
        maritalStatus: "Married", maritalPropertyRegime: "Separation of Property",
        spouseName: "Alice Nzabonimpa", spousePhone: "+250788111011", spouseIdNumber: "1199080000011002",
        employmentStatus: "Employed", employerName: "RSSB School",
        relationshipWithNdfsp: "Client", companyId: ingobyi.id,
      },
    }),
    prisma.customer.upsert({
      where: { nationalId: "1199280000003120" },
      update: {},
      create: {
        names: "Claudine Mukamazimpaka", nationalId: "1199280000003120",
        dateOfBirth: new Date("1992-08-30"), gender: "Female",
        province: "Kigali", district: "Kicukiro", sector: "Gatenga", cell: "Ruhuha", village: "Agakomeye",
        phone: "+250788111003", email: "claudine.m@gmail.com",
        maritalStatus: "Single",
        employmentStatus: "Employed", employerName: "King Faisal Hospital",
        relationshipWithNdfsp: "Client", companyId: ingobyi.id,
      },
    }),
    prisma.customer.upsert({
      where: { nationalId: "1198880000004121" },
      update: {},
      create: {
        names: "Samuel Hategekimana", nationalId: "1198880000004121",
        dateOfBirth: new Date("1988-03-15"), gender: "Male",
        province: "Western", district: "Rubavu", sector: "Gisenyi", cell: "Amahoro", village: "Kivumu",
        phone: "+250788111004", email: "samuel.h@outlook.com",
        maritalStatus: "Married", maritalPropertyRegime: "Community of Property",
        spouseName: "Grace Hategekimana", spousePhone: "+250788111012", spouseIdNumber: "1199280000012003",
        employmentStatus: "Self-employed",
        relationshipWithNdfsp: "Client", companyId: ingobyi.id,
      },
    }),
    prisma.customer.upsert({
      where: { nationalId: "1199580000005122" },
      update: {},
      create: {
        names: "Vestine Nyiramana", nationalId: "1199580000005122",
        dateOfBirth: new Date("1995-12-07"), gender: "Female",
        province: "Northern", district: "Musanze", sector: "Muhoza", cell: "Cyabararika", village: "Rwili",
        phone: "+250788111005", email: "vestine.n@gmail.com",
        maritalStatus: "Single",
        employmentStatus: "Self-employed",
        relationshipWithNdfsp: "Client", companyId: ingobyi.id,
      },
    }),
  ]);

  const [marie, patrick, , samuel] = customers;
  console.log("✅ Customers created");

  // ── 4. Loans ─────────────────────────────────────────────────────────────────
  // annualInterestRate: 30% = 2.5%/month × 12
  const firstPaymentMarie   = new Date("2024-04-05");
  const schedMarie = generateSchedule(1000000, 30, "declining", 12, firstPaymentMarie, 30);

  const loan1 = await prisma.loan.upsert({
    where: { id: "loan-marie-001" },
    update: {},
    create: {
      id:                     "loan-marie-001",
      customerId:             marie.id,
      companyId:              ingobyi.id,
      loanOfficerId:          alice.id,
      approvedById:           md.id,
      branchName:             "Kigali Main",
      purpose:                "Business expansion",
      amount:                 1000000,
      annualInterestRate:     30,
      interestMethod:         "declining",
      repaymentFrequencyDays: 30,
      gracePeriodDays:        0,
      firstPaymentDate:       firstPaymentMarie,
      agreedMaturityDate:     new Date("2025-03-05"),
      totalInstallments:      12,
      installmentsPaid:       6,
      disbursedAmount:        950000,
      disbursementDate:       new Date("2024-03-05"),
      status:                 "active",
      totalRepayable:         1150000,
      amountRepaidPrincipal:  500000,
      amountRepaidInterest:   74998,
      balanceOutstanding:     500000,
      nextPaymentDate:        new Date("2024-10-05"),
      nextPaymentAmount:      95833,
      lastPaymentDate:        new Date("2024-09-05"),
      collateralType:         "Movable Assets",
      collateralAmount:       1200000,
      eligibleCollateral:     900000,
      loanClass:              "Normal",
      provisioningRate:       1,
      provisionRequired:      5000,
      approvedAt:             new Date("2024-03-03"),
      installments: {
        create: schedMarie.map((row) => ({
          installmentNo: row.installmentNo,
          dueDate:       row.dueDate,
          principalDue:  row.principalDue,
          interestDue:   row.interestDue,
          totalDue:      row.totalDue,
          amountPaid:    row.installmentNo <= 6 ? row.totalDue : 0,
          paidDate:      row.installmentNo <= 6 ? new Date(`2024-0${3 + row.installmentNo}-05`) : null,
          status:        row.installmentNo <= 6 ? "paid" : (row.dueDate < new Date() ? "overdue" : "pending"),
        })),
      },
      fees: {
        create: [
          { name: "Management Fee", type: "percentage", value: 2, isRecurring: false },
          { name: "Application Fee", type: "fixed", value: 10000, isRecurring: false },
        ],
      },
    },
  });

  const firstPaymentPatrick = new Date("2024-05-15");
  const schedPatrick = generateSchedule(1500000, 36, "flat", 18, firstPaymentPatrick, 30);

  const loan2 = await prisma.loan.upsert({
    where: { id: "loan-patrick-001" },
    update: {},
    create: {
      id:                     "loan-patrick-001",
      customerId:             patrick.id,
      companyId:              ingobyi.id,
      loanOfficerId:          alice.id,
      approvedById:           md.id,
      branchName:             "Kigali Main",
      purpose:                "Home renovation",
      amount:                 1500000,
      annualInterestRate:     36,
      interestMethod:         "flat",
      repaymentFrequencyDays: 30,
      gracePeriodDays:        0,
      firstPaymentDate:       firstPaymentPatrick,
      agreedMaturityDate:     new Date("2025-10-15"),
      totalInstallments:      18,
      installmentsPaid:       5,
      disbursedAmount:        1425000,
      disbursementDate:       new Date("2024-04-15"),
      status:                 "overdue",
      totalRepayable:         1882500,
      amountRepaidPrincipal:  416667,
      amountRepaidInterest:   183333,
      balanceOutstanding:     1282500,
      nextPaymentDate:        new Date("2024-10-15"),
      nextPaymentAmount:      120000,
      lastPaymentDate:        new Date("2024-09-15"),
      penaltyAmount:          12000,
      daysOverdue:            15,
      arrearsStartDate:       new Date("2024-09-30"),
      collateralType:         "Real Estate",
      collateralAmount:       5000000,
      eligibleCollateral:     4000000,
      loanClass:              "Watch",
      provisioningRate:       3,
      provisionRequired:      38475,
      approvedAt:             new Date("2024-04-12"),
      installments: {
        create: schedPatrick.map((row) => ({
          installmentNo: row.installmentNo,
          dueDate:       row.dueDate,
          principalDue:  row.principalDue,
          interestDue:   row.interestDue,
          totalDue:      row.totalDue,
          amountPaid:    row.installmentNo <= 5 ? row.totalDue : 0,
          paidDate:      row.installmentNo <= 5 ? new Date(`2024-0${4 + row.installmentNo}-15`) : null,
          status:        row.installmentNo <= 5 ? "paid" : (row.dueDate < new Date() ? "overdue" : "pending"),
        })),
      },
      fees: {
        create: [
          { name: "Processing Fee", type: "fixed", value: 25000, isRecurring: false },
          { name: "Management Fee", type: "percentage", value: 2.5, isRecurring: false },
        ],
      },
    },
  });

  const firstPaymentSamuel = new Date("2024-11-20");
  const schedSamuel = generateSchedule(500000, 42, "flat", 6, firstPaymentSamuel, 30);

  await prisma.loan.upsert({
    where: { id: "loan-samuel-001" },
    update: {},
    create: {
      id:                     "loan-samuel-001",
      customerId:             samuel.id,
      companyId:              ingobyi.id,
      loanOfficerId:          alice.id,
      branchName:             "Musanze Branch",
      purpose:                "Agricultural inputs",
      amount:                 500000,
      annualInterestRate:     42,
      interestMethod:         "flat",
      repaymentFrequencyDays: 30,
      gracePeriodDays:        0,
      firstPaymentDate:       firstPaymentSamuel,
      agreedMaturityDate:     new Date("2025-04-20"),
      totalInstallments:      6,
      installmentsPaid:       0,
      disbursedAmount:        0,
      status:                 "pending",
      totalRepayable:         605000,
      balanceOutstanding:     500000,
      nextPaymentDate:        firstPaymentSamuel,
      nextPaymentAmount:      100833,
      collateralType:         "Movable Assets",
      collateralAmount:       600000,
      eligibleCollateral:     480000,
      loanClass:              "Normal",
      provisioningRate:       1,
      provisionRequired:      5000,
      installments: {
        create: schedSamuel.map((row) => ({
          installmentNo: row.installmentNo,
          dueDate:       row.dueDate,
          principalDue:  row.principalDue,
          interestDue:   row.interestDue,
          totalDue:      row.totalDue,
        })),
      },
      fees: {
        create: [{ name: "Application Fee", type: "fixed", value: 5000, isRecurring: false }],
      },
    },
  });

  console.log("✅ Loans + installment schedules created");

  // ── 5. Payments ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.payment.upsert({
      where: { reference: "MM-2024-09-001" },
      update: {},
      create: {
        loanId: loan1.id, customerId: marie.id, companyId: ingobyi.id,
        amount: 95833, penalty: 0, interest: 25000, principal: 70833,
        date: new Date("2024-09-05"), method: "mobile_money",
        reference: "MM-2024-09-001", recordedById: users[4].id,
      },
    }),
    prisma.payment.upsert({
      where: { reference: "BT-2024-09-002" },
      update: {},
      create: {
        loanId: loan2.id, customerId: patrick.id, companyId: ingobyi.id,
        amount: 132000, penalty: 12000, interest: 45000, principal: 75000,
        date: new Date("2024-09-15"), method: "bank_transfer",
        reference: "BT-2024-09-002", recordedById: users[4].id,
        notes: "Late payment - penalty applied",
      },
    }),
  ]);

  console.log("✅ Payments created");

  // ── 6. Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      { type: "payment_due", title: "Payment Due Tomorrow", isRead: false, companyId: ingobyi.id, link: `/loans/loan-patrick-001`, message: "Patrick Nzabonimpa's payment of RWF 120,000 is due on 2024-10-15" },
      { type: "approval_needed", title: "Loan Awaiting Approval", isRead: false, companyId: ingobyi.id, link: "/loans/loan-samuel-001", message: "Samuel Hategekimana's loan of RWF 500,000 requires your approval" },
      { type: "overdue", title: "Overdue Payment Alert", isRead: true, companyId: ingobyi.id, link: `/loans/loan-patrick-001`, message: "Patrick Nzabonimpa has an overdue payment with penalty of RWF 12,000" },
      { type: "system", title: "Monthly Report Ready", isRead: false, companyId: ingobyi.id, link: "/reports", message: "The September 2024 financial report is now available for review" },
    ],
  });

  // ── 7. Assets & Expenses ─────────────────────────────────────────────────────
  await prisma.asset.createMany({
    skipDuplicates: true,
    data: [
      { name: "Dell Server", category: "IT Equipment", purchaseDate: new Date("2023-01-15"), purchaseValue: 4500000, currentValue: 3600000, depreciationRate: 20, companyId: ingobyi.id },
      { name: "Toyota Hilux", category: "Vehicle", purchaseDate: new Date("2022-06-20"), purchaseValue: 28000000, currentValue: 21000000, depreciationRate: 25, companyId: ingobyi.id },
    ],
  });

  await prisma.expense.createMany({
    skipDuplicates: true,
    data: [
      { category: "Staff Salaries", description: "October 2024 payroll", amount: 8500000, date: new Date("2024-10-01"), companyId: ingobyi.id },
      { category: "Rent", description: "Office rent - October", amount: 1200000, date: new Date("2024-10-01"), companyId: ingobyi.id },
      { category: "Utilities", description: "Electricity & Internet", amount: 280000, date: new Date("2024-10-05"), companyId: ingobyi.id },
    ],
  });

  console.log("✅ Assets & expenses created");
  console.log("\n🎉 Seed complete!\n");
  console.log("Test accounts:");
  console.log("  Super Admin : admin@ingobyi.rw     / Admin@1234");
  console.log("  Director    : jp@ingobyi.rw        / Manager@1234");
  console.log("  Loan Officer: alice@ingobyi.rw     / Officer@1234");
  console.log("  Receptionist: grace@ingobyi.rw     / Staff@1234");
  console.log("  Shareholder : david@ingobyi.rw     / Share@1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
