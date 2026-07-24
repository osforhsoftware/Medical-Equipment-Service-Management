import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { ApiError, api, type BackendServiceRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function PortalHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<BackendServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.listServiceRequests()
      .then((rows) => setHistory(rows.filter((request) => request.customerId === user?.customerId)))
      .catch((error) => toast({ title: "Unable to load service history", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [user?.customerId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Service History" description="Complete lifetime record of services on your equipment." />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading history…</div> : null}

      <Card className="divide-y divide-border/70 overflow-hidden shadow-card">
        {history.map((r) => (
          <div key={r.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/25">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/18 to-accent/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{r.equipmentName}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-muted-foreground">{r.reference} · {r.type} · {formatDate(r.createdAt)}</p>
            </div>
          </div>
        ))}
        {!loading && history.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No service records found.</p> : null}
      </Card>
    </div>
  );
}
