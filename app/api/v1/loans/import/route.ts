import { prisma } from "@/lib/prisma";
import { LoanStatus } from "@/lib/generated/prisma/client";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const VALID_IMPORT_STATUSES = ["pending", "active", "overdue", "completed", "written_off", "rejected", "disbursed"] as const;
type ImportStatus = typeof VALID_IMPORT_STATUSES[number];

/** Return candidate phone strings to search (handles leading 0, +250, 250 prefix) */
function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const variants = new Set<string>([raw, digits]);
  if (digits.length === 9)  variants.add("0" + digits);            // 785337778 → 0785337778
  if (digits.startsWith("250") && digits.length === 12) variants.add("0" + digits.slice(3)); // 250785337778 → 0785337778
  if (digits.startsWith("0") && digits.length === 10)  variants.add("+250" + digits.slice(1));
  return [...variants].filter(Boolean);
}

const rowSchema = z.object({
  loan_id:                 z.string().optional().nullable().transform((v) => v?.trim() || undefined),
  customer_national_id:    z.string().min(1, "customer_national_id is required"),
  customer_name:           z.string().optional().nullable().transform((v) => v?.trim() || undefined),
  customer_phone:          z.string().optional().nullable().transform((v) => v?.trim() || undefined),
  purpose:                 z.string().optional().nullable().transform((v) => v || "Imported Loan"),
  amount:                  z.coerce.number().positive("amount must be positive").transform(Math.round),
  annual_interest_rate:    z.coerce.number().min(0).max(999).default(0),
  interest_method:         z.enum(["flat", "declining"]).optional().default("flat"),
  repayment_frequency_days:z.coerce.number().int().positive().optional().default(30),
  total_installments:      z.coerce.number().int().positive().optional().default(12),
  first_payment_date:      z.string().optional().nullable().transform((v) => v || undefined),
  last_payment_date:       z.string().optional().nullable().transform((v) => v || undefined),
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

    // Track IDs used in this batch to detect in-file duplicates
    const usedInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // row 1 = header

      const parsed = rowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({ row: rowNum, message: parsed.error.issues[0].message });
        continue;
      }

      const d = parsed.data;

      // Try National ID first (exact string match, then numeric-string match)
      const natIdVariants = [...new Set([
        d.customer_national_id,
        // Strip non-digits in case it was stored differently
        d.customer_national_id.replace(/\D/g, ""),
        // In case it was stored as a number and converted: also try trimmed
        d.customer_national_id.trim(),
      ])];

      let customer = await prisma.customer.findFirst({
        where: { nationalId: { in: natIdVariants }, companyId: auth.companyId! },
      });

      // Fallback: match by phone number if National ID lookup failed
      if (!customer && d.customer_phone) {
        const phones = phoneVariants(d.customer_phone);
        customer = await prisma.customer.findFirst({
          where: { phone: { in: phones }, companyId: auth.companyId! },
        });
      }

      if (!customer) {
        errors.push({ row: rowNum, message: `Customer not found — tried national ID "${d.customer_national_id}"${d.customer_phone ? ` and phone "${d.customer_phone}"` : ""}` });
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

      const totalInterestScheduled = schedule.reduce((s, r) => s + r.interestDue, 0);
      const totalMgmtFeeScheduled  = schedule.reduce((s, r) => s + r.managementFeeDue, 0);

      // Parse last payment date if provided
      const lastPaymentDate = d.last_payment_date ? new Date(d.last_payment_date) : undefined;
      if (lastPaymentDate && isNaN(lastPaymentDate.getTime())) {
        errors.push({ row: rowNum, message: `Invalid last_payment_date: "${d.last_payment_date}"` });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          let loanId = d.loan_id;
          if (!loanId) {
            const loanCount = await tx.loan.count({ where: { companyId: auth.companyId! } });
            loanId = `${idPrefix}-${String(loanCount + 1).padStart(3, "0")}`;
          } else {
            // Deduplicate: suffix with -2, -3 … if the ID is already taken in DB or in this batch
            const base = loanId;
            let suffix = 2;
            while (
              usedInBatch.has(loanId) ||
              (await tx.loan.findUnique({ where: { id: loanId }, select: { id: true } }))
            ) {
              loanId = `${base}-${suffix++}`;
            }
          }
          usedInBatch.add(loanId);

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
              totalInterestScheduled,
              totalMgmtFeeScheduled,
              balanceOutstanding:     d.balance_outstanding ?? (importStatus === "completed" ? 0 : d.amount),
              nextPaymentDate:        firstPaymentDate,
              nextPaymentAmount,
              branchName:             d.branch_name,
              collateralType:         d.collateral_type,
              collateralAmount:       d.collateral_amount,
              loanClass,
              provisioningRate,
              provisionRequired,
              status:                 importStatus as LoanStatus,
              disbursedAmount:        isLive ? d.amount : 0,
              disbursementDate:       disbursementDate ?? null,
              lastPaymentDate:        lastPaymentDate ?? null,
              daysOverdue,
              arrearsStartDate:       arrearsStartDate ?? null,
              penaltyRatePerDay:      d.penalty_rate > 0 ? d.penalty_rate / 365 : 0,
            },
          });

          await tx.installment.createMany({
            data: schedule.map((row) => ({
              loanId:          loan.id,
              installmentNo:   row.installmentNo,
              dueDate:         row.dueDate,
              principalDue:    row.principalDue,
              interestDue:     row.interestDue,
              managementFeeDue: row.managementFeeDue,
              totalDue:        row.totalDue,
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
