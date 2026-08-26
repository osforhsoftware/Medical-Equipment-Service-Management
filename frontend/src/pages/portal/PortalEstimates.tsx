import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { api, type BackendEstimate } from "@/lib/api";
import { estimateStatusLabel } from "@/lib/estimates";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function PortalEstimates() {
  const { user } = useAuth();
  const [items, setItems] = useState<BackendEstimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void api.getCustomerPortal()
      .then((portal) => setItems(portal.estimates))
      .catch((error) => toast.apiError(error, { fallback: "Unable to load estimates" }))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Estimates" description="Review service quotations prepared for your equipment." />
      {loading ? (
        <div className="flex justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading estimates…
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No estimates yet" description="When a quotation is ready, it will appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((estimate) => (
            <Card key={estimate.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="font-mono text-sm font-medium">{estimate.reference}</p>
                  </div>
                  <StatusBadge status={estimate.status} label={estimateStatusLabel(estimate.status)} />
                </div>
                <div>
                  <p className="font-medium">{estimate.equipmentName}</p>
                  <p className="text-sm text-muted-foreground">{estimate.customerName}</p>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-semibold">{formatCurrency(estimate.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Valid until</p>
                    <p className="text-sm">{formatDate(estimate.validUntil)}</p>
                  </div>
                </div>
                <Button asChild className="w-full" variant="outline">
                  <Link to={`/portal/estimates/${estimate.id}`}>View Estimate</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
