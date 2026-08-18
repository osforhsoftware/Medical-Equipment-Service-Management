import { type ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";

export type DetailTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export type DetailMetaItem = {
  label: string;
  value: ReactNode;
};

type RecordDetailLayoutProps = {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle?: ReactNode;
  status?: string;
  statusLabel?: string;
  meta?: DetailMetaItem[];
  actions?: ReactNode;
  tabs?: DetailTab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  sidebar?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  error?: string | null;
  notFound?: boolean;
  notFoundTitle?: string;
  notFoundDescription?: string;
  onRetry?: () => void;
  className?: string;
};

export function RecordDetailLayout({
  backTo,
  backLabel,
  title,
  subtitle,
  status,
  statusLabel,
  meta,
  actions,
  tabs,
  defaultTab,
  activeTab,
  onTabChange,
  sidebar,
  children,
  loading,
  error,
  notFound,
  notFoundTitle = "Record not found",
  notFoundDescription = "The requested record could not be found.",
  onRetry,
  className,
}: RecordDetailLayoutProps) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-40 rounded-lg bg-muted" />
        <div className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="h-8 w-56 rounded bg-muted" />
          <div className="h-4 w-80 max-w-full rounded bg-muted" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-24 rounded-full bg-muted" />
            <div className="h-6 w-32 rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="h-64 rounded-lg border border-border bg-card" />
          <div className="h-48 rounded-lg border border-border bg-card" />
        </div>
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold">Unable to load this record</p>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link to={backTo}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
            </Link>
          </Button>
          {onRetry ? (
            <Button onClick={onRetry}>Retry</Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-lg font-semibold">{notFoundTitle}</p>
        <p className="max-w-md text-sm text-muted-foreground">{notFoundDescription}</p>
        <Button asChild variant="outline">
          <Link to={backTo}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
          </Link>
        </Button>
      </div>
    );
  }

  const tabDefault = defaultTab ?? tabs?.[0]?.id;
  const showTabs = Boolean(tabs?.length);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
            <Link to={backTo}>
              <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title">{title}</h1>
              {status ? <StatusBadge status={status} label={statusLabel} /> : null}
            </div>
            {subtitle ? (
              <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
          {meta && meta.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {meta.map((item) => (
                <span key={item.label}>
                  <span className="font-medium text-foreground/80">{item.label}:</span> {item.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        ) : null}
      </div>

      <div className={cn("grid gap-5", sidebar ? "lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]" : undefined)}>
        <div className="min-w-0 space-y-5">
          {showTabs ? (
            <Tabs
              value={activeTab ?? tabDefault}
              defaultValue={tabDefault}
              onValueChange={onTabChange}
              className="space-y-4"
            >
              <div className="overflow-x-auto">
                <TabsList className="h-auto min-w-max justify-start">
                  {tabs!.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="px-3">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {tabs!.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0 space-y-4">
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            children
          )}
        </div>
        {sidebar ? (
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">{sidebar}</aside>
        ) : null}
      </div>
    </div>
  );
}

export function DetailSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-4 shadow-card sm:p-5", className)}>
      {title ? <h2 className="section-title mb-3">{title}</h2> : null}
      {children}
    </section>
  );
}

export function DetailInfoGrid({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <div className="mt-0.5 font-medium capitalize">{item.value ?? "—"}</div>
        </div>
      ))}
    </div>
  );
}

export function ActivityTimeline({
  items,
  emptyMessage = "No activity yet.",
}: {
  items: { id: string; title: string; detail?: string | null; meta?: string }[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
          <p className="text-sm font-medium">{item.title}</p>
          {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
          {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
        </li>
      ))}
    </ol>
  );
}
