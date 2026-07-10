"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Send } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORM_TEMPLATE_OPTIONS, type FormTemplateType } from "@/lib/forms/templates";

type FormRow = {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  totalStudents: number;
  completedCount: number;
  missingCount: number;
};

type FormsHubProps = {
  canEdit: boolean;
};

export function FormsHub({ canEdit }: FormsHubProps) {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [templateType, setTemplateType] = useState<FormTemplateType>(
    FORM_TEMPLATE_OPTIONS[0].type,
  );
  const [deadline, setDeadline] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  async function loadForms() {
    const response = await fetch("/api/forms");
    if (!response.ok) return;
    const data = await response.json();
    setForms(data.forms ?? []);
  }

  useEffect(() => {
    void loadForms();
  }, []);

  async function createForm(event: React.FormEvent) {
    event.preventDefault();
    setIsCreating(true);
    const response = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateType,
        deadline: deadline || undefined,
      }),
    });
    setIsCreating(false);
    if (!response.ok) {
      toast.error("Could not create form");
      return;
    }
    toast.success("Form created from template");
    setDeadline("");
    router.refresh();
    await loadForms();
  }

  async function sendReminders(formId: string) {
    setRemindingId(formId);
    const response = await fetch("/api/forms/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId }),
    });
    setRemindingId(null);
    if (!response.ok) {
      toast.error("Could not send reminders");
      return;
    }
    const data = await response.json();
    toast.success(`Reminders sent: ${data.sent} (skipped ${data.skipped})`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms & consent"
        description="Template-based permission slips and waivers — not a free-form field builder in v1."
      />

      {canEdit && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Create form from template</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick a camp-standard form type. Staff customize title/deadline; fields are
              structured per template.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={createForm} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Template</Label>
                <select
                  className="min-h-11 w-full rounded-xl border bg-background px-3"
                  value={templateType}
                  onChange={(event) =>
                    setTemplateType(event.target.value as FormTemplateType)
                  }
                >
                  {FORM_TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Deadline (optional)</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="min-h-11"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="min-h-11 w-full" disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create form"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Create a permission slip, medical consent, photo release, or waiver from a template."
        />
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="rounded-2xl">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="font-semibold">{form.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {form.type.replace(/_/g, " ")} · {form.completedCount} of{" "}
                    {form.totalStudents} complete
                    {form.deadline
                      ? ` · Due ${new Date(form.deadline).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {canEdit && form.missingCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={remindingId === form.id}
                    onClick={() => void sendReminders(form.id)}
                  >
                    <Send className="size-4" aria-hidden />
                    Remind missing ({form.missingCount})
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
