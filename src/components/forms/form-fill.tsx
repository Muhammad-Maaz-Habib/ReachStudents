"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SignaturePad } from "@/components/forms/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formHasSignatureField,
  type FormFieldDefinition,
  type FormResponseValue,
} from "@/lib/forms/templates";

type FormFillProps = {
  formId: string;
  studentId: string;
  studentName: string;
  formTitle: string;
  fields: FormFieldDefinition[];
  signerEmailDefault?: string;
  onSubmitted?: () => void;
};

export function FormFill({
  formId,
  studentId,
  studentName,
  formTitle,
  fields,
  signerEmailDefault,
  onSubmitted,
}: FormFillProps) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, FormResponseValue>>(
    {},
  );
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState(signerEmailDefault ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const needsSignature = useMemo(
    () => formHasSignatureField(fields),
    [fields],
  );
  const answerFields = useMemo(
    () => fields.filter((field) => field.type !== "signature"),
    [fields],
  );

  function setResponse(fieldId: string, value: FormResponseValue) {
    setResponses((current) => ({ ...current, [fieldId]: value }));
  }

  function toggleMulti(fieldId: string, option: string, checked: boolean) {
    setResponses((current) => {
      const existing = Array.isArray(current[fieldId])
        ? [...(current[fieldId] as string[])]
        : [];
      const next = checked
        ? existing.includes(option)
          ? existing
          : [...existing, option]
        : existing.filter((entry) => entry !== option);
      return { ...current, [fieldId]: next };
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (needsSignature && !signature) {
      toast.error("Please sign the form");
      return;
    }
    setIsSaving(true);

    const response = await fetch(`/api/forms/${formId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        responses,
        signerName,
        signerEmail: signerEmail || undefined,
        signatureDataUrl: signature || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) {
      toast.error(
        typeof data.error === "string" ? data.error : "Could not submit form",
      );
      return;
    }

    toast.success("Form signed and submitted");
    onSubmitted?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border p-4">
      <div>
        <p className="font-semibold">{formTitle}</p>
        <p className="text-sm text-muted-foreground">For {studentName}</p>
      </div>

      {answerFields.map((field) => (
        <div key={field.id} className="space-y-2">
          {field.type === "checkbox" ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required={field.required}
                checked={!!responses[field.id]}
                onChange={(event) =>
                  setResponse(field.id, event.target.checked)
                }
              />
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
            </label>
          ) : field.type === "yesno" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {field.label}
                {field.required ? " *" : ""}
              </legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(["yes", "no"] as const).map((option) => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.id}
                      required={field.required}
                      checked={responses[field.id] === option}
                      onChange={() => setResponse(field.id, option)}
                    />
                    {option === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : field.type === "select" ? (
            <>
              <Label>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              <select
                className="min-h-11 w-full rounded-xl border bg-background px-3"
                required={field.required}
                value={String(responses[field.id] ?? "")}
                onChange={(event) => setResponse(field.id, event.target.value)}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          ) : field.type === "multiselect" ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                {field.label}
                {field.required ? " *" : ""}
              </legend>
              <div className="space-y-2">
                {(field.options ?? []).map((option) => {
                  const selected = Array.isArray(responses[field.id])
                    ? (responses[field.id] as string[]).includes(option)
                    : false;
                  return (
                    <label
                      key={option}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          toggleMulti(field.id, option, event.target.checked)
                        }
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : field.type === "textarea" ? (
            <>
              <Label>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              <textarea
                className="min-h-20 w-full rounded-xl border px-3 py-2"
                required={field.required}
                value={String(responses[field.id] ?? "")}
                onChange={(event) => setResponse(field.id, event.target.value)}
              />
            </>
          ) : (
            <>
              <Label>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
              <Input
                type={
                  field.type === "date"
                    ? "date"
                    : field.type === "number"
                      ? "number"
                      : "text"
                }
                required={field.required}
                className="min-h-11"
                value={String(responses[field.id] ?? "")}
                onChange={(event) => setResponse(field.id, event.target.value)}
              />
            </>
          )}
          {field.helpText ? (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          ) : null}
        </div>
      ))}

      <div className="space-y-2">
        <Label>Signer full name</Label>
        <Input
          value={signerName}
          onChange={(event) => setSignerName(event.target.value)}
          required
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <Label>Signer email (optional)</Label>
        <Input
          type="email"
          value={signerEmail}
          onChange={(event) => setSignerEmail(event.target.value)}
          className="min-h-11"
        />
      </div>
      {needsSignature && (
        <div className="space-y-2">
          <Label>
            {fields.find((field) => field.type === "signature")?.label ??
              "Signature"}
          </Label>
          <SignaturePad onChange={setSignature} />
        </div>
      )}

      <Button type="submit" className="min-h-11 w-full" disabled={isSaving}>
        {isSaving ? "Submitting..." : "Sign and submit"}
      </Button>
    </form>
  );
}
