import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerAdditionalField } from "@/lib/customerFields";

type Props = {
  value: CustomerAdditionalField[];
  onChange: (next: CustomerAdditionalField[]) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
};

export function CustomerAdditionalFieldsEditor({
  value,
  onChange,
  disabled,
  title = "Additional fields",
  description = "Optional custom fields (site notes, accessories received, internal codes, etc.).",
}: Props) {
  const rows = value.length ? value : [{ label: "", value: "" }];

  const updateRow = (index: number, patch: Partial<CustomerAdditionalField>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = () => {
    if (rows.length >= 30) return;
    onChange([...rows, { label: "", value: "" }]);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ label: "", value: "" }]);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              value={row.label}
              disabled={disabled}
              placeholder="Field name"
              onChange={(e) => updateRow(index, { label: e.target.value })}
              aria-label={`Additional field ${index + 1} name`}
            />
            <Input
              value={row.value}
              disabled={disabled}
              placeholder="Value"
              onChange={(e) => updateRow(index, { value: e.target.value })}
              aria-label={`Additional field ${index + 1} value`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || (rows.length === 1 && !row.label && !row.value)}
              onClick={() => removeRow(index)}
              aria-label={`Remove additional field ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled || rows.length >= 30}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add field
      </Button>
    </div>
  );
}
