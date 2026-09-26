import type { ReactNode } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ReportSection({
  id,
  title,
  description,
  count,
  onExport,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  count?: number;
  onExport?: () => void;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 shadow-card">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {typeof count === "number" ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {count}
              </Badge>
            ) : null}
          </div>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {onExport ? (
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onExport}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
