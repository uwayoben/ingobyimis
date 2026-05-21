import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api-response";

export async function DELETE(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("Only a managing director can delete all loans.");
    }
    if (!auth.companyId) return forbidden("Company context required.");

    // Sum disbursed amounts to reverse in the company ledger
    const loans = await prisma.loan.findMany({
      where: { companyId: auth.companyId },
      select: { disbursedAmount: true },
    });

    const totalDisbursed = loans.reduce((s, l) => s + l.disbursedAmount, 0);

    await prisma.$transaction(async (tx) => {
      // Reverse all disbursements in the ledger if any
      if (totalDisbursed > 0) {
        const company = await tx.company.findUnique({
          where: { id: auth.companyId! },
          select: { accountBalance: true },
        });
        const before = company?.accountBalance ?? 0;
        const after  = before + totalDisbursed;
        await tx.company.update({ where: { id: auth.companyId! }, data: { accountBalance: after } });
        await tx.ledgerEntry.create({
          data: {
            companyId:     auth.companyId!,
            type:          "withdrawal",
            amount:        totalDisbursed,
            balanceBefore: before,
            balanceAfter:  after,
            description:   "Bulk loan deletion reversal",
            createdById:   auth.userId,
          },
        });
      }

      await tx.loan.deleteMany({ where: { companyId: auth.companyId! } });
    });

    return ok({ message: `${loans.length} loan(s) deleted.`, count: loans.length });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
