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
  model: fieldRules.requiredString("Model"),
  manufacturer: fieldRules.requiredString("Manufacturer"),
  category: fieldRules.selectRequired("a category"),
  serialNumber: fieldRules.requiredString("Serial number"),
  customerId: fieldRules.selectRequired("a customer"),
  location: fieldRules.requiredString("Location"),
  installDate: fieldRules.requiredString("Install date"),
  warrantyEnd: fieldRules.requiredString("Warranty end date"),
  condition: fieldRules.selectRequired("a condition"),
  lastServiceDate: fieldRules.optionalString(),
});

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultWarrantyEnd() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

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
  installDate: todayInputValue(),
  warrantyEnd: defaultWarrantyEnd(),
  condition: "",
  lastServiceDate: "",
});

function fromEquipment(item: BackendEquipment): FormState {
  return {
    assetTag: item.assetTag,
    name: item.name,
    model: item.model,
    manufacturer: item.manufacturer,
    category: item.category,
    serialNumber: item.serialNumber,
    customerId: item.customerId,
    location: item.location,
    installDate: toDateInput(item.installDate) || todayInputValue(),
    warrantyEnd: toDateInput(item.warrantyEnd) || defaultWarrantyEnd(),
    condition: item.condition,
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
    customerId: form.customerId,
    location: form.location.trim(),
    installDate: form.installDate,
    warrantyEnd: form.warrantyEnd,
    condition: form.condition,
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
  const defaultCategory = activeCategories.find((t) => t.slug === "imaging")?.slug ?? activeCategories[0]?.slug ?? "";
  const defaultCondition = activeConditions.find((t) => t.slug === "operational")?.slug ?? activeConditions[0]?.slug ?? "";

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

  useEffect(() => {
    if (!open || equipment) return;
    setForm((prev) => ({
      ...prev,
      customerId: prev.customerId || customers[0]?.id || "",
      category: prev.category || defaultCategory,
      condition: prev.condition || defaultCondition,
    }));
  }, [open, equipment, customers, defaultCategory, defaultCondition]);

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
              <Label htmlFor="manufacturer" className={shouldShow("manufacturer") ? "text-destructive" : undefined}>
                Manufacturer
                <RequiredMark />
              </Label>
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
                className={fieldErrorClass(shouldShow("manufacturer"))}
                {...fieldAria("manufacturer", shouldShow("manufacturer") ? errors.manufacturer : null)}
              />
              {shouldShow("manufacturer") && <FormFieldError field="manufacturer" message={errors.manufacturer} />}
            </div>
            <div className="grid gap-2" data-field="model">
              <Label htmlFor="model" className={shouldShow("model") ? "text-destructive" : undefined}>
                Model
                <RequiredMark />
              </Label>
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
                className={fieldErrorClass(shouldShow("model"))}
                {...fieldAria("model", shouldShow("model") ? errors.model : null)}
              />
              {shouldShow("model") && <FormFieldError field="model" message={errors.model} />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="category">
              <div className="flex items-center justify-between gap-2">
                <Label className={shouldShow("category") ? "text-destructive" : undefined}>
                  Category
                  <RequiredMark />
                </Label>
                {canManageMasterData ? (
                  <Link to="/app/master-data?type=equipment_category" className="text-xs text-primary hover:underline">
                    Manage
                  </Link>
                ) : null}
              </div>
              <Select
                value={form.category}
                onValueChange={(value) => {
                  const next = { ...form, category: value };
                  setForm(next);
                  clearError("category");
                  handleChange("category", next);
                }}
              >
                <SelectTrigger
                  id="category"
                  className={fieldErrorClass(shouldShow("category"))}
                  {...fieldAria("category", shouldShow("category") ? errors.category : null)}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shouldShow("category") && <FormFieldError field="category" message={errors.category} />}
            </div>
            <div className="grid gap-2" data-field="customerId">
              <Label className={shouldShow("customerId") ? "text-destructive" : undefined}>
                Customer
                <RequiredMark />
              </Label>
              <Select
                value={form.customerId}
                onValueChange={(customerId) => {
                  const next = { ...form, customerId };
                  setForm(next);
                  clearError("customerId");
                  handleChange("customerId", next);
                }}
              >
                <SelectTrigger
                  id="customerId"
                  className={fieldErrorClass(shouldShow("customerId"))}
                  {...fieldAria("customerId", shouldShow("customerId") ? errors.customerId : null)}
                >
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shouldShow("customerId") && <FormFieldError field="customerId" message={errors.customerId} />}
            </div>
          </div>
          <div className="grid gap-2" data-field="location">
            <Label htmlFor="location" className={shouldShow("location") ? "text-destructive" : undefined}>
              Location at site
              <RequiredMark />
            </Label>
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
              className={fieldErrorClass(shouldShow("location"))}
              {...fieldAria("location", shouldShow("location") ? errors.location : null)}
            />
            {shouldShow("location") && <FormFieldError field="location" message={errors.location} />}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="installDate">
              <Label htmlFor="install-date" className={shouldShow("installDate") ? "text-destructive" : undefined}>
                Install date
                <RequiredMark />
              </Label>
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
                className={fieldErrorClass(shouldShow("installDate"))}
                {...fieldAria("installDate", shouldShow("installDate") ? errors.installDate : null)}
              />
              {shouldShow("installDate") && <FormFieldError field="installDate" message={errors.installDate} />}
            </div>
            <div className="grid gap-2" data-field="warrantyEnd">
              <Label htmlFor="warranty-end" className={shouldShow("warrantyEnd") ? "text-destructive" : undefined}>
                Warranty end
                <RequiredMark />
              </Label>
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
                className={fieldErrorClass(shouldShow("warrantyEnd"))}
                {...fieldAria("warrantyEnd", shouldShow("warrantyEnd") ? errors.warrantyEnd : null)}
              />
              {shouldShow("warrantyEnd") && <FormFieldError field="warrantyEnd" message={errors.warrantyEnd} />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2" data-field="condition">
              <div className="flex items-center justify-between gap-2">
                <Label className={shouldShow("condition") ? "text-destructive" : undefined}>
                  Condition
                  <RequiredMark />
                </Label>
                {canManageMasterData ? (
                  <Link to="/app/master-data?type=equipment_condition" className="text-xs text-primary hover:underline">
                    Manage
                  </Link>
                ) : null}
              </div>
              <Select
                value={form.condition}
                onValueChange={(value) => {
                  const next = { ...form, condition: value };
                  setForm(next);
                  clearError("condition");
                  handleChange("condition", next);
                }}
              >
                <SelectTrigger className={fieldErrorClass(shouldShow("condition"))}>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {activeConditions.map((o) => (
                    <SelectItem key={o.id} value={o.slug}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {shouldShow("condition") && <FormFieldError field="condition" message={errors.condition} />}
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
