/** Normalise a Rwandan phone number to the format InTouch expects (07XXXXXXXX). */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("250")) return "0" + digits.slice(3);
  if (digits.startsWith("0"))   return digits;
  return "0" + digits;
}

/**
 * Send an SMS via the InTouch SMS gateway (https://www.intouchsms.co.rw).
 * Never throws — SMS failure must not break the login flow.
 */
export async function sendSms(recipient: string, message: string): Promise<boolean> {
  try {
    const url      = "https://www.intouchsms.co.rw/api/sendsms/.json";
    const username = process.env.SMS_USERNAME ?? "";
    const password = process.env.SMS_PASSWORD ?? "";
    const sender   = process.env.SMS_SENDER   ?? "FASITA";

    if (!username || !password) {
      console.warn("[SMS] SMS_USERNAME / SMS_PASSWORD not configured — OTP not sent via SMS.");
      return false;
    }

    const body = new URLSearchParams({
      sender,
      recipients: formatPhone(recipient),
      message,
      dlrurl: "http://www.dlrurl.rw/deliversms/",
    });

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const result = await res.text();
    console.log(`[SMS] ${res.status} → ${recipient}: ${result}`);
    return res.ok;
  } catch (e) {
    console.error(`[SMS] failed to send to ${recipient}:`, e);
    return false;
  }
}
