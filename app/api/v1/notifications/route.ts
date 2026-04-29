import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const notifications = await prisma.notification.findMany({
      where: { companyId: auth.companyId! },
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

export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    if (!["managing_director", "super_admin"].includes(auth.role)) {
      return forbidden("Only managing directors and super admin can send notifications.");
    }

    const body = await request.json();
    const { type, title, message, targetCompanyId } = body;

    if (!type || !title?.trim() || !message?.trim()) {
      return badRequest("type, title, and message are required.");
    }

    if (auth.role === "managing_director") {
      const notif = await prisma.notification.create({
        data: { type, title: title.trim(), message: message.trim(), companyId: auth.companyId! },
      });
      return created(notif);
    }

    // super_admin — send to all companies or a specific one
    if (targetCompanyId === "all") {
      const companies = await prisma.company.findMany({ select: { id: true } });
      if (companies.length === 0) return badRequest("No companies exist yet.");
      await prisma.notification.createMany({
        data: companies.map((c) => ({
          type,
          title: title.trim(),
          message: message.trim(),
          companyId: c.id,
        })),
      });
      return ok({ message: `Notification sent to ${companies.length} companies.` });
    }

    if (!targetCompanyId) {
      return badRequest("targetCompanyId is required. Use 'all' to send to every company.");
    }

    const company = await prisma.company.findUnique({ where: { id: targetCompanyId } });
    if (!company) return badRequest("Company not found.");

    const notif = await prisma.notification.create({
      data: { type, title: title.trim(), message: message.trim(), companyId: targetCompanyId },
    });
    return created(notif);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
