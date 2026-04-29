import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { generateSchedule, classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const createSchema = z.object({
  customerId:             z.string().min(1),
  branchName:             z.string().optional(),
  purpose:                z.string().min(1),
  amount:                 z.number().positive(),
  annualInterestRate:     z.number().positive(),
  interestMethod:         z.enum(["flat", "declining"]),
  repaymentFrequencyDays: z.number().int().positive(),
  gracePeriodDays:        z.number().int().min(0).default(0),
  firstPaymentDate:       z.string(),           // ISO date string
  totalInstallments:      z.number().int().positive(),
  collateralType:         z.string().optional(),
  collateralAmount:       z.number().int().optional(),
  eligibleCollateral:     z.number().int().optional(),
  fees: z.array(z.object({
    name:        z.string(),
    type:        z.enum(["fixed", "percentage"]),
    value:       z.number(),
    isRecurring: z.boolean().optional(),
  })).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, Number(searchParams.get("page")  ?? 1));
    const limit  = Math.min(100, Number(searchParams.get("limit") ?? 20));
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const skip   = (page - 1) * limit;

    const where = {
      companyId: auth.companyId!,
      ...(status && status !== "all" && { status: status as any }),
      ...(search && {
        OR: [
          { customer: { names: { contains: search } } },
          { id: { contains: search } },
        ],
      }),
    };

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, names: true } },
          fees: true,
        },
      }),
      prisma.loan.count({ where }),
    ]);

    const data = loans.map((l) => ({
      ...l,
      customerName:      l.customer.names,
      annualInterestRate: Number(l.annualInterestRate),
      provisioningRate:   Number(l.provisioningRate),
      installmentsOutstanding: l.totalInstallments - l.installmentsPaid,
    }));

    return paginated(data, total, page, limit);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const d = parsed.data;
    const firstPaymentDate = new Date(d.firstPaymentDate);
    const periodsPerYear   = 365 / d.repaymentFrequencyDays;
    const periodRate       = d.annualInterestRate / 100 / periodsPerYear;

    // Total repayable
    let totalRepayable: number;
    let nextPaymentAmount: number;
    if (d.interestMethod === "flat") {
      const totalInterest = d.amount * periodRate * d.totalInstallments;
      totalRepayable    = Math.round(d.amount + totalInterest);
      nextPaymentAmount = Math.round(totalRepayable / d.totalInstallments);
    } else {
      nextPaymentAmount = periodRate === 0
        ? Math.round(d.amount / d.totalInstallments)
        : Math.round((d.amount * periodRate) / (1 - Math.pow(1 + periodRate, -d.totalInstallments)));
      totalRepayable = nextPaymentAmount * d.totalInstallments;
    }

    // Agreed maturity date = firstPaymentDate + (n-1) * frequencyDays
    const agreedMaturityDate = new Date(firstPaymentDate);
    agreedMaturityDate.setDate(agreedMaturityDate.getDate() + (d.totalInstallments - 1) * d.repaymentFrequencyDays);

    // BNR provisioning (new loan = Normal, 1%)
    const { loanClass, provisioningRate } = classifyLoan(0);
    const provisionRequired = Math.round(d.amount * provisioningRate / 100);

    // Generate installment schedule
    const schedule = generateSchedule(
      d.amount,
      d.annualInterestRate,
      d.interestMethod,
      d.totalInstallments,
      firstPaymentDate,
      d.repaymentFrequencyDays,
    );

    const loan = await prisma.$transaction(async (tx) => {
      const newLoan = await tx.loan.create({
        data: {
          companyId:              auth.companyId!,
          customerId:             d.customerId,
          loanOfficerId:          auth.userId,
          branchName:             d.branchName,
          purpose:                d.purpose,
          amount:                 d.amount,
          annualInterestRate:     d.annualInterestRate,
          interestMethod:         d.interestMethod,
          repaymentFrequencyDays: d.repaymentFrequencyDays,
          gracePeriodDays:        d.gracePeriodDays,
          firstPaymentDate,
          agreedMaturityDate,
          totalInstallments:      d.totalInstallments,
          totalRepayable,
          balanceOutstanding:     d.amount,
          nextPaymentDate:        firstPaymentDate,
          nextPaymentAmount,
          collateralType:         d.collateralType,
          collateralAmount:       d.collateralAmount,
          eligibleCollateral:     d.eligibleCollateral,
          loanClass,
          provisioningRate,
          provisionRequired,
          fees: d.fees?.length
            ? { create: d.fees.map((f) => ({ name: f.name, type: f.type as any, value: f.value, isRecurring: f.isRecurring ?? false })) }
            : undefined,
        },
      });

      // Create installment schedule
      await tx.installment.createMany({
        data: schedule.map((row) => ({
          loanId:        newLoan.id,
          installmentNo: row.installmentNo,
          dueDate:       row.dueDate,
          principalDue:  row.principalDue,
          interestDue:   row.interestDue,
          totalDue:      row.totalDue,
        })),
      });

      // Notify MD for approval
      await tx.notification.create({
        data: {
          type:      "approval_needed",
          title:     "New Loan Application",
          message:   `New loan of RWF ${d.amount.toLocaleString()} submitted by ${auth.name} requires approval.`,
          companyId: auth.companyId!,
          link:      `/loans/${newLoan.id}`,
        },
      });

      return newLoan;
    });

    return created(loan);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
