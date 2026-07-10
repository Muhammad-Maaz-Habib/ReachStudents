"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, Check } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/design-system/empty-state";

type Announcement = {
  id: string;
  title: string;
  body: string;
  channels: string[];
  createdAt: string;
  senderName: string | null;
  scope: string;
  readAt: string | null;
  readCount: number;
};

type AnnouncementsHubProps = {
  canEdit: boolean;
};

export function AnnouncementsHub({ canEdit }: AnnouncementsHubProps) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadAnnouncements() {
    const response = await fetch("/api/announcements");
    if (!response.ok) return;
    const data = await response.json();
    setAnnouncements(data.announcements ?? []);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/announcements/${id}/read`, { method: "POST" });
    setAnnouncements((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              readAt: new Date().toISOString(),
              readCount: item.readCount + (item.readAt ? 0 : 1),
            }
          : item,
      ),
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    const formData = new FormData(event.currentTarget);
    const channels = ["in_app"];
    if (formData.get("sendEmail") === "on") channels.push("email");
    if (formData.get("sendSms") === "on") channels.push("sms");

    const response = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(formData.get("title") ?? ""),
        body: String(formData.get("body") ?? ""),
        channels,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      toast.error("Could not send announcement");
      return;
    }

    toast.success("Announcement sent");
    (event.target as HTMLFormElement).reset();
    router.refresh();
    await loadAnnouncements();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Broadcast to staff and parents with read receipts. Optional SMS/email blast when configured."
      />

      {canEdit && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">New announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required className="min-h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea id="body" name="body" required rows={4} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="sendEmail" />
                  Also send email
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="sendSms" />
                  Also send SMS
                </label>
              </div>
              <Button type="submit" className="min-h-11" disabled={isSaving}>
                {isSaving ? "Sending..." : "Send announcement"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading announcements...</p>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Session-wide broadcasts and team notes will appear here."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => (
            <Card key={item.id} className="rounded-2xl">
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.scope} · {item.senderName ?? "Staff"} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.readAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      onClick={() => void markRead(item.id)}
                    >
                      <Check className="size-4" aria-hidden />
                      Mark read
                    </Button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                <p className="text-xs text-muted-foreground">
                  {item.readCount} read
                  {item.readAt ? " · You read this" : ""}
                  {item.channels.length > 1
                    ? ` · Sent via ${item.channels.join(", ")}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
