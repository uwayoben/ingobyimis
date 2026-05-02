import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, noContent, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";

const patchSchema = z.object({
  isPaid:   z.boolean().optional(),
  proofUrl: z.string().min(1).optional().or(z.literal("")).transform((v) => v || undefined),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();

    const { id } = await params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      select: { companyId: true, isPaid: true, amount: true },
    });
    if (!expense) return notFound("Expense not found.");
    if (expense.companyId !== auth.companyId) return forbidden();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // Only deduct balance when transitioning from unpaid → paid
    const markingPaid = parsed.data.isPaid === true && !expense.isPaid;

    const updated = await prisma.$transaction(async (tx) => {
      const e = await tx.expense.update({
        where: { id },
        data: {
          ...(parsed.data.isPaid   !== undefined ? { isPaid:   parsed.data.isPaid   } : {}),
          ...(parsed.data.proofUrl !== undefined ? { proofUrl: parsed.data.proofUrl } : {}),
        },
      });

      if (markingPaid) {
        const company = await tx.company.findUnique({
          where: { id: auth.companyId! },
          select: { accountBalance: true },
        });
        const before = company?.accountBalance ?? 0;
        const after  = before - expense.amount;
        await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: after } });
        await tx.ledgerEntry.create({
          data: {
            companyId:     auth.companyId!,
            type:          "expense",
            amount:        expense.amount,
            balanceBefore: before,
            balanceAfter:  after,
            description:   `Expense payment — ${id}`,
            referenceId:   id,
            createdById:   auth.userId,
          },
        });
      }

      return e;
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();
    if (!["managing_director", "loan_officer"].includes(auth.role)) return forbidden();

    const { id } = await params;
    const expense = await prisma.expense.findUnique({ where: { id }, select: { companyId: true } });
    if (!expense) return notFound("Expense not found.");
    if (expense.companyId !== auth.companyId) return forbidden();

    await prisma.expense.delete({ where: { id } });
    return noContent();
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
