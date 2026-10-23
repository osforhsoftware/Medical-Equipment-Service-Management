import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  newExtraQaChecklistItem,
  type QaChecklistItem,
} from "@/lib/qaChecklist";

type Props = {
  items: QaChecklistItem[];
  onChange: (next: QaChecklistItem[]) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  /** Allow adding job-only extra points. */
  allowExtras?: boolean;
};

export function QaChecklistEditor({
  items,
  onChange,
  disabled,
  title = "QA quality checklist",
  description = "Default points come from Admin → Settings. Use + to add an optional check for this job only.",
  allowExtras = true,
}: Props) {
  const updateItem = (index: number, patch: Partial<QaChecklistItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addExtra = () => {
    if (items.length >= 40) return;
    onChange([...items, newExtraQaChecklistItem(items)]);
  };

  const removeExtra = (index: number) => {
    const item = items[index];
    if (!item?.isExtra) return;
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div>
        <Label className="text-xs font-semibold uppercase text-muted-foreground">{title}</Label>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {items.map((item, index) => (
          <label
            key={item.id}
            className={`flex items-start gap-2 ${disabled ? "" : "cursor-pointer"} ${
              item.isExtra ? "sm:col-span-2" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={item.checked}
              disabled={disabled}
              onChange={(e) => updateItem(index, { checked: e.target.checked })}
              className="mt-1 rounded"
            />
            {item.isExtra ? (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  value={item.label}
                  disabled={disabled}
                  placeholder="Extra check point for this job"
                  className="h-8"
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  aria-label={`Extra checklist point ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={disabled}
                  onClick={() => removeExtra(index)}
                  aria-label={`Remove extra point ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            ) : (
              <span>
                {index + 1}. {item.label}
              </span>
            )}
          </label>
        ))}
      </div>
      {allowExtras && !disabled ? (
        <Button type="button" variant="outline" size="sm" onClick={addExtra} disabled={items.length >= 40}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add check point
        </Button>
      ) : null}
    </div>
  );
}
