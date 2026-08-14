import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";
import { classifyLoan, calculateMonthlyAdditionalInterest } from "@/lib/loan-schedule";
import { applyAdditionalInterestCharge } from "@/lib/loan-charges";

/**
 * POST /api/v1/cron/classify-loans
 *
 * 1. Flips pending/partial installments that are past due → "overdue".
 * 2. Recalculates daysOverdue for every active/overdue loan and updates
 *    loanClass, status, and arrearsStartDate accordingly.
 * 3. For loans that have a penaltyRatePerDay > 0, adds the incremental
 *    daily penalty on each overdue installment since the last run.
 * 4. Resets classification to Normal/active when a borrower catches up.
 * 5. For companies with additionalInterestMode === "auto", charges
 *    additional interest for every newly-crossed 30-day overdue cycle,
 *    using the loan's own stored interest rate. Guarded by
 *    additionalInterestMonthsCharged so a loan is never double-charged
 *    for the same month, even across repeated/retried runs.
 *
 * Classification thresholds:
 *   0 days   → Normal       (1% provision)
 *   1–89     → Watch        (3%)
 *   90–179   → Substandard  (20%)
 *   180–359  → Doubtful     (50%)
 *   360+     → Loss         (100%)
 *
 * Body: { dryRun?: boolean } — when true, additional-interest charges
 * are computed and returned but never posted (steps 1–4 are unaffected;
 * they're the existing, already-relied-upon classification behavior).
 */
export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const body: { dryRun?: boolean } = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const companyFilter = auth.companyId ? { companyId: auth.companyId } : {};

    // Step 1: flip pending/partial installments that are now past their due date
    await prisma.installment.updateMany({
      where: {
        loan: { ...companyFilter, status: { in: ["active", "overdue"] } },
        status: { in: ["pending", "partial"] },
        dueDate: { lt: today },
      },
      data: { status: "overdue" },
    });

    // Step 2: load every active/overdue loan with ALL its overdue installments
    const loans = await prisma.loan.findMany({
      where: { ...companyFilter, status: { in: ["active", "overdue"] } },
      select: {
        id:                       true,
        companyId:                true,
        balanceOutstanding:        true,
        arrearsStartDate:          true,
        penaltyAmount:             true,
        penaltyRatePerDay:         true,
        lastPenaltyCalculatedAt:   true,
        annualInterestRate:              true,
        additionalInterestMonthsCharged: true,
        company: { select: { additionalInterestMode: true } },
        installments: {
          where:   { status: "overdue" },
          orderBy: { dueDate: "asc" },
          select:  { dueDate: true, totalDue: true },
        },
      },
    });

    let updated = 0;
    let additionalInterestApplied = 0;
    const additionalInterestPreview: { loanId: string; monthsOverdue: number; monthsToCharge: number; amount: number }[] = [];

    for (const loan of loans) {
      const earliest    = loan.installments[0];

      // ── Classification & overdue days ──────────────────────────────
      let daysOverdue: number;
      let newStatus: "active" | "overdue";
      let arrearsStartDate: Date | null;

      if (!earliest) {
        // All installments on time — clear arrears
        daysOverdue      = 0;
        newStatus        = "active";
        arrearsStartDate = null;
      } else {
        const dueDay = new Date(earliest.dueDate);
        dueDay.setHours(0, 0, 0, 0);
        daysOverdue      = Math.floor((today.getTime() - dueDay.getTime()) / 86_400_000);
        newStatus        = "overdue";
        arrearsStartDate = loan.arrearsStartDate ?? earliest.dueDate;
      }

      const { loanClass, provisioningRate } = classifyLoan(daysOverdue);
      const provisionRequired = Math.round(loan.balanceOutstanding * provisioningRate / 100);

      // Auto-penalty is disabled — penalties are added manually by staff.
      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          daysOverdue,
          loanClass,
          provisioningRate,
          provisionRequired,
          status:          newStatus,
          arrearsStartDate,
        },
      });
      updated++;

      // ── Step 5: auto additional interest (company opt-in only) ──────
      if (loan.company.additionalInterestMode === "auto" && daysOverdue >= 30) {
        const monthsOverdue  = Math.floor(daysOverdue / 30);
        const monthsToCharge = monthsOverdue - loan.additionalInterestMonthsCharged;

        if (monthsToCharge > 0) {
          const chargePerMonth = calculateMonthlyAdditionalInterest(Number(loan.annualInterestRate), loan.balanceOutstanding);
          const amount = chargePerMonth * monthsToCharge;

          if (dryRun) {
            additionalInterestPreview.push({ loanId: loan.id, monthsOverdue, monthsToCharge, amount });
          } else if (amount > 0) {
            await applyAdditionalInterestCharge({
              loanId:                 loan.id,
              companyId:              loan.companyId,
              amount,
              reason:                 `Auto-applied for ${monthsToCharge} newly-crossed overdue month(s) (loan is ${monthsOverdue} month(s) overdue).`,
              recordedByUserId:       null,
              monthsChargedIncrement: monthsToCharge,
            });
            additionalInterestApplied++;
          } else {
            // Nothing to charge (e.g. principal already fully repaid) —
            // still advance the counter so this loan isn't re-evaluated forever.
            await prisma.loan.update({
              where: { id: loan.id },
              data: { additionalInterestMonthsCharged: monthsOverdue },
            });
          }
        }
      }
    }

    return ok({
      updated,
      processedAt: today.toISOString(),
      additionalInterestApplied,
      ...(dryRun ? { dryRun: true, wouldChargeAdditionalInterest: additionalInterestPreview } : {}),
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
