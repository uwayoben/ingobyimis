import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { noContent, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden();
    if (auth.role !== "managing_director") return forbidden();

    const { id } = await params;
    const asset = await prisma.asset.findUnique({ where: { id }, select: { companyId: true } });
    if (!asset) return notFound("Asset not found.");
    if (asset.companyId !== auth.companyId) return forbidden();

    await prisma.asset.delete({ where: { id } });
    return noContent();
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
