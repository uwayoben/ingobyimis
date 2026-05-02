import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return unauthorized();

    const companyId = auth.companyId;
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const from = searchParams.get("from");
    const to   = searchParams.get("to");
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
    const toDate   = to   ? new Date(to + "T23:59:59.999Z") : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    // ── Portfolio snapshot (all loans — current state) ────────────────────────
    const allLoans = await prisma.loan.findMany({
      where: { companyId },
      select: {
        id: true, status: true, amount: true,
        balanceOutstanding: true, disbursedAmount: true,
        disbursementDate: true, loanClass: true,
        provisioningRate: true, provisionRequired: true,
        amountRepaidPrincipal: true, amountRepaidInterest: true,
      },
    });

    const activeStatuses = ["active", "overdue", "disbursed"];
    const activeLoans    = allLoans.filter((l) => activeStatuses.includes(l.status));
    const totalOutstanding = activeLoans.reduce((s, l) => s + l.balanceOutstanding, 0);

    const nplLoans  = activeLoans.filter((l) => ["Substandard", "Doubtful", "Loss"].includes(l.loanClass));
    const nplAmount = nplLoans.reduce((s, l) => s + l.balanceOutstanding, 0);
    const nplRate   = totalOutstanding > 0 ? (nplAmount / totalOutstanding) * 100 : 0;

    const totalProvision    = activeLoans.reduce((s, l) => s + l.provisionRequired, 0);
    const provisionCoverage = nplAmount > 0 ? (totalProvision / nplAmount) * 100 : 100;

    const statusGroups: Record<string, { count: number; amount: number }> = {};
    for (const l of allLoans) {
      if (!statusGroups[l.status]) statusGroups[l.status] = { count: 0, amount: 0 };
      statusGroups[l.status].count++;
      statusGroups[l.status].amount += l.balanceOutstanding;
    }

    const classGroups: Record<string, { count: number; amount: number }> = {};
    for (const l of activeLoans) {
      const cls = l.loanClass;
      if (!classGroups[cls]) classGroups[cls] = { count: 0, amount: 0 };
      classGroups[cls].count++;
      classGroups[cls].amount += l.balanceOutstanding;
    }

    // ── Payments in period ────────────────────────────────────────────────────
    const payments = await prisma.payment.findMany({
      where: { companyId, date: { gte: fromDate, lte: toDate } },
      select: { amount: true, interest: true, principal: true, penalty: true, date: true },
    });

    const interestIncome     = payments.reduce((s, p) => s + p.interest, 0);
    const penaltyIncome      = payments.reduce((s, p) => s + p.penalty, 0);
    const principalCollected = payments.reduce((s, p) => s + p.principal, 0);
    const totalCollected     = payments.reduce((s, p) => s + p.amount, 0);

    // Fee income: non-recurring fees on loans disbursed in the period
    const disbursedInPeriodIds = allLoans
      .filter((l) => l.disbursementDate && new Date(l.disbursementDate) >= fromDate && new Date(l.disbursementDate) <= toDate)
      .map((l) => l.id);

    let feeIncome = 0;
    if (disbursedInPeriodIds.length > 0) {
      const fees = await prisma.loanFee.findMany({
        where: { loanId: { in: disbursedInPeriodIds }, isRecurring: false },
        include: { loan: { select: { disbursedAmount: true } } },
      });
      feeIncome = fees.reduce((s, f) => {
        const v = Number(f.value);
        return s + (f.type === "fixed" ? v : (v / 100) * f.loan.disbursedAmount);
      }, 0);
    }

    const totalIncome = interestIncome + penaltyIncome + Math.round(feeIncome);

    // ── Expenses in period ────────────────────────────────────────────────────
    const expenseRows = await prisma.expense.findMany({
      where: { companyId, date: { gte: fromDate, lte: toDate } },
      select: { category: true, amount: true },
    });

    const expByCat: Record<string, number> = {};
    for (const e of expenseRows) {
      expByCat[e.category] = (expByCat[e.category] ?? 0) + e.amount;
    }
    expByCat["Provisioning"] = (expByCat["Provisioning"] ?? 0) + totalProvision;
    const totalExpenses = Object.values(expByCat).reduce((s, v) => s + v, 0);

    // ── Monthly chart data (period) ───────────────────────────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyMap: Record<string, { disbursed: number; collected: number }> = {};

    for (const l of allLoans) {
      if (!l.disbursementDate) continue;
      const d = new Date(l.disbursementDate);
      if (d < fromDate || d > toDate) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { disbursed: 0, collected: 0 };
      monthlyMap[key].disbursed += l.disbursedAmount;
    }

    for (const p of payments) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { disbursed: 0, collected: 0 };
      monthlyMap[key].collected += p.amount;
    }

    const chartData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, vals]) => {
        const [year, month] = key.split("-");
        return { month: `${MONTHS[Number(month) - 1]} ${year.slice(2)}`, ...vals };
      });

    return ok({
      portfolio: {
        totalLoans:        allLoans.length,
        activeLoans:       activeLoans.length,
        overdueLoans:      allLoans.filter((l) => l.status === "overdue").length,
        pendingLoans:      allLoans.filter((l) => l.status === "pending").length,
        completedLoans:    allLoans.filter((l) => l.status === "completed").length,
        totalOutstanding,
        nplAmount,
        nplRate:           Math.round(nplRate * 10) / 10,
        totalProvision,
        provisionCoverage: Math.round(provisionCoverage),
        byStatus: Object.entries(statusGroups).map(([status, d]) => ({ status, ...d })),
        byClass:  Object.entries(classGroups).map(([cls, d]) => ({ class: cls, ...d })),
      },
      income: {
        interestIncome,
        penaltyIncome,
        feeIncome: Math.round(feeIncome),
        totalIncome,
        totalCollected,
        principalCollected,
      },
      expenses: {
        byCategory: Object.entries(expByCat).map(([category, amount]) => ({ category, amount })),
        total: totalExpenses,
      },
      chartData,
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
