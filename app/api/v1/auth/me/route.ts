import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true, name: true, email: true, role: true, phone: true,
        companyId: true, isActive: true, createdAt: true,
        company: { select: { id: true, name: true, status: true } },
      },
    });

    if (!user || !user.isActive) return unauthorized();

    return Response.json({ data: user });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
