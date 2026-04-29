import { prisma } from "@/lib/prisma";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { sendSms } from "@/lib/sms";
import { z } from "zod";

const schema = z.object({ email: z.string().email("Invalid email address") });

export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, phone: true, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return ok({ message: "If that email is registered, an OTP has been sent to the linked phone number." });
    }

    const otpCode  = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.user.update({
      where: { id: user.id },
      data:  { otpCode, otpExpiry },
    });

    const phone = user.phone?.replace(/\s+/g, "") ?? "";
    if (phone) {
      await sendSms(phone, `Your INGOBYI MIS password reset code is: ${otpCode}. Valid for 10 minutes. Do not share it.`);
    }
    console.log(`[RESET OTP] ${parsed.data.email}: ${otpCode}`);

    return ok({
      message: "If that email is registered, an OTP has been sent to the linked phone number.",
      userId:  user.id,
      maskedPhone: phone ? `+250 ${phone.slice(-3).padStart(9, "X")}` : null,
    });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
