import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

function getDateRange(filter: string): { gte: Date; lte: Date } | null {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();

  switch (filter) {
    case "today":
      return { gte: new Date(y, m, d), lte: new Date(y, m, d, 23, 59, 59, 999) };
    case "this_week": {
      const dow = now.getDay();
      const diff = dow === 0 ? 6 : dow - 1; // Monday-based week
      return {
        gte: new Date(y, m, d - diff),
        lte: new Date(y, m, d - diff + 6, 23, 59, 59, 999),
      };
    }
    case "this_month":
      return { gte: new Date(y, m, 1), lte: new Date(y, m + 1, 0, 23, 59, 59, 999) };
    case "last_month":
      return { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59, 999) };
    case "this_quarter": {
      const qs = Math.floor(m / 3) * 3;
      return { gte: new Date(y, qs, 1), lte: new Date(y, qs + 3, 0, 23, 59, 59, 999) };
    }
    case "last_quarter": {
      const cq = Math.floor(m / 3);
      const lq = cq === 0 ? 3 : cq - 1;
      const ly = cq === 0 ? y - 1 : y;
      return { gte: new Date(ly, lq * 3, 1), lte: new Date(ly, lq * 3 + 3, 0, 23, 59, 59, 999) };
    }
    case "this_year":
      return { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59, 999) };
    case "last_year":
      return { gte: new Date(y - 1, 0, 1), lte: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
    default:
      return null;
  }
}

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    if (!auth.companyId) {
      return ok({
        totalLoans: 0, activeLoans: 0, completedLoans: 0, overdueLoans: 0,
        pendingLoans: 0, writtenOffLoans: 0, totalDisbursed: 0,
        totalAmountCollected: 0, totalOutstanding: 0, totalPrincipalPaid: 0,
        totalInterestPaid: 0, totalOutstandingPrincipal: 0,
        totalFees: 0, totalPenaltyPaid: 0, totalExpenses: 0,
        totalEarnings: 0, netProfit: 0,
        totalCustomers: 0, disbursedToday: 0, collectionRate: 0,
      });
    }

    const cid = auth.companyId;
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") ?? "all";
    const range = getDateRange(filter);

    const loanWhere = { companyId: cid, ...(range ? { createdAt: range } : {}) };
    const payWhere = { companyId: cid, ...(range ? { date: range } : {}) };
    const expWhere = { companyId: cid, ...(range ? { date: range } : {}) };

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const [
      totalLoans, activeLoans, completedLoans, overdueLoans, pendingLoans, writtenOffLoans,
      companyRow, disbursedAgg,
      // All-time running balances
      outstandingAgg, repaidAgg, outstandingPrincipalAgg,
      // Period-filtered
      penaltyAgg, expensesAgg, feesAgg,
      // Misc
      totalCustomers, disbursedTodayAgg, allTimeCollectedAgg,
    ] = await Promise.all([
      prisma.loan.count({ where: loanWhere }),
      prisma.loan.count({ where: { ...loanWhere, status: "active" } }),
      prisma.loan.count({ where: { ...loanWhere, status: "completed" } }),
      prisma.loan.count({ where: { ...loanWhere, status: "overdue" } }),
      prisma.loan.count({ where: { ...loanWhere, status: "pending" } }),
      prisma.loan.count({ where: { ...loanWhere, status: "written_off" } }),
      prisma.company.findUnique({ where: { id: cid }, select: { accountBalance: true } }),
      prisma.loan.aggregate({ where: loanWhere, _sum: { disbursedAmount: true } }),
      // All-time — outstanding uses totalRepayable so it includes principal + interest + penalty
      prisma.loan.aggregate({
        where: { companyId: cid, status: { in: ["active", "overdue"] } },
        _sum: {
          totalRepayable: true,
          amountRepaidPrincipal: true,
          amountRepaidInterest: true,
          penaltyAmount: true,
          amount: true,            // for outstanding principal
          balanceOutstanding: true, // kept for principal-only reference
        },
      }),
      prisma.loan.aggregate({
        where: { companyId: cid },
        _sum: { amountRepaidPrincipal: true, amountRepaidInterest: true },
      }),
      // placeholder — merged into outstandingAgg above
      Promise.resolve(null),
      // Period-filtered payments & expenses
      prisma.payment.aggregate({ where: payWhere, _sum: { penalty: true, interest: true } }),
      prisma.expense.aggregate({ where: expWhere, _sum: { amount: true } }),
      prisma.loanFee.aggregate({
        where: { loan: { companyId: cid, ...(range ? { createdAt: range } : {}) } },
        _sum: { value: true },
      }),
      // Misc
      prisma.customer.count({ where: { companyId: cid } }),
      prisma.loan.aggregate({
        where: { companyId: cid, disbursementDate: { gte: todayStart, lte: todayEnd } },
        _sum: { disbursedAmount: true },
      }),
      prisma.payment.aggregate({ where: { companyId: cid }, _sum: { amount: true } }),
    ]);

    // True outstanding = totalRepayable − paid principal − paid interest + unpaid penalty
    const totalOutstanding = Math.max(
      0,
      (outstandingAgg._sum.totalRepayable ?? 0) -
      (outstandingAgg._sum.amountRepaidPrincipal ?? 0) -
      (outstandingAgg._sum.amountRepaidInterest ?? 0),
    ) + (outstandingAgg._sum.penaltyAmount ?? 0);

    // Principal-only outstanding (for provisioning reports)
    const totalOutstandingPrincipal =
      (outstandingAgg._sum.amount ?? 0) -
      (outstandingAgg._sum.amountRepaidPrincipal ?? 0);

    const totalPrincipalPaid = repaidAgg._sum.amountRepaidPrincipal ?? 0;
    const totalInterestPaid  = repaidAgg._sum.amountRepaidInterest  ?? 0;
    const totalPenaltyPaid = penaltyAgg._sum.penalty ?? 0;
    const totalFees = Number(feesAgg._sum.value ?? 0);
    const totalExpenses = expensesAgg._sum.amount ?? 0;
    const totalEarnings = totalInterestPaid + totalFees + totalPenaltyPaid;
    const netProfit = totalEarnings - totalExpenses;
    const allTimeCollected = allTimeCollectedAgg._sum.amount ?? 0;
    const collectionRate =
      totalOutstanding + allTimeCollected > 0
        ? Math.round((allTimeCollected / (totalOutstanding + allTimeCollected)) * 1000) / 10
        : 0;

    return ok({
      // Filtered by period
      totalLoans,
      totalDisbursed: disbursedAgg._sum.disbursedAmount ?? 0,
      activeLoans,
      completedLoans,
      overdueLoans,
      pendingLoans,
      writtenOffLoans,
      totalFees,
      totalPenaltyPaid,
      totalExpenses,
      // All-time running balances
      totalAmountCollected: allTimeCollected,
      totalOutstanding,
      totalPrincipalPaid,
      totalInterestPaid,
      totalOutstandingPrincipal,
      // Computed
      totalEarnings,
      netProfit,
      // Misc
      totalCustomers,
      disbursedToday: disbursedTodayAgg._sum.disbursedAmount ?? 0,
      collectionRate,
      accountBalance: companyRow?.accountBalance ?? 0,
      // Legacy alias kept for compatibility
      outstandingBalance: totalOutstanding,
      totalRevenue: totalEarnings,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
