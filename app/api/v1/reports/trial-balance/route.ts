import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

function row(account: string, initialBalance: number, debit: number, credit: number) {
  return { account, initialBalance, debit, credit, balance: initialBalance + debit - credit };
}

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

    // ── Balance sheet snapshots ───────────────────────────────────────────────

    const company = await prisma.company.findUnique({
      where:  { id: companyId },
      select: { accountBalance: true },
    });
    const cashBalance = company?.accountBalance ?? 0;

    const activeLoans = await prisma.loan.findMany({
      where:  { companyId, status: { in: ["active", "overdue", "disbursed"] } },
      select: { balanceOutstanding: true, provisionRequired: true },
    });
    const loanPortfolio  = activeLoans.reduce((s, l) => s + l.balanceOutstanding, 0);
    const totalProvision = activeLoans.reduce((s, l) => s + l.provisionRequired, 0);

    const assets = await prisma.asset.findMany({
      where:  { companyId },
      select: { currentValue: true, purchaseValue: true },
    });
    const fixedAssetsGross = assets.reduce((s, a) => s + a.purchaseValue, 0);
    const fixedAssetsNet   = assets.reduce((s, a) => s + a.currentValue, 0);
    const accumulatedDeprec = fixedAssetsGross - fixedAssetsNet;

    const liabilities = await prisma.liability.findMany({
      where:  { companyId, status: "active" },
      select: { balanceOutstanding: true, lenderName: true },
    });

    // ── Period movements ──────────────────────────────────────────────────────

    const payments = await prisma.payment.findMany({
      where:  { companyId, date: { gte: fromDate, lte: toDate } },
      select: { interest: true, penalty: true, managementFee: true, processingFee: true, principal: true },
    });
    const interestIncome      = payments.reduce((s, p) => s + p.interest, 0);
    const penaltyIncome       = payments.reduce((s, p) => s + p.penalty, 0);
    const mgmtFeeIncome       = payments.reduce((s, p) => s + p.managementFee, 0);
    const processingFeeIncome = payments.reduce((s, p) => s + p.processingFee, 0);
    const principalCollected  = payments.reduce((s, p) => s + p.principal, 0);
    const totalFeeIncome      = mgmtFeeIncome + processingFeeIncome;

    const disbursedLoans = await prisma.loan.findMany({
      where:  { companyId, disbursementDate: { gte: fromDate, lte: toDate } },
      select: { id: true, disbursedAmount: true },
    });
    const totalDisbursed = disbursedLoans.reduce((s, l) => s + l.disbursedAmount, 0);

    // Non-recurring loan fees (upfront)
    let upfrontFeeIncome = 0;
    if (disbursedLoans.length > 0) {
      const fees = await prisma.loanFee.findMany({
        where:   { loanId: { in: disbursedLoans.map((l) => l.id) }, isRecurring: false },
        include: { loan: { select: { disbursedAmount: true } } },
      });
      upfrontFeeIncome = fees.reduce((s, f) => {
        const v = Number(f.value);
        return s + (f.type === "fixed" ? v : Math.round((v / 100) * f.loan.disbursedAmount));
      }, 0);
    }
    const combinedFeeIncome = totalFeeIncome + upfrontFeeIncome;

    const expenseRows = await prisma.expense.findMany({
      where:  { companyId, date: { gte: fromDate, lte: toDate }, isPaid: true },
      select: { category: true, amount: true },
    });
    const expByCat: Record<string, number> = {};
    for (const e of expenseRows) {
      expByCat[e.category] = (expByCat[e.category] ?? 0) + e.amount;
    }

    // Liability payments in period
    const liabilityPayments = await prisma.liabilityPayment.findMany({
      where:  { companyId, date: { gte: fromDate, lte: toDate } },
      select: { amount: true, principal: true },
    });
    const liabilityPrincipalPaid = liabilityPayments.reduce((s, p) => s + p.principal, 0);
    const liabilityTotalPaid     = liabilityPayments.reduce((s, p) => s + p.amount, 0);

    // ── Build rows ────────────────────────────────────────────────────────────
    // Formula: balance = initialBalance + debit - credit
    // Assets & Expenses  → debit-normal  (debit increases, credit decreases)
    // Liabilities/Income → credit-normal (credit increases, debit decreases)

    // For period TB: initialBalance = snapshot - period movements
    const bankInitial     = cashBalance - (interestIncome + penaltyIncome + combinedFeeIncome + principalCollected) + totalDisbursed + expenseRows.reduce((s, e) => s + e.amount, 0) + liabilityTotalPaid;
    const loansInitial    = loanPortfolio + principalCollected - totalDisbursed;
    const fixedInitial    = fixedAssetsNet; // no period change tracked

    const rows = [
      // ── Assets ──────────────────────────────────────────────────────────────
      row("Bank Account",
          Math.max(0, bankInitial),
          interestIncome + penaltyIncome + combinedFeeIncome + principalCollected,
          totalDisbursed + expenseRows.reduce((s, e) => s + e.amount, 0) + liabilityTotalPaid),

      row("Loan Portfolio",
          Math.max(0, loansInitial),
          totalDisbursed,
          principalCollected),

      ...(totalProvision > 0 ? [row("Provisions", 0, 0, totalProvision)] : []),

      row("Interest Receivable", 0, interestIncome, 0),

      ...(fixedInitial > 0
        ? [row("Fixed Assets", fixedInitial, 0, 0)]
        : []),

      ...(accumulatedDeprec > 0
        ? [row("Accumulated Depreciation", 0, 0, accumulatedDeprec)]
        : []),

      // ── Liabilities ──────────────────────────────────────────────────────────
      ...liabilities.map((l) =>
        row(`Loan Payable — ${l.lenderName}`,
            l.balanceOutstanding + liabilityPrincipalPaid,
            liabilityPrincipalPaid,
            0)
      ),

      // ── Income ───────────────────────────────────────────────────────────────
      ...(interestIncome > 0
        ? [{ account: "Interest Income",       initialBalance: 0, debit: 0, credit: interestIncome, balance: interestIncome }]
        : []),
      ...(penaltyIncome > 0
        ? [{ account: "Other Financial Income (Penalties)", initialBalance: 0, debit: 0, credit: penaltyIncome, balance: penaltyIncome }]
        : []),
      ...(combinedFeeIncome > 0
        ? [{ account: "Fees and Commission",  initialBalance: 0, debit: 0, credit: combinedFeeIncome, balance: combinedFeeIncome }]
        : []),

      // ── Expenses ─────────────────────────────────────────────────────────────
      ...Object.entries(expByCat).map(([cat, amt]) =>
        row(cat, 0, amt, 0)
      ),
    ];

    // Totals
    const totals = rows.reduce(
      (acc, r) => ({
        initialBalance: acc.initialBalance + r.initialBalance,
        debit:          acc.debit  + r.debit,
        credit:         acc.credit + r.credit,
        balance:        acc.balance + r.balance,
      }),
      { initialBalance: 0, debit: 0, credit: 0, balance: 0 }
    );

    return ok({ rows, totals, period: { from: fromDate.toISOString(), to: toDate.toISOString() } });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
