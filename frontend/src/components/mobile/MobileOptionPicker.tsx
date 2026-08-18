import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
  /** Stock count — renders as availability badge */
  stock?: number;
  disabled?: boolean;
}

interface MobileOptionPickerProps {
  label: string;
  placeholder?: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

export function MobileOptionPicker({
  label,
  placeholder = "Select…",
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = "Search…",
  className,
}: MobileOptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.sublabel?.toLowerCase().includes(q),
    );
  }, [options, query]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-[48px] w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2.5 text-left text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-medium leading-snug">{selected.label}</span>
              {selected.sublabel && (
                <span className="block truncate text-xs text-muted-foreground">{selected.sublabel}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 opacity-50" />
      </button>

      <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
        <DrawerContent className="mobile-picker-sheet [&>div:first-child]:hidden">
          <DrawerHeader className="border-b border-border/60 px-4 pb-3 pt-2 text-left">
            <DrawerTitle className="font-display text-lg">{label}</DrawerTitle>
          </DrawerHeader>

          {searchable && (
            <div className="px-4 pt-3">
              <div className="mobile-search-bar !h-12">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-auto flex-1 border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          )}

          <div
            className="max-h-[min(60dvh,420px)] overflow-y-auto overscroll-contain px-3 py-2 pb-safe"
            role="listbox"
            aria-label={label}
          >
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No matches found.</p>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                const outOfStock = opt.stock === 0;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => pick(opt.value)}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-colors active:scale-[0.99]",
                      active ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-muted/50",
                      opt.disabled && "pointer-events-none opacity-50",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium leading-snug text-foreground">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{opt.sublabel}</span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {opt.stock !== undefined && (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            outOfStock
                              ? "bg-destructive/10 text-destructive"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {outOfStock ? "Out of stock" : `${opt.stock} avail`}
                        </span>
                      )}
                      {active && <Check className="h-5 w-5 text-primary" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
