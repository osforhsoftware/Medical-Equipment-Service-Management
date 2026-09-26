import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type BackendEquipment } from "@/lib/api";
import { toast } from "@/lib/toast";

const SERVICE_TYPES = ["Repair", "Maintenance", "Calibration", "Inspection", "Installation", "Other"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: BackendEquipment[];
  defaultEquipmentId?: string;
  onCreated?: () => void;
};

export function PortalRequestDialog({
  open,
  onOpenChange,
  equipment,
  defaultEquipmentId,
  onCreated,
}: Props) {
  const [equipmentId, setEquipmentId] = useState("");
  const [type, setType] = useState<string>("Repair");
  const [typeOther, setTypeOther] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEquipmentId(defaultEquipmentId && equipment.some((item) => item.id === defaultEquipmentId) ? defaultEquipmentId : equipment[0]?.id ?? "");
    setType("Repair");
    setTypeOther("");
    setPriority("medium");
    setDescription("");
  }, [open, defaultEquipmentId, equipment]);

  const submit = async () => {
    if (!equipmentId) {
      toast.error("Select equipment");
      return;
    }
    if (!description.trim()) {
      toast.error("Describe the problem");
      return;
    }
    setSaving(true);
    try {
      await api.createPortalServiceRequest({
        equipmentId,
        type,
        typeOther: type === "Other" ? typeOther.trim() || null : null,
        priority,
        description: description.trim(),
      });
      toast.success("Service request submitted");
      onOpenChange(false);
      onCreated?.();
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to submit request" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New service request</DialogTitle>
          <DialogDescription>Request service for one of your registered devices.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Equipment</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId} disabled={equipment.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={equipment.length ? "Select equipment" : "No equipment on file"} />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.assetTag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {type === "Other" ? (
            <div className="grid gap-2">
              <Label htmlFor="portal-type-other">Specify type</Label>
              <Textarea id="portal-type-other" rows={2} value={typeOther} onChange={(e) => setTypeOther(e.target.value)} />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="portal-request-desc">Problem / request</Label>
            <Textarea
              id="portal-request-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs service?"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving || equipment.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
