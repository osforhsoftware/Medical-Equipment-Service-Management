import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { HardDrive, Loader2 } from "lucide-react";
import { EquipmentQrPanel } from "@/components/shared/EquipmentQrPanel";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  fieldAria,
  fieldErrorClass,
  fieldRules,
  parseApiFieldErrors,
  type FieldErrors,
} from "@/lib/formValidation";

const SERIAL_NUMBER_TAKEN_MESSAGE = "Serial number already taken. Please check.";
import { EQUIPMENT_CURRENT_STATUS_OPTIONS } from "@/lib/equipmentWarranty";
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
  partDescription: string;
  additionalNote: string;
  customerId: string;
  location: string;
  installDate: string;
  warrantyStart: string;
  warrantyEnd: string;
  noMachineWarranty: boolean;
  serviceWarrantyStart: string;
  serviceWarrantyEnd: string;
  noServiceWarranty: boolean;
  condition: string;
  currentStatus: string;
  purchaseSaleHistory: string;
  lastServiceDate: string;
};

type UnitEntry = {
  key: string;
  serialNumber: string;
};

const equipmentSchema = z.object({
  name: fieldRules.requiredString("Equipment name"),
  model: fieldRules.optionalString(),
  manufacturer: fieldRules.optionalString(),
  category: fieldRules.optionalString(),
  serialNumber: fieldRules.requiredString("Serial number"),
  partDescription: fieldRules.optionalString(),
  additionalNote: fieldRules.optionalString(),
  customerId: fieldRules.optionalString(),
  location: fieldRules.optionalString(),
  installDate: fieldRules.optionalString(),
  warrantyStart: fieldRules.optionalString(),
  warrantyEnd: fieldRules.optionalString(),
  serviceWarrantyStart: fieldRules.optionalString(),
  serviceWarrantyEnd: fieldRules.optionalString(),
  condition: fieldRules.optionalString(),
  currentStatus: fieldRules.optionalString(),
  purchaseSaleHistory: fieldRules.optionalString(),
  lastServiceDate: fieldRules.optionalString(),
});

/** Shared product fields when registering equipment (serial numbers are collected separately). */
const sharedProductSchema = equipmentSchema.omit({ serialNumber: true });

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
  partDescription: "",
  additionalNote: "",
  customerId: "",
  location: "",
  installDate: "",
  warrantyStart: "",
  warrantyEnd: "",
  noMachineWarranty: false,
  serviceWarrantyStart: "",
  serviceWarrantyEnd: "",
  noServiceWarranty: false,
  condition: "",
  currentStatus: "in_service",
  purchaseSaleHistory: "",
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
    partDescription: item.partDescription ?? "",
    additionalNote: item.additionalNote ?? "",
    customerId: item.customerId ?? "",
    location: item.location ?? "",
    installDate: toDateInput(item.installDate),
    warrantyStart: toDateInput(item.warrantyStart),
    warrantyEnd: toDateInput(item.warrantyEnd),
    noMachineWarranty: Boolean(item.noMachineWarranty),
    serviceWarrantyStart: toDateInput(item.serviceWarrantyStart),
    serviceWarrantyEnd: toDateInput(item.serviceWarrantyEnd),
    noServiceWarranty: Boolean(item.noServiceWarranty),
    condition: item.condition ?? "",
    currentStatus: item.currentStatus ?? "in_service",
    purchaseSaleHistory: item.purchaseSaleHistory ?? "",
    lastServiceDate: toDateInput(item.lastServiceDate),
  };
}

function toPayload(form: FormState, unit?: Pick<UnitEntry, "serialNumber">): CreateEquipmentInput {
  return {
    name: form.name.trim(),
    model: form.model.trim(),
    manufacturer: form.manufacturer.trim(),
    category: form.category,
    serialNumber: (unit?.serialNumber ?? form.serialNumber).trim(),
    partDescription: form.partDescription.trim() || null,
    additionalNote: form.additionalNote.trim() || null,
    customerId: form.customerId || null,
    location: form.location.trim(),
    installDate: form.installDate || null,
    warrantyStart: form.noMachineWarranty ? null : form.warrantyStart || null,
    warrantyEnd: form.noMachineWarranty ? null : form.warrantyEnd || null,
    noMachineWarranty: form.noMachineWarranty,
    serviceWarrantyStart: form.noServiceWarranty ? null : form.serviceWarrantyStart || null,
    serviceWarrantyEnd: form.noServiceWarranty ? null : form.serviceWarrantyEnd || null,
    noServiceWarranty: form.noServiceWarranty,
    condition: form.condition || undefined,
    currentStatus: form.currentStatus || "in_service",
    purchaseSaleHistory: form.purchaseSaleHistory.trim() || null,
    lastServiceDate: form.lastServiceDate || undefined,
  };
}

