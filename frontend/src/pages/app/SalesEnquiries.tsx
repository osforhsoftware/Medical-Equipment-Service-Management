import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileQuestion,
  Plus,
  Search,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnquiryStatus = "open" | "quoted" | "converted" | "lost";

export interface SalesEnquiry {
  id: string;
  reference: string;
  customerName: string;
  contactPerson: string;
  phone: string;
  email: string;
  productInterest: string;
  quantity: number;
  estimatedBudget: string | number | null;
  source: string;
  priority: "low" | "medium" | "high";
  status: EnquiryStatus;
  notes: string;
  assignedTo: string;
  followUpDate: string | null;
  createdAt: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

function statusBadge(status: EnquiryStatus) {
  switch (status) {
    case "open":
      return <Badge variant="outline" className="gap-1 border-blue-400 text-blue-600"><Clock className="h-3 w-3" />Open</Badge>;
    case "quoted":
      return <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600"><FileQuestion className="h-3 w-3" />Quoted</Badge>;
    case "converted":
      return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Converted</Badge>;
    case "lost":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Lost</Badge>;
  }
}

// ── Create / Edit Form ────────────────────────────────────────────────────────

interface EnquiryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: SalesEnquiry | null;
  onSuccess: () => void;
}

const BLANK = {
  customerName: "",
  contactPerson: "",
  phone: "",
  email: "",
  productInterest: "",
  quantity: 1,
  estimatedBudget: "",
  source: "walk-in",
  priority: "medium" as "low" | "medium" | "high",
  status: "open" as EnquiryStatus,
  notes: "",
  assignedTo: "",
  followUpDate: "",
};

