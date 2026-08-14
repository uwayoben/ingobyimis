import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

const patchSchema = z.object({
  additionalInterestMode: z.enum(["manual", "auto"]),
  companyId: z.string().min(1).optional(),
});

function resolveCompanyId(
  auth: { role: string; companyId: string | null },
  requestedCompanyId: string | undefined,
): { companyId: string } | { error: ReturnType<typeof badRequest> } {
  if (auth.role === "super_admin") {
    if (!requestedCompanyId) return { error: badRequest("companyId is required for super_admin.") };
    return { companyId: requestedCompanyId };
  }
  if (!auth.companyId) return { error: badRequest("Company context required.") };
  return { companyId: auth.companyId };
}

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden();

    const { searchParams } = new URL(request.url);
    const resolved = resolveCompanyId(auth, searchParams.get("companyId") ?? undefined);
    if ("error" in resolved) return resolved.error;

    const company = await prisma.company.findUnique({
      where: { id: resolved.companyId },
      select: { id: true, name: true, additionalInterestMode: true },
    });
    if (!company) return notFound("Company not found.");

    return ok(company);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();
    if (!["managing_director", "super_admin"].includes(auth.role)) return forbidden();

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const resolved = resolveCompanyId(auth, parsed.data.companyId);
    if ("error" in resolved) return resolved.error;

    const company = await prisma.company.update({
      where: { id: resolved.companyId },
      data: { additionalInterestMode: parsed.data.additionalInterestMode },
      select: { id: true, name: true, additionalInterestMode: true },
    });

    return ok(company);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
