import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="no-print relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/10 bg-card/80 px-5 py-5 shadow-card backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-primary" aria-hidden="true" />
      <div className="relative">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="relative flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
