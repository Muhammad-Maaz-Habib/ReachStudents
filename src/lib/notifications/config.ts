export type NotificationChannel = "sms" | "email" | "push";

export function getNotificationConfig() {
  return {
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "Waypoint <onboarding@resend.dev>",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
    pusherAppId: process.env.PUSHER_APP_ID,
    pusherKey: process.env.PUSHER_KEY,
    pusherSecret: process.env.PUSHER_SECRET,
    pusherCluster: process.env.PUSHER_CLUSTER ?? "us2",
    appUrl: process.env.AUTH_URL ?? "http://localhost:3000",
  };
}

export function isEmailEnabled() {
  const config = getNotificationConfig();
  return !!config.resendApiKey;
}

export function isSmsEnabled() {
  const config = getNotificationConfig();
  return !!(
    config.twilioAccountSid &&
    config.twilioAuthToken &&
    config.twilioFromNumber
  );
}

export function isPusherEnabled() {
  const config = getNotificationConfig();
  return !!(
    config.pusherAppId &&
    config.pusherKey &&
    config.pusherSecret
  );
}

export function orgChannelName(organizationId: string) {
  return `private-org-${organizationId}`;
}

export function chatChannelName(channelId: string) {
  return `private-chat-${channelId}`;
}
