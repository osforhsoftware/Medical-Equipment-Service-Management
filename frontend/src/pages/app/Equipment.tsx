import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { HardDrive, Loader2, Plus, QrCode } from "lucide-react";
import { EquipmentQrPanel } from "@/components/shared/EquipmentQrPanel";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
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
import {
  api,
  type BackendEquipment,
} from "@/lib/api";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { toast } from "@/lib/toast";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { userCanAccessModule } from "@/lib/userRoles";
import { activeTerms, termLabel } from "@/lib/taxonomy";
import { navItems } from "@/config/nav";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultWarrantyEnd() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

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

export default function EquipmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["condition", "customerId", "category"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const equipmentQuery = usePaginatedQuery({
    queryKey: "equipment",
    params: queryParams,
    queryFn: (params) => api.listEquipment(params),
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: () => api.listCustomersOptions(),
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "equipment_category"],
    queryFn: () => api.listTaxonomy({ type: "equipment_category" }),
    staleTime: 30_000,
  });

  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 30_000,
  });

  const equipment = equipmentQuery.data?.data ?? [];
  const pagination = equipmentQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const customers = (customersQuery.data ?? []).filter((c) => c.status === "active");
  const categories = categoriesQuery.data ?? [];
  const conditions = conditionsQuery.data ?? [];
  const activeCategories = activeTerms(categories);
  const activeConditions = activeTerms(conditions);

  const [dialogOpen, setDialogOpen] = useState(false);
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

  const loadEquipment = () => void queryClient.invalidateQueries({ queryKey: ["equipment"] });

  const defaultCategory = activeCategories.find((t) => t.slug === "imaging")?.slug ?? activeCategories[0]?.slug ?? "";
  const defaultCondition = activeConditions.find((t) => t.slug === "operational")?.slug ?? activeConditions[0]?.slug ?? "";

  const openCreate = () => {
    const firstCustomer = customers[0];
    setForm({
      ...emptyForm(),
      customerId: firstCustomer?.id ?? "",
      category: defaultCategory,
      condition: defaultCondition,
    });
    resetValidation();
    setDialogOpen(true);
  };

  const onCustomerChange = (customerId: string) => {
    const next = { ...form, customerId };
    setForm(next);
    clearError("customerId");
    handleChange("customerId", next);
  };

  const saveEquipment = async () => {
    if (!validateAll(form, undefined, dialogRef.current)) return;

    setSaving(true);
    try {
      await api.createEquipment({
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
        ...(form.lastServiceDate ? { lastServiceDate: form.lastServiceDate } : {}),
      });
      toast({
        title: "Equipment registered",
        description: `${form.name.trim()} (${form.assetTag.trim()}) was added successfully.`,
      });
      setDialogOpen(false);
      resetValidation();
      await queryClient.invalidateQueries({ queryKey: ["equipment"] });
      await queryClient.invalidateQueries({ queryKey: ["customers", "options"] });    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to register equipment" });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<BackendEquipment>[] = [
    {
      key: "name",
      header: "Equipment",
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-muted-foreground">
            {e.manufacturer} · {e.model}
          </p>
        </div>
      ),
    },
    {
      key: "assetTag",
      header: "Asset Tag",
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
          <QrCode className="h-3 w-3" /> {e.assetTag}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (e) => <span className="text-sm">{e.customerName}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (e) => <span className="text-sm text-muted-foreground">{termLabel(categories, e.category)}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (e) => <span className="text-sm text-muted-foreground">{e.location}</span>,
    },
    {
      key: "condition",
      header: "Condition",
      render: (e) => <StatusBadge status={e.condition} label={termLabel(conditions, e.condition)} />,
    },
    {
      key: "lastServiceDate",
      header: "Last Service",
      render: (e) => (
        <span className="text-sm text-muted-foreground">{formatDate(e.lastServiceDate)}</span>
      ),
    },
  ];

  const customerFilterOptions = useMemo(
    () => customers.map((c) => ({ label: c.name, value: c.id })),
    [customers],
  );

  const categoryFilterOptions = categories.map((c) => ({ label: c.name, value: c.slug }));
  const conditionFilterOptions = conditions.map((c) => ({ label: c.name, value: c.slug }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment & Machines"
        description="QR-tracked medical devices with lifetime service history."
        actions={
          <Button
            onClick={openCreate}
            disabled={customers.length === 0}
            variant="brand"
          >
            <Plus className="mr-1 h-4 w-4" /> Register Equipment
          </Button>
        }
      />

      <DataTable
        mode="server"
        data={equipment}
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, asset tag, serial, customer…"
        emptyMessage="No equipment found."
        emptyHint="Try changing your search or filters."
        filterValues={filters}
        onFilterChange={setFilter}
        filters={[
          {
            key: "condition",
            label: "Condition",
            options: conditionFilterOptions,
          },
          ...(customerFilterOptions.length > 0
            ? [{
                key: "customerId",
                label: "Customer",
                options: customerFilterOptions,
              }]
            : []),
          {
            key: "category",
            label: "Category",
            options: categoryFilterOptions,
          },
        ]}
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={setLimit}
        loading={equipmentQuery.isLoading}
        isFetching={equipmentQuery.isFetching}
        error={equipmentQuery.error as Error | null}
        onRetry={() => loadEquipment()}
        onRowClick={(e) => navigate(`/app/equipment/${e.id}`)}
      />
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetValidation(); setDialogOpen(open); }}>
        <DialogContent ref={dialogRef} className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" /> Register Equipment
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
              name={form.name}
              manufacturer={form.manufacturer}
              model={form.model}
              existingTags={equipment.map((item) => item.assetTag)}
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
                <Select value={form.customerId} onValueChange={onCustomerChange}>
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
                <Select value={form.condition} onValueChange={(value) => {
                  const next = { ...form, condition: value };
                  setForm(next);
                  clearError("condition");
                  handleChange("condition", next);
                }}>
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Register equipment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
