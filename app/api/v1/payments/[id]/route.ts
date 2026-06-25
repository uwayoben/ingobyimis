import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("Only a managing director can edit payments.");
    }

    const { id } = await params;
    const body   = await request.json();

    const payment = await prisma.payment.findFirst({
      where: auth.role === "super_admin" ? { id } : { id, companyId: auth.companyId! },
    });
    if (!payment) return notFound("Payment not found.");

    const updateData: Record<string, unknown> = {};
    if (body.amount        !== undefined) updateData.amount        = Number(body.amount);
    if (body.principal     !== undefined) updateData.principal     = Number(body.principal);
    if (body.interest      !== undefined) updateData.interest      = Number(body.interest);
    if (body.managementFee !== undefined) updateData.managementFee = Number(body.managementFee);
    if (body.processingFee !== undefined) updateData.processingFee = Number(body.processingFee);
    if (body.penalty       !== undefined) updateData.penalty       = Number(body.penalty);
    if (body.reference     !== undefined) updateData.reference     = body.reference;
    if (body.notes         !== undefined) updateData.notes         = body.notes || null;
    if (body.method        !== undefined) updateData.method        = body.method;
    if (body.date          !== undefined) updateData.date          = new Date(body.date);

    if (Object.keys(updateData).length === 0) {
      return badRequest("No editable fields provided.");
    }

    const updated = await prisma.payment.update({ where: { id }, data: updateData });
    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
