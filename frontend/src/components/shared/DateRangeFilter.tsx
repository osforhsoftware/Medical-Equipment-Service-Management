import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DATE_RANGE_PRESETS, defaultDateRange, toIsoDate } from "@/lib/charts";
import { cn } from "@/lib/utils";

export type DateRangeValue = { from: string; to: string };

type DateRangeFilterProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  className?: string;
  dense?: boolean;
};

export function DateRangeFilter({ value, onChange, className, dense }: DateRangeFilterProps) {
  const applyPreset = (days: number) => {
    if (days === 0) {
      const today = toIsoDate(new Date());
      onChange({ from: today, to: today });
      return;
    }
    onChange(defaultDateRange(days));
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-3 sm:flex-row sm:flex-wrap sm:items-end",
        dense && "p-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        {DATE_RANGE_PRESETS.map((preset) => {
          const active =
            value.from === (preset.days === 0 ? toIsoDate(new Date()) : defaultDateRange(preset.days).from) &&
            value.to === toIsoDate(new Date());
          return (
            <Button
              key={preset.label}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-8 px-2.5 text-xs"
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-1 flex-wrap items-end gap-2">
        <div className="grid min-w-[9rem] flex-1 gap-1">
          <Label htmlFor="chart-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="chart-from"
            type="date"
            value={value.from}
            max={value.to}
            className="h-8"
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div className="grid min-w-[9rem] flex-1 gap-1">
          <Label htmlFor="chart-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="chart-to"
            type="date"
            value={value.to}
            min={value.from}
            max={toIsoDate(new Date())}
            className="h-8"
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
