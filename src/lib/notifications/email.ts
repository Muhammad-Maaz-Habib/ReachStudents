import { Resend } from "resend";
import { getNotificationConfig, isEmailEnabled } from "@/lib/notifications/config";

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!isEmailEnabled()) {
    console.info("[email:skipped]", params.to, params.subject);
    return { ok: false as const, reason: "not_configured" as const };
  }

  const config = getNotificationConfig();
  const resend = new Resend(config.resendApiKey);

  const result = await resend.emails.send({
    from: config.fromEmail,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html ?? `<p>${params.text.replace(/\n/g, "<br/>")}</p>`,
  });

  if (result.error) {
    console.error("[email:error]", result.error);
    return { ok: false as const, reason: result.error.message };
  }

  return { ok: true as const, id: result.data?.id };
}
