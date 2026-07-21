"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FORM_FIELD_TYPE_OPTIONS,
  slugifyFieldId,
  type FormFieldDefinition,
  type FormFieldType,
} from "@/lib/forms/templates";

type DraftField = FormFieldDefinition & { optionsText?: string };

type CustomFormBuilderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

function blankField(existing: DraftField[]): DraftField {
  return {
    id: slugifyFieldId("field", existing.map((field) => field.id)),
    label: "",
    type: "text",
    required: false,
    optionsText: "",
  };
}

export function CustomFormBuilderDialog({
  open,
  onOpenChange,
  onSaved,
}: CustomFormBuilderDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fields, setFields] = useState<DraftField[]>([blankField([])]);
  const [publishToSession, setPublishToSession] = useState(true);
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setDeadline("");
    setFields([blankField([])]);
    setPublishToSession(true);
    setSaveAsTemplate(true);
  }

  function updateField(index: number, patch: Partial<DraftField>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function removeField(index: number) {
    setFields((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!saveAsTemplate && !publishToSession) {
      toast.error("Save as template and/or publish to this session");
      return;
    }

    const existingIds: string[] = [];
    const payloadFields: FormFieldDefinition[] = [];

    for (const field of fields) {
      if (!field.label.trim()) {
        toast.error("Every field needs a label");
        return;
      }
      const type = field.type as FormFieldType;
      const needsOptions = type === "select" || type === "multiselect";
      const options = (field.optionsText ?? "")
        .split(/\n|,/)
        .map((option) => option.trim())
        .filter(Boolean);

      if (needsOptions && options.length < 2) {
        toast.error(`“${field.label}” needs at least 2 options`);
        return;
      }

      const id = slugifyFieldId(field.label, existingIds);
      existingIds.push(id);
      payloadFields.push({
        id,
        label: field.label.trim(),
        type,
        required: Boolean(field.required),
        ...(needsOptions ? { options } : {}),
        ...(field.helpText?.trim() ? { helpText: field.helpText.trim() } : {}),
      });
    }

    setIsSaving(true);
    const response = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "custom",
        title: title.trim(),
        description: description.trim() || undefined,
        fields: payloadFields,
        deadline: deadline || undefined,
        saveAsTemplate,
        publishToSession,
      }),
    });
    setIsSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error(
        typeof data.error === "string"
          ? data.error
          : "Could not save custom form",
      );
      return;
    }

    const parts = [];
    if (saveAsTemplate) parts.push("saved as template");
    if (publishToSession) parts.push("published to session");
    toast.success(`Custom form ${parts.join(" and ")}`);
    reset();
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create custom form</DialogTitle>
          <DialogDescription>
            Build fields for your org. Save as a reusable template and/or publish
            to the active session for parents to complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom-form-title">Title</Label>
            <Input
              id="custom-form-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-h-11"
              placeholder="Cabin quiet hours agreement"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-form-description">Description</Label>
            <textarea
              id="custom-form-description"
              className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional context shown to parents"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-form-deadline">
              Deadline (optional, when publishing)
            </Label>
            <Input
              id="custom-form-deadline"
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="min-h-11"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Fields</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() =>
                  setFields((current) => [...current, blankField(current)])
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Add field
              </Button>
            </div>

            {fields.map((field, index) => {
              const typeMeta = FORM_FIELD_TYPE_OPTIONS.find(
                (option) => option.value === field.type,
              );
              return (
                <div
                  key={`${field.id}-${index}`}
                  className="space-y-3 rounded-2xl border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Field {index + 1}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9"
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9"
                        disabled={index === fields.length - 1}
                        onClick={() => moveField(index, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9 text-destructive"
                        disabled={fields.length <= 1}
                        onClick={() => removeField(index)}
                        aria-label="Remove field"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Label</Label>
                      <Input
                        value={field.label}
                        onChange={(event) =>
                          updateField(index, { label: event.target.value })
                        }
                        className="min-h-11"
                        placeholder="Field label"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <select
                        className="min-h-11 w-full rounded-xl border bg-background px-3"
                        value={field.type}
                        onChange={(event) =>
                          updateField(index, {
                            type: event.target.value as FormFieldType,
                          })
                        }
                      >
                        {FORM_FIELD_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(event) =>
                            updateField(index, {
                              required: event.target.checked,
                            })
                          }
                        />
                        Required
                      </label>
                    </div>
                    {typeMeta?.needsOptions && (
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Options (comma or new line separated)</Label>
                        <textarea
                          className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm"
                          value={field.optionsText ?? ""}
                          onChange={(event) =>
                            updateField(index, {
                              optionsText: event.target.value,
                            })
                          }
                          placeholder={"Option A\nOption B\nOption C"}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 rounded-xl border border-dashed p-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={saveAsTemplate}
                onChange={(event) => setSaveAsTemplate(event.target.checked)}
              />
              <span>
                <span className="font-medium">Save as reusable template</span>
                <span className="block text-muted-foreground">
                  Keeps this schema in your org library so you can publish it to
                  future sessions.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={publishToSession}
                onChange={(event) => setPublishToSession(event.target.checked)}
              />
              <span>
                <span className="font-medium">Publish to this session</span>
                <span className="block text-muted-foreground">
                  Parents see it immediately in pending forms for the active
                  camp session.
                </span>
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving ? "Saving..." : "Save custom form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
