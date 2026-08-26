import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Eye, FilePenLine, MoreHorizontal, ShoppingCart } from "lucide-react";
import { EstimateDecisionPanel } from "@/components/estimates/EstimateDecisionPanel";
import { EstimateItemsTable } from "@/components/estimates/EstimateItemsTable";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFormValidation } from "@/hooks/useFormValidation";
import { fieldRules, type FieldErrors } from "@/lib/formValidation";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api, type BackendEstimate, type BackendUser, type EstimateLineInput } from "@/lib/api";
import {
  canEditEstimate,
  estimateStatusLabel,
  isEstimatePendingDecision,
} from "@/lib/estimates";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";

const decisionSchema = z.object({
  decisionNote: fieldRules.optionalString(),
  engineerId: fieldRules.optionalString(),
});

export default function EstimateDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [engineers, setEngineers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [saving, setSaving] = useState(false);
  const tab = searchParams.get("tab") ?? "overview";
  const decisionRef = useRef<HTMLDivElement>(null);
  const {
    errors,
    shouldShow,
    validateAll,
    handleBlur,
    handleChange,
    applyApiErrors,
    reset: resetValidation,
  } = useFormValidation({
    fieldOrder: ["engineerId", "decisionNote"],
    schema: decisionSchema,
  });
  const canApprove = hasRole(["admin", "coordinator"]);
  const canBuild = hasRole(["admin", "coordinator", "estimator"]);
  const isSalesQuote = Boolean(estimate && !estimate.serviceRequestId);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, users] = await Promise.all([
        api.getEstimate(id),
        api.listUsers({ role: "engineer", isActive: true }).catch(() => [] as BackendUser[]),
      ]);
      setEstimate(record);
      setEngineers(users);
    } catch (err) {
      setEstimate(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Unable to load this estimate. Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load estimate" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: "approved" | "rejected" | "revision") => {
    if (!estimate) return;
    const values = { decisionNote, engineerId };
    const extraErrors: FieldErrors = {};
    if (action === "approved" && canApprove && !engineerId && estimate.serviceRequestId) {
      extraErrors.engineerId = "Select a service engineer to assign the job.";
    }
    if (!validateAll(values, extraErrors, decisionRef.current)) return;

    setSaving(true);
    try {
      await api.decideEstimate(estimate.id, action, decisionNote || undefined, {
        engineerId: action === "approved" ? engineerId : undefined,
      });
      setDecisionNote("");
      setEngineerId("");
      resetValidation();
      toast({ title: action === "approved" ? "Estimate approved" : action === "revision" ? "Revision requested" : "Estimate rejected" });
      await load();
    } catch (err) {
      if (!applyApiErrors(err, decisionRef.current)) {
        toast.apiError(err, { fallback: "Workflow update failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const convertToOrder = async () => {
    if (!estimate) return;
    setSaving(true);
    try {
      const order = await api.convertSalesQuote(estimate.id);
      toast({ title: "Sales order created", description: order.reference });
      navigate(`/app/sales/orders/${order.id}`);
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to convert quotation" });
    } finally {
      setSaving(false);
    }
  };

  const canDecide = Boolean(estimate && isEstimatePendingDecision(estimate.status));
  const viewLines: EstimateLineInput[] = (estimate?.lineItems ?? []).map((line) => ({
    type: line.type as EstimateLineInput["type"],
    description: line.description,
    catalogItemId: line.catalogItemId,
    inventoryItemId: line.inventoryItemId,
    partNumber: line.partNumber,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
    taxRate: Number(line.taxRate),
    discount: Number(line.discount),
  }));

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator", "billing", "inspector", "engineer"]}>
      <RecordDetailLayout
        backTo="/app/estimates"
        backLabel="Estimates"
        title={estimate?.reference ?? "Estimate"}
        subtitle={estimate ? `${estimate.customerName} · ${estimate.equipmentName}` : undefined}
        status={estimate?.status}
        statusLabel={estimate ? estimateStatusLabel(estimate.status) : undefined}
        meta={estimate ? [
          { label: "Ticket", value: estimate.requestRef },
          { label: "Revision", value: String(estimate.revision) },
          { label: "Created", value: formatDate(estimate.createdAt) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !estimate}
        notFoundTitle="Estimate not found"
        notFoundDescription="The requested estimate could not be found."
        onRetry={() => void load()}
        actions={estimate ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to={`/app/estimates/${estimate.id}/preview`}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Link>
            </Button>
            {canBuild && isSalesQuote && canEditEstimate(estimate.status) ? (
              <Button variant="outline" asChild>
                <Link to={`/app/estimates/new?customerId=${estimate.customerId ?? ""}`}>
                  <FilePenLine className="mr-1 h-4 w-4" /> Edit quotation
                </Link>
              </Button>
            ) : null}
            {canBuild && isSalesQuote && estimate.status === "approved" ? (
              <Button variant="brand" disabled={saving} onClick={() => void convertToOrder()}>
                <ShoppingCart className="mr-1 h-4 w-4" /> Convert to sales order
              </Button>
            ) : null}
            {canBuild && estimate.serviceRequestId && canEditEstimate(estimate.status) ? (
              <Button variant="outline" asChild>
                <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>
                  <FilePenLine className="mr-1 h-4 w-4" /> Edit Estimate
                </Link>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {estimate.serviceRequestId ? (
                  <DropdownMenuItem asChild>
                    <Link to={`/app/service-tickets/${estimate.serviceRequestId}`}>Open ticket</Link>
                  </DropdownMenuItem>
                ) : null}
                {canBuild && estimate.serviceRequestId ? (
                  <DropdownMenuItem asChild>
                    <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>Open builder</Link>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : undefined}
        activeTab={tab}
        onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
        tabs={estimate ? [
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-4">
                <DetailSection title="Estimate information">
                  <DetailInfoGrid
                    items={[
                      { label: "Ticket", value: estimate.serviceRequestId ? (
                        <Link className="text-primary hover:underline normal-case" to={`/app/service-tickets/${estimate.serviceRequestId}`}>{estimate.requestRef}</Link>
                      ) : estimate.requestRef },
                      { label: "Customer", value: estimate.customerName },
                      { label: "Equipment", value: estimate.equipmentName },
                      { label: "Revision", value: String(estimate.revision) },
                      { label: "Valid until", value: formatDate(estimate.validUntil) },
                    ]}
                  />
                </DetailSection>
                <DetailSection title="Financial summary">
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Labor</dt><dd className="font-medium">{formatCurrency(estimate.laborCost)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Parts</dt><dd className="font-medium">{formatCurrency(estimate.partsCost)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium">{formatCurrency(estimate.subtotal ?? 0)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Discount</dt><dd className="font-medium">{formatCurrency(estimate.discount ?? 0)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Tax</dt><dd className="font-medium">{formatCurrency(estimate.tax ?? 0)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Total</dt><dd className="text-base font-semibold">{formatCurrency(estimate.total)}</dd></div>
                  </dl>
                </DetailSection>
                {estimate.notes ? (
                  <DetailSection title="Notes">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{estimate.notes}</p>
                  </DetailSection>
                ) : null}
                {estimate.terms ? (
                  <DetailSection title="Terms & Conditions">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{estimate.terms}</p>
                  </DetailSection>
                ) : null}
              </div>
            ),
          },
          {
            id: "lines",
            label: "Line items",
            content: <EstimateItemsTable mode="view" lines={viewLines} />,
          },
          {
            id: "activity",
            label: "Activity",
            content: (
              <DetailSection title="Activity">
                <ActivityTimeline
                  items={[
                    ...(estimate.decisions ?? []).map((d) => ({
                      id: d.id,
                      title: d.decision.replace(/_/g, " "),
                      detail: d.note,
                      meta: `${formatDateTime(d.createdAt)} · ${d.actorRole}`,
                    })),
                    ...(estimate.revisions ?? []).map((r) => ({
                      id: r.id,
                      title: `Revision ${r.revision} created`,
                      detail: r.notes,
                      meta: formatDateTime(r.createdAt),
                    })),
                  ]}
                  emptyMessage="No activity recorded yet."
                />
              </DetailSection>
            ),
          },
        ] : undefined}
        sidebar={estimate && canApprove ? (
          <div ref={decisionRef}>
            <EstimateDecisionPanel
              status={estimate.status}
              canDecide={canDecide}
              canApprove={canApprove}
              engineers={engineers}
              engineerId={engineerId}
              decisionNote={decisionNote}
              saving={saving}
              errors={errors}
              shouldShow={shouldShow}
              onEngineerChange={(value) => {
                setEngineerId(value);
                handleChange("engineerId", { engineerId: value, decisionNote });
              }}
              onNoteChange={(value) => {
                setDecisionNote(value);
                handleChange("decisionNote", { decisionNote: value, engineerId });
              }}
              onNoteBlur={() => handleBlur("decisionNote", { decisionNote, engineerId })}
              onApprove={() => void act("approved")}
              onRevision={() => void act("revision")}
              onReject={() => void act("rejected")}
              requireEngineer={!isSalesQuote}
            />
          </div>
        ) : undefined}
      />
    </RoleGuard>
  );
}
