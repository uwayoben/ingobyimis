import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, badRequest, serverError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!auth.companyId) return forbidden("Company context required.");

    const { id } = await params;
    const body = await request.json();
    const { signedContractUrl } = body;

    if (signedContractUrl === undefined) return badRequest("signedContractUrl is required.");

    // Use raw SQL to bypass any Prisma client cache issues
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Loan WHERE id = ${id} AND companyId = ${auth.companyId} LIMIT 1
    `;
    if (!existing.length) return notFound("Loan not found.");

    await prisma.$executeRaw`
      UPDATE Loan SET signedContractUrl = ${signedContractUrl}, updatedAt = NOW()
      WHERE id = ${id} AND companyId = ${auth.companyId}
    `;

    return ok({ signedContractUrl });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
