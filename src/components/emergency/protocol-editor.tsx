"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProtocolStep = { id: string; text: string; order: number };

type Protocol = {
  id: string;
  type: string;
  title: string;
  steps: ProtocolStep[];
};

type ProtocolEditorPanelProps = {
  protocol: Protocol;
  onSaved: (updated: Protocol) => void;
  onCancel: () => void;
};

function newStepId() {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ProtocolEditorPanel({
  protocol,
  onSaved,
  onCancel,
}: ProtocolEditorPanelProps) {
  const [title, setTitle] = useState(protocol.title);
  const [steps, setSteps] = useState<ProtocolStep[]>(
    [...protocol.steps].sort((a, b) => a.order - b.order),
  );
  const [isSaving, setIsSaving] = useState(false);

  function updateStepText(id: string, text: string) {
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, text } : step)),
    );
  }

  function addStep() {
    setSteps((current) => [
      ...current,
      { id: newStepId(), text: "", order: current.length + 1 },
    ]);
  }

  function removeStep(id: string) {
    setSteps((current) =>
      current
        .filter((step) => step.id !== id)
        .map((step, index) => ({ ...step, order: index + 1 })),
    );
  }

  function moveStep(id: string, direction: -1 | 1) {
    setSteps((current) => {
      const index = current.findIndex((step) => step.id === id);
      if (index < 0) return current;
      const next = index + direction;
      if (next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy.map((step, i) => ({ ...step, order: i + 1 }));
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const trimmedSteps = steps
      .map((step) => ({ ...step, text: step.text.trim() }))
      .filter((step) => step.text.length > 0);

    if (!title.trim()) {
      toast.error("Protocol title is required");
      return;
    }
    if (trimmedSteps.length === 0) {
      toast.error("Add at least one step");
      return;
    }

    setIsSaving(true);
    const response = await fetch(`/api/emergency/protocols/${protocol.type}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), steps: trimmedSteps }),
    });
    setIsSaving(false);

    if (!response.ok) {
      toast.error("Could not save protocol");
      return;
    }

    const updated = await response.json();
    toast.success("Protocol saved");
    onSaved({
      id: updated.id,
      type: updated.type,
      title: updated.title,
      steps: updated.steps,
    });
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="protocol-title">Protocol title</Label>
        <Input
          id="protocol-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Steps</Label>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus className="size-4" aria-hidden />
            Add step
          </Button>
        </div>
        <ul className="space-y-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex items-start gap-2 rounded-xl border bg-background p-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {index + 1}
              </span>
              <textarea
                value={step.text}
                onChange={(event) => updateStepText(step.id, event.target.value)}
                className="min-h-11 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                placeholder="Step instruction..."
                rows={2}
              />
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => moveStep(step.id, -1)}
                  aria-label="Move step up"
                >
                  <GripVertical className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={steps.length <= 1}
                  onClick={() => removeStep(step.id)}
                  aria-label="Remove step"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save protocol"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

type ProtocolViewHeaderProps = {
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
};

export function ProtocolViewHeader({
  canEdit,
  isEditing,
  onEdit,
}: ProtocolViewHeaderProps) {
  if (!canEdit || isEditing) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={onEdit}>
      <Pencil className="size-4" aria-hidden />
      Edit protocol
    </Button>
  );
}
