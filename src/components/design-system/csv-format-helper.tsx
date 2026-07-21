"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CsvFormatHelperProps = {
  title?: string;
  columns: readonly string[];
  exampleRow: string[];
  filename: string;
  notes?: React.ReactNode;
};

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function CsvFormatHelper({
  title = "CSV format",
  columns,
  exampleRow,
  filename,
  notes,
}: CsvFormatHelperProps) {
  const [open, setOpen] = useState(false);
  const headerLine = columns.join(",");
  const exampleLine = exampleRow.map(escapeCsvCell).join(",");

  function downloadTemplate() {
    const blank = columns.map(() => "").join(",");
    const content = `${headerLine}\n${exampleLine}\n${blank}\n`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border bg-muted/20">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        )}
        {title}
      </button>
      <div className={cn("space-y-3 border-t px-4 py-3", !open && "hidden")}>
        {notes}
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Required headers
          </p>
          <code className="block overflow-x-auto rounded-xl bg-background p-3 text-xs leading-relaxed break-all">
            {headerLine}
          </code>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Example row
          </p>
          <code className="block overflow-x-auto rounded-xl bg-background p-3 text-xs leading-relaxed break-all">
            {exampleLine}
          </code>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10"
          onClick={downloadTemplate}
        >
          <Download className="size-3.5" aria-hidden />
          Download template CSV
        </Button>
      </div>
    </div>
  );
}
