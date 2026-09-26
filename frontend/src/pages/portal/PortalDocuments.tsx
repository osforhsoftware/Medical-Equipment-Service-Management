import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { api, type PortalDocument } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function PortalDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void api.getCustomerPortal()
      .then((portal) => setDocuments(portal.documents ?? []))
      .catch((error) => toast.apiError(error, { fallback: "Unable to load documents" }))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Estimates and invoices for your equipment only." />
      {loading ? (
        <div className="flex justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading documents…
        </div>
      ) : documents.length === 0 ? (
        <EmptyState title="No documents yet" description="When a quotation or invoice is ready, it will appear here." />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.originalName || doc.reference || "Document"}</p>
                    <p className="text-xs text-muted-foreground">{doc.reference ?? doc.entityType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{doc.kind}</Badge>
                  <Button size="sm" variant="outline" asChild>
                    <a href={api.fileDownloadUrl(doc.fileId)} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