function EnquiryFormDialog({ open, onOpenChange, existing, onSuccess }: EnquiryFormDialogProps) {
  const [form, setForm] = useState(
    existing
      ? {
          customerName: existing.customerName || "",
          contactPerson: existing.contactPerson || "",
          phone: existing.phone || "",
          email: existing.email || "",
          productInterest: existing.productInterest || "",
          quantity: Number(existing.quantity) || 1,
          estimatedBudget: existing.estimatedBudget ? String(existing.estimatedBudget) : "",
          source: existing.source || "walk-in",
          priority: existing.priority || "medium",
          status: existing.status || "open",
          notes: existing.notes || "",
          assignedTo: existing.assignedTo || "",
          followUpDate: existing.followUpDate ? existing.followUpDate.slice(0, 10) : "",
        }
      : { ...BLANK },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set =
    (field: keyof typeof BLANK) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.customerName.trim()) errs.customerName = "Customer name required";
    if (!form.productInterest.trim()) errs.productInterest = "Product / service interest required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        estimatedBudget: form.estimatedBudget ? Number(form.estimatedBudget) || null : null,
      };
      if (existing) {
        await api.put(`/sales-enquiries/${existing.id}`, payload);
        toast.success("Enquiry updated");
      } else {
        await api.post("/sales-enquiries", payload);
        toast.success("Enquiry created");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to save enquiry" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5 text-primary" />
            {existing ? "Edit Sales Enquiry" : "New Sales Enquiry"}
          </DialogTitle>
          <DialogDescription>
            Record a new inbound sales lead or enquiry from a prospective customer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className={errors.customerName ? "text-destructive" : ""}>
              Customer / Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.customerName}
              onChange={set("customerName")}
              placeholder="Hospital or company name"
              className={errors.customerName ? "border-destructive" : ""}
            />
            {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
          </div>

          <div className="space-y-1">
            <Label>Contact Person</Label>
            <Input value={form.contactPerson} onChange={set("contactPerson")} placeholder="Dr. John / Purchase Manager" />
          </div>

          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} placeholder="purchase@hospital.com" />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label className={errors.productInterest ? "text-destructive" : ""}>
              Product / Service Interest <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={form.productInterest}
              onChange={set("productInterest")}
              placeholder="e.g. Ventilator service contract, ECG machine spare parts..."
              rows={2}
              className={errors.productInterest ? "border-destructive" : ""}
            />
            {errors.productInterest && <p className="text-xs text-destructive">{errors.productInterest}</p>}
          </div>

          <div className="space-y-1">
            <Label>Estimated Quantity</Label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))}
            />
          </div>

          <div className="space-y-1">
            <Label>Budget Amount</Label>
            <Input
              type="number"
              value={form.estimatedBudget}
              onChange={set("estimatedBudget")}
              placeholder="e.g. 50000"
            />
          </div>

          <div className="space-y-1">
            <Label>Lead Source</Label>
            <Select value={form.source} onValueChange={(v) => setForm((p) => ({ ...p, source: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["walk-in", "phone", "email", "whatsapp", "referral", "website", "trade-show", "other"].map((s) => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((p) => ({ ...p, priority: v as typeof form.priority }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Assigned To (Sales Rep)</Label>
            <Input value={form.assignedTo} onChange={set("assignedTo")} placeholder="Sales rep name" />
          </div>

          <div className="space-y-1">
            <Label>Follow-up Date</Label>
            <Input type="date" value={form.followUpDate} onChange={set("followUpDate")} />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((p) => ({ ...p, status: v as EnquiryStatus }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="converted">Converted to Order</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Any additional context..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Update Enquiry" : "Create Enquiry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalesEnquiries() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasRole(["admin", "sales", "coordinator"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SalesEnquiry | null>(null);

  const { data: enquiries = [], isLoading, isError, error, refetch: refetchQuery } = useQuery<SalesEnquiry[]>({
    queryKey: ["sales-enquiries"],
    queryFn: async () => {
      const res = await api.get<SalesEnquiry[]>("/sales-enquiries");
      return res.data;
    },
  });

  const filtered = enquiries.filter((e) => {
    const matchSearch =
      !search ||
      e.customerName.toLowerCase().includes(search.toLowerCase()) ||
      e.productInterest.toLowerCase().includes(search.toLowerCase()) ||
      e.reference.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    open: enquiries.filter((e) => e.status === "open").length,
    quoted: enquiries.filter((e) => e.status === "quoted").length,
    converted: enquiries.filter((e) => e.status === "converted").length,
    lost: enquiries.filter((e) => e.status === "lost").length,
  };

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["sales-enquiries"] });

  return (
    <RoleGuard roles={["admin", "sales", "coordinator", "billing"]}>
      <div className="space-y-5">
        <PageHeader
          title="Sales Enquiries"
          subtitle="Track inbound leads and convert them to quotations or sales orders"
          icon={<FileQuestion className="h-6 w-6" />}
          actions={
            canCreate ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Enquiry
              </Button>
            ) : undefined
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Open", count: stats.open, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Quoted", count: stats.quoted, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Converted", count: stats.converted, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
            { label: "Lost", count: stats.lost, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
          ].map((s) => (
            <Card
              key={s.label}
              className={`cursor-pointer border-border transition-all hover:shadow-sm ${s.bg}`}
              onClick={() => setStatusFilter(s.label.toLowerCase() as EnquiryStatus)}
            >
              <CardContent className="pt-4 pb-3">
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by customer, product, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="quoted">Quoted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm font-medium text-destructive">
                {error instanceof ApiError ? error.message : "Unable to load sales enquiries"}
              </p>
              <Button variant="outline" size="sm" onClick={() => void refetchQuery()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileQuestion className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No enquiries found</p>
              {canCreate && (
                <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create first enquiry
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((enq) => (
              <Card
                key={enq.id}
                className="cursor-pointer transition-all hover:shadow-sm hover:border-primary/40"
                onClick={() => { setEditing(enq); setFormOpen(true); }}
              >
                <CardContent className="py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{enq.reference}</span>
                        {statusBadge(enq.status)}
                        <Badge
                          variant="outline"
                          className={
                            enq.priority === "high"
                              ? "border-red-400 text-red-600"
                              : enq.priority === "medium"
                                ? "border-amber-400 text-amber-600"
                                : "border-muted-foreground text-muted-foreground"
                          }
                        >
                          {enq.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 font-semibold">{enq.customerName}</p>
                      <p className="text-sm text-muted-foreground truncate">{enq.productInterest}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                      <div className="text-right">
                        {enq.followUpDate && (
                          <p>
                            Follow-up: <span className="font-medium">{formatDate(enq.followUpDate)}</span>
                          </p>
                        )}
                        <p>Created: {formatDate(enq.createdAt)}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={(ev) => { ev.stopPropagation(); setEditing(enq); setFormOpen(true); }}
                      >
                        Edit <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {formOpen && (
          <EnquiryFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            existing={editing}
            onSuccess={refetch}
          />
        )}
      </div>
    </RoleGuard>
  );
}
