"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SignaturePad } from "@/components/forms/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormFieldDefinition } from "@/lib/forms/templates";

type FormFillProps = {
  formId: string;
  studentId: string;
  studentName: string;
  formTitle: string;
  fields: FormFieldDefinition[];
  signerEmailDefault?: string;
};

export function FormFill({
  formId,
  studentId,
  studentName,
  formTitle,
  fields,
  signerEmailDefault,
}: FormFillProps) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, string | boolean>>({});
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState(signerEmailDefault ?? "");
  const [signature, setSignature] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!signature) {
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
        signatureDataUrl: signature,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      toast.error("Could not submit form");
      return;
    }

    toast.success("Form signed and submitted");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border p-4">
      <div>
        <p className="font-semibold">{formTitle}</p>
        <p className="text-sm text-muted-foreground">For {studentName}</p>
      </div>

      {fields
        .filter((field) => field.type !== "signature")
        .map((field) => (
          <div key={field.id} className="space-y-2">
            {field.type === "checkbox" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  required={field.required}
                  checked={!!responses[field.id]}
                  onChange={(event) =>
                    setResponses((current) => ({
                      ...current,
                      [field.id]: event.target.checked,
                    }))
                  }
                />
                <span>{field.label}</span>
              </label>
            ) : (
              <>
                <Label>{field.label}</Label>
                {field.type === "textarea" ? (
                  <textarea
                    className="min-h-20 w-full rounded-xl border px-3 py-2"
                    required={field.required}
                    value={String(responses[field.id] ?? "")}
                    onChange={(event) =>
                      setResponses((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    type={field.type === "date" ? "date" : "text"}
                    required={field.required}
                    className="min-h-11"
                    value={String(responses[field.id] ?? "")}
                    onChange={(event) =>
                      setResponses((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                  />
                )}
              </>
            )}
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
      <div className="space-y-2">
        <Label>Signature</Label>
        <SignaturePad onChange={setSignature} />
      </div>

      <Button type="submit" className="min-h-11 w-full" disabled={isSaving}>
        {isSaving ? "Submitting..." : "Sign and submit"}
      </Button>
    </form>
  );
}
