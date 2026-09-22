import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  BadgeIndianRupee,
  Ban,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Loader2,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DateRangeFilter, type DateRangeValue } from "@/components/shared/DateRangeFilter";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldAria, fieldErrorClass, fieldRules } from "@/lib/formValidation";
import { defaultDateRange, toIsoDate } from "@/lib/charts";
import { downloadSpreadsheet } from "@/lib/exportSpreadsheet";
import { normalizeNumberInputValue, parseNumberInput } from "@/lib/numberInput";
import { activeTerms, termLabel } from "@/lib/taxonomy";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type BackendCommission,
  type BackendExpense,
  type BackendInvoice,
  type BackendServiceJob,
  type BackendTaxonomyTerm,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

type CommissionStatus = "accrued" | "approved" | "paid" | "cancelled";

const COMMISSION_STATUS_FILTERS = [
  { label: "Accrued", value: "accrued" },
  { label: "Approved", value: "approved" },
  { label: "Paid", value: "paid" },
  { label: "Cancelled", value: "cancelled" },
];

const NONE_VALUE = "__none__";
const ADD_OPTION = "__add__";

const expenseSchema = z
  .object({
    category: fieldRules.requiredString("Category"),
    categoryOther: fieldRules.optionalString(),
    description: fieldRules.requiredString("Description"),
    incurredAt: fieldRules.requiredString("Incurred date"),
    amount: fieldRules.positiveNumber("Amount"),
    projectRef: fieldRules.optionalString(),
    jobId: fieldRules.optionalString(),
    vendor: fieldRules.optionalString(),
  })
  .superRefine((data, ctx) => {
    if (data.category === ADD_OPTION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.categoryOther?.trim() ? ["categoryOther"] : ["category"],
        message: data.categoryOther?.trim()
          ? "Click Add to save the new category."
          : "Enter a category, or choose an existing one.",
      });
    }
  });

const commissionSchema = z.object({
  payeeName: fieldRules.requiredString("Payee"),
  basisAmount: fieldRules.positiveNumber("Basis amount"),
  rate: fieldRules.nonNegativeNumber("Rate"),
  invoiceId: fieldRules.optionalString(),
});

function todayIso() {
  return toIsoDate(new Date());
}

function inDateRange(iso: string | null | undefined, range: DateRangeValue) {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= range.from && day <= range.to;
}

