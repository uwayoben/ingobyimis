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

    const [activePenalties, penaltyHistory, summaryAgg, loansWithPenalties] = await Promise.all([
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
    ]);

    const totalPenaltyAccrued = activePenalties.reduce((s, l) => s + l.penaltyAmount, 0);

    return ok({
      summary: {
        totalPenaltyAccrued,
        totalPenaltyCollected: summaryAgg._sum.penalty ?? 0,
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
