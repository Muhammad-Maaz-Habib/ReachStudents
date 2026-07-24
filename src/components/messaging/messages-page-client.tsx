"use client";

import { useState } from "react";
import { PageHeader } from "@/components/design-system/page-header";
import { ParentMessagingHub } from "@/components/messaging/parent-messaging-hub";
import { StudentMessagingHub } from "@/components/messaging/student-messaging-hub";
import { StaffChatHub } from "@/components/messaging/staff-chat-hub";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StudentOption = { id: string; name: string };

type MessagesPageClientProps = {
  students: StudentOption[];
};

export function MessagesPageClient({ students }: MessagesPageClientProps) {
  const [tab, setTab] = useState<"chat" | "parents" | "students">("chat");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createThread(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId || !body.trim()) return;
    setIsCreating(true);
    const response = await fetch("/api/parent/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        subject: subject || undefined,
        body: body.trim(),
      }),
    });
    setIsCreating(false);
    if (!response.ok) return;
    setBody("");
    setSubject("");
    setTab("parents");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Staff channels, parent threads, and student–staff messages."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === "chat" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setTab("chat")}
        >
          Staff chat
        </Button>
        <Button
          type="button"
          variant={tab === "parents" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setTab("parents")}
        >
          Parent threads
        </Button>
        <Button
          type="button"
          variant={tab === "students" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setTab("students")}
        >
          Student messages
        </Button>
      </div>

      {tab === "chat" ? (
        <StaffChatHub />
      ) : tab === "students" ? (
        <StudentMessagingHub mode="staff" />
      ) : (
        <div className="space-y-4">
          {students.length > 0 && (
            <form
              onSubmit={createThread}
              className={cn(
                "grid gap-3 rounded-2xl border bg-muted/20 p-4 sm:grid-cols-2",
              )}
            >
              <label className="space-y-1 text-sm">
                <span className="font-medium">Student</span>
                <select
                  className="min-h-11 w-full rounded-xl border bg-background px-3"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Subject (optional)</span>
                <input
                  className="min-h-11 w-full rounded-xl border bg-background px-3"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">First message</span>
                <textarea
                  className="min-h-24 w-full rounded-xl border bg-background px-3 py-2"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
              </label>
              <Button
                type="submit"
                className="min-h-11 sm:col-span-2"
                disabled={isCreating}
              >
                {isCreating ? "Starting..." : "Start parent thread"}
              </Button>
            </form>
          )}
          <ParentMessagingHub mode="staff" />
        </div>
      )}
    </div>
  );
}
