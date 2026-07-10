"use client";

import { useEffect, useRef } from "react";
import PusherClient from "pusher-js";

type UsePusherChannelOptions = {
  channelName: string | null;
  event: string;
  onEvent: (data: unknown) => void;
  enabled?: boolean;
};

export function usePusherChannel({
  channelName,
  event,
  onEvent,
  enabled = true,
}: UsePusherChannelOptions) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !channelName) return;

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "us2";
    if (!key) return;

    const pusher = new PusherClient(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusher.subscribe(channelName);
    const handler = (data: unknown) => handlerRef.current(data);
    channel.bind(event, handler);

    return () => {
      channel.unbind(event, handler);
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [channelName, event, enabled]);
}
