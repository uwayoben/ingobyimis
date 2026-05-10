import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";

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
    if (auth.role !== "super_admin") return forbidden("Only super admins can delete customers.");

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { loans: true } } },
    });

    if (!customer) return notFound("Customer not found.");

    if (customer._count.loans > 0) {
      return badRequest(
        `Cannot delete — this customer has ${customer._count.loans} loan record(s). Remove all associated loans first.`
      );
    }

    await prisma.customer.delete({ where: { id } });

    return ok({ message: "Customer deleted successfully." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
