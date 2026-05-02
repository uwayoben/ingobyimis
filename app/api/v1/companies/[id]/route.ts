import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!company) return notFound("Company not found.");

    // MySQL FK constraints require explicit deletion order.
    // Cascade on companyId alone is not enough because cross-table
    // references (e.g. Loan → User via loanOfficerId) have no cascade.
    await prisma.$transaction(async (tx) => {
      await tx.installment.deleteMany({ where: { loan: { companyId: id } } });
      await tx.loanFee.deleteMany({ where: { loan: { companyId: id } } });
      await tx.payment.deleteMany({ where: { companyId: id } });
      await tx.loan.deleteMany({ where: { companyId: id } });
      await tx.customer.deleteMany({ where: { companyId: id } });
      await tx.notification.deleteMany({ where: { companyId: id } });
      await tx.asset.deleteMany({ where: { companyId: id } });
      await tx.expense.deleteMany({ where: { companyId: id } });
      await tx.user.deleteMany({ where: { companyId: id } });
      await tx.company.delete({ where: { id } });
    });

    return ok({ message: `"${company.name}" and all its data have been permanently deleted.` });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
