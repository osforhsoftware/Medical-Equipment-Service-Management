import { AlertTriangle, CheckCircle2, PackageX, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ReturnWithoutRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string;
  equipmentName: string;
  onConfirm: (data: ReturnWithoutRepairData) => Promise<void>;
  saving?: boolean;
}

export interface ReturnWithoutRepairData {
  returnReason: string;
  handedBy: string;
  returnDate: string;
  customerAcknowledged: boolean;
}

export function ReturnWithoutRepairDialog({
  open,
  onOpenChange,
  customerName,
  equipmentName,
  onConfirm,
  saving = false,
}: ReturnWithoutRepairDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [returnReason, setReturnReason] = useState("");
  const [handedBy, setHandedBy] = useState("");
  const [returnDate, setReturnDate] = useState(today);
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!returnReason.trim()) errs.returnReason = "Return reason is required";
    if (!handedBy.trim()) errs.handedBy = "Technician name is required";
    if (!returnDate) errs.returnDate = "Return date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;
    await onConfirm({
      returnReason: returnReason.trim(),
      handedBy: handedBy.trim(),
      returnDate,
      customerAcknowledged: acknowledged,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <PackageX className="h-5 w-5" />
            Return Without Repair
          </DialogTitle>
          <DialogDescription>
            The estimate for <strong>{equipmentName}</strong> was rejected by{" "}
            <strong>{customerName}</strong>. Record the return handover details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This action will close the service request and mark the equipment as returned to the
                customer without repair. Ensure the customer has acknowledged receipt.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="return-reason" className={errors.returnReason ? "text-destructive" : ""}>
              Return reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="return-reason"
              placeholder="e.g. Customer declined repair cost, requested equipment back..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              className={errors.returnReason ? "border-destructive" : ""}
            />
            {errors.returnReason && (
              <p className="text-xs text-destructive">{errors.returnReason}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="handed-by" className={errors.handedBy ? "text-destructive" : ""}>
                Handed over by <span className="text-destructive">*</span>
              </Label>
              <Input
                id="handed-by"
                placeholder="Technician name"
                value={handedBy}
                onChange={(e) => setHandedBy(e.target.value)}
                className={errors.handedBy ? "border-destructive" : ""}
              />
              {errors.handedBy && (
                <p className="text-xs text-destructive">{errors.handedBy}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="return-date" className={errors.returnDate ? "text-destructive" : ""}>
                Return date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="return-date"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={errors.returnDate ? "border-destructive" : ""}
              />
              {errors.returnDate && (
                <p className="text-xs text-destructive">{errors.returnDate}</p>
              )}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <div>
              <p className="text-sm font-medium">Customer acknowledged receipt</p>
              <p className="text-xs text-muted-foreground">
                Tick if the customer signed or confirmed receiving the equipment
              </p>
            </div>
            {acknowledged && <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />}
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={saving}
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            {saving ? "Processing…" : "Confirm Return Without Repair"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
