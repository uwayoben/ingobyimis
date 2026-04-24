import { prisma } from "@/lib/prisma";
import { signToken, makeAuthCookie } from "@/lib/auth";
import { badRequest, unauthorized, serverError } from "@/lib/api-response";
import { z } from "zod";

const schema = z.object({
  userId: z.string(),
  otp: z.string().length(6),
});

export async function POST(request: Request) {
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
    if (!user.otpCode || !user.otpExpiry) return unauthorized("No OTP requested.");
    if (new Date() > user.otpExpiry) return unauthorized("OTP has expired. Please log in again.");
    if (user.otpCode !== otp) return unauthorized("Invalid OTP.");

    // Clear OTP after successful verification
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpiry: null },
    });

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      name: user.name,
    };

    const token = signToken(payload);

    return new Response(
      JSON.stringify({
        data: {
          token,     // returned for mobile apps
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            companyId: user.companyId,
            companyName: user.company.name,
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": makeAuthCookie(token), // for web browsers
        },
      }
    );
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
