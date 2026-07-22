"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { CsvFormatHelper } from "@/components/design-system/csv-format-helper";
import { ROSTER_CSV_COLUMNS } from "@/lib/csv/student-import";
import { ROSTER_CSV_AI_PROMPT } from "@/lib/csv/import-ai-prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROSTER_EXAMPLE_ROW = [
  "REG-001",
  "Jordan",
  "Lee",
  "2012-03-15",
  "8",
  "Pine Cabin",
  "Mentor Group A",
  "Peanuts",
  "EpiPen as needed",
  "Asthma",
  "Taylor Lee",
  "taylor@example.com",
  "555-010-1000",
  "Chris Lee",
  "555-010-1001",
  "Aunt",
  "chris@example.com",
];

type ImportRosterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportRosterDialog({
  open,
  onOpenChange,
}: ImportRosterDialogProps) {
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

    const response = await fetch("/api/students/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setIsLoading(false);
    setResult(data);

    if (data.imported > 0 || data.updated > 0) {
      const parts = [];
      if (data.imported > 0) parts.push(`${data.imported} imported`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
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
          <DialogTitle>Import roster CSV</DialogTitle>
          <DialogDescription>
            Upload a UTF-8 CSV with a header row. Team and mentor_group names
            must match existing values in the active session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CsvFormatHelper
            columns={ROSTER_CSV_COLUMNS}
            exampleRow={ROSTER_EXAMPLE_ROW}
            filename="roster-import-template.csv"
            aiPrompt={ROSTER_CSV_AI_PROMPT}
            notes={
              <p className="text-sm text-muted-foreground">
                Required: <code>first_name</code>, <code>last_name</code>. Other
                columns are optional. Phones need 10–15 digits.
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
                  {result.imported} imported
                </span>
                {result.updated > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {result.updated} updated
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
