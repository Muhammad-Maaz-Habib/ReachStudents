"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CsvFormatHelperProps = {
  title?: string;
  columns: readonly string[];
  exampleRow: string[];
  filename: string;
  notes?: React.ReactNode;
  /** Ready-to-paste AI reformatting prompt (optional guidance only). */
  aiPrompt?: string;
};

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function CsvFormatHelper({
  title = "How to format your import",
  columns,
  exampleRow,
  filename,
  notes,
  aiPrompt,
}: CsvFormatHelperProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  async function copyPrompt() {
    if (!aiPrompt) return;
    const promptText = aiPrompt;

    async function writeViaClipboard() {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }
      await navigator.clipboard.writeText(promptText);
    }

    function writeViaExecCommand() {
      const textarea = document.getElementById(
        `${filename}-ai-prompt`,
      ) as HTMLTextAreaElement | null;
      if (!textarea) throw new Error("missing textarea");
      const previous = textarea.value;
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand("copy");
      textarea.setSelectionRange(0, 0);
      if (!ok) {
        // Restore selection state if copy failed
        textarea.value = previous;
        throw new Error("execCommand failed");
      }
    }

    try {
      try {
        await writeViaClipboard();
      } catch {
        writeViaExecCommand();
      }
      setCopied(true);
      toast.success(
        "Prompt copied — paste it into Claude or ChatGPT with your spreadsheet",
      );
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the text manually");
    }
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
      <div
        className={cn(
          "max-h-[min(60vh,28rem)] space-y-4 overflow-y-auto border-t px-4 py-3",
          !open && "hidden",
        )}
      >
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

        {aiPrompt && (
          <div className="space-y-2 rounded-xl border border-dashed bg-background/80 p-3">
            <p className="text-sm font-medium">Optional: reformat with AI</p>
            <p className="text-sm text-muted-foreground">
              If you don&apos;t want to clean the spreadsheet by hand, paste the
              prompt below into an AI assistant (Claude, ChatGPT, etc.) along with
              your raw file. Waypoint itself does no AI processing — this is
              optional guidance only. You can also format the CSV manually using
              the column reference above.
            </p>
            <div className="space-y-2">
              <label htmlFor={`${filename}-ai-prompt`} className="sr-only">
                AI reformatting prompt
              </label>
              <textarea
                id={`${filename}-ai-prompt`}
                readOnly
                value={aiPrompt}
                rows={10}
                className="w-full resize-y rounded-xl border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-10"
                onClick={() => void copyPrompt()}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden />
                    Copy prompt
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
