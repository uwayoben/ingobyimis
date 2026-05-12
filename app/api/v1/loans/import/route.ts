import { prisma } from "@/lib/prisma";
import { LoanStatus } from "@/lib/generated/prisma/client";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const VALID_IMPORT_STATUSES = ["pending", "active", "overdue", "completed", "written_off", "rejected", "disbursed"] as const;
type ImportStatus = typeof VALID_IMPORT_STATUSES[number];

const rowSchema = z.object({
  customer_national_id:    z.string().min(1, "customer_national_id is required"),
  purpose:                 z.string().optional().nullable().transform((v) => v || "Imported Loan"),
  amount:                  z.coerce.number().positive("amount must be positive").transform(Math.round),
  annual_interest_rate:    z.coerce.number().min(0).max(200).default(0),
  interest_method:         z.enum(["flat", "declining"]).optional().default("flat"),
  repayment_frequency_days:z.coerce.number().int().positive().optional().default(30),
  total_installments:      z.coerce.number().int().positive().optional().default(12),
  first_payment_date:      z.string().optional().nullable().transform((v) => v || undefined),
  branch_name:             z.string().optional().nullable().transform((v) => v || undefined),
  collateral_type:         z.string().optional().nullable().transform((v) => v || undefined),
  collateral_amount:       z.coerce.number().positive().optional().nullable().transform((v) => (v ? Math.round(v) : undefined)),
  balance_outstanding:     z.coerce.number().min(0).optional().nullable().transform((v) => (v != null && v > 0 ? Math.round(v) : undefined)),
  status:                  z.enum(VALID_IMPORT_STATUSES).optional().default("active"),
  days_overdue:            z.coerce.number().int().min(0).optional().default(0),
  disbursement_date:       z.string().optional().nullable().transform((v) => v || undefined),
  penalty_rate:            z.coerce.number().min(0).optional().default(0),
});

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const body = await request.json();
    const rows: unknown[] = body.loans;
    if (!Array.isArray(rows) || rows.length === 0) return badRequest("No loan rows provided.");
    if (rows.length > 500) return badRequest("Maximum 500 loans per import.");

    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    // Build loan ID prefix from company name
    const company = await prisma.company.findUnique({
      where: { id: auth.companyId! },
      select: { name: true },
    });
    const idPrefix = (company?.name ?? "XX").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // row 1 = header

      const parsed = rowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({ row: rowNum, message: parsed.error.issues[0].message });
        continue;
      }

      const d = parsed.data;

      const customer = await prisma.customer.findFirst({
        where: { nationalId: d.customer_national_id, companyId: auth.companyId! },
      });
      if (!customer) {
        errors.push({ row: rowNum, message: `Customer with national ID "${d.customer_national_id}" not found in this company` });
        continue;
      }

      // Derive first_payment_date: explicit > disbursement+frequency > today+frequency
      let firstPaymentDate: Date;
      if (d.first_payment_date) {
        firstPaymentDate = new Date(d.first_payment_date);
        if (isNaN(firstPaymentDate.getTime())) {
          errors.push({ row: rowNum, message: `Invalid first_payment_date: "${d.first_payment_date}"` });
          continue;
        }
      } else {
        const base = d.disbursement_date ? new Date(d.disbursement_date) : new Date();
        firstPaymentDate = new Date(base.getTime() + d.repayment_frequency_days * 86400_000);
      }

      const periodsPerYear   = 360 / d.repayment_frequency_days;
      const periodRate       = d.annual_interest_rate / 100 / periodsPerYear;

      let totalRepayable: number;
      let nextPaymentAmount: number;
      if (d.interest_method === "flat") {
        const totalInterest = d.amount * periodRate * d.total_installments;
        totalRepayable    = Math.round(d.amount + totalInterest);
        nextPaymentAmount = Math.round(totalRepayable / d.total_installments);
      } else {
        const exactEmi = periodRate === 0
          ? d.amount / d.total_installments
          : (d.amount * periodRate) / (1 - Math.pow(1 + periodRate, -d.total_installments));
        nextPaymentAmount = Math.round(exactEmi);
        totalRepayable    = Math.round(exactEmi * d.total_installments);
      }

      const agreedMaturityDate = new Date(firstPaymentDate);
      agreedMaturityDate.setDate(agreedMaturityDate.getDate() + (d.total_installments - 1) * d.repayment_frequency_days);

      // Determine days overdue and classify accordingly
      const importStatus: ImportStatus = d.status;
      const daysOverdue = (importStatus === "overdue" && d.days_overdue > 0) ? d.days_overdue
                        : (importStatus === "overdue") ? 30
                        : d.days_overdue > 0 ? d.days_overdue : 0;
      const { loanClass, provisioningRate } = classifyLoan(daysOverdue);
      const provisionRequired = Math.round(d.amount * provisioningRate / 100);

      // For active/overdue/completed loans the principal was already disbursed
      const isLive = importStatus !== "pending";
      const disbursementDate = d.disbursement_date
        ? new Date(d.disbursement_date)
        : isLive
          ? new Date(firstPaymentDate.getTime() - d.repayment_frequency_days * 86400_000)
          : undefined;

      const arrearsStartDate = importStatus === "overdue"
        ? new Date(Date.now() - daysOverdue * 86400_000)
        : undefined;

      const schedule = generateSchedule(
        d.amount,
        d.annual_interest_rate,
        d.interest_method,
        d.total_installments,
        firstPaymentDate,
        d.repayment_frequency_days,
      );

      try {
        await prisma.$transaction(async (tx) => {
          const loanCount = await tx.loan.count({ where: { companyId: auth.companyId! } });
          const loanId    = `${idPrefix}-${String(loanCount + 1).padStart(3, "0")}`;

          const loan = await tx.loan.create({
            data: {
              id:                     loanId,
              companyId:              auth.companyId!,
              customerId:             customer.id,
              loanOfficerId:          auth.userId,
              purpose:                d.purpose,
              amount:                 d.amount,
              annualInterestRate:     d.annual_interest_rate,
              interestMethod:         d.interest_method,
              repaymentFrequencyDays: d.repayment_frequency_days,
              firstPaymentDate,
              agreedMaturityDate,
              totalInstallments:      d.total_installments,
              totalRepayable,
              balanceOutstanding:     d.balance_outstanding ?? (importStatus === "completed" ? 0 : d.amount),
              nextPaymentDate:        firstPaymentDate,
              nextPaymentAmount,
              branchName:             d.branch_name,
              collateralType:         d.collateral_type,
              collateralAmount:       d.collateral_amount,
              loanClass,
              provisioningRate,
              provisionRequired,
              status:                 importStatus.replace("written_off", "written_off") as LoanStatus,
              disbursedAmount:        isLive ? d.amount : 0,
              disbursementDate:       disbursementDate ?? null,
              daysOverdue,
              arrearsStartDate:       arrearsStartDate ?? null,
              penaltyRatePerDay:      d.penalty_rate > 0 ? d.penalty_rate / 365 : 0,
            },
          });

          await tx.installment.createMany({
            data: schedule.map((row) => ({
              loanId:        loan.id,
              installmentNo: row.installmentNo,
              dueDate:       row.dueDate,
              principalDue:  row.principalDue,
              interestDue:   row.interestDue,
              totalDue:      row.totalDue,
            })),
          });
        });
        imported++;
      } catch (err: any) {
        errors.push({ row: rowNum, message: err?.message ?? "Failed to create loan" });
      }
    }

    return ok({ imported, errors, total: rows.length });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
