import { prisma } from "@/lib/prisma";
import { badRequest, unauthorized, serverError } from "@/lib/api-response";
import { sendSms } from "@/lib/sms";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
    // audit logging must never break the login flow
  }
}

export async function POST(request: Request) {
  const ip = getIp(request);
  const ua = request.headers.get("user-agent") ?? undefined;

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid email or password format.");

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: { select: { id: true, name: true, status: true } } },
    });

    if (!user || !user.isActive) {
      await writeAuditLog({
        action: "login_failed",
        userEmail: email,
        ipAddress: ip,
        userAgent: ua,
        details: !user ? "User not found" : "Account inactive",
      });
      return unauthorized("Invalid credentials.");
    }

    if (user.company?.status === "suspended") {
      await writeAuditLog({
        action: "login_failed",
        userEmail: email,
        userName: user.name,
        companyName: user.company.name,
        companyId: user.company.id,
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        details: "Company suspended",
      });
      return unauthorized("Your company account is suspended.");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await writeAuditLog({
        action: "login_failed",
        userEmail: email,
        userName: user.name,
        companyName: user.company?.name,
        companyId: user.company?.id,
        userId: user.id,
        ipAddress: ip,
        userAgent: ua,
        details: "Wrong password",
      });
      return unauthorized("Invalid credentials.");
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiry },
    });

    await writeAuditLog({
      action: "login_attempt",
      userEmail: email,
      userName: user.name,
      companyName: user.company?.name,
      companyId: user.company?.id,
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      details: "OTP sent",
    });

    console.log(`[OTP] User ${user.email}: ${otpCode}`);

    if (user.phone) {
      await sendSms(user.phone, `Your ipfundoMIS verification code is: ${otpCode}. Valid for 10 minutes. Do not share this code.`);
    }

    return Response.json({
      data: {
        message: "OTP sent to your registered phone number.",
        userId: user.id,
        maskedPhone: user.phone ? `+250 ${user.phone.slice(-3).padStart(9, "X")}` : null,
        ...(process.env.NODE_ENV === "development" ? { devOtp: otpCode } : {}),
      },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
