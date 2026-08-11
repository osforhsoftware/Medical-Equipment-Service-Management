import { Plus, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFABProps {
  onClick: () => void;
  icon?: "plus" | "scan";
  label?: string;
  className?: string;
}

export function MobileFAB({ onClick, icon = "plus", label, className }: MobileFABProps) {
  const Icon = icon === "scan" ? QrCode : Plus;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("mobile-fab", className)}
      aria-label={label ?? (icon === "scan" ? "Scan QR code" : "Create request")}
    >
      <Icon className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
