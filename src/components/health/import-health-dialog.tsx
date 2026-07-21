"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { CsvFormatHelper } from "@/components/design-system/csv-format-helper";
import { HEALTH_CSV_COLUMNS } from "@/lib/csv/health-import";
import { HEALTH_CSV_AI_PROMPT } from "@/lib/csv/import-ai-prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const HEALTH_EXAMPLE_ROW = [
  "REG-001",
  "Jordan",
  "Lee",
  "2012-03-15",
  "Peanuts, tree nuts",
  "EpiPen as needed",
  "Asthma",
];

type ImportHealthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportHealthDialog({
  open,
  onOpenChange,
}: ImportHealthDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
    warnings: string[];
  } | null>(null);

  async function handleImport(file: File) {
    setIsLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/health/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setIsLoading(false);
    setResult(data);

    if (data.imported > 0 || data.updated > 0) {
      const parts = [];
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      if (data.imported > 0) parts.push(`${data.imported} profiles created`);
      toast.success(parts.join(", "));
      router.refresh();
    } else if (!response.ok) {
      toast.error("Import failed — check the CSV format");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import health CSV</DialogTitle>
          <DialogDescription>
            Updates medical profiles for existing students only. Match by
            external_id, or by first_name + last_name + date_of_birth together.
            Confidential notes are not importable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CsvFormatHelper
            columns={HEALTH_CSV_COLUMNS}
            exampleRow={HEALTH_EXAMPLE_ROW}
            filename="health-import-template.csv"
            aiPrompt={HEALTH_CSV_AI_PROMPT}
            notes={
              <p className="text-sm text-muted-foreground">
                Required identity: <code>external_id</code>, or{" "}
                <code>first_name</code> + <code>last_name</code> +{" "}
                <code>date_of_birth</code> (YYYY-MM-DD). Unmatched rows are
                rejected — nothing new is created. Empty allergy/med/condition
                cells clear that field.
              </p>
            }
          />

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden />
            {isLoading ? "Importing..." : "Choose CSV file"}
          </Button>

          {result && (
            <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
              <p>
                <span className="font-medium text-emerald-700">
                  {result.updated} updated
                </span>
                {result.imported > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {result.imported} profiles created
                  </span>
                )}
                {result.skipped > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {result.skipped} skipped
                  </span>
                )}
              </p>
              {result.warnings.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-amber-700">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              {result.errors.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-destructive">
                  {result.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
