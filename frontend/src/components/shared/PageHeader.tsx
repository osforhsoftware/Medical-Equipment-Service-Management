import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** Preferred descriptive text prop. */
  description?: string;
  /** Alias for `description`, kept for pages that use `subtitle`. */
  subtitle?: string;
  /** Optional leading icon shown next to the title. */
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, subtitle, icon, actions }: PageHeaderProps) {
  const supportingText = description ?? subtitle;
  return (
    <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-primary">{icon}</span>}
          <h1 className="page-title">{title}</h1>
        </div>
        {supportingText && <p className="mt-1 text-sm text-muted-foreground">{supportingText}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}