import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, notFound, unauthorized, forbidden, badRequest, serverError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden("Only super_admin can edit payments.");

    const { id } = await params;
    const body   = await request.json();

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return notFound("Payment not found.");

    const updateData: Record<string, unknown> = {};
    if (body.reference !== undefined) updateData.reference = body.reference;
    if (body.notes     !== undefined) updateData.notes     = body.notes     || null;
    if (body.method    !== undefined) updateData.method    = body.method;
    if (body.date      !== undefined) updateData.date      = new Date(body.date);

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
