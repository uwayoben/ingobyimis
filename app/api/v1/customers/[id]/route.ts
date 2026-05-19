import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, serverError } from "@/lib/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, companyId: auth.companyId! },
      include: {
        loans: {
          orderBy: { createdAt: "desc" },
          include: { fees: true },
        },
        payments: {
          orderBy: { date: "desc" },
          take: 20,
        },
      },
    });

    if (!customer) return notFound("Customer not found.");
    return ok(customer);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;
    const body = await request.json();

    const customer = await prisma.customer.findFirst({
      where: { id, companyId: auth.companyId! },
    });
    if (!customer) return notFound("Customer not found.");

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        names: body.names,
        phone: body.phone,
        email: body.email || null,
        gender: body.gender,
        province: body.province,
        district: body.district,
        sector: body.sector,
        cell: body.cell,
        village: body.village,
        maritalStatus: body.maritalStatus,
        employerName: body.employerName,
        employmentStatus: body.employmentStatus,
        relationshipWithNdfsp: body.relationshipWithNdfsp,
        spouseName: body.spouseName,
        spousePhone: body.spousePhone,
        spouseIdNumber: body.spouseIdNumber,
        maritalPropertyRegime: body.maritalPropertyRegime,
        isActive: body.isActive,
      },
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

    const canDelete = auth.role === "super_admin" || auth.role === "managing_director";
    if (!canDelete) return forbidden("Only super admins and managing directors can delete customers.");

    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        ...(auth.role !== "super_admin" ? { companyId: auth.companyId! } : {}),
      },
    });

    if (!customer) return notFound("Customer not found.");

    // Cascade-delete all related records in FK-safe order before deleting the customer.
    // Loan sub-records (Installment, LoanFee, LoanDocument) have onDelete: Cascade on Loan,
    // but Payment→Loan and Payment→Customer do not, so they must be deleted explicitly first.
    await prisma.$transaction(async (tx) => {
      await tx.installment.deleteMany({ where: { loan: { customerId: id } } });
      await tx.loanFee.deleteMany({ where: { loan: { customerId: id } } });
      await tx.loanDocument.deleteMany({ where: { loan: { customerId: id } } });
      await tx.payment.deleteMany({ where: { customerId: id } });
      await tx.loan.deleteMany({ where: { customerId: id } });
      await tx.customer.delete({ where: { id } });
    });

    return ok({ message: "Customer deleted successfully." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
