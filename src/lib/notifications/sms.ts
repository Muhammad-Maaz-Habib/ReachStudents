import twilio from "twilio";
import { getNotificationConfig, isSmsEnabled } from "@/lib/notifications/config";

export async function sendSms(params: { to: string; body: string }) {
  if (!isSmsEnabled()) {
    console.info("[sms:skipped]", params.to, params.body.slice(0, 80));
    return { ok: false as const, reason: "not_configured" as const };
  }

  const config = getNotificationConfig();
  const client = twilio(config.twilioAccountSid!, config.twilioAuthToken!);

  try {
    const message = await client.messages.create({
      from: config.twilioFromNumber!,
      to: params.to,
      body: params.body,
    });
    return { ok: true as const, sid: message.sid };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "sms_failed";
    console.error("[sms:error]", reason);
    return { ok: false as const, reason };
  }
}
