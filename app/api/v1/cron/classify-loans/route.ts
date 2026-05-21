import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";

/**
 * POST /api/v1/cron/classify-loans
 *
 * 1. Flips pending/partial installments that are past due → "overdue".
 * 2. Recalculates daysOverdue for every active/overdue loan and updates
 *    loanClass, status, and arrearsStartDate accordingly.
 * 3. For loans that have a penaltyRatePerDay > 0, adds the incremental
 *    daily penalty on each overdue installment since the last run.
 * 4. Resets classification to Normal/active when a borrower catches up.
 *
 * Classification thresholds:
 *   0 days   → Normal       (1% provision)
 *   1–89     → Watch        (3%)
 *   90–179   → Substandard  (20%)
 *   180–359  → Doubtful     (50%)
 *   360+     → Loss         (100%)
 */
export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

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
        balanceOutstanding:        true,
        arrearsStartDate:          true,
        penaltyAmount:             true,
        penaltyRatePerDay:         true,
        lastPenaltyCalculatedAt:   true,
        installments: {
          where:   { status: "overdue" },
          orderBy: { dueDate: "asc" },
          select:  { dueDate: true, totalDue: true },
        },
      },
    });

    let updated = 0;

    for (const loan of loans) {
      const earliest    = loan.installments[0];
      const rate        = Number(loan.penaltyRatePerDay);

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
    }

    return ok({ updated, processedAt: today.toISOString() });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
