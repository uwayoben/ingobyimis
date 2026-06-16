import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const { id } = await params;
    const { name, email, phone, address } = await request.json();

    if (!name || !email || !phone || !address) {
      return badRequest("Name, email, phone, and address are required.");
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return notFound("Company not found.");

    if (email !== company.email) {
      const existing = await prisma.company.findUnique({ where: { email } });
      if (existing) return badRequest("A company with this email already exists.");
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { name, email, phone, address },
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["active", "suspended", "trial"].includes(status)) {
      return badRequest("Invalid status. Must be active, suspended, or trial.");
    }

    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return notFound("Company not found.");

    const updated = await prisma.company.update({
      where: { id },
      data: { status },
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

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
