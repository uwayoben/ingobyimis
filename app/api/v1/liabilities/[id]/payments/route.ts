import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { created, badRequest, unauthorized, notFound, serverError } from "@/lib/api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth || !auth.companyId) return unauthorized();

    const { id } = await params;
    const { amount, principal, interest, date, notes } = await request.json();

    if (!amount || !date) return badRequest("Amount and date are required.");

    const totalAmt  = Number(amount);
    const princAmt  = Number(principal || 0);
    const interAmt  = Number(interest  || 0);

    if (isNaN(totalAmt) || totalAmt <= 0) return badRequest("Amount must be a positive number.");

    const liability = await prisma.liability.findUnique({ where: { id } });
    if (!liability || liability.companyId !== auth.companyId) return notFound("Liability not found.");
    if (liability.status === "completed") return badRequest("This liability is already fully repaid.");

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.liabilityPayment.create({
        data: {
          liabilityId: id,
          companyId:   auth.companyId!,
          amount:      totalAmt,
          principal:   princAmt,
          interest:    interAmt,
          date:        new Date(date),
          notes:       notes?.trim() || undefined,
        },
      });

      const newBalance = Math.max(0, liability.balanceOutstanding - princAmt);
      const newStatus  = newBalance === 0 ? "completed" : "active";

      const updated = await tx.liability.update({
        where: { id },
        data: {
          balanceOutstanding: newBalance,
          totalPaid:          liability.totalPaid + totalAmt,
          status:             newStatus,
        },
        include: { payments: { orderBy: { date: "desc" } } },
      });

      // Auto-create an expense so it appears in P&L
      const expense = await tx.expense.create({
        data: {
          companyId:   auth.companyId!,
          category:    "Loan Repayment",
          description: `Repayment to ${liability.lenderName}${notes ? ` — ${notes.trim()}` : ""}`,
          amount:      totalAmt,
          date:        new Date(date),
          isPaid:      true,
        },
      });

      // Record in ledger and deduct from account balance
      const company = await tx.company.findUnique({
        where:  { id: auth.companyId! },
        select: { accountBalance: true },
      });
      const balanceBefore = company?.accountBalance ?? 0;
      const balanceAfter  = balanceBefore - totalAmt;

      await tx.company.update({
        where: { id: auth.companyId! },
        data:  { accountBalance: balanceAfter },
      });

      await tx.ledgerEntry.create({
        data: {
          companyId:     auth.companyId!,
          type:          "expense",
          amount:        totalAmt,
          balanceBefore,
          balanceAfter,
          description:   `Liability repayment to ${liability.lenderName}${notes ? ` — ${notes.trim()}` : ""}`,
          referenceId:   expense.id,
          createdById:   auth.userId,
        },
      });

      return { payment, liability: updated };
    });

    return created(result);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
