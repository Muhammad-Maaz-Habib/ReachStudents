"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePusherChannel } from "@/hooks/use-pusher";

type Channel = {
  id: string;
  name: string;
  type: string;
  teamColor: string | null;
  mentorGroupName?: string | null;
  messageCount: number;
  lastMessage: {
    body: string;
    senderName: string | null;
    createdAt: string;
  } | null;
};

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; isSelf: boolean };
};

export function StaffChatHub() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  usePusherChannel({
    channelName: selectedId ? `private-chat-${selectedId}` : null,
    event: "new-message",
    onEvent: (data) => {
      const message = data as ChatMessage;
      setMessages((current) =>
        current.some((item) => item.id === message.id)
          ? current
          : [...current, message],
      );
    },
  });

  useEffect(() => {
    async function loadChannels() {
      const response = await fetch("/api/chat/channels");
      if (!response.ok) return;
      const data = await response.json();
      setChannels(data.channels ?? []);
      if (data.channels?.[0]) setSelectedId(data.channels[0].id);
    }
    void loadChannels();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    async function loadMessages() {
      const response = await fetch(`/api/chat/channels/${selectedId}/messages`);
      if (!response.ok) return;
      const data = await response.json();
      setMessages(data.messages ?? []);
    }
    void loadMessages();
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setIsSending(true);

    const response = await fetch(`/api/chat/channels/${selectedId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.trim() }),
    });

    setIsSending(false);
    if (!response.ok) return;

    const data = await response.json();
    setMessages((current) => [...current, data.message]);
    setDraft("");
  }

  if (channels.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Staff chat"
          description="Channel-based team chat with realtime updates via Pusher."
        />
        <EmptyState
          icon={MessageSquare}
          title="No channels yet"
          description="Channels are created automatically for your session, teams, and mentor groups."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff chat"
        description="All-staff, team, mentor-group, and club channels. Messages update live when Pusher is configured."
      />

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="rounded-2xl">
          <CardContent className="space-y-1 p-2">
            {channels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left text-sm transition-colors",
                  selectedId === channel.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/60",
                )}
                onClick={() => setSelectedId(channel.id)}
              >
                <p className="font-medium">{channel.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {channel.type === "GENERAL"
                    ? "All staff"
                    : channel.type === "MENTOR_GROUP"
                      ? "Mentor group"
                      : channel.type === "CLUB"
                        ? "Club"
                        : "Team"}
                </p>
                {channel.lastMessage && (
                  <p className="truncate text-xs text-muted-foreground">
                    {channel.lastMessage.senderName}: {channel.lastMessage.body}
                  </p>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col rounded-2xl">
          <CardContent className="flex flex-1 flex-col p-4">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    message.sender.isSelf
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  {!message.sender.isSelf && (
                    <p className="mb-1 text-xs font-medium opacity-80">
                      {message.sender.name}
                    </p>
                  )}
                  <p>{message.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Message your team..."
                className="min-h-11"
              />
              <Button
                type="submit"
                className="min-h-11 shrink-0"
                disabled={isSending || !draft.trim()}
              >
                <Send className="size-4" aria-hidden />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