function newUnitKey() {
  return `unit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createUnit(): UnitEntry {
  return {
    key: newUnitKey(),
    serialNumber: "",
  };
}

function validateUnits(units: UnitEntry[]): FieldErrors {
  const errors: FieldErrors = {};
  const serialSeen = new Map<string, number>();

  units.forEach((unit, index) => {
    const serial = unit.serialNumber.trim();
    const serialField = `unit_${index}_serialNumber`;

    if (!serial) {
      errors[serialField] = "Serial number is required";
    } else {
      const normalized = serial.toUpperCase();
      const first = serialSeen.get(normalized);
      if (first !== undefined) {
        errors[serialField] = "Duplicate serial number in this batch";
        errors[`unit_${first}_serialNumber`] = "Duplicate serial number in this batch";
      } else {
        serialSeen.set(normalized, index);
      }
    }
  });

  return errors;
}

type EquipmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: BackendEquipment | null;
  defaultCustomerId?: string;
  defaultCustomerName?: string;
  defaultLocation?: string;
  onSaved?: (record: BackendEquipment) => void;
};

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment = null,
  defaultCustomerId = "",
  defaultCustomerName = "",
  defaultLocation = "",
  onSaved,
}: EquipmentFormDialogProps) {
  const { user } = useAuth();
  const { settings, rbacMatrix, refresh: refreshSettings } = useSettings();
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
  const [units, setUnits] = useState<UnitEntry[]>(() => [createUnit()]);
  const [unitErrors, setUnitErrors] = useState<FieldErrors>({});
  const [unitsTouched, setUnitsTouched] = useState(false);
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
    fieldOrder: editing
      ? [
          "serialNumber",
          "partDescription",
          "name",
          "manufacturer",
          "model",
          "category",
          "customerId",
          "location",
          "installDate",
          "warrantyStart",
          "warrantyEnd",
          "serviceWarrantyStart",
          "serviceWarrantyEnd",
          "condition",
          "currentStatus",
          "purchaseSaleHistory",
          "additionalNote",
        ]
      : [
          "name",
          "manufacturer",
          "model",
          "partDescription",
          "category",
          "customerId",
          "location",
          "installDate",
          "warrantyStart",
          "warrantyEnd",
          "serviceWarrantyStart",
          "serviceWarrantyEnd",
          "condition",
          "currentStatus",
          "purchaseSaleHistory",
          "additionalNote",
          ...Array.from({ length: 40 }, (_, index) => `unit_${index}_serialNumber`),
        ],
    schema: editing ? equipmentSchema : sharedProductSchema,
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
      setUnits([]);
    } else {
      setForm({
        ...emptyForm(),
        customerId: defaultCustomerId,
        location: defaultLocation,
      });
      setUnits([createUnit()]);
    }
    setUnitErrors({});
    setUnitsTouched(false);
    resetValidation();
    // Reset only when the dialog opens, the edited record changes, or guided defaults change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, equipment?.id, defaultCustomerId, defaultLocation]);

  const showUnitError = (field: string) => Boolean(unitErrors[field] && unitsTouched);

  const updateUnit = (key: string, patch: Partial<Pick<UnitEntry, "serialNumber">>) => {
    setUnits((current) => current.map((unit) => (unit.key === key ? { ...unit, ...patch } : unit)));
  };

  const saveEquipment = async () => {
    if (editing) {
      if (!validateAll(form, undefined, dialogRef.current)) return;

      setSaving(true);
      try {
        const payload = toPayload(form);
        const saved = await api.updateEquipment(equipment!.id, {
          ...payload,
          lastServiceDate: form.lastServiceDate || null,
        });
        toast({
          title: "Equipment updated",
          description: `${saved.name} (${saved.assetTag}) was saved.`,
        });
        onOpenChange(false);
        resetValidation();
        onSaved?.(saved);
      } catch (err) {
        if (!applyApiErrors(err, dialogRef.current)) {
          toast.apiError(err, { fallback: "Unable to update equipment" });
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    const nextUnitErrors = validateUnits(units);
    const sharedOk = validateAll(form, nextUnitErrors, dialogRef.current);
    setUnitErrors(nextUnitErrors);
    setUnitsTouched(true);
    if (!sharedOk || Object.keys(nextUnitErrors).length > 0) return;

    setSaving(true);
    const created: BackendEquipment[] = [];
    let remaining = [...units];
    const totalRequested = units.length;

    try {
      for (let index = 0; index < totalRequested; index += 1) {
        const unit = remaining[0];
        if (!unit) break;
        try {
          const saved = await api.createEquipment(toPayload(form, unit));
          created.push(saved);
          remaining = remaining.slice(1);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unable to register this unit";
          const { fieldErrors } = parseApiFieldErrors(err);
          const serialMessage =
            fieldErrors.serialNumber ||
            (message === SERIAL_NUMBER_TAKEN_MESSAGE ? message : undefined);

          setUnits(remaining);
          setUnitsTouched(true);
          setUnitErrors(
            serialMessage ? { unit_0_serialNumber: serialMessage } : {},
          );

          if (created.length > 0) {
            void refreshSettings();
            toast({
              title: `Registered ${created.length} of ${totalRequested}`,
              description: `Stopped at unit ${index + 1}: ${message}. Fix the remaining rows and try again.`,
              variant: "destructive",
            });
            onSaved?.(created[created.length - 1]);
          } else if (serialMessage) {
            // Serial uniqueness is shown on the serial field; do not save or toast.
          } else if (!applyApiErrors(err, dialogRef.current)) {
            toast.apiError(err, { fallback: "Unable to register equipment" });
          }
          return;
        }
      }

      const count = created.length;
      toast({
        title: count === 1 ? "Equipment registered" : `${count} units registered`,
        description:
          count === 1
            ? `${created[0].name} (${created[0].assetTag}) was added successfully.`
            : `${created[0].name} — ${count} units with unique asset tags and serials were added.`,
      });
      void refreshSettings();
      onOpenChange(false);
      resetValidation();
      onSaved?.(created[created.length - 1]);
    } finally {
      setSaving(false);
    }
  };

  const submitLabel = editing ? "Save changes" : "Register equipment";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetValidation();
          setUnitErrors({});
          setUnitsTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        ref={dialogRef}
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> {editing ? "Edit Equipment" : "Register Equipment"}
          </DialogTitle>
          {!editing ? (
            <p className="text-sm text-muted-foreground">
              {defaultCustomerId
                ? `${defaultCustomerName || "This customer"} is already selected. Add the machine details, or change the customer if needed.`
                : "Enter the serial number and product details. The asset tag and QR code are assigned when you register."}
            </p>
          ) : null}
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void saveEquipment();
          }}
          className="grid gap-4 py-2"
        >
          {editing ? (
            <>
              <EquipmentQrPanel assetTag={form.assetTag} showInput={false} />
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
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Asset tag</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assigned automatically from company settings when this equipment is saved. The same number is stored on the asset, its QR code, and related service records.
                </p>
                {settings?.assetTagPreview ? (
                  <p className="mt-2 font-mono text-sm font-semibold">{settings.assetTagPreview}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {settings?.assetTagPreview
                    ? "Expected next tag. The saved tag is the one returned by the server."
                    : "The saved tag is confirmed after registration."}
                </p>
              </div>
              <div className="grid gap-2" data-field="unit_0_serialNumber">
                <Label
                  htmlFor="unit-0-serial"
                  className={showUnitError("unit_0_serialNumber") ? "text-destructive" : undefined}
                >
                  Serial number
                  <RequiredMark />
                </Label>
                <Input
                  id="unit-0-serial"
                  value={units[0]?.serialNumber ?? ""}
                  onChange={(e) => {
                    if (!units[0]) return;
                    updateUnit(units[0].key, { serialNumber: e.target.value });
                    setUnitErrors((prev) => {
                      const next = { ...prev };
                      delete next.unit_0_serialNumber;
                      return next;
                    });
                  }}
                  placeholder="SN-MRI-99201"
                  className={fieldErrorClass(showUnitError("unit_0_serialNumber"), "font-mono")}
                  {...fieldAria(
                    "unit_0_serialNumber",
                    showUnitError("unit_0_serialNumber") ? unitErrors.unit_0_serialNumber : null,
                  )}
                />
                {showUnitError("unit_0_serialNumber") && (
                  <FormFieldError field="unit_0_serialNumber" message={unitErrors.unit_0_serialNumber} />
                )}
              </div>
            </>
          )}

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
          <div className="grid gap-2" data-field="partDescription">
            <Label htmlFor="part-description">Part description (optional)</Label>
            <Textarea
              id="part-description"
              value={form.partDescription}
              onChange={(e) => {
                const next = { ...form, partDescription: e.target.value };
                setForm(next);
                handleChange("partDescription", next);
              }}
              onBlur={() => handleBlur("partDescription", form)}
              rows={3}
              placeholder="Describe the part, component, or configuration"
            />
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
                  {defaultCustomerId && !customers.some((c) => c.id === defaultCustomerId) ? (
                    <SelectItem value={defaultCustomerId}>
                      {defaultCustomerName || "New customer"}
                    </SelectItem>
                  ) : null}
                  {form.customerId
                    && form.customerId !== defaultCustomerId
                    && !customers.some((c) => c.id === form.customerId) ? (
                    <SelectItem value={form.customerId}>
                      {equipment?.customerName || "Current customer"} (inactive)
                    </SelectItem>
                  ) : null}
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
            <Label htmlFor="location">Location (optional)</Label>
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
              <Label htmlFor="install-date">Install Date / Received Date</Label>
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
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.noMachineWarranty}
                onCheckedChange={(checked) => {
                  const noMachineWarranty = checked === true;
                  const next = {
                    ...form,
                    noMachineWarranty,
                    warrantyStart: noMachineWarranty ? "" : form.warrantyStart,
                    warrantyEnd: noMachineWarranty ? "" : form.warrantyEnd,
                  };
                  setForm(next);
                  handleChange("warrantyStart", next);
                }}
              />
              <span>No machine warranty</span>
            </label>
            {!form.noMachineWarranty ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="warrantyStart">
                  <Label htmlFor="warranty-start">Machine warranty start (optional)</Label>
                  <Input
                    id="warranty-start"
                    type="date"
                    value={form.warrantyStart}
                    onChange={(e) => {
                      const next = { ...form, warrantyStart: e.target.value };
                      setForm(next);
                      handleChange("warrantyStart", next);
                    }}
                    onBlur={() => handleBlur("warrantyStart", form)}
                  />
                </div>
                <div className="grid gap-2" data-field="warrantyEnd">
                  <Label htmlFor="warranty-end">Machine warranty end (optional)</Label>
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
            ) : null}
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.noServiceWarranty}
                onCheckedChange={(checked) => {
                  const noServiceWarranty = checked === true;
                  const next = {
                    ...form,
                    noServiceWarranty,
                    serviceWarrantyStart: noServiceWarranty ? "" : form.serviceWarrantyStart,
                    serviceWarrantyEnd: noServiceWarranty ? "" : form.serviceWarrantyEnd,
                  };
                  setForm(next);
                  handleChange("serviceWarrantyStart", next);
                }}
              />
              <span>No service warranty</span>
            </label>
            {!form.noServiceWarranty ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2" data-field="serviceWarrantyStart">
                  <Label htmlFor="service-warranty-start">Service warranty start (optional)</Label>
                  <Input
                    id="service-warranty-start"
                    type="date"
                    value={form.serviceWarrantyStart}
                    onChange={(e) => {
                      const next = { ...form, serviceWarrantyStart: e.target.value };
                      setForm(next);
                      handleChange("serviceWarrantyStart", next);
                    }}
                    onBlur={() => handleBlur("serviceWarrantyStart", form)}
                  />
                </div>
                <div className="grid gap-2" data-field="serviceWarrantyEnd">
                  <Label htmlFor="service-warranty-end">Service warranty end (optional)</Label>
                  <Input
                    id="service-warranty-end"
                    type="date"
                    value={form.serviceWarrantyEnd}
                    onChange={(e) => {
                      const next = { ...form, serviceWarrantyEnd: e.target.value };
                      setForm(next);
                      handleChange("serviceWarrantyEnd", next);
                    }}
                    onBlur={() => handleBlur("serviceWarrantyEnd", form)}
                  />
                </div>
              </div>
            ) : null}
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
            <div className="grid gap-2" data-field="currentStatus">
              <Label>Current status</Label>
              <Select
                value={form.currentStatus || "in_service"}
                onValueChange={(value) => {
                  const next = { ...form, currentStatus: value };
                  setForm(next);
                  clearError("currentStatus");
                  handleChange("currentStatus", next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select current status" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CURRENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Lifecycle status — separate from condition and machine/service warranty.
              </p>
            </div>
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
          <div className="grid gap-2" data-field="purchaseSaleHistory">
            <Label htmlFor="purchase-sale-history">Purchase / sale history (optional)</Label>
            <Textarea
              id="purchase-sale-history"
              value={form.purchaseSaleHistory}
              onChange={(e) => {
                const next = { ...form, purchaseSaleHistory: e.target.value };
                setForm(next);
                handleChange("purchaseSaleHistory", next);
              }}
              onBlur={() => handleBlur("purchaseSaleHistory", form)}
              rows={3}
              placeholder="e.g. Purchased 2022-03-15 from Siemens · Sold/transferred notes…"
            />
          </div>
          <div className="grid gap-2" data-field="additionalNote">
            <Label htmlFor="additional-note">Additional note (optional)</Label>
            <Textarea
              id="additional-note"
              value={form.additionalNote}
              onChange={(e) => {
                const next = { ...form, additionalNote: e.target.value };
                setForm(next);
                handleChange("additionalNote", next);
              }}
              onBlur={() => handleBlur("additionalNote", form)}
              rows={3}
              placeholder="Any extra notes about this equipment"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
