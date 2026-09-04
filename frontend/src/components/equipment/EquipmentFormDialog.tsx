import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { HardDrive, Loader2 } from "lucide-react";
import { EquipmentQrPanel } from "@/components/shared/EquipmentQrPanel";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type BackendEquipment, type CreateEquipmentInput } from "@/lib/api";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { generateEquipmentAssetTag } from "@/lib/equipmentQr";
import { toast } from "@/lib/toast";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { userCanAccessModule } from "@/lib/userRoles";
import { activeTerms } from "@/lib/taxonomy";
import { navItems } from "@/config/nav";

const NONE = "__none__";

type FormState = {
  assetTag: string;
  name: string;
  model: string;
  manufacturer: string;
  category: string;
  serialNumber: string;
  customerId: string;
  location: string;
  installDate: string;
  warrantyEnd: string;
  condition: string;
  lastServiceDate: string;
};

const equipmentSchema = z.object({
  assetTag: fieldRules.requiredString("Asset tag"),
  name: fieldRules.requiredString("Equipment name"),
  model: fieldRules.optionalString(),
  manufacturer: fieldRules.optionalString(),
  category: fieldRules.optionalString(),
  serialNumber: fieldRules.requiredString("Serial number"),
  customerId: fieldRules.optionalString(),
  location: fieldRules.optionalString(),
  installDate: fieldRules.optionalString(),
  warrantyEnd: fieldRules.optionalString(),
  condition: fieldRules.optionalString(),
  lastServiceDate: fieldRules.optionalString(),
});

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

const emptyForm = (): FormState => ({
  assetTag: "",
  name: "",
  model: "",
  manufacturer: "",
  category: "",
  serialNumber: "",
  customerId: "",
  location: "",
  installDate: "",
  warrantyEnd: "",
  condition: "",
  lastServiceDate: "",
});

function fromEquipment(item: BackendEquipment): FormState {
  return {
    assetTag: item.assetTag,
    name: item.name,
    model: item.model ?? "",
    manufacturer: item.manufacturer ?? "",
    category: item.category ?? "",
    serialNumber: item.serialNumber,
    customerId: item.customerId ?? "",
    location: item.location ?? "",
    installDate: toDateInput(item.installDate),
    warrantyEnd: toDateInput(item.warrantyEnd),
    condition: item.condition ?? "",
    lastServiceDate: toDateInput(item.lastServiceDate),
  };
}

function toPayload(form: FormState): CreateEquipmentInput {
  return {
    assetTag: form.assetTag.trim(),
    name: form.name.trim(),
    model: form.model.trim(),
    manufacturer: form.manufacturer.trim(),
    category: form.category,
    serialNumber: form.serialNumber.trim(),
    customerId: form.customerId || null,
    location: form.location.trim(),
    installDate: form.installDate || null,
    warrantyEnd: form.warrantyEnd || null,
    condition: form.condition || undefined,
    lastServiceDate: form.lastServiceDate || undefined,
  };
}

type EquipmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: BackendEquipment | null;
  existingAssetTags?: string[];
  onSaved?: (record: BackendEquipment) => void;
};

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment = null,
  existingAssetTags = [],
  onSaved,
}: EquipmentFormDialogProps) {
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const canManageMasterData = Boolean(
    user && userCanAccessModule(
      user,
      "Master Data",
      rbacMatrix,
      navItems.find((item) => item.label === "Master Data")?.roles,
    ),
  );
  const editing = Boolean(equipment);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    reset: resetValidation,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    clearError,
  } = useFormValidation({
    fieldOrder: [
      "assetTag",
      "serialNumber",
      "name",
      "manufacturer",
      "model",
      "category",
      "customerId",
      "location",
      "installDate",
      "warrantyEnd",
      "condition",
    ],
    schema: equipmentSchema,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: () => api.listCustomersOptions(),
    staleTime: 60_000,
    enabled: open,
  });
  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "equipment_category"],
    queryFn: () => api.listTaxonomy({ type: "equipment_category" }),
    staleTime: 30_000,
    enabled: open,
  });
  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 30_000,
    enabled: open,
  });

  const customers = (customersQuery.data ?? []).filter((c) => c.status === "active");
  const activeCategories = activeTerms(categoriesQuery.data ?? []);
  const activeConditions = activeTerms(conditionsQuery.data ?? []);

  useEffect(() => {
    if (!open) return;
    if (equipment) {
      setForm(fromEquipment(equipment));
    } else {
      setForm({
        ...emptyForm(),
        assetTag: generateEquipmentAssetTag(existingAssetTags),
      });
    }
    resetValidation();
    // Reset only when the dialog opens or the edited record changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, equipment?.id]);

  const saveEquipment = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = equipment
        ? await api.updateEquipment(equipment.id, {
            ...payload,
            lastServiceDate: form.lastServiceDate || null,
          })
        : await api.createEquipment(payload);
      toast({
        title: equipment ? "Equipment updated" : "Equipment registered",
        description: equipment
          ? `${saved.name} (${saved.assetTag}) was saved.`
          : `${saved.name} (${saved.assetTag}) was added successfully.`,
      });
      onOpenChange(false);
      resetValidation();
      onSaved?.(saved);
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: equipment ? "Unable to update equipment" : "Unable to register equipment" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetValidation();
        onOpenChange(next);
      }}
    >
      <DialogContent ref={dialogRef} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> {editing ? "Edit Equipment" : "Register Equipment"}
          </DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void saveEquipment();
          }}
          className="grid gap-4 py-2"
        >
          <EquipmentQrPanel
            assetTag={form.assetTag}
            required
            error={shouldShow("assetTag") ? errors.assetTag : null}
            onAssetTagChange={(assetTag) => {
              const next = { ...form, assetTag };
              setForm(next);
              handleChange("assetTag", next);
            }}
            onBlur={() => handleBlur("assetTag", form)}
          />
          <div className="grid gap-2" data-field="serialNumber">
            <Label htmlFor="serial-number" className={shouldShow("serialNumber") ? "text-destructive" : undefined}>
              Serial number
              <RequiredMark />
            </Label>
            <Input
              id="serial-number"
              value={form.serialNumber}
              onChange={(e) => {
                const next = { ...form, serialNumber: e.target.value };
                setForm(next);
                handleChange("serialNumber", next);
              }}
              onBlur={() => handleBlur("serialNumber", form)}
              placeholder="SN-MRI-99201"
              className={fieldErrorClass(shouldShow("serialNumber"), "font-mono")}
              {...fieldAria("serialNumber", shouldShow("serialNumber") ? errors.serialNumber : null)}
            />
            {shouldShow("serialNumber") && <FormFieldError field="serialNumber" message={errors.serialNumber} />}
          </div>
          <div className="grid gap-2" data-field="name">
            <Label htmlFor="equipment-name" className={shouldShow("name") ? "text-destructive" : undefined}>
              Equipment name
              <RequiredMark />
            </Label>
            <Input
              id="equipment-name"
              value={form.name}
              onChange={(e) => {
                const next = { ...form, name: e.target.value };
                setForm(next);
                handleChange("name", next);
              }}
              onBlur={() => handleBlur("name", form)}
              placeholder="MRI Scanner"
              className={fieldErrorClass(shouldShow("name"))}
              {...fieldAria("name", shouldShow("name") ? errors.name : null)}
            />
            {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="manufacturer">
              <Label htmlFor="manufacturer">Manufacturer (optional)</Label>
              <Input
                id="manufacturer"
                value={form.manufacturer}
                onChange={(e) => {
                  const next = { ...form, manufacturer: e.target.value };
                  setForm(next);
                  handleChange("manufacturer", next);
                }}
                onBlur={() => handleBlur("manufacturer", form)}
                placeholder="Siemens"
              />
            </div>
            <div className="grid gap-2" data-field="model">
              <Label htmlFor="model">Model (optional)</Label>
              <Input
                id="model"
                value={form.model}
                onChange={(e) => {
                  const next = { ...form, model: e.target.value };
                  setForm(next);
                  handleChange("model", next);
                }}
                onBlur={() => handleBlur("model", form)}
                placeholder="Magnetom Vida"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="category">
              <div className="flex items-center justify-between gap-2">
                <Label>Category (optional)</Label>
                {canManageMasterData ? (
                  <Link to="/app/master-data?type=equipment_category" className="text-xs text-primary hover:underline">
                    Manage
                  </Link>
                ) : null}
              </div>
              <Select
                value={form.category || NONE}
                onValueChange={(value) => {
                  const next = { ...form, category: value === NONE ? "" : value };
                  setForm(next);
                  clearError("category");
                  handleChange("category", next);
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2" data-field="customerId">
              <Label>Customer (optional)</Label>
              <Select
                value={form.customerId || NONE}
                onValueChange={(value) => {
                  const next = { ...form, customerId: value === NONE ? "" : value };
                  setForm(next);
                  clearError("customerId");
                  handleChange("customerId", next);
                }}
              >
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2" data-field="location">
            <Label htmlFor="location">Location at site (optional)</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => {
                const next = { ...form, location: e.target.value };
                setForm(next);
                handleChange("location", next);
              }}
              onBlur={() => handleBlur("location", form)}
              placeholder="Radiology Wing 2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="installDate">
              <Label htmlFor="install-date">Install date (optional)</Label>
              <Input
                id="install-date"
                type="date"
                value={form.installDate}
                onChange={(e) => {
                  const next = { ...form, installDate: e.target.value };
                  setForm(next);
                  handleChange("installDate", next);
                }}
                onBlur={() => handleBlur("installDate", form)}
              />
            </div>
            <div className="grid gap-2" data-field="warrantyEnd">
              <Label htmlFor="warranty-end">Warranty end (optional)</Label>
              <Input
                id="warranty-end"
                type="date"
                value={form.warrantyEnd}
                onChange={(e) => {
                  const next = { ...form, warrantyEnd: e.target.value };
                  setForm(next);
                  handleChange("warrantyEnd", next);
                }}
                onBlur={() => handleBlur("warrantyEnd", form)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="condition">
              <div className="flex items-center justify-between gap-2">
                <Label>Condition (optional)</Label>
                {canManageMasterData ? (
                  <Link to="/app/master-data?type=equipment_condition" className="text-xs text-primary hover:underline">
                    Manage
                  </Link>
                ) : null}
              </div>
              <Select
                value={form.condition || NONE}
                onValueChange={(value) => {
                  const next = { ...form, condition: value === NONE ? "" : value };
                  setForm(next);
                  clearError("condition");
                  handleChange("condition", next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  {activeConditions.map((o) => (
                    <SelectItem key={o.id} value={o.slug}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last-service">Last service (optional)</Label>
              <Input
                id="last-service"
                type="date"
                value={form.lastServiceDate}
                onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Register equipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
