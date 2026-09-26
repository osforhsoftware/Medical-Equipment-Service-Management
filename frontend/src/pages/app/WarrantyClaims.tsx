import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Plus,
  Search,
  Loader2,
  AlertTriangle,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendEquipment } from "@/lib/api";
import {
  formatMachineWarrantyLabel,
  formatServiceWarrantyLabel,
  isEquipmentUnderActiveWarranty,
} from "@/lib/equipmentWarranty";
import { formatDate, formatServiceStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

const NO_LINKED_TICKET = "__none__";
const NO_LINKED_JOB = "__none__";

const EMPTY_CREATE_FORM = {
  customerId: "",
  customerName: "",
  equipmentId: "",
  equipmentName: "",
  serviceRequestId: "",
  originalJobId: "",
  underWarranty: false,
  isPhysicalDamage: false,
  componentCovered: true,
  inspectorNotes: "",
};

function equipmentDisplayName(item: BackendEquipment): string {
  const parts = [item.name.trim()];
  if (item.model?.trim()) parts.push(item.model.trim());
  if (item.manufacturer?.trim()) parts.push(item.manufacturer.trim());
  return parts.join(" · ");
}

function equipmentSelectLabel(item: BackendEquipment): string {
  const base = equipmentDisplayName(item);
  return item.assetTag?.trim() ? `${base} (${item.assetTag.trim()})` : base;
}

export interface WarrantyClaimData {
  id: string;
  reference: string;
  equipmentId: string;
  equipmentName: string;
  customerId?: string | null;
  customerName: string;
  serviceRequestId?: string | null;
  originalJobId?: string | null;
  underWarranty: boolean;
  isPhysicalDamage: boolean;
  componentCovered: boolean;
  claimDecision?: "approved" | "rejected" | "partial" | null;
  inspectorNotes?: string | null;
  decisionNotes?: string | null;
  status: "pending" | "under_review" | "approved" | "rejected";
  createdBy: string;
  createdAt: string;
}

export default function WarrantyClaims() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasRole(["admin", "coordinator", "inspector"]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [decideOpen, setDecideOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaimData | null>(null);

  const [form, setForm] = useState({ ...EMPTY_CREATE_FORM });

  const [decisionForm, setDecisionForm] = useState<{
    claimDecision: "approved" | "rejected" | "partial";
    decisionNotes: string;
    status: "approved" | "rejected";
  }>({
    claimDecision: "approved",
    decisionNotes: "",
    status: "approved",
  });

  const {
    data: claims = [],
    isLoading,
    isError,
    error: loadError,
  } = useQuery<WarrantyClaimData[]>({
    queryKey: ["warranty-claims"],
    queryFn: async () => {
      const res = await api.get<WarrantyClaimData[]>("/warranty-claims");
      return res.data;
    },
  });

  const jobsLookupQuery = useQuery({
    queryKey: ["jobs", "warranty-lookup"],
    queryFn: () =>
      api.listJobs({
        completedScope: "all",
        limit: 200,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    staleTime: 60_000,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["warranty-claims"] });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: () => api.listCustomersOptions(),
    enabled: createOpen,
    staleTime: 60_000,
  });

  const equipmentQuery = useQuery({
    queryKey: ["equipment", "options", form.customerId],
    queryFn: () => api.listEquipmentOptions({ customerId: form.customerId }),
    enabled: createOpen && Boolean(form.customerId),
    staleTime: 60_000,
  });

  const serviceRequestsQuery = useQuery({
    queryKey: ["service-requests", "warranty-link", form.customerId, form.equipmentId],
    queryFn: () =>
      api.listServiceRequests({
        customerId: form.customerId,
        equipmentId: form.equipmentId,
        completedScope: "all",
        limit: 100,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    enabled: createOpen && Boolean(form.customerId) && Boolean(form.equipmentId),
    staleTime: 30_000,
  });

  const jobsQuery = useQuery({
    queryKey: ["jobs", "warranty-link", form.customerId],
    queryFn: () =>
      api.listJobs({
        customerId: form.customerId,
        completedScope: "all",
        limit: 100,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    enabled: createOpen && Boolean(form.customerId),
    staleTime: 30_000,
  });

  const customers = customersQuery.data ?? [];
  const equipmentOptions = equipmentQuery.data ?? [];
  const linkedTickets = serviceRequestsQuery.data?.data ?? [];
  const linkedJobs = (jobsQuery.data?.data ?? []).filter((job) =>
    form.equipmentId ? job.equipmentId === form.equipmentId : true,
  );
  const selectedEquipment = equipmentOptions.find((e) => e.id === form.equipmentId);
  const originalJobLabel = (jobId?: string | null) => {
    if (!jobId) return null;
    const fromDialog = (jobsQuery.data?.data ?? []).find((item) => item.id === jobId);
    const fromList = (jobsLookupQuery.data?.data ?? []).find((item) => item.id === jobId);
    return fromDialog?.reference ?? fromList?.reference ?? jobId;
  };

  const handleCreate = async () => {
    if (!form.customerId.trim()) {
      toast.error("Select a customer");
      return;
    }
    if (!form.equipmentId.trim()) {
      toast.error("Select equipment");
      return;
    }
    try {
      await api.post("/warranty-claims", {
        equipmentId: form.equipmentId.trim(),
        equipmentName: form.equipmentName.trim(),
        customerId: form.customerId.trim(),
        customerName: form.customerName.trim(),
        serviceRequestId: form.serviceRequestId.trim() || null,
        originalJobId: form.originalJobId.trim() || null,
        underWarranty: form.underWarranty,
        isPhysicalDamage: form.isPhysicalDamage,
        componentCovered: form.componentCovered,
        inspectorNotes: form.inspectorNotes.trim() || null,
      });
      toast.success("Warranty claim logged successfully");
      setCreateOpen(false);
      setForm({ ...EMPTY_CREATE_FORM });
      refetch();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to log claim" });
    }
  };

  const handleDecide = async () => {
    if (!selectedClaim) return;
    try {
      await api.post(`/warranty-claims/${selectedClaim.id}/decide`, decisionForm);
      toast.success("Warranty claim decision submitted");
      setDecideOpen(false);
      refetch();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to record decision" });
    }
  };

  const filtered = claims.filter((c) => {
    const matchSearch =
      !search ||
      c.reference.toLowerCase().includes(search.toLowerCase()) ||
      c.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: claims.length,
    pending: claims.filter((c) => c.status === "pending").length,
    approved: claims.filter((c) => c.status === "approved").length,
    rejected: claims.filter((c) => c.status === "rejected").length,
  };

  return (
    <RoleGuard roles={["admin", "coordinator", "inspector", "estimator", "sales", "billing", "engineer", "qa"]}>
      <div className="space-y-5">
        <PageHeader
          title="Warranty Claims"
          subtitle="Manage warranty eligibility, physical damage assessments, and claim approvals"
          icon={<ShieldAlert className="h-6 w-6" />}
          actions={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Submit Warranty Claim
              </Button>
            ) : undefined
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Claims</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending Decision</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-green-600">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="pt-4 pb-3">
              <p className="text-2xl font-bold tabular-nums text-red-600">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by equipment, customer, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Claim Cards List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <Card className="border-destructive/40">
            <CardContent className="py-12 text-center space-y-3">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive/70" />
              <p className="font-medium text-foreground">Could not load warranty claims</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {loadError instanceof Error
                  ? loadError.message
                  : "The server rejected the request. Pending database migrations are a common cause."}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No warranty claims found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <Card key={c.id} className="border-border">
                <CardContent className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{c.reference}</span>
                        <Badge
                          variant={
                            c.status === "approved"
                              ? "default"
                              : c.status === "rejected"
                                ? "destructive"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {c.status}
                        </Badge>
                        {c.isPhysicalDamage && (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <AlertTriangle className="h-3 w-3" /> Physical Damage
                          </Badge>
                        )}
                      </div>
                      <p className="font-semibold text-base mt-1">{c.equipmentName}</p>
                      <p className="text-xs text-muted-foreground">Customer: <span className="text-foreground font-medium">{c.customerName}</span></p>
                      {c.originalJobId ? (
                        <p className="text-xs text-muted-foreground">
                          Original job: <span className="text-foreground font-medium">{originalJobLabel(c.originalJobId)}</span>
                        </p>
                      ) : null}
                      {c.inspectorNotes && (
                        <p className="text-xs text-muted-foreground mt-2 italic bg-muted/30 p-2 rounded">
                          Inspector Notes: "{c.inspectorNotes}"
                        </p>
                      )}
                      {c.decisionNotes && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                          Decision Notes ({c.claimDecision}): {c.decisionNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-xs text-muted-foreground text-right space-y-0.5">
                        <p>Under Warranty: {c.underWarranty ? "Yes" : "Expired"}</p>
                        <p>Part Covered: {c.componentCovered ? "Yes" : "No"}</p>
                        <p>Logged: {formatDate(c.createdAt)}</p>
                      </div>

                      {canManage && c.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedClaim(c);
                            setDecisionForm({
                              claimDecision: "approved",
                              decisionNotes: "",
                              status: "approved",
                            });
                            setDecideOpen(true);
                          }}
                        >
                          Review & Decide
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Claim Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Submit New Warranty Claim
              </DialogTitle>
              <DialogDescription>
                Record equipment issue for warranty verification.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <Label>Customer <span className="text-destructive">*</span></Label>
                <Select
                  value={form.customerId || undefined}
                  onValueChange={(customerId) => {
                    const customer = customers.find((c) => c.id === customerId);
                    setForm((p) => ({
                      ...p,
                      customerId,
                      customerName: customer?.name ?? "",
                      equipmentId: "",
                      equipmentName: "",
                      serviceRequestId: "",
                      originalJobId: "",
                      underWarranty: false,
                    }));
                  }}
                >
                  <SelectTrigger>
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
              </div>

              <div className="space-y-1">
                <Label>Equipment <span className="text-destructive">*</span></Label>
                <Select
                  value={form.equipmentId || undefined}
                  disabled={!form.customerId}
                  onValueChange={(equipmentId) => {
                    const item = equipmentOptions.find((e) => e.id === equipmentId);
                    if (!item) return;
                    setForm((p) => ({
                      ...p,
                      equipmentId,
                      equipmentName: equipmentDisplayName(item),
                      customerName: item.customerName?.trim() || p.customerName,
                      serviceRequestId: "",
                      originalJobId: "",
                      underWarranty: isEquipmentUnderActiveWarranty(item),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.customerId ? "Select equipment" : "Select a customer first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {equipmentSelectLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!form.customerId ? (
                  <p className="text-xs text-muted-foreground">Choose the customer who owns the asset.</p>
                ) : equipmentQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading equipment…</p>
                ) : equipmentOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No registered equipment for this customer.</p>
                ) : selectedEquipment ? (
                  <p className="text-xs text-muted-foreground">
                    Machine warranty: {formatMachineWarrantyLabel(selectedEquipment)} · Service warranty:{" "}
                    {formatServiceWarrantyLabel(selectedEquipment)}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Linked service ticket (optional)</Label>
                <Select
                  value={form.serviceRequestId || NO_LINKED_TICKET}
                  disabled={!form.equipmentId}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      serviceRequestId: value === NO_LINKED_TICKET ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.equipmentId ? "Select a ticket" : "Select customer and equipment first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LINKED_TICKET}>No linked ticket</SelectItem>
                    {linkedTickets.map((ticket) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        {ticket.reference} · {formatServiceStatus(ticket.status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.equipmentId && serviceRequestsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading service tickets…</p>
                ) : form.equipmentId && linkedTickets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No service tickets found for this customer and equipment.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Original service job (optional)</Label>
                <Select
                  value={form.originalJobId || NO_LINKED_JOB}
                  disabled={!form.equipmentId}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      originalJobId: value === NO_LINKED_JOB ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.equipmentId ? "Select original job" : "Select customer and equipment first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LINKED_JOB}>No original job</SelectItem>
                    {linkedJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.reference} · {job.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.equipmentId && jobsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading jobs…</p>
                ) : form.equipmentId && linkedJobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No service jobs found for this customer and equipment.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Inspection & Eligibility Checklist</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.underWarranty}
                      onCheckedChange={(c) => setForm((p) => ({ ...p, underWarranty: !!c }))}
                    />
                    <span>Equipment is within active manufacturer/service warranty period</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-amber-600 font-medium">
                    <Checkbox
                      checked={form.isPhysicalDamage}
                      onCheckedChange={(c) => setForm((p) => ({ ...p, isPhysicalDamage: !!c }))}
                    />
                    <span>Has user physical damage / liquid ingress (may invalidate warranty)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.componentCovered}
                      onCheckedChange={(c) => setForm((p) => ({ ...p, componentCovered: !!c }))}
                    />
                    <span>Failed component is covered under warranty clause</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Inspector Remarks / Problem Summary</Label>
                <Textarea
                  placeholder="Describe failure mode, error code..."
                  value={form.inspectorNotes}
                  onChange={(e) => setForm((p) => ({ ...p, inspectorNotes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Submit Claim</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decide Claim Dialog */}
        <Dialog open={decideOpen} onOpenChange={setDecideOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Review Claim #{selectedClaim?.reference}</DialogTitle>
              <DialogDescription>
                Decide warranty coverage for {selectedClaim?.equipmentName}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <Label>Claim Decision</Label>
                <Select
                  value={decisionForm.claimDecision}
                  onValueChange={(v) => {
                    const dec = v as "approved" | "rejected" | "partial";
                    setDecisionForm((p) => ({
                      ...p,
                      claimDecision: dec,
                      status: dec === "rejected" ? "rejected" : "approved",
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve Claim (FOC Repair/Replacement)</SelectItem>
                    <SelectItem value="partial">Partial Coverage (Customer pays labor/shipping)</SelectItem>
                    <SelectItem value="rejected">Reject Claim (Chargeable Repair)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Decision Rationale / Notes</Label>
                <Textarea
                  placeholder="Reason for approval or rejection..."
                  value={decisionForm.decisionNotes}
                  onChange={(e) => setDecisionForm((p) => ({ ...p, decisionNotes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDecideOpen(false)}>Cancel</Button>
              <Button onClick={handleDecide}>Confirm Decision</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}
