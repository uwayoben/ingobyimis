import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api-response";
import { classifyLoan } from "@/lib/loan-schedule";
import { z } from "zod";

const waiveSchema = z.object({
  reason: z.string().min(1, "A reason is required for all waivers"),
  amount: z.number().positive("Waiver amount must be positive").optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role))
      return forbidden("Only managing directors can waive penalties.");

    const { id } = await params;
    const body   = await request.json();
    const parsed = waiveSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { reason, amount } = parsed.data;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId! },
    });
    if (!loan) return notFound("Loan not found.");

    if (!["active", "overdue", "completed"].includes(loan.status))
      return badRequest("Penalty waivers can only be applied to active, overdue, or completed loans.");

    if (loan.penaltyAmount === 0)
      return badRequest("There is no outstanding penalty to waive.");

    const waived = amount !== undefined
      ? Math.min(amount, loan.penaltyAmount)
      : loan.penaltyAmount;

    if (waived <= 0) return badRequest("Waiver amount must be greater than zero.");

    const newPenalty = loan.penaltyAmount - waived;

    // Fetch the waivor's name
    const waivor = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true },
    });
    const waivorName = waivor?.name ?? auth.name ?? "Unknown";

    const { loanClass, provisioningRate } = classifyLoan(loan.daysOverdue);
    const provisionRequired = Math.round(loan.balanceOutstanding * Number(provisioningRate) / 100);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.ledgerEntry.create({
        data: {
          companyId:     auth.companyId!,
          type:          "waiver",
          amount:        waived,
          balanceBefore: loan.balanceOutstanding,
          balanceAfter:  loan.balanceOutstanding,
          description:   `Penalty waiver (${formatCurrency(waived)}) by ${waivorName} — ${reason}`,
          referenceId:   id,
          createdById:   auth.userId,
        },
      });

      return tx.loan.update({
        where: { id },
        data: {
          penaltyAmount:      newPenalty,
          penaltyWaived:      { increment: waived },
          penaltyWaivedByName: waivorName,
          penaltyWaivedAt:    new Date(),
          loanClass,
          provisioningRate,
          provisionRequired,
        },
      });
    });

    return ok({
      ...updated,
      annualInterestRate: Number(updated.annualInterestRate),
      waived,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

function formatCurrency(n: number) {
  return "RWF " + Math.round(n).toLocaleString();
}
