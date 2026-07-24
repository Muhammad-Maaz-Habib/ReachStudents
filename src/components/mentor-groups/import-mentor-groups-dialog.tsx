"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { CsvFormatHelper } from "@/components/design-system/csv-format-helper";
import { MENTOR_GROUP_CSV_COLUMNS } from "@/lib/csv/mentor-group-import";
import { MENTOR_GROUP_CSV_AI_PROMPT } from "@/lib/csv/import-ai-prompts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MENTOR_GROUP_EXAMPLE_ROW = ["Mentor Group A", "ava.nguyen@demo.camp"];

type ImportMentorGroupsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onImported?: () => void;
};

export function ImportMentorGroupsDialog({
  open,
  onOpenChange,
  sessionId,
  onImported,
}: ImportMentorGroupsDialogProps) {
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
    formData.append("sessionId", sessionId);

    const response = await fetch("/api/mentor-groups/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setIsLoading(false);
    setResult({
      imported: data.imported ?? 0,
      updated: data.updated ?? 0,
      skipped: data.skipped ?? 0,
      errors: data.errors ?? [],
      warnings: data.warnings ?? [],
    });

    if (data.imported > 0 || data.updated > 0) {
      const parts = [];
      if (data.imported > 0) parts.push(`${data.imported} imported`);
      if (data.updated > 0) parts.push(`${data.updated} updated`);
      toast.success(parts.join(", "));
      onImported?.();
      router.refresh();
    } else if (!response.ok) {
      toast.error("Import failed — check the CSV format");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setResult(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import mentor groups CSV</DialogTitle>
          <DialogDescription>
            Creates or updates groups and assigns mentors. Student rosters are
            not changed here — use the roster CSV{" "}
            <code className="text-xs">mentor_group</code> column for that.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CsvFormatHelper
            columns={MENTOR_GROUP_CSV_COLUMNS}
            exampleRow={MENTOR_GROUP_EXAMPLE_ROW}
            filename="mentor-groups-import-template.csv"
            aiPrompt={MENTOR_GROUP_CSV_AI_PROMPT}
            notes={
              <p className="text-sm text-muted-foreground">
                Required: <code>name</code>, <code>mentor_email</code>. Mentor
                email must match an existing active staff account. Matching
                group names in this session update the mentor.
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
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={isLoading || !sessionId}
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
