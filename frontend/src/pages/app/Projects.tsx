import { useEffect, useState } from "react";
import { FolderKanban, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { ApiError, api, type BackendServiceJob } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function Projects() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<BackendServiceJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.listJobs()
      .then(setJobs)
      .catch((error) => toast({ title: "Unable to load projects", description: error instanceof ApiError ? error.message : "Request failed", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<BackendServiceJob>[] = [
    { key: "reference", header: "Project", render: (job) => <div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-primary" /><div><p className="font-mono text-sm font-medium">{job.reference}</p><p className="text-xs text-muted-foreground">{job.requestRef}</p></div></div> },
    { key: "customerName", header: "Customer", render: (job) => <div><p>{job.customerName}</p><p className="text-xs text-muted-foreground">{job.equipmentName}</p></div> },
    { key: "engineer", header: "Lead", render: (job) => <span>{job.engineer}</span> },
    { key: "scheduledFor", header: "Scheduled", render: (job) => <span>{formatDate(job.scheduledFor)}</span> },
    { key: "progress", header: "Progress", render: (job) => <div className="w-28 space-y-1"><Progress value={job.progress} className="h-1.5" /><span className="text-xs text-muted-foreground">{job.progress}%</span></div> },
    { key: "status", header: "Status", render: (job) => <StatusBadge status={job.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Job-centred delivery view for staffing, work logs, extras and project expenses." />
      {loading ? <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading projects…</div> : (
        <DataTable data={jobs} columns={columns} searchKeys={["reference", "requestRef", "customerName", "equipmentName", "engineer"]} searchPlaceholder="Search projects…" emptyMessage="No service projects found." onRowClick={(job) => navigate(`/app/projects/${job.id}`)} />
      )}
    </div>
  );
}
