import { Mic, QrCode, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onScan?: () => void;
  onVoice?: () => void;
  className?: string;
}

export function MobileSearchBar({
  value,
  onChange,
  placeholder = "Search request, equipment, customer…",
  onScan,
  onVoice,
  className,
}: MobileSearchBarProps) {
  return (
    <div className={cn("mobile-search-bar", className)}>
      <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        aria-label="Search"
      />
      <div className="flex shrink-0 items-center gap-1">
        {onVoice && (
          <button
            type="button"
            onClick={onVoice}
            className="mobile-icon-btn h-9 w-9"
            aria-label="Voice search"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            className="mobile-icon-btn h-9 w-9 bg-primary/10 text-primary hover:bg-primary/15"
            aria-label="Scan QR code"
          >
            <QrCode className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
