import { useEffect, useId, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
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

/** Word the user must type to enable destructive confirm actions. */
export const DELETE_CONFIRM_WORD = "delete";

type DeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const inputId = useId();
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim() === DELETE_CONFIRM_WORD;

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  const handleConfirm = async () => {
    if (!canConfirm || loading) return;
    await onConfirm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {typeof description === "string" ? <p>{description}</p> : description}
              <p>
                Type{" "}
                <span className="font-mono font-semibold text-foreground">{DELETE_CONFIRM_WORD}</span>{" "}
                to confirm.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-1">
          <Label htmlFor={inputId}>Confirmation</Label>
          <Input
            id={inputId}
            autoComplete="off"
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleConfirm();
              }
            }}
            placeholder={DELETE_CONFIRM_WORD}
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={loading || !canConfirm}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
