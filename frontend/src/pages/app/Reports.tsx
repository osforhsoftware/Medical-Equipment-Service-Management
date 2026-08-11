import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { jobsByType, revenueTrend } from "@/data/mock";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))"];

const reports = [
  "Service Performance Summary",
  "Revenue by Customer",
  "Equipment Downtime Analysis",
  "Inventory Consumption",
  "Engineer Productivity",
];

export default function Reports() {
  return (
    <RoleGuard roles={["admin", "billing", "coordinator"]}>
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Operational and financial insights with exportable reports."
          actions={
            <Button variant="outline" onClick={() => toast({ title: "Export", description: "Reports exported to CSV." })}>
              <Download className="mr-1 h-4 w-4" /> Export All
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueTrend} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Job Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={jobsByType} dataKey="count" nameKey="type" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {jobsByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {jobsByType.map((j, i) => (
                  <span key={j.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {j.type}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Standard Reports</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <div key={r} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FileBarChart className="h-4 w-4 text-primary" /> {r}
                </span>
                <Button variant="ghost" size="icon" onClick={() => toast({ title: r, description: "Report generated." })}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}
