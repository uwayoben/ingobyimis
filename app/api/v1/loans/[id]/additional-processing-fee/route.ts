import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";

const addSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  reason: z.string().min(1, "A reason is required"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "loan_officer", "super_admin"].includes(auth.role))
      return forbidden("Only loan officers and above can add additional processing fees.");

    const { id } = await params;
    const body   = await request.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { amount, reason } = parsed.data;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId! },
    });
    if (!loan) return notFound("Loan not found.");

    if (!["active", "overdue", "disbursed"].includes(loan.status))
      return badRequest("Additional processing fees can only be added to active or overdue loans.");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.loanComment.create({
        data: {
          loanId:      id,
          companyId:   auth.companyId!,
          createdById: auth.userId,
          content:     `[Additional Processing Fee] RWF ${amount.toLocaleString()} added. Reason: ${reason}`,
        },
      });

      return tx.loan.update({
        where: { id },
        data: { additionalProcessingFee: { increment: amount } },
      });
    });

    return ok({
      ...updated,
      annualInterestRate: Number(updated.annualInterestRate),
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
