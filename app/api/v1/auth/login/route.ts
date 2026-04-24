import { prisma } from "@/lib/prisma";
import { signToken, makeAuthCookie } from "@/lib/auth";
import { badRequest, unauthorized, serverError } from "@/lib/api-response";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid email or password format.");

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: { select: { id: true, name: true, status: true } } },
    });

    if (!user || !user.isActive) return unauthorized("Invalid credentials.");
    if (user.company.status === "suspended") return unauthorized("Your company account is suspended.");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return unauthorized("Invalid credentials.");

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiry },
    });

    // TODO: Send OTP via SMS (integrate with your SMS provider here)
    // await sendSMS(user.phone, `Your Ingobyi MIS OTP is: ${otpCode}`)
    console.log(`[OTP] User ${user.email}: ${otpCode}`); // dev only

    return Response.json({
      data: {
        message: "OTP sent to your registered phone number.",
        userId: user.id,
        maskedPhone: user.phone ? `+250 ${user.phone.slice(-3).padStart(9, "X")}` : null,
        // Only exposed in development — remove when SMS is integrated
        ...(process.env.NODE_ENV !== "production" && { devOtp: otpCode }),
      },
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
