import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const notifications = await prisma.notification.findMany({
      where: { companyId: auth.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unread = notifications.filter((n) => !n.isRead).length;
    return ok({ notifications, unread });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
