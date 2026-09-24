import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BackendInventoryItem } from "@/lib/api";
import { cn } from "@/lib/utils";

function availableQty(item: BackendInventoryItem) {
  return item.available ?? Math.max(0, item.inStock - item.reserved);
}

export function defaultInventoryOptionLabel(item: BackendInventoryItem) {
  return `${item.name} (${item.sku}) · ${availableQty(item)} avail`;
}

type InventoryProductSelectProps = {
  items: BackendInventoryItem[];
  value?: string;
  onValueChange: (id: string, item: BackendInventoryItem) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  getOptionLabel?: (item: BackendInventoryItem) => string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  id?: string;
  modal?: boolean;
};

export function InventoryProductSelect({
  items,
  value = "",
  onValueChange,
  placeholder = "Select inventory product",
  searchPlaceholder = "Search by name, SKU, or category…",
  emptyText = "No matching inventory products.",
  getOptionLabel = defaultInventoryOptionLabel,
  className,
  triggerClassName,
  disabled,
  id,
  modal = true,
}: InventoryProductSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id === value) ?? null,
    [items, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.name,
        item.sku,
        item.category,
        item.subcategory ?? "",
        item.itemClass ?? "",
        item.supplier ?? "",
        item.manufacturer ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  return (
    <Popover
      modal={modal}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between bg-background px-3 font-normal shadow-none hover:bg-accent/50",
            !selected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate text-left">
            {selected ? getOptionLabel(selected) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("z-[80] p-0", className)}
        align="start"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>{items.length === 0 ? "No inventory products." : emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map((item) => {
                const isSelected = item.id === value;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onValueChange(item.id, item);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    <span className="min-w-0 flex-1 truncate">{getOptionLabel(item)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
