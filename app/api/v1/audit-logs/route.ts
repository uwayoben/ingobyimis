import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, forbidden, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  const auth = getAuthUser(request);
  if (!auth) return unauthorized();
  if (auth.role !== "super_admin") return forbidden();

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const skip = (page - 1) * limit;

  const action = url.searchParams.get("action") ?? undefined;
  const search = url.searchParams.get("search") ?? "";
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    const where = {
      ...(action ? { action: action as never } : {}),
      ...(companyId ? { companyId } : {}),
      ...(search ? {
        OR: [
          { userEmail: { contains: search } },
          { userName: { contains: search } },
          { companyName: { contains: search } },
        ],
      } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
        },
      } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok({
      logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
