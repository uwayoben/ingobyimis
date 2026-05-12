import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

const addSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().positive("Amount must be positive"),
  reason: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return ok({ summary: { totalPenaltyAccrued: 0, totalPenaltyCollected: 0, loansWithPenalties: 0 }, activePenalties: [], penaltyHistory: [] });

    const cid = auth.companyId;

    const [activePenalties, penaltyHistory, summaryAgg, loansWithPenalties, waiverEntries, waivedAgg] = await Promise.all([
      // Loans that have an outstanding (unpaid) penalty
      prisma.loan.findMany({
        where: { companyId: cid, penaltyAmount: { gt: 0 } },
        orderBy: { penaltyAmount: "desc" },
        include: { customer: { select: { names: true } } },
      }),
      // Payments where penalty was collected
      prisma.payment.findMany({
        where: { companyId: cid, penalty: { gt: 0 } },
        orderBy: { date: "desc" },
        take: 100,
        include: {
          customer: { select: { names: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      prisma.payment.aggregate({
        where: { companyId: cid },
        _sum: { penalty: true },
      }),
      prisma.loan.count({ where: { companyId: cid, penaltyAmount: { gt: 0 } } }),
      // Waiver ledger entries
      prisma.ledgerEntry.findMany({
        where: { companyId: cid, type: "waiver" },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      // Total waived across all loans
      prisma.loan.aggregate({
        where: { companyId: cid },
        _sum: { penaltyWaived: true },
      }),
    ]);

    // Enrich waiver entries with customer names by looking up the referenced loans
    const waiverLoanIds = [...new Set(waiverEntries.map((e) => e.referenceId).filter(Boolean))] as string[];
    const waiverLoans = waiverLoanIds.length
      ? await prisma.loan.findMany({
          where: { id: { in: waiverLoanIds } },
          include: { customer: { select: { names: true } } },
        })
      : [];
    const waiverLoanMap = Object.fromEntries(waiverLoans.map((l) => [l.id, l]));

    // Parse description: "Penalty waiver (RWF X) by [Name] — [reason]"
    const descRegex = /^Penalty waiver[^—]*by (.+?) — (.+)$/;

    const totalPenaltyAccrued = activePenalties.reduce((s, l) => s + l.penaltyAmount, 0);

    return ok({
      summary: {
        totalPenaltyAccrued,
        totalPenaltyCollected: summaryAgg._sum.penalty ?? 0,
        totalPenaltyWaived: waivedAgg._sum.penaltyWaived ?? 0,
        loansWithPenalties,
      },
      activePenalties: activePenalties.map((l) => ({
        id: l.id,
        customerName: l.customer.names,
        customerId: l.customerId,
        penaltyAmount: l.penaltyAmount,
        status: l.status,
        daysOverdue: l.daysOverdue,
        balanceOutstanding: l.balanceOutstanding,
        nextPaymentDate: l.nextPaymentDate,
        loanClass: l.loanClass,
      })),
      penaltyHistory: penaltyHistory.map((p) => ({
        id: p.id,
        loanId: p.loanId,
        reference: p.reference,
        customerName: p.customer.names,
        penaltyAmount: p.penalty,
        date: p.date,
        method: p.method,
        recordedByName: p.recordedBy.name,
        notes: p.notes,
      })),
      waiverHistory: waiverEntries.map((e) => {
        const loan = e.referenceId ? waiverLoanMap[e.referenceId] : null;
        const match = e.description.match(descRegex);
        return {
          id: e.id,
          loanId: e.referenceId ?? "",
          customerName: loan?.customer?.names ?? "—",
          amount: e.amount,
          waivedByName: match?.[1] ?? e.createdById ?? "—",
          reason: match?.[2] ?? e.description,
          date: e.createdAt,
        };
      }),
    });
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
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { loanId, amount, reason } = parsed.data;

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, companyId: auth.companyId },
    });
    if (!loan) return notFound("Loan not found.");
    if (!["active", "overdue", "disbursed"].includes(loan.status)) {
      return badRequest("Penalties can only be added to active or overdue loans.");
    }

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        penaltyAmount: loan.penaltyAmount + amount,
        status: loan.status === "active" ? "overdue" : loan.status,
        ...(reason ? {} : {}),
      },
      include: { customer: { select: { names: true } } },
    });

    return created({
      loanId: updated.id,
      customerName: updated.customer.names,
      penaltyAmount: updated.penaltyAmount,
      addedAmount: amount,
      reason: reason ?? null,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
