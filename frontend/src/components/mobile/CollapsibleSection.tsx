import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("mobile-card !p-0 overflow-hidden", className)}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30">
        <div className="flex items-center gap-3">
          {icon && <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>}
          <span className="font-display text-sm font-semibold text-foreground">{title}</span>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-5 pb-5 pt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