function InlineAddCategory({
  value,
  error,
  showError,
  adding,
  onChange,
  onAdd,
}: {
  value: string;
  error?: string;
  showError?: boolean;
  adding?: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-border p-3" data-field="categoryOther">
      <Label htmlFor="expense-category-other" className={showError ? "text-destructive" : undefined}>
        New category name
        <RequiredMark />
      </Label>
      <div className="flex gap-2">
        <Input
          id="expense-category-other"
          value={value}
          placeholder="e.g. Calibration, Insurance"
          onChange={(e) => onChange(e.target.value)}
          className={fieldErrorClass(Boolean(showError))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" disabled={adding || !value.trim()} onClick={onAdd}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saved categories appear in this list and in{" "}
        <Link to="/app/master-data?type=expense_category" className="text-primary hover:underline">
          Master Data
        </Link>
        .
      </p>
      {showError && error ? <FormFieldError field="categoryOther" message={error} /> : null}
    </div>
  );
}

type ExpenseForm = {
  projectRef: string;
  jobId: string;
  category: string;
  categoryOther: string;
  description: string;
  amount: string;
  incurredAt: string;
  vendor: string;
};

type CommissionForm = {
  payeeName: string;
  basisAmount: string;
  rate: string;
  invoiceId: string;
};

function emptyExpense(): ExpenseForm {
  return {
    projectRef: "",
    jobId: "",
    category: "",
    categoryOther: "",
    description: "",
    amount: "",
    incurredAt: todayIso(),
    vendor: "",
  };
}

function emptyCommission(): CommissionForm {
  return { payeeName: "", basisAmount: "", rate: "", invoiceId: "" };
}

export default function ExpensesCommissions() {
  const queryClient = useQueryClient();
  const [expenses, setExpenses] = useState<BackendExpense[]>([]);
  const [commissions, setCommissions] = useState<BackendCommission[]>([]);
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [expense, setExpense] = useState<ExpenseForm>(emptyExpense());
  const [commission, setCommission] = useState<CommissionForm>(emptyCommission());
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => defaultDateRange(89));
  const [activeTab, setActiveTab] = useState("expenses");
  const [pendingCancel, setPendingCancel] = useState<BackendCommission | null>(null);
  const expenseRef = useRef<HTMLDivElement>(null);
  const commissionRef = useRef<HTMLDivElement>(null);

  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "expense_category"],
    queryFn: () => api.listTaxonomy({ type: "expense_category" }),
    staleTime: 30_000,
  });
  const categoryTerms = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const activeCategories = activeTerms(categoryTerms);

  const expenseValidation = useFormValidation({
    fieldOrder: ["category", "categoryOther", "incurredAt", "description", "amount"],
    schema: expenseSchema,
  });
  const commissionValidation = useFormValidation({
    fieldOrder: ["payeeName", "basisAmount", "rate"],
    schema: commissionSchema,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expenseRows, commissionRows, jobRows, invoiceRows] = await Promise.all([
        api.listExpenses(),
        api.listCommissions(),
        api.listJobs({ limit: 100, page: 1 }),
        api.listInvoices(),
      ]);
      setExpenses(expenseRows);
      setCommissions(commissionRows);
      setJobs(jobRows.data);
      setInvoices(invoiceRows);
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to load finance records" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rangedExpenses = useMemo(
    () => expenses.filter((row) => inDateRange(row.incurredAt, dateRange)),
    [expenses, dateRange],
  );

  const rangedCommissions = useMemo(
    () => commissions.filter((row) => inDateRange(row.createdAt, dateRange)
      || (row.paidAt ? inDateRange(row.paidAt, dateRange) : false)),
    [commissions, dateRange],
  );

  const totals = useMemo(() => {
    const expenseTotal = rangedExpenses.reduce((sum, row) => sum + Number(row.amount), 0);
    const commissionTotal = rangedCommissions.reduce((sum, row) => sum + Number(row.amount), 0);
    const commissionPaid = rangedCommissions
      .filter((row) => row.status === "paid")
      .reduce((sum, row) => sum + Number(row.amount), 0);
    const commissionPending = rangedCommissions
      .filter((row) => row.status === "accrued" || row.status === "approved")
      .reduce((sum, row) => sum + Number(row.amount), 0);
    return { expenses: expenseTotal, commissions: commissionTotal, commissionPaid, commissionPending };
  }, [rangedExpenses, rangedCommissions]);

  const expenseCategoryOptions = useMemo(() => {
    const known = new Map(activeCategories.map((term) => [term.slug, term.name]));
    rangedExpenses.forEach((row) => {
      if (row.category && !known.has(row.category)) {
        known.set(row.category, termLabel(categoryTerms, row.category, row.category));
      }
    });
    return Array.from(known.entries()).map(([value, label]) => ({ value, label }));
  }, [activeCategories, categoryTerms, rangedExpenses]);

  const calculatedCommission = useMemo(() => {
    const basis = parseNumberInput(commission.basisAmount);
    const rate = parseNumberInput(commission.rate);
    return (basis * rate) / 100;
  }, [commission.basisAmount, commission.rate]);

  const findExistingCategory = (terms: BackendTaxonomyTerm[], name: string) =>
    terms.find(
      (term) =>
        term.name.toLowerCase() === name.toLowerCase()
        || term.slug.toLowerCase() === name.toLowerCase(),
    );

  const addCategory = async () => {
    const name = expense.categoryOther.trim();
    if (!name) return;
    const existing = findExistingCategory(categoryTerms, name);
    if (existing) {
      const next = { ...expense, category: existing.slug, categoryOther: "" };
      setExpense(next);
      expenseValidation.clearError("category");
      expenseValidation.clearError("categoryOther");
      toast({ title: "Category selected", description: `"${existing.name}" is already in the list.` });
      return;
    }
    setAddingCategory(true);
    try {
      const created = await api.createTaxonomy({ type: "expense_category", name });
      await queryClient.invalidateQueries({ queryKey: ["taxonomy", "expense_category"] });
      const next = { ...expense, category: created.slug, categoryOther: "" };
      setExpense(next);
      expenseValidation.clearError("category");
      expenseValidation.clearError("categoryOther");
      toast({ title: "Category added", description: `"${created.name}" is now in the Category list.` });
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to add expense category" });
    } finally {
      setAddingCategory(false);
    }
  };

  const saveExpense = async () => {
    const payload = {
      ...expense,
      amount: parseNumberInput(expense.amount),
    };
    if (!expenseValidation.validateAll(payload, undefined, expenseRef.current)) return;
    setSaving(true);
    try {
      await api.createExpense({
        category: expense.category,
        description: payload.description.trim(),
        amount: payload.amount,
        incurredAt: payload.incurredAt,
        branchId: null,
        projectRef: payload.projectRef.trim() || null,
        jobId: payload.jobId || null,
        vendor: payload.vendor.trim() || null,
        receiptFileId: null,
      });
      setExpenseOpen(false);
      setExpense(emptyExpense());
      expenseValidation.reset();
      await load();
      toast({ title: "Expense recorded" });
    } catch (error) {
      if (!expenseValidation.applyApiErrors(error, expenseRef.current)) {
        toast.apiError(error, { fallback: "Unable to save expense" });
      }
    } finally {
      setSaving(false);
    }
  };

  const saveCommission = async () => {
    const payload = {
      payeeName: commission.payeeName.trim(),
      basisAmount: parseNumberInput(commission.basisAmount),
      rate: parseNumberInput(commission.rate),
      invoiceId: commission.invoiceId || null,
    };
    if (!commissionValidation.validateAll(payload, undefined, commissionRef.current)) return;
    setSaving(true);
    try {
      await api.createCommission(payload);
      setCommissionOpen(false);
      setCommission(emptyCommission());
      commissionValidation.reset();
      await load();
      toast({ title: "Commission accrued" });
    } catch (error) {
      if (!commissionValidation.applyApiErrors(error, commissionRef.current)) {
        toast.apiError(error, { fallback: "Unable to save commission" });
      }
    } finally {
      setSaving(false);
    }
  };

  const changeCommissionStatus = async (row: BackendCommission, status: CommissionStatus) => {
    setBusyId(row.id);
    try {
      await api.updateCommission(row.id, {
        status,
        paidAt: status === "paid" ? new Date().toISOString() : null,
      });
      await load();
      const messages: Record<CommissionStatus, string> = {
        accrued: "Commission set to accrued",
        approved: "Commission approved",
        paid: "Commission marked paid — expense booked",
        cancelled: "Commission cancelled",
      };
      toast({ title: messages[status] });
    } catch (error) {
      toast.apiError(error, { fallback: "Unable to update commission" });
    } finally {
      setBusyId(null);
      setPendingCancel(null);
    }
  };

  const commissionActions = (row: BackendCommission): {
    label: string;
    status: CommissionStatus;
    tone: "default" | "destructive";
    icon: typeof CheckCircle2;
  }[] => {
    const actions: {
      label: string;
      status: CommissionStatus;
      tone: "default" | "destructive";
      icon: typeof CheckCircle2;
    }[] = [];
    if (row.status === "accrued") {
      actions.push({ label: "Approve", status: "approved", tone: "default", icon: CheckCircle2 });
    }
    if (row.status === "accrued" || row.status === "approved") {
      actions.push({ label: "Mark paid", status: "paid", tone: "default", icon: Wallet });
    }
    if (row.status !== "paid" && row.status !== "cancelled") {
      actions.push({ label: "Cancel", status: "cancelled", tone: "destructive", icon: Ban });
    }
    return actions;
  };

  const invoiceLabel = (invoiceId?: string | null) => {
    if (!invoiceId) return null;
    const invoice = invoices.find((row) => row.id === invoiceId);
    return invoice ? `${invoice.reference} · ${invoice.customerName}` : invoiceId;
  };

  const exportCurrent = () => {
    if (activeTab === "expenses") {
      downloadSpreadsheet(
        "finance-expenses",
        [
          { header: "Date", value: (row) => formatDate(row.incurredAt) },
          { header: "Category", value: (row) => termLabel(categoryTerms, row.category, row.category) },
          { header: "Description", value: (row) => row.description },
          { header: "Vendor", value: (row) => row.vendor ?? "" },
          { header: "Project / Job", value: (row) => row.projectRef ?? "" },
          { header: "Amount", value: (row) => Number(row.amount) },
        ],
        rangedExpenses,
      );
      toast.success("Export ready", {
        description: `${rangedExpenses.length} expense(s) exported for Excel.`,
      });
      return;
    }

    downloadSpreadsheet(
      "finance-commissions",
      [
        { header: "Payee", value: (row) => row.payeeName },
        { header: "Basis amount", value: (row) => Number(row.basisAmount) },
        { header: "Rate %", value: (row) => Number(row.rate) },
        { header: "Amount", value: (row) => Number(row.amount) },
        { header: "Status", value: (row) => row.status },
        { header: "Invoice", value: (row) => invoiceLabel(row.invoiceId) ?? "" },
        { header: "Created", value: (row) => formatDate(row.createdAt) },
        { header: "Paid", value: (row) => (row.paidAt ? formatDate(row.paidAt) : "") },
      ],
      rangedCommissions,
    );
    toast.success("Export ready", {
      description: `${rangedCommissions.length} commission(s) exported for Excel.`,
    });
  };

  const expenseColumns: Column<BackendExpense>[] = [
    {
      key: "description",
      header: "Expense",
      render: (row) => (
        <div className="flex min-w-0 items-start gap-2">
          <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.description}</p>
            <p className="text-xs text-muted-foreground">
              {row.vendor ? `Vendor: ${row.vendor}` : "No vendor"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <span className="text-sm">{termLabel(categoryTerms, row.category, row.category)}</span>
      ),
    },
    {
      key: "projectRef",
      header: "Project / Job",
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.projectRef || "—"}
        </span>
      ),
    },
    {
      key: "incurredAt",
      header: "Incurred",
      render: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.incurredAt)}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (row) => <span className="font-semibold tabular-nums">{formatCurrency(Number(row.amount))}</span>,
    },
  ];

  const commissionColumns: Column<BackendCommission>[] = [
    {
      key: "payeeName",
      header: "Payee",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium">{row.payeeName}</p>
          <p className="text-xs text-muted-foreground">
            {invoiceLabel(row.invoiceId) ?? "No linked invoice"}
          </p>
        </div>
      ),
    },
    {
      key: "basisAmount",
      header: "Basis",
      render: (row) => (
        <div className="text-sm">
          <p className="tabular-nums">{formatCurrency(Number(row.basisAmount))}</p>
          <p className="text-xs text-muted-foreground">{Number(row.rate)}%</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Commission",
      render: (row) => <span className="font-semibold tabular-nums">{formatCurrency(Number(row.amount))}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "paidAt",
      header: "Dates",
      render: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>Created {formatDate(row.createdAt)}</p>
          <p>{row.paidAt ? `Paid ${formatDate(row.paidAt)}` : "Not paid"}</p>
        </div>
      ),
    },
    {
      key: "actions" as keyof BackendCommission,
      header: "Actions",
      className: "w-[1%] whitespace-nowrap text-right",
      render: (row) => {
        const actions = commissionActions(row);
        const busy = busyId === row.id;
        if (actions.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.tone === "destructive" ? "ghost" : "outline"}
                className={action.tone === "destructive" ? "text-destructive hover:text-destructive" : undefined}
                disabled={busy}
                onClick={() => {
                  if (action.status === "cancelled") setPendingCancel(row);
                  else void changeCommissionStatus(row, action.status);
                }}
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <action.icon className="mr-1 h-3.5 w-3.5" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Operations"
        description="Track project expenses, vendor spend, and referral commission accruals through payout."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={exportCurrent} disabled={loading}>
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                expenseValidation.reset();
                setExpense(emptyExpense());
                setExpenseOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Expense
            </Button>
            <Button
              variant="brand"
              onClick={() => {
                commissionValidation.reset();
                setCommission(emptyCommission());
                setCommissionOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Commission
            </Button>
          </div>
        }
      />

      <DateRangeFilter value={dateRange} onChange={setDateRange} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recorded Expenses" value={formatCurrency(totals.expenses)} icon={ReceiptText} accent="warning" />
        <StatCard label="Commission Accruals" value={formatCurrency(totals.commissions)} icon={BadgeIndianRupee} accent="accent" />
        <StatCard label="Commission Outstanding" value={formatCurrency(totals.commissionPending)} icon={Clock} accent="primary" />
        <StatCard label="Commission Paid" value={formatCurrency(totals.commissionPaid)} icon={Wallet} accent="success" />
      </div>

      {loading ? (
        <div className="flex justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading finance records…
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="expenses">Expenses ({rangedExpenses.length})</TabsTrigger>
            <TabsTrigger value="commissions">Commissions ({rangedCommissions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-4">
            <DataTable
              data={rangedExpenses}
              columns={expenseColumns}
              searchKeys={["description", "vendor", "projectRef", "category"]}
              searchPlaceholder="Search description, vendor, project…"
              emptyMessage={expenses.length === 0 ? "No expenses recorded yet." : "No expenses in this date range."}
              emptyHint="Try widening the date range or clearing filters."
              filters={[
                {
                  label: "Category",
                  options: expenseCategoryOptions,
                  predicate: (row, value) => (row as BackendExpense).category === value,
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <DataTable
              data={rangedCommissions}
              columns={commissionColumns}
              searchKeys={["payeeName"]}
              searchPlaceholder="Search payee…"
              emptyMessage={commissions.length === 0 ? "No commissions recorded yet." : "No commissions in this date range."}
              emptyHint="Try widening the date range or clearing filters."
              filters={[
                {
                  label: "Status",
                  options: COMMISSION_STATUS_FILTERS,
                  predicate: (row, value) => (row as BackendCommission).status === value,
                },
              ]}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={expenseOpen}
        onOpenChange={(open) => {
          if (!open) expenseValidation.reset();
          setExpenseOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record expense</DialogTitle>
            <DialogDescription>
              Capture vendor spend or project cost. Link a service job when the cost belongs to a specific repair.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveExpense();
            }}
          >
            <div ref={expenseRef} className="grid gap-3 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2" data-field="category">
                  <Label
                    htmlFor="expense-category"
                    className={expenseValidation.shouldShow("category") ? "text-destructive" : undefined}
                  >
                    Category
                    <RequiredMark />
                  </Label>
                  <Select
                    value={expense.category || undefined}
                    onValueChange={(value) => {
                      const next = {
                        ...expense,
                        category: value,
                        categoryOther: value === ADD_OPTION ? expense.categoryOther : "",
                      };
                      setExpense(next);
                      expenseValidation.clearError("category");
                      if (value !== ADD_OPTION) expenseValidation.clearError("categoryOther");
                      expenseValidation.handleChange("category", next);
                    }}
                  >
                    <SelectTrigger
                      id="expense-category"
                      aria-invalid={expenseValidation.shouldShow("category")}
                      className={fieldErrorClass(expenseValidation.shouldShow("category"))}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((term) => (
                        <SelectItem key={term.id} value={term.slug}>
                          {term.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={ADD_OPTION}>+ Add new category</SelectItem>
                    </SelectContent>
                  </Select>
                  {expenseValidation.shouldShow("category") && (
                    <FormFieldError field="category" message={expenseValidation.errors.category} />
                  )}
                </div>
                <div className="grid gap-2" data-field="incurredAt">
                  <Label
                    htmlFor="expense-date"
                    className={expenseValidation.shouldShow("incurredAt") ? "text-destructive" : undefined}
                  >
                    Incurred date
                    <RequiredMark />
                  </Label>
                  <Input
                    id="expense-date"
                    name="incurredAt"
                    type="date"
                    value={expense.incurredAt}
                    max={todayIso()}
                    className={fieldErrorClass(expenseValidation.shouldShow("incurredAt"))}
                    {...fieldAria(
                      "incurredAt",
                      expenseValidation.shouldShow("incurredAt") ? expenseValidation.errors.incurredAt : null,
                    )}
                    onChange={(e) => {
                      const next = { ...expense, incurredAt: e.target.value };
                      setExpense(next);
                      expenseValidation.handleChange("incurredAt", next);
                    }}
                    onBlur={() => expenseValidation.handleBlur("incurredAt", expense)}
                  />
                  {expenseValidation.shouldShow("incurredAt") && (
                    <FormFieldError field="incurredAt" message={expenseValidation.errors.incurredAt} />
                  )}
                </div>
              </div>

              {expense.category === ADD_OPTION ? (
                <InlineAddCategory
                  value={expense.categoryOther}
                  error={expenseValidation.errors.categoryOther}
                  showError={expenseValidation.shouldShow("categoryOther")}
                  adding={addingCategory}
                  onChange={(value) => {
                    const next = { ...expense, categoryOther: value };
                    setExpense(next);
                    expenseValidation.handleChange("categoryOther", next);
                  }}
                  onAdd={() => void addCategory()}
                />
              ) : null}

              <div className="grid gap-2" data-field="description">
                <Label
                  htmlFor="expense-description"
                  className={expenseValidation.shouldShow("description") ? "text-destructive" : undefined}
                >
                  Description
                  <RequiredMark />
                </Label>
                <Textarea
                  id="expense-description"
                  name="description"
                  rows={3}
                  placeholder="What was purchased or paid for?"
                  value={expense.description}
                  className={fieldErrorClass(expenseValidation.shouldShow("description"))}
                  {...fieldAria(
                    "description",
                    expenseValidation.shouldShow("description") ? expenseValidation.errors.description : null,
                  )}
                  onChange={(e) => {
                    const next = { ...expense, description: e.target.value };
                    setExpense(next);
                    expenseValidation.handleChange("description", next);
                  }}
                  onBlur={() => expenseValidation.handleBlur("description", expense)}
                />
                {expenseValidation.shouldShow("description") && (
                  <FormFieldError field="description" message={expenseValidation.errors.description} />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="expense-job">Linked service job</Label>
                  <Select
                    value={expense.jobId || NONE_VALUE}
                    onValueChange={(value) => {
                      if (value === NONE_VALUE) {
                        setExpense({ ...expense, jobId: "", projectRef: "" });
                        return;
                      }
                      const job = jobs.find((row) => row.id === value);
                      setExpense({
                        ...expense,
                        jobId: value,
                        projectRef: job?.reference ?? "",
                      });
                    }}
                  >
                    <SelectTrigger id="expense-job">
                      <SelectValue placeholder="Optional job link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>No linked job</SelectItem>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.reference} · {job.customerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expense-vendor">Vendor / supplier</Label>
                  <Input
                    id="expense-vendor"
                    value={expense.vendor}
                    placeholder="Who was paid?"
                    onChange={(e) => setExpense({ ...expense, vendor: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="expense-project-ref">Project reference</Label>
                  <Input
                    id="expense-project-ref"
                    value={expense.projectRef}
                    placeholder="Auto-filled from job, or enter manually"
                    onChange={(e) => setExpense({ ...expense, projectRef: e.target.value })}
                  />
                </div>
                <div className="grid gap-2" data-field="amount">
                  <Label
                    htmlFor="expense-amount"
                    className={expenseValidation.shouldShow("amount") ? "text-destructive" : undefined}
                  >
                    Amount
                    <RequiredMark />
                  </Label>
                  <Input
                    id="expense-amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={expense.amount}
                    className={fieldErrorClass(expenseValidation.shouldShow("amount"))}
                    {...fieldAria(
                      "amount",
                      expenseValidation.shouldShow("amount") ? expenseValidation.errors.amount : null,
                    )}
                    onChange={(e) => {
                      const next = {
                        ...expense,
                        amount: normalizeNumberInputValue(e.target.value),
                      };
                      setExpense(next);
                      expenseValidation.handleChange("amount", {
                        ...next,
                        amount: parseNumberInput(next.amount),
                      });
                    }}
                    onBlur={() =>
                      expenseValidation.handleBlur("amount", {
                        ...expense,
                        amount: parseNumberInput(expense.amount),
                      })
                    }
                  />
                  {expenseValidation.shouldShow("amount") && (
                    <FormFieldError field="amount" message={expenseValidation.errors.amount} />
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Save expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={commissionOpen}
        onOpenChange={(open) => {
          if (!open) commissionValidation.reset();
          setCommissionOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Accrue commission</DialogTitle>
            <DialogDescription>
              Record a referral or sales commission. Approve, then mark paid to book the payout as an expense.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveCommission();
            }}
          >
            <div ref={commissionRef} className="grid gap-3 py-2">
              <div className="grid gap-2" data-field="payeeName">
                <Label
                  htmlFor="commission-payee"
                  className={commissionValidation.shouldShow("payeeName") ? "text-destructive" : undefined}
                >
                  Payee / referral partner
                  <RequiredMark />
                </Label>
                <Input
                  id="commission-payee"
                  name="payeeName"
                  placeholder="Person or partner to pay"
                  value={commission.payeeName}
                  className={fieldErrorClass(commissionValidation.shouldShow("payeeName"))}
                  {...fieldAria(
                    "payeeName",
                    commissionValidation.shouldShow("payeeName") ? commissionValidation.errors.payeeName : null,
                  )}
                  onChange={(e) => {
                    const next = { ...commission, payeeName: e.target.value };
                    setCommission(next);
                    commissionValidation.handleChange("payeeName", next);
                  }}
                  onBlur={() => commissionValidation.handleBlur("payeeName", commission)}
                />
                {commissionValidation.shouldShow("payeeName") && (
                  <FormFieldError field="payeeName" message={commissionValidation.errors.payeeName} />
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="commission-invoice">Linked invoice</Label>
                <Select
                  value={commission.invoiceId || NONE_VALUE}
                  onValueChange={(value) => {
                    if (value === NONE_VALUE) {
                      setCommission({ ...commission, invoiceId: "", basisAmount: commission.basisAmount });
                      return;
                    }
                    const invoice = invoices.find((row) => row.id === value);
                    setCommission({
                      ...commission,
                      invoiceId: value,
                      basisAmount: invoice
                        ? normalizeNumberInputValue(String(Number(invoice.total)))
                        : commission.basisAmount,
                    });
                  }}
                >
                  <SelectTrigger id="commission-invoice">
                    <SelectValue placeholder="Optional invoice link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>No linked invoice</SelectItem>
                    {invoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.reference} · {invoice.customerName} · {formatCurrency(Number(invoice.total))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2" data-field="basisAmount">
                  <Label
                    htmlFor="commission-basis"
                    className={commissionValidation.shouldShow("basisAmount") ? "text-destructive" : undefined}
                  >
                    Basis amount
                    <RequiredMark />
                  </Label>
                  <Input
                    id="commission-basis"
                    name="basisAmount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={commission.basisAmount}
                    className={fieldErrorClass(commissionValidation.shouldShow("basisAmount"))}
                    {...fieldAria(
                      "basisAmount",
                      commissionValidation.shouldShow("basisAmount")
                        ? commissionValidation.errors.basisAmount
                        : null,
                    )}
                    onChange={(e) => {
                      const next = {
                        ...commission,
                        basisAmount: normalizeNumberInputValue(e.target.value),
                      };
                      setCommission(next);
                      commissionValidation.handleChange("basisAmount", {
                        ...next,
                        basisAmount: parseNumberInput(next.basisAmount),
                        rate: parseNumberInput(next.rate),
                      });
                    }}
                    onBlur={() =>
                      commissionValidation.handleBlur("basisAmount", {
                        ...commission,
                        basisAmount: parseNumberInput(commission.basisAmount),
                        rate: parseNumberInput(commission.rate),
                      })
                    }
                  />
                  {commissionValidation.shouldShow("basisAmount") && (
                    <FormFieldError field="basisAmount" message={commissionValidation.errors.basisAmount} />
                  )}
                </div>
                <div className="grid gap-2" data-field="rate">
                  <Label
                    htmlFor="commission-rate"
                    className={commissionValidation.shouldShow("rate") ? "text-destructive" : undefined}
                  >
                    Rate %
                    <RequiredMark />
                  </Label>
                  <Input
                    id="commission-rate"
                    name="rate"
                    inputMode="decimal"
                    placeholder="0"
                    value={commission.rate}
                    className={fieldErrorClass(commissionValidation.shouldShow("rate"))}
                    {...fieldAria(
                      "rate",
                      commissionValidation.shouldShow("rate") ? commissionValidation.errors.rate : null,
                    )}
                    onChange={(e) => {
                      const next = {
                        ...commission,
                        rate: normalizeNumberInputValue(e.target.value),
                      };
                      setCommission(next);
                      commissionValidation.handleChange("rate", {
                        ...next,
                        basisAmount: parseNumberInput(next.basisAmount),
                        rate: parseNumberInput(next.rate),
                      });
                    }}
                    onBlur={() =>
                      commissionValidation.handleBlur("rate", {
                        ...commission,
                        basisAmount: parseNumberInput(commission.basisAmount),
                        rate: parseNumberInput(commission.rate),
                      })
                    }
                  />
                  {commissionValidation.shouldShow("rate") && (
                    <FormFieldError field="rate" message={commissionValidation.errors.rate} />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                Calculated commission:{" "}
                <span className="font-semibold text-foreground">{formatCurrency(calculatedCommission)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                New commissions start as <span className="font-medium">accrued</span>. Approve, then mark paid to book
                the payout as a project expense.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCommissionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Save commission
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={pendingCancel != null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
        title="Cancel this commission?"
        description={
          pendingCancel
            ? `${formatCurrency(pendingCancel.amount)} commission for ${pendingCancel.payeeName} will be marked cancelled. This cannot be reverted from here.`
            : ""
        }
        confirmLabel="Cancel commission"
        loading={pendingCancel != null && busyId === pendingCancel.id}
        onConfirm={() => {
          if (pendingCancel) void changeCommissionStatus(pendingCancel, "cancelled");
        }}
      />
    </div>
  );
}
