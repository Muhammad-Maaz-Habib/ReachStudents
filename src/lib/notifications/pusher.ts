import Pusher from "pusher";
import {
  chatChannelName,
  getNotificationConfig,
  isPusherEnabled,
  orgChannelName,
} from "@/lib/notifications/config";

function getPusherServer() {
  const config = getNotificationConfig();
  return new Pusher({
    appId: config.pusherAppId!,
    key: config.pusherKey!,
    secret: config.pusherSecret!,
    cluster: config.pusherCluster,
    useTLS: true,
  });
}

export async function pushOrgEvent(
  organizationId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  if (!isPusherEnabled()) {
    console.info("[pusher:skipped]", event, payload);
    return { ok: false as const, reason: "not_configured" as const };
  }

  const pusher = getPusherServer();
  await pusher.trigger(orgChannelName(organizationId), event, payload);
  return { ok: true as const };
}

export async function pushChatEvent(
  channelId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  if (!isPusherEnabled()) {
    console.info("[pusher:chat:skipped]", event, payload);
    return { ok: false as const, reason: "not_configured" as const };
  }

  const pusher = getPusherServer();
  await pusher.trigger(chatChannelName(channelId), event, payload);
  return { ok: true as const };
}

export function getPusherPublicConfig() {
  const config = getNotificationConfig();
  return {
    key: config.pusherKey ?? null,
    cluster: config.pusherCluster,
    enabled: isPusherEnabled(),
  };
}
