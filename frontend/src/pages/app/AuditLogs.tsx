import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { ApiError } from "@/lib/api";
import { api, type BackendAuditLog } from "@/lib/api";
import { roleLabels } from "@/data/mock";
import type { Role } from "@/data/types";
import { toast } from "@/hooks/use-toast";

export default function AuditLogs() {
  const [logs, setLogs] = useState<BackendAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listAuditLogs({ limit: 200 });
      setLogs(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load audit logs";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const columns: Column<BackendAuditLog>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      render: (l) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(l.createdAt).toLocaleString()}
        </span>
      ),
    },
    { key: "actor", header: "Actor", render: (l) => <span className="text-sm font-medium">{l.actor}</span> },
    {
      key: "role",
      header: "Role",
      render: (l) => <Badge variant="secondary">{roleLabels[l.role as Role] ?? l.role}</Badge>,
    },
    { key: "action", header: "Action", render: (l) => <span className="text-sm">{l.action}</span> },
    { key: "entity", header: "Entity", render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.entity}</span> },
    { key: "ip", header: "IP", render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.ip}</span> },
  ];

  const uniqueRoles = [...new Set(logs.map((l) => l.role))];

  return (
    <RoleGuard roles={["admin"]}>
      <div className="space-y-6">
        <PageHeader
          title="Audit Logs"
          description="Immutable record of every action across the tenant."
          actions={
            <Button variant="outline" onClick={() => toast({ title: "Export", description: "Audit log exported." })}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading audit logs…
          </div>
        ) : (
          <DataTable
            data={logs}
            columns={columns}
            searchKeys={["actor", "action", "entity", "ip"]}
            searchPlaceholder="Search logs…"
            filters={[
              {
                label: "Role",
                options: uniqueRoles.map((r) => ({ label: roleLabels[r as Role] ?? r, value: r })),
                predicate: (l, v) => l.role === v,
              },
            ]}
          />
        )}
      </div>
    </RoleGuard>
  );
}
