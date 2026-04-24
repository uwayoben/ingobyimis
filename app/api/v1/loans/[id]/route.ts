import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const loan = await prisma.loan.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        customer: true,
        fees: true,
        payments: { orderBy: { date: "desc" } },
        createdBy: { select: { id: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true, role: true } },
      },
    });

    if (!loan) return notFound("Loan not found.");

    return ok({ ...loan, interestRate: Number(loan.interestRate) });
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

    const loan = await prisma.loan.findFirst({ where: { id, companyId: auth.companyId } });
    if (!loan) return notFound("Loan not found.");

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: body.status,
        approvedById: body.status === "approved" ? auth.userId : undefined,
        approvedAt: body.status === "approved" ? new Date() : undefined,
        disbursedAt: body.status === "disbursed" ? new Date() : undefined,
        disbursedAmount: body.disbursedAmount,
      },
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
