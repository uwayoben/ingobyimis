import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const rowSchema = z.object({
  customer_national_id:    z.string().min(1, "customer_national_id is required"),
  purpose:                 z.string().min(1, "purpose is required"),
  amount:                  z.coerce.number().int().positive("amount must be a positive integer"),
  annual_interest_rate:    z.coerce.number().positive("annual_interest_rate must be positive").max(200, "annual_interest_rate seems too high"),
  interest_method:         z.enum(["flat", "declining"], { error: "interest_method must be 'flat' or 'declining'" }),
  repayment_frequency_days:z.coerce.number().int().positive("repayment_frequency_days must be a positive integer"),
  total_installments:      z.coerce.number().int().positive("total_installments must be a positive integer"),
  first_payment_date:      z.string().min(1, "first_payment_date is required"),
  branch_name:             z.string().optional().nullable().transform((v) => v || undefined),
  collateral_type:         z.string().optional().nullable().transform((v) => v || undefined),
  collateral_amount:       z.coerce.number().int().positive().optional().nullable().transform((v) => v || undefined),
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

      const firstPaymentDate = new Date(d.first_payment_date);
      if (isNaN(firstPaymentDate.getTime())) {
        errors.push({ row: rowNum, message: `Invalid first_payment_date: "${d.first_payment_date}" — use YYYY-MM-DD` });
        continue;
      }

      const periodsPerYear   = 365 / d.repayment_frequency_days;
      const periodRate       = d.annual_interest_rate / 100 / periodsPerYear;

      let totalRepayable: number;
      let nextPaymentAmount: number;
      if (d.interest_method === "flat") {
        const totalInterest = d.amount * periodRate * d.total_installments;
        totalRepayable    = Math.round(d.amount + totalInterest);
        nextPaymentAmount = Math.round(totalRepayable / d.total_installments);
      } else {
        nextPaymentAmount = periodRate === 0
          ? Math.round(d.amount / d.total_installments)
          : Math.round((d.amount * periodRate) / (1 - Math.pow(1 + periodRate, -d.total_installments)));
        totalRepayable = nextPaymentAmount * d.total_installments;
      }

      const agreedMaturityDate = new Date(firstPaymentDate);
      agreedMaturityDate.setDate(agreedMaturityDate.getDate() + (d.total_installments - 1) * d.repayment_frequency_days);

      const { loanClass, provisioningRate } = classifyLoan(0);
      const provisionRequired = Math.round(d.amount * provisioningRate / 100);

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
          const loan = await tx.loan.create({
            data: {
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
              balanceOutstanding:     d.amount,
              nextPaymentDate:        firstPaymentDate,
              nextPaymentAmount,
              branchName:             d.branch_name,
              collateralType:         d.collateral_type,
              collateralAmount:       d.collateral_amount,
              loanClass,
              provisioningRate,
              provisionRequired,
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
