import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, notFound, serverError } from "@/lib/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const { id } = await params;

    const n = await prisma.notification.findFirst({
      where: { id, companyId: auth.companyId! },
    });
    if (!n) return notFound();

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

// Mark ALL as read
export async function POST(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    await prisma.notification.updateMany({
      where: { companyId: auth.companyId!, isRead: false },
      data: { isRead: true },
    });

    return ok({ message: "All notifications marked as read." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
