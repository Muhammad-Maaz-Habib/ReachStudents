"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Send, Wrench } from "lucide-react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { CustomFormBuilderDialog } from "@/components/forms/custom-form-builder-dialog";
import { DeleteFormButton } from "@/components/forms/delete-form-button";
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

type CustomTemplateRow = {
  id: string;
  title: string;
  description: string | null;
  fieldCount: number;
  updatedAt: string;
};

type FormsHubProps = {
  canEdit: boolean;
  canDelete?: boolean;
};

export function FormsHub({ canEdit, canDelete = false }: FormsHubProps) {
  const router = useRouter();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplateRow[]>(
    [],
  );
  const [templateType, setTemplateType] = useState<FormTemplateType>(
    FORM_TEMPLATE_OPTIONS[0].type,
  );
  const [deadline, setDeadline] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  async function loadForms() {
    const response = await fetch("/api/forms");
    if (!response.ok) return;
    const data = await response.json();
    setForms(data.forms ?? []);
    setCustomTemplates(data.customTemplates ?? []);
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
        source: "template",
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

  async function publishCustomTemplate(templateId: string) {
    setPublishingId(templateId);
    const response = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "publish_custom",
        templateId,
      }),
    });
    setPublishingId(null);
    if (!response.ok) {
      toast.error("Could not publish custom template");
      return;
    }
    toast.success("Custom form published to this session");
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
        description="Publish fixed templates or build reusable custom forms for parent e-signature."
        action={
          canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setBuilderOpen(true)}
            >
              <Wrench className="size-4" aria-hidden />
              Create custom form
            </Button>
          ) : undefined
        }
      />

      {canEdit && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Create form from template</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick a camp-standard form type. Staff customize deadline; fields
              come from the template.
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

      {canEdit && customTemplates.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Custom templates</CardTitle>
            <p className="text-sm text-muted-foreground">
              Reusable schemas saved for your organization. Publish a copy to the
              active session whenever you need parents to fill it out.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {customTemplates.map((template) => (
              <div
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div>
                  <p className="font-medium">{template.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {template.fieldCount} field
                    {template.fieldCount === 1 ? "" : "s"}
                    {template.description ? ` · ${template.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={publishingId === template.id}
                      onClick={() => void publishCustomTemplate(template.id)}
                    >
                      {publishingId === template.id
                        ? "Publishing..."
                        : "Publish to session"}
                    </Button>
                  )}
                  {canDelete && (
                    <DeleteFormButton
                      formId={template.id}
                      formTitle={template.title}
                      submissionCount={0}
                      isTemplate
                      onDeleted={() => void loadForms()}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Create a permission slip, medical consent, photo release, waiver, or custom form."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">Published for this session</p>
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
                <div className="flex flex-wrap items-center gap-2">
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
                  {canDelete && (
                    <DeleteFormButton
                      formId={form.id}
                      formTitle={form.title}
                      submissionCount={form.completedCount}
                      onDeleted={() => void loadForms()}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canEdit && (
        <CustomFormBuilderDialog
          open={builderOpen}
          onOpenChange={setBuilderOpen}
          onSaved={() => {
            void loadForms();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
