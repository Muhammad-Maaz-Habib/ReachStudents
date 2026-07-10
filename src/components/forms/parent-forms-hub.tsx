"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/design-system/page-header";
import { EmptyState } from "@/components/design-system/empty-state";
import { FormFill } from "@/components/forms/form-fill";
import { FileText } from "lucide-react";
import type { FormFieldDefinition } from "@/lib/forms/templates";

type PendingForm = {
  formId: string;
  studentId: string;
  studentName: string;
  title: string;
  fields: FormFieldDefinition[];
  deadline: string | null;
};

type CompletedForm = {
  formId: string;
  studentId: string;
  studentName: string;
  title: string;
  submittedAt: string;
};

export function ParentFormsHub() {
  const [pending, setPending] = useState<PendingForm[]>([]);
  const [completed, setCompleted] = useState<CompletedForm[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/parent/forms");
      if (!response.ok) return;
      const data = await response.json();
      setPending(data.pending ?? []);
      setCompleted(data.completed ?? []);
      if (data.pending?.[0]) {
        setActiveId(`${data.pending[0].formId}:${data.pending[0].studentId}`);
      }
    }
    void load();
  }, []);

  const active = pending.find(
    (item) => `${item.formId}:${item.studentId}` === activeId,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        description="Sign permission slips and consent forms for your child."
      />

      {pending.length === 0 && completed.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms assigned"
          description="When camp staff assign forms, they'll appear here for e-signature."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pending</p>
              {pending.map((item) => {
                const key = `${item.formId}:${item.studentId}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${
                      activeId === key ? "border-primary bg-primary/10" : ""
                    }`}
                    onClick={() => setActiveId(key)}
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">{item.studentName}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-4">
            {active ? (
              <FormFill
                formId={active.formId}
                studentId={active.studentId}
                studentName={active.studentName}
                formTitle={active.title}
                fields={active.fields}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a pending form to sign.
              </p>
            )}

            {completed.length > 0 && (
              <div className="rounded-2xl border p-4">
                <p className="mb-2 font-medium">Completed</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {completed.map((item) => (
                    <li key={`${item.formId}:${item.studentId}`}>
                      {item.title} — {item.studentName} ·{" "}
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
