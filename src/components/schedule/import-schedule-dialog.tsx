"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { CsvFormatHelper } from "@/components/design-system/csv-format-helper";
import { SCHEDULE_CSV_COLUMNS } from "@/lib/csv/schedule-import";
import { SCHEDULE_CSV_AI_PROMPT } from "@/lib/csv/import-ai-prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SCHEDULE_EXAMPLE_ROW = [
  "Afternoon Swim",
  "Pine Cabin",
  "2026-06-16",
  "14:00",
  "60",
  "Mon,Wed,Fri",
  "15",
];

type ImportScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportScheduleDialog({
  open,
  onOpenChange,
}: ImportScheduleDialogProps) {
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

    const response = await fetch("/api/activities/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setIsLoading(false);
    setResult(data);

    if (data.imported > 0) {
      toast.success(`${data.imported} activit${data.imported === 1 ? "y" : "ies"} imported`);
      router.refresh();
    } else if (!response.ok) {
      toast.error("Import failed — check the CSV format");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import schedule CSV</DialogTitle>
          <DialogDescription>
            Create one-off activities or recurring series. Team names must match
            an existing team; leave team blank for session-wide activities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CsvFormatHelper
            columns={SCHEDULE_CSV_COLUMNS}
            exampleRow={SCHEDULE_EXAMPLE_ROW}
            filename="schedule-import-template.csv"
            aiPrompt={SCHEDULE_CSV_AI_PROMPT}
            notes={
              <p className="text-sm text-muted-foreground">
                Required: <code>activity_name</code>, <code>start_date</code>{" "}
                (YYYY-MM-DD), <code>start_time</code> (HH:MM),{" "}
                <code>duration_minutes</code> (15–480). Optional{" "}
                <code>recurrence_days</code> (e.g. Mon,Wed,Fri) creates a series
                from start_date through the session end. Blank recurrence creates
                a one-off.
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
