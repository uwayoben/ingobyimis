import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api-response";

export async function DELETE(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("Only a managing director can delete all customers.");
    }
    if (!auth.companyId) return forbidden("Company context required.");

    const cid = auth.companyId;

    await prisma.$transaction(async (tx) => {
      // Sum disbursed amounts to reverse in ledger
      const loans = await tx.loan.findMany({
        where: { companyId: cid },
        select: { disbursedAmount: true },
      });
      const totalDisbursed = loans.reduce((s, l) => s + l.disbursedAmount, 0);

      if (totalDisbursed > 0) {
        const company = await tx.company.findUnique({
          where: { id: cid },
          select: { accountBalance: true },
        });
        const before = company?.accountBalance ?? 0;
        const after  = before + totalDisbursed;
        await tx.company.update({ where: { id: cid }, data: { accountBalance: after } });
        await tx.ledgerEntry.create({
          data: {
            companyId:     cid,
            type:          "withdrawal",
            amount:        totalDisbursed,
            balanceBefore: before,
            balanceAfter:  after,
            description:   "Bulk customer deletion reversal",
            createdById:   auth.userId,
          },
        });
      }

      // Delete loans first (cascades to payments, installments, fees, documents)
      await tx.loan.deleteMany({ where: { companyId: cid } });

      // Now safe to delete all customers
      await tx.customer.deleteMany({ where: { companyId: cid } });
    });

    return ok({ message: "All customers and their loans deleted successfully." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
