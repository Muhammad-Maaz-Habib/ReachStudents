"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DestructiveConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmValue: string;
  confirmInputLabel: string;
  actionLabel: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmValue,
  confirmInputLabel,
  actionLabel,
  isLoading = false,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const matches =
    typed.trim().toLowerCase() === confirmValue.trim().toLowerCase();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
          <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="destructive-confirm">
            {confirmInputLabel}{" "}
            <span className="font-semibold text-foreground">{confirmLabel}</span>
          </Label>
          <Input
            id="destructive-confirm"
            className="min-h-11"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            disabled={isLoading}
          />
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!matches || isLoading}
            onClick={() => void onConfirm()}
          >
            {isLoading ? "Working..." : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
