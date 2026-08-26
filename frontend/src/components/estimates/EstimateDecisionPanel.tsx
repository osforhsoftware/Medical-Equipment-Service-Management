import { Loader2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BackendUser } from "@/lib/api";
import { estimateStatusLabel } from "@/lib/estimates";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";

interface EstimateDecisionPanelProps {
  status: string;
  canDecide: boolean;
  canApprove: boolean;
  engineers: BackendUser[];
  engineerId: string;
  decisionNote: string;
  saving: boolean;
  errors: Record<string, string>;
  shouldShow: (field: string) => boolean;
  onEngineerChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onNoteBlur: () => void;
  onApprove: () => void;
  onRevision: () => void;
  onReject: () => void;
  requireEngineer?: boolean;
}

export function EstimateDecisionPanel({
  status,
  canDecide,
  canApprove,
  engineers,
  engineerId,
  decisionNote,
  saving,
  errors,
  shouldShow,
  onEngineerChange,
  onNoteChange,
  onNoteBlur,
  onApprove,
  onRevision,
  onReject,
  requireEngineer = true,
}: EstimateDecisionPanelProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="section-title mb-4">Approval</h2>
      <div className="mb-4 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Current status</span>
        <StatusBadge status={status} label={estimateStatusLabel(status)} />
      </div>

      {canDecide && canApprove ? (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onApprove();
          }}
        >
          {requireEngineer ? (
          <div className="grid gap-2" data-field="engineerId">
            <Label className={shouldShow("engineerId") ? "text-destructive" : undefined}>
              Assigned engineer
              <RequiredMark />
            </Label>
            <Select value={engineerId} onValueChange={onEngineerChange}>
              <SelectTrigger
                id="engineerId"
                className={fieldErrorClass(shouldShow("engineerId"))}
                {...fieldAria("engineerId", shouldShow("engineerId") ? errors.engineerId : null)}
              >
                <SelectValue placeholder="Select engineer" />
              </SelectTrigger>
              <SelectContent>
                {engineers.map((eng) => (
                  <SelectItem key={eng.id} value={eng.id}>
                    {eng.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {shouldShow("engineerId") && <FormFieldError field="engineerId" message={errors.engineerId} />}
          </div>
          ) : null}
          <div className="grid gap-2" data-field="decisionNote">
            <Label htmlFor="decision-note">Decision note</Label>
            <Textarea
              id="decision-note"
              name="decisionNote"
              value={decisionNote}
              rows={3}
              onChange={(e) => onNoteChange(e.target.value)}
              onBlur={onNoteBlur}
            />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Approve
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={onRevision}>
              Request Revision
            </Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={onReject}>
              Reject
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canDecide
            ? "Waiting for administrator approval."
            : "No pending decisions for this estimate."}
        </p>
      )}
    </section>
  );
}
