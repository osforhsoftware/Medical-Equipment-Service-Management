import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Building2, Loader2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldRules } from "@/lib/formValidation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type BackendCustomer } from "@/lib/api";
import { toast } from "@/lib/toast";
import { activeTerms } from "@/lib/taxonomy";

const schema = z.object({
  name: fieldRules.requiredString("Customer name"),
  type: fieldRules.optionalString(),
  contactPerson: fieldRules.optionalString(),
  phone: fieldRules.phone(false),
  address: fieldRules.optionalString(),
});

type FormState = {
  name: string;
  type: string;
  contactPerson: string;
  phone: string;
  address: string;
};

export function QuickAddCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: BackendCustomer) => void;
}) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    type: "",
    contactPerson: "",
    phone: "",
    address: "",
  });

  const typesQuery = useQuery({
    queryKey: ["taxonomy", "customer_type"],
    queryFn: () => api.listTaxonomy({ type: "customer_type" }),
    enabled: open,
    staleTime: 30_000,
  });
  const activeTypes = activeTerms(typesQuery.data);

  const { errors, shouldShow, reset, validateAll, handleBlur, handleChange, applyApiErrors, clearError } =
    useFormValidation({
      fieldOrder: ["name", "type", "phone", "address"],
      schema,
    });

  const set = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    Object.keys(patch).forEach((key) => clearError(key));
  };

  const save = async () => {
    const payload = {
      ...form,
      contactPerson: form.contactPerson.trim() || form.name.trim(),
    };
    if (!validateAll(payload, undefined, dialogRef.current)) return;
    setSaving(true);
    try {
      const created = await api.createCustomer({
        name: payload.name.trim(),
        type: payload.type.trim(),
        contactPerson: payload.contactPerson,
        email: "",
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        city: "",
        country: "",
        status: "active",
      });
      toast.success("Customer added", { description: created.name });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCreated(created);
      reset();
      setForm({ name: "", type: "", contactPerson: "", phone: "", address: "" });
      onOpenChange(false);
    } catch (err) {
      if (!applyApiErrors(err, dialogRef.current)) {
        toast.apiError(err, { fallback: "Unable to add customer" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent ref={dialogRef} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> New customer
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-1">
          <div>
            <Label>
              Name <RequiredMark />
            </Label>
            <Input
              value={form.name}
              onChange={(e) => {
                handleChange("name");
                set({ name: e.target.value });
              }}
              onBlur={() => handleBlur("name", form)}
              placeholder="Hospital or clinic"
            />
            <FormFieldError message={shouldShow("name") ? errors.name : undefined} />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={form.type || "__none__"}
              onValueChange={(value) => {
                handleChange("type");
                set({ type: value === "__none__" ? "" : value });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not specified</SelectItem>
                {activeTypes.map((term) => (
                  <SelectItem key={term.id} value={term.slug}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormFieldError message={shouldShow("type") ? errors.type : undefined} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => {
                handleChange("phone");
                set({ phone: e.target.value });
              }}
              onBlur={() => handleBlur("phone", form)}
              placeholder="+91 …"
            />
            <FormFieldError message={shouldShow("phone") ? errors.phone : undefined} />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => {
                handleChange("address");
                set({ address: e.target.value });
              }}
              onBlur={() => handleBlur("address", form)}
              placeholder="Site / street"
            />
            <FormFieldError message={shouldShow("address") ? errors.address : undefined} />
          </div>
          <div>
            <Label>Contact person</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => set({ contactPerson: e.target.value })}
              placeholder="Defaults to customer name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
