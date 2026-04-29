import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, noContent, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

const updateSchema = z.object({
  role: z.enum(["managing_director", "loan_officer", "receptionist", "shareholder"]).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden();

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    // Scope check: managing_director can only update users in their own company
    const target = await prisma.user.findUnique({ where: { id }, select: { companyId: true, role: true } });
    if (!target) return notFound("User not found.");
    if (auth.role === "managing_director" && target.companyId !== auth.companyId) return forbidden();

    const updated = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
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
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden();

    const { id } = await params;

    const target = await prisma.user.findUnique({ where: { id }, select: { companyId: true, role: true } });
    if (!target) return notFound("User not found.");
    if (auth.role === "managing_director" && target.companyId !== auth.companyId) return forbidden();
    if (id === auth.userId) return badRequest("You cannot delete your own account.");

    // Delete in dependency order to avoid FK constraint violations.
    // Loans own the main data chain; payments recorded by this user may span
    // loans they didn't originate, so we handle both paths.
    await prisma.$transaction(async (tx) => {
      // Clear nullable back-reference on loans this user approved
      await tx.loan.updateMany({ where: { approvedById: id }, data: { approvedById: null } });

      // Delete sub-records of loans this user is officer on
      await tx.installment.deleteMany({ where: { loan: { loanOfficerId: id } } });
      await tx.loanFee.deleteMany({ where: { loan: { loanOfficerId: id } } });

      // Delete all payments recorded by this user (across any loan)
      await tx.payment.deleteMany({ where: { recordedById: id } });

      // Delete any remaining payments on the officer's own loans
      await tx.payment.deleteMany({ where: { loan: { loanOfficerId: id } } });

      // Delete the loans themselves
      await tx.loan.deleteMany({ where: { loanOfficerId: id } });

      // Delete the user
      await tx.user.delete({ where: { id } });
    });

    return noContent();
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
