import { prisma } from "@/lib/prisma";
import { signToken, makeAuthCookie } from "@/lib/auth";
import { badRequest, unauthorized, serverError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  userId: z.string(),
  otp: z.string().length(6),
});

function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function writeAuditLog(data: Parameters<typeof prisma.auditLog.create>[0]["data"]) {
  try {
    await prisma.auditLog.create({ data });
  } catch {
    // audit logging must never break the auth flow
  }
}

export async function POST(request: Request) {
  const ip = getIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid request.");

    const { userId, otp } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!user) return unauthorized("User not found.");

    if (!user.otpCode || !user.otpExpiry) {
      return unauthorized("No OTP requested.");
    }

    if (new Date() > user.otpExpiry) {
      await writeAuditLog({
        action: "otp_failed",
        userEmail: user.email,
        userName: user.name,
        companyName: user.company?.name,
        companyId: user.company?.id,
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        details: "OTP expired",
      });
      return unauthorized("OTP has expired. Please log in again.");
    }

    if (user.otpCode !== otp) {
      await writeAuditLog({
        action: "otp_failed",
        userEmail: user.email,
        userName: user.name,
        companyName: user.company?.name,
        companyId: user.company?.id,
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        details: "Wrong OTP entered",
      });
      return unauthorized("Invalid OTP.");
    }

    // Clear OTP after successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiry: null },
    });

    await writeAuditLog({
      action: "otp_verified",
      userEmail: user.email,
      userName: user.name,
      companyName: user.company?.name,
      companyId: user.company?.id,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      details: "Login successful",
    });

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
      name: user.name,
    };

    const token = signToken(payload);

    return new Response(
      JSON.stringify({
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            companyId: user.companyId ?? null,
            companyName: user.company?.name ?? null,
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": makeAuthCookie(token),
        },
      }
    );
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
