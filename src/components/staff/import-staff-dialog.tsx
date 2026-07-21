"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { CsvFormatHelper } from "@/components/design-system/csv-format-helper";
import { STAFF_CSV_COLUMNS } from "@/lib/csv/staff-import";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STAFF_EXAMPLE_ROW = [
  "Ava",
  "Nguyen",
  "STAFF",
  "ava.nguyen@demo.camp",
  "555-020-0001",
  "Pre-Med",
  "Sam Nguyen",
  "555-020-0002",
  "Jordan Lee",
  "555-020-0003",
  "Shellfish",
  "Vegetarian",
  "",
];

type ImportStaffDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

export function ImportStaffDialog({
  open,
  onOpenChange,
  onImported,
}: ImportStaffDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
    warnings: string[];
    temporaryCredentials: {
      email: string;
      name: string;
      temporaryPassword: string;
    }[];
  } | null>(null);

  async function handleImport(file: File) {
    setIsLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/staff/import", {
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
      temporaryCredentials: data.temporaryCredentials ?? [],
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import staff CSV</DialogTitle>
          <DialogDescription>
            Upload a UTF-8 CSV. New accounts get a temporary password and must
            change it on first login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CsvFormatHelper
            columns={STAFF_CSV_COLUMNS}
            exampleRow={STAFF_EXAMPLE_ROW}
            filename="staff-import-template.csv"
            notes={
              <p className="text-sm text-muted-foreground">
                Required: <code>first_name</code>, <code>last_name</code>,{" "}
                <code>role</code> (<code>STAFF</code>, <code>NURSE</code>, or{" "}
                <code>SESSION_ADMIN</code>), and <code>email</code>. Team names
                must match the active session.
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
              {result.temporaryCredentials.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="font-medium text-foreground">
                    Temporary passwords (share securely)
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs">
                    {result.temporaryCredentials.map((credential) => (
                      <li key={credential.email}>
                        {credential.email}: {credential.temporaryPassword}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
