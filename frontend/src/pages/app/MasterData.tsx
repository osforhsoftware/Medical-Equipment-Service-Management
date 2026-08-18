import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Pencil, Tags } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { api, type BackendTaxonomyTerm, type TaxonomyType } from "@/lib/api";
import { slugifyTerm, TAXONOMY_TABS } from "@/lib/taxonomy";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const termSchema = z.object({
  name: fieldRules.requiredString("Name"),
  slug: fieldRules.optionalString(),
  description: fieldRules.optionalString(),
  sortOrder: z.string(),
  isActive: z.boolean(),
});

type FormState = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
  isActive: true,
});

function isTaxonomyType(value: string | null): value is TaxonomyType {
  return TAXONOMY_TABS.some((tab) => tab.type === value);
}

export default function MasterData() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("type");
  const type: TaxonomyType = isTaxonomyType(requested) ? requested : "equipment_category";
  const tab = TAXONOMY_TABS.find((t) => t.type === type) ?? TAXONOMY_TABS[0];

  const termsQuery = useQuery({
    queryKey: ["taxonomy", type],
    queryFn: () => api.listTaxonomy({ type }),
  });
  const terms = termsQuery.data ?? [];

  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);
  const [editing, setEditing] = useState<BackendTaxonomyTerm | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    fieldOrder: ["name", "slug", "sortOrder"],
    schema: termSchema,
  });

  useEffect(() => {
    setForm(emptyForm());
    setEditing(null);
    setSlugManual(false);
    resetValidation();
  }, [type, resetValidation]);

  const title = useMemo(() => {
    if (type === "equipment_category") return "Add new category";
    if (type === "equipment_condition") return "Add new condition";
    return "Add new customer type";
  }, [type]);

  const setTab = (next: TaxonomyType) => {
    setSearchParams(next === "equipment_category" ? {} : { type: next });
  };

  const onNameChange = (name: string) => {
    const next = {
      ...form,
      name,
      slug: slugManual || editing ? form.slug : slugifyTerm(name),
    };
    setForm(next);
    handleChange("name", next);
  };

  const startEdit = (term: BackendTaxonomyTerm) => {
    setEditing(term);
    setSlugManual(true);
    setForm({
      name: term.name,
      slug: term.slug,
      description: term.description ?? "",
      sortOrder: String(term.sortOrder),
      isActive: term.isActive,
    });
    resetValidation();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setSlugManual(false);
    setForm(emptyForm());
    resetValidation();
  };

  const save = async () => {
    if (!validateAll(form, undefined, formRef.current)) return;
    const sortOrder = form.sortOrder.trim() === "" ? 0 : Number(form.sortOrder);
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      toast.error("Sort order must be a number.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.updateTaxonomy(editing.id, {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description.trim() || null,
          sortOrder,
          isActive: form.isActive,
        });
        toast.success("Term updated", { description: `${form.name.trim()} was saved.` });
      } else {
        await api.createTaxonomy({
          type,
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description.trim() || null,
          sortOrder,
          isActive: form.isActive,
        });
        toast.success("Term added", { description: `${form.name.trim()} is now available in dropdowns.` });
      }
      cancelEdit();
      await queryClient.invalidateQueries({ queryKey: ["taxonomy"] });
    } catch (err) {
      if (!applyApiErrors(err, formRef.current)) {
        toast.apiError(err, { fallback: editing ? "Unable to update term" : "Unable to add term" });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (term: BackendTaxonomyTerm) => {
    setPendingId(term.id);
    try {
      await api.updateTaxonomy(term.id, { isActive: !term.isActive });
      toast.success(term.isActive ? "Term deactivated" : "Term activated", {
        description: term.isActive
          ? `${term.name} is hidden from new records.`
          : `${term.name} is available again.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["taxonomy"] });
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to update term" });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Data"
        description="Manage lookup lists used on Register Equipment and Add Customer — add, rename, or deactivate without changing code."
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <nav className="rounded-lg border bg-card p-2">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Taxonomies
            </p>
            <div className="space-y-0.5">
              {TAXONOMY_TABS.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setTab(item.type)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                    item.type === type
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="grid gap-6 xl:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
            <form
              ref={formRef}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-4 rounded-lg border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{editing ? `Edit ${tab.singular}` : title}</h2>
              </div>

              <div className="grid gap-2" data-field="name">
                <Label htmlFor="term-name" className={shouldShow("name") ? "text-destructive" : undefined}>
                  Name
                  <RequiredMark />
                </Label>
                <Input
                  id="term-name"
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={() => handleBlur("name", form)}
                  placeholder={type === "customer_type" ? "Nursing Home" : "Cardiology"}
                  className={fieldErrorClass(shouldShow("name"))}
                  {...fieldAria("name", shouldShow("name") ? errors.name : null)}
                />
                {shouldShow("name") && <FormFieldError field="name" message={errors.name} />}
              </div>

              <div className="grid gap-2" data-field="slug">
                <Label htmlFor="term-slug">Slug</Label>
                <Input
                  id="term-slug"
                  value={form.slug}
                  disabled={Boolean(editing?.isSystem)}
                  onChange={(e) => {
                    setSlugManual(true);
                    const next = { ...form, slug: e.target.value };
                    setForm(next);
                    clearError("slug");
                    handleChange("slug", next);
                  }}
                  onBlur={() => handleBlur("slug", form)}
                  placeholder="auto-from-name"
                  className={cn("font-mono text-sm", fieldErrorClass(shouldShow("slug")))}
                  {...fieldAria("slug", shouldShow("slug") ? errors.slug : null)}
                />
                <p className="text-xs text-muted-foreground">
                  {editing?.isSystem
                    ? "System slugs are protected so existing records keep working."
                    : "Used when saving records. Leave blank to generate from the name."}
                </p>
                {shouldShow("slug") && <FormFieldError field="slug" message={errors.slug} />}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="term-description">Description</Label>
                <Textarea
                  id="term-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional"
                  rows={3}
                />
              </div>

              <div className="grid gap-2" data-field="sortOrder">
                <Label htmlFor="term-sort">Sort order</Label>
                <Input
                  id="term-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => {
                    const next = { ...form, sortOrder: e.target.value };
                    setForm(next);
                    handleChange("sortOrder", next);
                  }}
                  className={fieldErrorClass(shouldShow("sortOrder"))}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="term-active" className="cursor-pointer">Active</Label>
                <Switch
                  id="term-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
              </div>

              <div className="flex gap-2">
                {editing ? (
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editing ? "Update" : "Add"}
                </Button>
              </div>
            </form>

            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Used by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {termsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        Loading {tab.label.toLowerCase()}…
                      </TableCell>
                    </TableRow>
                  ) : terms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No {tab.label.toLowerCase()} yet. Add the first one using the form.
                      </TableCell>
                    </TableRow>
                  ) : (
                    terms.map((term) => (
                      <TableRow key={term.id} className={editing?.id === term.id ? "bg-muted/40" : undefined}>
                        <TableCell>
                          <p className="font-medium">{term.name}</p>
                          {term.isSystem ? (
                            <p className="text-[11px] text-muted-foreground">System</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{term.slug}</TableCell>
                        <TableCell>
                          <StatusBadge status={term.isActive ? "active" : "inactive"} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{term.usageCount ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(term)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pendingId === term.id}
                              onClick={() => void toggleActive(term)}
                            >
                              {term.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
