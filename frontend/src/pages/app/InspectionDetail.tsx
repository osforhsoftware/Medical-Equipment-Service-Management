import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FilePenLine, FileText } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { InspectionReportPanel } from "@/components/inspections/InspectionReportPanel";
import { splitInspectionFindings, useInspectionReportEditor } from "@/components/inspections/useInspectionReportEditor";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { PhotoCaptionTile } from "@/components/shared/PhotoCaptionTile";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, type BackendInspectionReport, type BackendServiceRequest, type BackendTimelineEvent } from "@/lib/api";
import { formatFixedOption, SERVICE_TYPE_OPTIONS } from "@/lib/fixedOptions";
import { formatCurrency, formatDate, formatDateTime, formatServiceStatus } from "@/lib/format";
import { toast } from "@/lib/toast";

function equipmentLabel(request: BackendServiceRequest) {
  if (request.equipmentItems?.length) {
    return request.equipmentItems.map((e) => e.equipmentName).join(" · ");
  }
  return request.equipmentName ?? "No equipment";
}

export default function InspectionDetail() {
  const { id = "" } = useParams();
  const [request, setRequest] = useState<BackendServiceRequest | null>(null);
  const [report, setReport] = useState<BackendInspectionReport | null>(null);
  const [timeline, setTimeline] = useState<BackendTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [record, inspection, events] = await Promise.all([
        api.getServiceRequest(id),
        api.getInspectionReport(id).catch(() => null),
        api.getServiceRequestTimeline(id).catch(() => [] as BackendTimelineEvent[]),
      ]);
      setRequest(record);
      setReport(inspection ?? record.inspectionReport);
      setTimeline(events);
    } catch (err) {
      setRequest(null);
      setReport(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load inspection details" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const editor = useInspectionReportEditor(load);
  const split = splitInspectionFindings(report?.findings ?? "");
  const canInspect = Boolean(request) && ["new", "inspection", "estimate"].includes(request!.status);
  const inspectLabel = report ? "Update report" : "Conduct inspection";

  return (
    <RoleGuard roles={["admin", "coordinator", "inspector"]}>
      <RecordDetailLayout
        backTo="/app/inspections"
        backLabel="Back to inspections"
        title={request?.reference ?? "Inspection"}
        subtitle={request ? `${equipmentLabel(request)} · ${request.customerName}` : undefined}
        status={request?.status}
        meta={request ? [
          { label: "Priority", value: request.priority },
          { label: "Assigned", value: request.assignedName ?? "Unassigned" },
          { label: "SLA due", value: formatDate(request.slaDue) },
        ] : undefined}
        loading={loading}
        error={error}
        notFound={!loading && !error && !request}
        notFoundTitle="Inspection not found"
        notFoundDescription="This inspection ticket could not be found."
        onRetry={() => void load()}
        actions={request ? (
          <div className="flex flex-wrap items-center gap-2">
            {report ? (
              <Button variant="outline" asChild>
                <Link to={`/app/inspections/${request.id}/report`}>
                  <FileText className="mr-1.5 h-4 w-4" />
                  Full report
                </Link>
              </Button>
            ) : null}
            {canInspect ? (
              <Button variant="brand" onClick={() => void editor.startInspection(request)}>
                <FilePenLine className="mr-1.5 h-4 w-4" />
                {inspectLabel}
              </Button>
            ) : null}
          </div>
        ) : undefined}
        sidebar={request ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Related</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link to={`/app/service-tickets/${request.id}`}>Open service ticket</Link>
              </Button>
              {request.customerId ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/app/customers/${request.customerId}`}>View customer</Link>
                </Button>
              ) : null}
              {request.status === "estimate" || request.status === "approval" || request.status === "pending_approval" ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/app/estimates/${request.id}/build`}>Open estimate builder</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : undefined}
      >
        {request ? (
          <div className="space-y-4">
            <DetailSection title="Ticket details">
              <DetailInfoGrid
                items={[
                  { label: "Type", value: formatFixedOption(SERVICE_TYPE_OPTIONS, request.type, request.typeOther) },
                  { label: "Priority", value: request.priority },
                  { label: "Status", value: formatServiceStatus(request.status) },
                  { label: "Created by", value: request.createdBy },
                  { label: "Assigned to", value: request.assignedName ?? "Unassigned" },
                  { label: "Created", value: formatDateTime(request.createdAt) },
                  { label: "Updated", value: formatDateTime(request.updatedAt) },
                  { label: "SLA due", value: formatDate(request.slaDue) },
                  {
                    label: "Customer",
                    value: request.customerId ? (
                      <Link className="text-primary hover:underline normal-case" to={`/app/customers/${request.customerId}`}>
                        {request.customerName}
                      </Link>
                    ) : request.customerName,
                  },
                ]}
              />
            </DetailSection>

            {request.equipmentItems?.length ? (
              <DetailSection title={`Equipment (${request.equipmentItems.length})`}>
                <div className="flex flex-wrap gap-1.5">
                  {request.equipmentItems.map((item) => (
                    <Badge key={item.id} variant="secondary" className="text-xs">
                      {item.equipmentId ? (
                        <Link to={`/app/equipment/${item.equipmentId}`}>{item.equipmentName}</Link>
                      ) : (
                        item.equipmentName
                      )}
                    </Badge>
                  ))}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection title="Request description">
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                {request.description || "No description provided."}
              </p>
            </DetailSection>

            {report ? (
              <>
                <DetailSection title="Inspection report">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <StatusBadge status={report.severity} />
                    <span className="text-sm text-muted-foreground">
                      Filed by {report.reportedBy} · {formatDateTime(report.reportedAt)}
                      {report.submittedAt ? ` · Submitted ${formatDateTime(report.submittedAt)}` : " · Draft"}
                      {report.version ? ` · v${report.version}` : ""}
                    </span>
                  </div>
                  <DetailInfoGrid
                    items={[
                      { label: "Severity", value: report.severity },
                      { label: "Reported by", value: report.reportedBy },
                      { label: "Reported at", value: formatDateTime(report.reportedAt) },
                      { label: "Submitted at", value: report.submittedAt ? formatDateTime(report.submittedAt) : "Not submitted" },
                    ]}
                  />
                </DetailSection>

                <DetailSection title="Findings & observations">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {split.findings.trim() || "No findings recorded."}
                  </p>
                </DetailSection>

                {split.workDetails.trim() ? (
                  <DetailSection title="Work details">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{split.workDetails}</p>
                  </DetailSection>
                ) : null}

                <DetailSection title="Recommendation">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {report.recommendation.trim() || "No recommendation recorded."}
                  </p>
                </DetailSection>

                {report.attachments?.length ? (
                  <DetailSection title={`Photos (${report.attachments.length})`}>
                    <div className="flex flex-wrap gap-3">
                      {report.attachments.map((att) => (
                        <PhotoCaptionTile
                          key={att.id}
                          src={api.fileDownloadUrl(att.fileId)}
                          alt={att.file?.originalName ?? att.caption ?? "Inspection image"}
                          caption={att.caption ?? ""}
                          href={api.fileDownloadUrl(att.fileId)}
                          readOnly
                          className="w-32 sm:w-36"
                        />
                      ))}
                    </div>
                  </DetailSection>
                ) : null}

                {report.recommendations?.length ? (
                  <DetailSection title="Recommended parts & work">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="pb-2 pr-3 font-medium">Item</th>
                            <th className="pb-2 pr-3 font-medium">Type</th>
                            <th className="pb-2 pr-3 font-medium">Qty</th>
                            <th className="pb-2 pr-3 font-medium">Priority</th>
                            <th className="pb-2 font-medium">Est. cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.recommendations.map((item) => (
                            <tr key={item.id} className="border-b border-border/60 last:border-0">
                              <td className="py-2.5 pr-3">
                                <p className="font-medium">{item.title}</p>
                                {item.description ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                                ) : null}
                              </td>
                              <td className="py-2.5 pr-3 capitalize">{item.type}</td>
                              <td className="py-2.5 pr-3">{item.quantity}</td>
                              <td className="py-2.5 pr-3">
                                <StatusBadge status={item.priority} className="text-[10px]" />
                              </td>
                              <td className="py-2.5">{formatCurrency(item.estimatedCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </DetailSection>
                ) : null}
              </>
            ) : (
              <DetailSection title="Inspection report">
                <p className="text-sm text-muted-foreground">No inspection report has been filed yet.</p>
                {canInspect ? (
                  <Button className="mt-3" variant="brand" onClick={() => void editor.startInspection(request)}>
                    <FilePenLine className="mr-1.5 h-4 w-4" />
                    Conduct inspection
                  </Button>
                ) : null}
              </DetailSection>
            )}

            <DetailSection title="Activity">
              <ActivityTimeline
                items={timeline.map((event) => ({
                  id: event.id,
                  title: event.action,
                  detail: event.note,
                  meta: `${event.actor} · ${formatDateTime(event.at)}`,
                }))}
                emptyMessage="No activity recorded for this inspection yet."
              />
            </DetailSection>
          </div>
        ) : null}
      </RecordDetailLayout>

      <InspectionReportPanel
        open={!!editor.active}
        onClose={editor.closePanel}
        active={editor.active}
        existingReport={editor.existingReport}
        loadingReport={editor.loadingReport}
        saving={editor.saving}
        onSubmit={() => void editor.submitReport()}
        findings={editor.findings}
        setFindings={editor.setFindings}
        recommendation={editor.recommendation}
        setRecommendation={editor.setRecommendation}
        workDetails={editor.workDetails}
        setWorkDetails={editor.setWorkDetails}
        severity={editor.severity}
        setSeverity={editor.setSeverity}
        machineImages={editor.machineImages}
        setMachineImages={editor.setMachineImages}
        setMachineImage={editor.setMachineImage}
        imageCaptions={editor.imageCaptions}
        setImageCaptions={editor.setImageCaptions}
        newImagePreviews={editor.newImagePreviews}
      />
    </RoleGuard>
  );
}
