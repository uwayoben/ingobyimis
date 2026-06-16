import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth || !auth.companyId) return unauthorized();

    const companyId = auth.companyId;
    const { searchParams } = new URL(request.url);
    const now      = new Date();
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const fromDate = from ? new Date(from) : new Date(now.getFullYear(), 0, 1);
    const toDate   = to   ? new Date(to + "T23:59:59.999Z") : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    // ── ASSETS ────────────────────────────────────────────────────────────────

    // Cash & bank
    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { accountBalance: true },
    });
    const cashBalance = company?.accountBalance ?? 0;

    // Loan portfolio & provisions
    const activeLoans = await prisma.loan.findMany({
      where:  { companyId, status: { in: ["active", "overdue", "disbursed"] } },
      select: { balanceOutstanding: true, provisionRequired: true },
    });
    const loanPortfolioGross = activeLoans.reduce((s, l) => s + l.balanceOutstanding, 0);
    const totalProvision     = activeLoans.reduce((s, l) => s + l.provisionRequired, 0);
    const loanPortfolioNet   = loanPortfolioGross - totalProvision;

    // Interest receivable (accrued interest on active loans)
    const accrued = await prisma.installment.aggregate({
      where:  { loan: { companyId }, status: { in: ["pending", "overdue"] } },
      _sum:   { interestDue: true },
    });
    const interestReceivable = accrued._sum.interestDue ?? 0;

    // Fixed assets
    const assets = await prisma.asset.findMany({
      where:  { companyId },
      select: { purchaseValue: true, currentValue: true, name: true, category: true },
    });
    const fixedAssetsGross   = assets.reduce((s, a) => s + a.purchaseValue, 0);
    const fixedAssetsNet     = assets.reduce((s, a) => s + a.currentValue, 0);
    const accumulatedDeprec  = fixedAssetsGross - fixedAssetsNet;

    // ── LIABILITIES ───────────────────────────────────────────────────────────

    // Unpaid expenses (accounts payable)
    const unpaidExpenses = await prisma.expense.aggregate({
      where:  { companyId, isPaid: false },
      _sum:   { amount: true },
    });
    const accountsPayable = unpaidExpenses._sum.amount ?? 0;

    // Company liabilities (loans payable)
    const liabilities = await prisma.liability.findMany({
      where:  { companyId, status: "active" },
      select: { lenderName: true, balanceOutstanding: true, dueDate: true },
    });
    const totalLiabilitiesOutstanding = liabilities.reduce((s, l) => s + l.balanceOutstanding, 0);

    // ── EQUITY (computed as Assets - Liabilities) ─────────────────────────────

    // Income in period
    const payments = await prisma.payment.findMany({
      where:  { companyId, date: { gte: fromDate, lte: toDate } },
      select: { interest: true, penalty: true, managementFee: true, processingFee: true },
    });
    const totalIncome =
      payments.reduce((s, p) => s + p.interest + p.penalty + p.managementFee + p.processingFee, 0);

    // Expenses paid in period
    const paidExpenses = await prisma.expense.aggregate({
      where:  { companyId, date: { gte: fromDate, lte: toDate }, isPaid: true },
      _sum:   { amount: true },
    });
    const totalExpenses  = paidExpenses._sum.amount ?? 0;
    const netProfitLoss  = totalIncome - totalExpenses;

    // Totals
    const totalCurrentAssets    = Math.max(0, cashBalance) + loanPortfolioNet + interestReceivable;
    const totalNonCurrentAssets = fixedAssetsNet;
    const totalAssets           = totalCurrentAssets + totalNonCurrentAssets;

    const totalLiabilities      = accountsPayable + totalLiabilitiesOutstanding;
    const retainedEarnings      = totalAssets - totalLiabilities - netProfitLoss;

    return ok({
      asOf: toDate.toISOString(),
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      assets: {
        current: {
          cashAndBank:       Math.max(0, cashBalance),
          loanPortfolioGross,
          provision:         totalProvision,
          loanPortfolioNet,
          interestReceivable,
          total:             totalCurrentAssets,
        },
        nonCurrent: {
          fixedAssetsGross,
          accumulatedDeprec,
          fixedAssetsNet,
          items: assets.map((a) => ({ name: a.name, category: a.category, value: a.currentValue })),
          total: totalNonCurrentAssets,
        },
        total: totalAssets,
      },
      liabilities: {
        current: {
          accountsPayable,
          loansPayable: liabilities.map((l) => ({
            name:    l.lenderName,
            amount:  l.balanceOutstanding,
            dueDate: l.dueDate?.toISOString() ?? null,
          })),
          totalLoansPayable: totalLiabilitiesOutstanding,
          total:             accountsPayable + totalLiabilitiesOutstanding,
        },
        total: totalLiabilities,
      },
      equity: {
        retainedEarnings,
        netProfitLoss,
        total: retainedEarnings + netProfitLoss,
      },
      balanced: Math.abs(totalAssets - (totalLiabilities + retainedEarnings + netProfitLoss)) < 1,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
