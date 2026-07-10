"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { parentThreadDeliveryNote } from "@/lib/messaging/thread-delivery-shared";

type ThreadTopic = "GENERAL" | "INCIDENT" | "HEALTH";

type LinkedStudent = { id: string; name: string; teamName?: string | null };

type Thread = {
  id: string;
  subject: string | null;
  status: string;
  topic: ThreadTopic;
  studentName: string;
  updatedAt: string;
  lastMessage: {
    body: string;
    senderName: string | null;
    createdAt: string;
  } | null;
};

type ParentMessage = {
  id: string;
  body: string;
  sentVia: string[];
  createdAt: string;
  sender: { id: string; name: string | null; role: string; isSelf: boolean };
};

type ParentMessagingHubProps = {
  mode: "staff" | "parent";
  initialThreadId?: string;
  linkedStudents?: LinkedStudent[];
};

export function ParentMessagingHub({
  mode,
  initialThreadId,
  linkedStudents: initialStudents = [],
}: ParentMessagingHubProps) {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [linkedStudents, setLinkedStudents] = useState(initialStudents);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialThreadId ?? null,
  );
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newStudentId, setNewStudentId] = useState(initialStudents[0]?.id ?? "");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTopic, setActiveTopic] = useState<ThreadTopic>("GENERAL");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "parent") return;
    async function loadStudents() {
      const response = await fetch("/api/parent/students");
      if (!response.ok) return;
      const data = await response.json();
      setLinkedStudents(data.students ?? []);
      if (data.students?.[0] && !newStudentId) {
        setNewStudentId(data.students[0].id);
      }
    }
    void loadStudents();
  }, [mode, newStudentId]);

  useEffect(() => {
    async function loadThreads() {
      const response = await fetch("/api/parent/threads");
      if (!response.ok) return;
      const data = await response.json();
      setThreads(data.threads ?? []);
      if (!selectedId && data.threads?.[0]) {
        setSelectedId(data.threads[0].id);
      }
    }
    void loadThreads();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    async function loadMessages() {
      const response = await fetch(`/api/parent/threads/${selectedId}/messages`);
      if (!response.ok) return;
      const data = await response.json();
      setMessages(data.messages ?? []);
      setActiveTopic(data.thread?.topic ?? "GENERAL");
    }
    void loadMessages();
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function createThread(event: React.FormEvent) {
    event.preventDefault();
    if (!newStudentId || !newBody.trim()) return;
    setIsCreating(true);

    const response = await fetch("/api/parent/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: newStudentId,
        subject: newSubject || undefined,
        body: newBody.trim(),
      }),
    });

    setIsCreating(false);
    if (!response.ok) return;

    const data = await response.json();
    setNewBody("");
    setNewSubject("");
    setShowNewThread(false);
    setSelectedId(data.threadId);
    router.refresh();
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setIsSending(true);

    const response = await fetch(`/api/parent/threads/${selectedId}/messages`, {
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

  const deliveryNote =
    mode === "staff"
      ? activeTopic === "GENERAL"
        ? "General/logistics threads: full message text is sent via SMS and email to the guardian on file."
        : parentThreadDeliveryNote(activeTopic)
      : "Start a new conversation with your child's team anytime. Staff on your child's team will be notified.";

  const newThreadForm = mode === "parent" && linkedStudents.length > 0 && (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 pt-6">
        {!showNewThread ? (
          <Button
            type="button"
            className="min-h-11 w-full"
            onClick={() => setShowNewThread(true)}
          >
            <Plus className="size-4" aria-hidden />
            New message to staff
          </Button>
        ) : (
          <form onSubmit={createThread} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-student">Child</Label>
              <select
                id="new-student"
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                value={newStudentId}
                onChange={(event) => setNewStudentId(event.target.value)}
              >
                {linkedStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                    {student.teamName ? ` · ${student.teamName}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-subject">Subject (optional)</Label>
              <Input
                id="new-subject"
                value={newSubject}
                onChange={(event) => setNewSubject(event.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-body">Message</Label>
              <textarea
                id="new-body"
                className="min-h-24 w-full rounded-xl border bg-background px-3 py-2"
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="min-h-11" disabled={isCreating}>
                {isCreating ? "Sending..." : "Send to staff"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setShowNewThread(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );

  if (threads.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parent messages" description={deliveryNote} />
        {newThreadForm}
        {!showNewThread && (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description={
              mode === "staff"
                ? "Start a thread for a student on your team, or wait for a parent to reach out."
                : "Use “New message to staff” above to contact your child's counselors."
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Parent messages" description={deliveryNote} />
      {mode === "parent" && newThreadForm}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="rounded-2xl">
          <CardContent className="space-y-1 p-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={cn(
                  "w-full rounded-xl px-3 py-3 text-left text-sm transition-colors",
                  selectedId === thread.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/60",
                )}
                onClick={() => setSelectedId(thread.id)}
              >
                <p className="font-medium">{thread.studentName}</p>
                {thread.topic !== "GENERAL" && (
                  <p className="text-xs text-amber-700">{thread.topic}</p>
                )}
                {thread.lastMessage && (
                  <p className="truncate text-xs text-muted-foreground">
                    {thread.lastMessage.body}
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
                    {new Date(message.createdAt).toLocaleString()}
                    {message.sentVia.includes("sms")
                      ? message.sentVia.includes("email")
                        ? " · Notified (SMS/email)"
                        : " · SMS"
                      : message.sentVia.includes("email")
                        ? " · Email"
                        : ""}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="mt-4 flex gap-2">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message..."
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
