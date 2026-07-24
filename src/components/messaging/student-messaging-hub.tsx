"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/design-system/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ThreadSummary = {
  id: string;
  subject: string | null;
  status: string;
  studentName?: string;
  updatedAt: string;
  lastMessage: {
    body: string;
    createdAt: string;
    senderName: string | null;
  } | null;
};

type MessageRow = {
  id: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    role: string;
    isSelf: boolean;
  };
};

type StudentMessagingHubProps = {
  mode: "student" | "staff";
};

export function StudentMessagingHub({ mode }: StudentMessagingHubProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [threadTitle, setThreadTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadThreads() {
    const response = await fetch("/api/student/threads");
    if (!response.ok) {
      toast.error("Could not load messages");
      return;
    }
    const data = await response.json();
    setThreads(data.threads ?? []);
  }

  async function loadMessages(threadId: string) {
    const response = await fetch(`/api/student/threads/${threadId}/messages`);
    if (!response.ok) {
      toast.error("Could not open thread");
      return;
    }
    const data = await response.json();
    setActiveId(threadId);
    setThreadTitle(
      data.thread?.subject ||
        data.thread?.studentName ||
        (mode === "student" ? "Conversation" : "Student thread"),
    );
    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    void loadThreads();
  }, []);

  async function createThread(event: React.FormEvent) {
    event.preventDefault();
    if (mode !== "student" || !body.trim()) return;
    setIsLoading(true);
    const response = await fetch("/api/student/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: subject.trim() || undefined,
        body: body.trim(),
      }),
    });
    setIsLoading(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string" ? data.error : "Could not send message",
      );
      return;
    }
    const data = await response.json();
    setSubject("");
    setBody("");
    toast.success("Message sent");
    await loadThreads();
    if (data.threadId) await loadMessages(data.threadId);
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!activeId || !reply.trim()) return;
    setIsLoading(true);
    const response = await fetch(`/api/student/threads/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });
    setIsLoading(false);
    if (!response.ok) {
      toast.error("Could not send reply");
      return;
    }
    setReply("");
    await loadMessages(activeId);
    await loadThreads();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "student" ? "Messages" : "Student messages"}
        description={
          mode === "student"
            ? "Message your mentor, team staff, or program admins. Peer chat is not available."
            : "Threads started by students linked to your teams or mentor groups."
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "student" && (
              <form onSubmit={(event) => void createThread(event)} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="space-y-2">
                  <Label htmlFor="student-msg-subject">Subject (optional)</Label>
                  <Input
                    id="student-msg-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-msg-body">Message</Label>
                  <textarea
                    id="student-msg-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
                  {isLoading ? "Sending..." : "Message staff"}
                </Button>
              </form>
            )}

            {threads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      className="w-full p-3 text-left text-sm hover:bg-muted/40"
                      onClick={() => void loadMessages(thread.id)}
                    >
                      <p className="font-medium">
                        {thread.subject ||
                          thread.studentName ||
                          "Conversation"}
                      </p>
                      <p className="line-clamp-1 text-muted-foreground">
                        {thread.lastMessage?.body ?? "No messages"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">
              {activeId ? threadTitle : "Select a conversation"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeId ? (
              <p className="text-sm text-muted-foreground">
                Choose a thread to read and reply.
              </p>
            ) : (
              <>
                <ul className="max-h-80 space-y-3 overflow-y-auto">
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      className={`rounded-xl border p-3 text-sm ${
                        message.sender.isSelf ? "bg-muted/40" : "bg-background"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground">
                        {message.sender.name ?? "User"} ·{" "}
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                    </li>
                  ))}
                </ul>
                <form onSubmit={(event) => void sendReply(event)} className="space-y-2">
                  <Label htmlFor="student-reply">Reply</Label>
                  <textarea
                    id="student-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    required
                    rows={3}
                    className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  />
                  <Button type="submit" className="min-h-11" disabled={isLoading}>
                    Send reply
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
