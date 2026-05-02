import { prisma } from "@/lib/prisma";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api-response";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  userId:      z.string().min(1, "User ID is required"),
  otp:         z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const { userId, otp, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, otpCode: true, otpExpiry: true, isActive: true },
    });

    if (!user || !user.isActive)       return unauthorized("Invalid request.");
    if (!user.otpCode || !user.otpExpiry) return badRequest("No password reset was requested.");
    if (new Date() > user.otpExpiry)   return badRequest("OTP has expired. Please request a new one.");
    if (user.otpCode !== otp)          return badRequest("Invalid OTP. Please try again.");

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data:  { password: hashed, otpCode: null, otpExpiry: null },
    });

    return ok({ message: "Password reset successfully. You can now log in." });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
