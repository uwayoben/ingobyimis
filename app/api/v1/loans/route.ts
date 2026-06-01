import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, paginated, unauthorized, badRequest, forbidden, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  customerId:             z.string().min(1),
  branchName:             z.string().optional(),
  purpose:                z.string().min(1),
  amount:                 z.number().positive(),
  annualInterestRate:     z.number().positive(),
  interestMethod:         z.enum(["flat", "declining"]),
  repaymentFrequencyDays: z.number().int().positive(),
  gracePeriodDays:        z.number().int().min(0).default(0),
  // firstPaymentDate is calculated at disbursement — not required at registration
  totalInstallments:      z.number().int().positive(),
  penaltyRatePerDay:      z.number().min(0).max(100).default(0),
  managementFeeRate:      z.number().min(0).default(0),  // annual %, charged per installment like interest
  processingFeeRate:      z.number().min(0).default(0),  // annual %, charged per installment like interest
  collateralType:         z.string().optional(),
  collateralAmount:       z.number().int().optional(),
  eligibleCollateral:     z.number().int().optional(),
  fees: z.array(z.object({
    name:        z.string(),
    type:        z.enum(["fixed", "percentage"]),
    value:       z.number(),
    isRecurring: z.boolean().optional(),
  })).optional(),
  documents: z.array(z.object({
    documentType: z.enum(["national_id", "passport", "employment_letter", "bank_statement", "collateral_proof", "other"]),
    name:         z.string(),
    url:          z.string().url(),
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

    const loanIds = loans.map((l) => l.id);
    const penaltyGroups = loanIds.length
      ? await prisma.payment.groupBy({
          by: ["loanId"],
          where: { loanId: { in: loanIds } },
          _sum: { penalty: true },
        })
      : [];
    const penaltyPaidMap = Object.fromEntries(
      penaltyGroups.map((g) => [g.loanId, g._sum.penalty ?? 0])
    );

    // Fetch signedContractUrl via raw SQL to bypass any Prisma client cache issues.
    // MySQL may return column names in lowercase, so we check both casings.
    const contractMap: Record<string, string | null> = {};
    if (loanIds.length) {
      const placeholders = loanIds.map(() => "?").join(",");
      const contractRows = await prisma.$queryRawUnsafe<Record<string, any>[]>(
        `SELECT id, signedContractUrl FROM Loan WHERE id IN (${placeholders})`,
        ...loanIds
      ).catch(() => [] as Record<string, any>[]);
      for (const r of contractRows) {
        const rowId  = r["id"] ?? r["ID"];
        const rawUrl = r["signedContractUrl"] ?? r["signedcontracturl"] ?? r["SIGNEDCONTRACTURL"] ?? null;
        if (rowId) contractMap[rowId] = rawUrl;
      }
    }

    const data = loans.map((l) => ({
      ...l,
      customerName:       l.customer.names,
      annualInterestRate: Number(l.annualInterestRate),
      provisioningRate:   Number(l.provisioningRate),
      managementFeeRate:  Number(l.managementFeeRate),
      processingFeeRate:  Number((l as any).processingFeeRate ?? 0),
      signedContractUrl:  contractMap[l.id] ?? null,
      installmentsOutstanding: l.totalInstallments - l.installmentsPaid,
      penaltyPaid: penaltyPaidMap[l.id] ?? 0,
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
    if (!["managing_director", "loan_officer", "super_admin"].includes(auth.role)) return forbidden();
    if (!auth.companyId) return forbidden("Company context required.");

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const d = parsed.data;
    const periodsPerYear        = 360 / d.repaymentFrequencyDays;
    const interestPeriodRate    = d.annualInterestRate    / 100 / periodsPerYear;
    const mgmtFeePeriodRate     = d.managementFeeRate     / 100 / periodsPerYear;
    const procFeePeriodRate     = d.processingFeeRate     / 100 / periodsPerYear;
    const combinedPeriodRate    = interestPeriodRate + mgmtFeePeriodRate + procFeePeriodRate;

    // Total repayable — includes principal + interest + management fee + processing fee
    let totalRepayable              = 0;
    let nextPaymentAmount           = 0;
    let totalInterestScheduled      = 0;
    let totalMgmtFeeScheduled       = 0;
    let totalProcessingFeeScheduled = 0;

    if (d.interestMethod === "flat") {
      const totalInterest    = d.amount * interestPeriodRate * d.totalInstallments;
      const totalMgmtFee     = d.amount * mgmtFeePeriodRate  * d.totalInstallments;
      const totalProcFee     = d.amount * procFeePeriodRate  * d.totalInstallments;
      totalRepayable              = Math.round(d.amount + totalInterest + totalMgmtFee + totalProcFee);
      nextPaymentAmount           = Math.round(totalRepayable / d.totalInstallments);
      totalInterestScheduled      = Math.round(totalInterest);
      totalMgmtFeeScheduled       = Math.round(totalMgmtFee);
      totalProcessingFeeScheduled = Math.round(totalProcFee);
    } else {
      const exactEmi = combinedPeriodRate === 0
        ? d.amount / d.totalInstallments
        : (d.amount * combinedPeriodRate) / (1 - Math.pow(1 + combinedPeriodRate, -d.totalInstallments));
      nextPaymentAmount           = Math.round(exactEmi);
      totalRepayable              = Math.round(exactEmi * d.totalInstallments);
      const totalFees             = totalRepayable - d.amount;
      totalInterestScheduled      = combinedPeriodRate > 0 ? Math.round(totalFees * (interestPeriodRate / combinedPeriodRate)) : totalFees;
      totalMgmtFeeScheduled       = combinedPeriodRate > 0 ? Math.round(totalFees * (mgmtFeePeriodRate  / combinedPeriodRate)) : 0;
      totalProcessingFeeScheduled = combinedPeriodRate > 0 ? Math.round(totalFees * (procFeePeriodRate  / combinedPeriodRate)) : 0;
    }

    // BNR provisioning (new loan = Normal, 1%)
    const { loanClass, provisioningRate } = classifyLoan(0);
    const provisionRequired = Math.round(d.amount * provisioningRate / 100);

    // firstPaymentDate and agreedMaturityDate are calculated at disbursement — not set here
    // Installment schedule is also generated at disbursement time

    // Build the custom loan ID: first 2 letters of company name + zero-padded sequence
    const company = await prisma.company.findUnique({
      where: { id: auth.companyId! },
      select: { name: true },
    });
    const prefix = (company?.name ?? "XX").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();

    const loan = await prisma.$transaction(async (tx) => {
      // Find the highest existing sequence for this prefix to avoid ID collisions
      // when loans have been deleted (COUNT-based approach recycles IDs).
      const existing = await tx.loan.findMany({
        where: { companyId: auth.companyId!, id: { startsWith: `${prefix}-` } },
        select: { id: true },
      });
      const maxSeq = existing.reduce((max, l) => {
        const n = parseInt(l.id.replace(`${prefix}-`, ""), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const seq    = String(maxSeq + 1).padStart(3, "0");
      const loanId = `${prefix}-${seq}`;

      const newLoan = await tx.loan.create({
        data: {
          id:                     loanId,
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
          // firstPaymentDate, agreedMaturityDate, nextPaymentDate set at disbursement
          totalInstallments:      d.totalInstallments,
          totalRepayable,
          balanceOutstanding:     d.amount,
          nextPaymentAmount,
          penaltyRatePerDay:      d.penaltyRatePerDay,
          managementFeeRate:          d.managementFeeRate,
          processingFeeRate:          d.processingFeeRate,
          totalInterestScheduled,
          totalMgmtFeeScheduled,
          totalProcessingFeeScheduled,
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

      // Installment schedule is NOT created here — it is generated at disbursement time

      // Attach supporting documents
      if (d.documents?.length) {
        await tx.loanDocument.createMany({
          data: d.documents.map((doc) => ({
            loanId:       newLoan.id,
            documentType: doc.documentType as any,
            name:         doc.name,
            url:          doc.url,
            uploadedById: auth.userId,
          })),
        });
      }

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
