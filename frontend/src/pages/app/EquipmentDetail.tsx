import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ActivityTimeline,
  DetailInfoGrid,
  DetailSection,
  RecordDetailLayout,
} from "@/components/shared/RecordDetailLayout";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError, type BackendEquipment, type BackendEquipmentHistory } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { termLabel } from "@/lib/taxonomy";
import { useQuery } from "@tanstack/react-query";

export default function EquipmentDetail() {
  const { id = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [equipment, setEquipment] = useState<BackendEquipment | null>(null);
  const [history, setHistory] = useState<BackendEquipmentHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = searchParams.get("tab") ?? "overview";
  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "equipment_category"],
    queryFn: () => api.listTaxonomy({ type: "equipment_category" }),
    staleTime: 60_000,
  });
  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 60_000,
  });
  const categoryName = termLabel(categoriesQuery.data, equipment?.category);
  const conditionName = termLabel(conditionsQuery.data, equipment?.condition);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const record = await api.getEquipment(id);
      setEquipment(record);
      try {
        setHistory(await api.getEquipmentHistory(record.assetTag));
      } catch {
        setHistory(null);
      }
    } catch (err) {
      setEquipment(null);
      setError(err instanceof ApiError && err.status === 404 ? null : "Please try again.");
      if (!(err instanceof ApiError && err.status === 404)) {
        toast.apiError(err, { fallback: "Failed to load equipment" });
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RecordDetailLayout
      backTo="/app/equipment"
      backLabel="Back to Equipment"
      title={equipment?.name ?? "Equipment"}
      subtitle={equipment ? `${equipment.assetTag} · ${equipment.customerName}` : undefined}
      status={equipment ? equipment.condition : undefined}
      statusLabel={equipment ? conditionName : undefined}
      meta={equipment ? [
        { label: "Category", value: categoryName },
        { label: "Location", value: equipment.location || "—" },
        { label: "Serial", value: equipment.serialNumber || "—" },
      ] : undefined}
      loading={loading}
      error={error}
      notFound={!loading && !error && !equipment}
      notFoundTitle="Equipment not found"
      notFoundDescription="The requested equipment record could not be found."
      onRetry={() => void load()}
      activeTab={tab}
      onTabChange={(value) => setSearchParams(value === "overview" ? {} : { tab: value })}
      tabs={equipment ? [
        {
          id: "overview",
          label: "Overview",
          content: (
            <DetailSection title="Equipment details">
              <DetailInfoGrid
                items={[
                  { label: "Manufacturer", value: equipment.manufacturer },
                  { label: "Model", value: equipment.model },
                  { label: "Category", value: categoryName },
                  { label: "Serial no.", value: equipment.serialNumber },
                  { label: "Location", value: equipment.location },
                  { label: "Customer", value: (
                    <Link className="text-primary hover:underline normal-case" to={`/app/customers/${equipment.customerId}`}>
                      {equipment.customerName}
                    </Link>
                  ) },
                  { label: "Installed", value: formatDate(equipment.installDate) },
                  { label: "Warranty ends", value: formatDate(equipment.warrantyEnd) },
                  { label: "Last service", value: formatDate(equipment.lastServiceDate) },
                  { label: "Asset tag", value: equipment.assetTag },
                ]}
              />
            </DetailSection>
          ),
        },
        {
          id: "history",
          label: "Service history",
          content: (
            <div className="space-y-4">
              <DetailSection title="Related tickets">
                {(history?.requests?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No related service tickets.</p>
                ) : (
                  <div className="space-y-2">
                    {history!.requests.map((r) => (
                      <Link key={r.id} to={`/app/service-tickets/${r.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                        <div>
                          <p className="font-mono font-medium">{r.reference}</p>
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </DetailSection>
              <DetailSection title="Related jobs">
                {(history?.jobs?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No related jobs.</p>
                ) : (
                  <div className="space-y-2">
                    {history!.jobs.map((j) => (
                      <Link key={j.id} to={`/app/jobs/${j.id}`} className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-secondary/40">
                        <div>
                          <p className="font-mono font-medium">{j.reference}</p>
                          <p className="text-xs text-muted-foreground">{j.engineer} · {formatDate(j.scheduledFor)}</p>
                        </div>
                        <StatusBadge status={j.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </DetailSection>
            </div>
          ),
        },
        {
          id: "activity",
          label: "Activity",
          content: (
            <DetailSection title="QR & scan activity">
              <ActivityTimeline
                items={(history?.scans ?? []).map((s) => ({
                  id: s.id,
                  title: `QR scan (${s.source})`,
                  meta: formatDateTime(s.scannedAt),
                }))}
                emptyMessage="No scan activity recorded."
              />
            </DetailSection>
          ),
        },
      ] : undefined}
      sidebar={equipment ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Condition</span><StatusBadge status={equipment.condition} label={conditionName} /></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Tickets</span><span>{history?.requests?.length ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Jobs</span><span>{history?.jobs?.length ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Invoices</span><span>{history?.invoices?.length ?? "—"}</span></div>
          </CardContent>
        </Card>
      ) : undefined}
    />
  );
}
