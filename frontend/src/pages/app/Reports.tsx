import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { REPORT_CATEGORIES, REPORT_PAGE_ROLES, reportHref } from "@/lib/reportCategories";
import { cn } from "@/lib/utils";

export default function Reports() {
  return (
    <RoleGuard roles={REPORT_PAGE_ROLES}>
      <div className="space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Choose a category to open the full report page — filters, activity, and exports stay on that page."
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {REPORT_CATEGORIES.map((category) => (
            <Card key={category.id} className="relative overflow-hidden shadow-card">
              <span className={cn("absolute inset-y-0 left-0 w-1.5", category.barClass)} />
              <CardHeader className="pb-3 pl-6">
                <CardTitle className={cn("text-xs font-semibold uppercase tracking-[0.14em]", category.accentClass)}>
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pl-6">
                <ul className="space-y-2">
                  {category.reports.map((report) => (
                    <li key={report.id}>
                      <Link
                        to={reportHref(category.path, report.id)}
                        className="text-sm text-foreground/90 hover:text-foreground hover:underline"
                      >
                        {report.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link to={category.path}>
                    See all {category.shortTitle.toLowerCase()} reports
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
