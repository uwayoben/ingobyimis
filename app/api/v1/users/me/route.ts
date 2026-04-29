import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api-response";
import { z } from "zod";
import bcrypt from "bcryptjs";

const patchSchema = z.object({
  name:            z.string().min(2, "Name must be at least 2 characters").optional(),
  phone:           z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(6, "New password must be at least 6 characters").optional(),
});

export async function GET(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    });

    return ok(user);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = getAuthUser(request);
    if (!auth) return unauthorized();

    const body   = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { name, phone, currentPassword, newPassword } = parsed.data;

    if (newPassword) {
      if (!currentPassword) return badRequest("Current password is required to set a new password.");

      const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { password: true } });
      if (!user) return unauthorized();

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return badRequest("Current password is incorrect.");
    }

    const updateData: Record<string, unknown> = {};
    if (name)        updateData.name     = name;
    if (phone !== undefined) updateData.phone = phone;
    if (newPassword) updateData.password = await bcrypt.hash(newPassword, 10);

    if (Object.keys(updateData).length === 0) return badRequest("Nothing to update.");

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data:  updateData,
      select: { id: true, name: true, email: true, role: true, phone: true },
    });

    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
