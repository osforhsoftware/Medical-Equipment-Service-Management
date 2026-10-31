import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  Download,
  Eye,
  FilePenLine,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  PackageX,
  Printer,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { EstimateDecisionPanel } from "@/components/estimates/EstimateDecisionPanel";
import { EstimateItemsTable } from "@/components/estimates/EstimateItemsTable";
import { ReturnWithoutRepairDialog, type ReturnWithoutRepairData } from "@/components/estimates/ReturnWithoutRepairDialog";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ESTIMATE_READ_ROLES, ESTIMATE_WRITE_ROLES, SALES_WRITE_ROLES } from "@/config/roles";
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
import {
  ApiError,
  api,
  type BackendCustomer,
  type BackendEstimate,
  type BackendUser,
  type EstimateLineInput,
} from "@/lib/api";
import { shareEstimate, type EstimateShareChannel } from "@/lib/estimateShare";
import {
  canEditEstimate,
  estimateLevelDiscount,
  estimateStatusLabel,
  isEstimatePendingDecision,
  totalsForEstimate,
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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const [estimate, setEstimate] = useState<BackendEstimate | null>(null);
  const [customer, setCustomer] = useState<BackendCustomer | null>(null);
  const [engineers, setEngineers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [engineerId, setEngineerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState<EstimateShareChannel | null>(null);
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
  const canBuild = hasRole(ESTIMATE_WRITE_ROLES);
  const canSell = hasRole(SALES_WRITE_ROLES);
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
      setCustomer(null);
      if (record.customerId) {
        try {
          setCustomer(await api.getCustomer(record.customerId));
        } catch {
          setCustomer(null);
        }
      }
    } catch (err) {
      setEstimate(null);
      setCustomer(null);
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

  useEffect(() => {
    if (estimate && !estimate.serviceRequestId) {
      navigate(`/app/sales/quotations/${estimate.id}`, { replace: true });
    }
  }, [estimate, navigate]);

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
      if (action === "rejected" && estimate.serviceRequestId) {
        // Service-ticket estimates go through the ticket workflow reject action.
        await api.rejectTicketEstimate(estimate.serviceRequestId, {
          estimateId: estimate.id,
          reason: decisionNote.trim() || "Estimate rejected",
          target: "estimate",
        });
      } else {
        await api.decideEstimate(estimate.id, action, decisionNote || undefined, {
          engineerId: action === "approved" ? engineerId : undefined,
        });
      }
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

  const handleReturnWithoutRepair = async (data: ReturnWithoutRepairData) => {
    if (!estimate) return;
    setReturnSaving(true);
    try {
      // Record return details as a decision note on the estimate
      const note = `RETURN WITHOUT REPAIR: ${data.returnReason} | Handed by: ${data.handedBy} on ${data.returnDate} | Customer acknowledged: ${data.customerAcknowledged ? "Yes" : "No"}`;
      await api.decideEstimate(estimate.id, "rejected", note);
      if (estimate.serviceRequestId) {
        await api.cancelServiceTicket(estimate.serviceRequestId, note);
      }
      toast.success("Return without repair recorded", { description: `Handed back by ${data.handedBy} on ${data.returnDate}` });
      setReturnOpen(false);
      await load();
    } catch (err) {
      toast.apiError(err, { fallback: "Failed to record return" });
    } finally {
      setReturnSaving(false);
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
  const financials = estimate ? totalsForEstimate(estimate) : null;

  const downloadPdf = async () => {
    if (!estimate) return;
    setPdfBusy(true);
    try {
      const doc = await api.generateDocument("estimate", estimate.id);
      if (doc.file?.id) {
        window.open(api.fileDownloadUrl(doc.file.id), "_blank");
        toast({ title: "PDF ready", description: "Estimate PDF opened in a new tab." });
      }
    } catch (err) {
      toast.apiError(err, { fallback: "Unable to generate PDF" });
    } finally {
      setPdfBusy(false);
    }
  };

  const sendEstimate = async (channel: EstimateShareChannel) => {
    if (!estimate) return;
    setShareBusy(channel);
    try {
      const result = await shareEstimate({ channel, estimate, customer });
      if (!result.opened && !result.sharedNatively && !result.downloaded) {
        return;
      }
      toast.success(channel === "whatsapp" ? "WhatsApp opened" : "Gmail/Email opened", {
        description: result.sharedNatively
          ? "Native share was used when available. Otherwise attach the downloaded PDF."
          : "PDF downloaded — attach it in the message window that opened.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send estimate";
      toast.error(message);
    } finally {
      setShareBusy(null);
    }
  };

  return (
    <RoleGuard roles={ESTIMATE_READ_ROLES}>
      <RecordDetailLayout
        backTo="/app/estimates"
        backLabel="Estimates"
        title={estimate?.reference ?? "Estimate"}
        subtitle={estimate ? `${estimate.customerName} · ${estimate.equipmentName}` : undefined}
        status={estimate?.status}
        statusLabel={estimate ? estimateStatusLabel(estimate.status) : undefined}
        meta={estimate ? [
          { label: "Quotation", value: estimate.reference },
          { label: "Revision", value: `Rev ${estimate.revision}` },
          { label: "Created", value: formatDate(estimate.createdAt) },
          ...(estimate.sentAt ? [{ label: "Sent", value: formatDate(estimate.sentAt) }] : []),
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !estimate}
        notFoundTitle="Estimate not found"
        notFoundDescription="The requested estimate could not be found."
        onRetry={() => void load()}
        actions={estimate ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/app/estimates/${estimate.id}/preview?print=1`}>
                <Printer className="mr-1 h-4 w-4" /> Print
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pdfBusy || Boolean(shareBusy)}
              onClick={() => void downloadPdf()}
            >
              {pdfBusy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(shareBusy) || pdfBusy}
              onClick={() => void sendEstimate("whatsapp")}
              className="gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              {shareBusy === "whatsapp" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="mr-1 h-4 w-4" />
              )}
              WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={Boolean(shareBusy) || pdfBusy}
              onClick={() => void sendEstimate("email")}
              className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {shareBusy === "email" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-1 h-4 w-4" />
              )}
              Gmail
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/app/estimates/${estimate.id}/preview`}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Link>
            </Button>
            {canSell && isSalesQuote && canEditEstimate(estimate.status) ? (
              <Button variant="outline" asChild>
                <Link to={`/app/estimates/new?customerId=${estimate.customerId ?? ""}`}>
                  <FilePenLine className="mr-1 h-4 w-4" /> Edit quotation
                </Link>
              </Button>
            ) : null}
            {canSell && isSalesQuote && estimate.status === "approved" ? (
              <Button variant="brand" disabled={saving} onClick={() => void convertToOrder()}>
                <ShoppingCart className="mr-1 h-4 w-4" /> Convert to sales order
              </Button>
            ) : null}
            {canApprove && estimate.status === "rejected" && estimate.serviceRequestId ? (
              <Button
                variant="outline"
                className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => setReturnOpen(true)}
              >
                <PackageX className="mr-1 h-4 w-4" /> Return Without Repair
              </Button>
            ) : null}
            {canBuild && estimate.serviceRequestId && canEditEstimate(estimate.status) ? (
              <Button variant="outline" asChild>
                <Link to={`/app/estimates/${estimate.serviceRequestId}/build`}>
                  <FilePenLine className="mr-1 h-4 w-4" /> Edit Estimate
                </Link>
              </Button>
            ) : null}
            {canBuild && canEditEstimate(estimate.status) ? (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={saving}
                onClick={() => {
                  if (!window.confirm(`Delete estimate ${estimate.reference}? This cannot be undone.`)) return;
                  setSaving(true);
                  void api.deleteEstimate(estimate.id)
                    .then(() => {
                      toast({ title: "Estimate deleted" });
                      navigate("/app/estimates");
                    })
                    .catch((err) => toast.apiError(err, { fallback: "Unable to delete estimate" }))
                    .finally(() => setSaving(false));
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
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
                      { label: "Revision", value: `Rev ${estimate.revision}` },
                      { label: "Currency", value: estimate.currency || "INR" },
                      { label: "Valid until", value: formatDate(estimate.validUntil) },
                      { label: "Est. completion", value: estimate.estimatedCompletion ? formatDate(estimate.estimatedCompletion) : "—" },
                      { label: "Warranty", value: estimate.warranty || "—" },
                      { label: "Prepared by", value: estimate.preparedBy || "—" },
                      { label: "Created", value: formatDate(estimate.createdAt) },
                      { label: "Sent", value: estimate.sentAt ? formatDate(estimate.sentAt) : "—" },
                      { label: "Approval status", value: estimateStatusLabel(estimate.status) },
                    ]}
                  />
                </DetailSection>
                <DetailSection title="Financial summary">
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Labor</dt><dd className="font-medium">{formatCurrency(estimate.laborCost)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Parts</dt><dd className="font-medium">{formatCurrency(estimate.partsCost)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium">{formatCurrency(financials?.subtotal ?? 0)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Discount</dt><dd className="font-medium">{formatCurrency(financials?.discount ?? 0)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Tax</dt><dd className="font-medium">{formatCurrency(financials?.tax ?? 0)}</dd></div>
                    <div className="flex justify-between sm:block"><dt className="text-muted-foreground">Total</dt><dd className="text-base font-semibold">{formatCurrency(financials?.total ?? 0)}</dd></div>
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
            content: (
              <EstimateItemsTable
                mode="view"
                lines={viewLines}
                showCustomizeItems
                customerSummary={estimate.customerSummary ?? ""}
                headerDiscount={estimateLevelDiscount(estimate)}
                total={financials?.total}
              />
            ),
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

      {/* Return Without Repair Dialog */}
      {estimate && (
        <ReturnWithoutRepairDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          customerName={estimate.customerName ?? ""}
          equipmentName={estimate.equipmentName ?? ""}
          onConfirm={(data) => handleReturnWithoutRepair(data)}
          saving={returnSaving}
        />
      )}
    </RoleGuard>
  );
}
