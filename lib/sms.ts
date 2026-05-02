/**
 * Send an SMS via the InTouch SMS gateway.
 * Returns true on success, false on failure (never throws — SMS must not break login).
 */
export async function sendSms(recipient: string, message: string): Promise<boolean> {
  try {
    const url      = process.env.SMS_URL      ?? "https://www.intouchsms.co.rw/api/sendsms/.json";
    const username = process.env.SMS_USERNAME ?? "";
    const password = process.env.SMS_PASSWORD ?? "";
    const sender   = process.env.SMS_SENDER   ?? "INGOBYI";

    const body = new URLSearchParams({
      sender,
      recipients: recipient,
      message,
      dlrurl: "http://www.dlrurl.rw/deliversms/",
    });

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${username}:${password}`).toString("base64"),
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    console.log(`[SMS] sent to ${recipient} — HTTP ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error(`[SMS] failed to send to ${recipient}:`, e);
    return false;
  }
}
