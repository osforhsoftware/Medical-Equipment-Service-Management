import { useEffect, useState } from "react";
import { Download, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import {
  downloadEquipmentQrPng,
  equipmentQrLabelDataUrl,
  QR_LABEL_SIZE_MM,
} from "@/lib/equipmentQr";
import { fieldAria, fieldErrorClass } from "@/lib/formValidation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type EquipmentQrPanelProps = {
  assetTag: string;
  required?: boolean;
  showInput?: boolean;
  error?: string | null;
  onAssetTagChange?: (value: string) => void;
  onBlur?: () => void;
};

export function EquipmentQrPanel({
  assetTag,
  required = false,
  showInput = true,
  error = null,
  onAssetTagChange,
  onBlur,
}: EquipmentQrPanelProps) {
  const [labelDataUrl, setLabelDataUrl] = useState("");
  const [busy, setBusy] = useState<boolean>(false);
  const tag = assetTag.trim();

  useEffect(() => {
    if (!tag) {
      setLabelDataUrl("");
      return;
    }
    let cancelled = false;
    void equipmentQrLabelDataUrl(tag)
      .then((url) => {
        if (!cancelled) setLabelDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setLabelDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const runDownload = async () => {
    if (!tag) return;
    setBusy(true);
    try {
      await downloadEquipmentQrPng(tag);
      toast({
        title: "QR label downloaded",
        description: `${tag}-label.png is ready to print at ${QR_LABEL_SIZE_MM} × ${QR_LABEL_SIZE_MM} mm.`,
      });
    } catch {
      toast({ title: "Download failed", description: "Unable to create the QR label.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <QrCode className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Asset QR code</p>
          <p className="text-xs text-muted-foreground">
            Enter a tag to preview the QR, then download a sticker for the machine.
          </p>
          <p className="mt-1 text-xs font-medium text-foreground">
            QR Label Size: {QR_LABEL_SIZE_MM} × {QR_LABEL_SIZE_MM} mm
          </p>
        </div>
      </div>

      <div className={cn("flex gap-4", showInput ? "flex-col sm:flex-row sm:items-start" : "flex-col items-stretch")}>
        <div className="mx-auto w-[148px] shrink-0">
          <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border bg-background p-2">
            {labelDataUrl ? (
              <img
                src={labelDataUrl}
                alt={`QR label for ${tag}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="px-2 text-center text-xs text-muted-foreground">
                <QrCode className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Enter an asset tag to preview the label
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          {showInput ? (
            <div className="grid gap-2" data-field="assetTag">
              <Label htmlFor="asset-tag" className={error ? "text-destructive" : undefined}>
                Asset tag
                {required ? <RequiredMark /> : null}
              </Label>
              <Input
                id="asset-tag"
                value={assetTag}
                onChange={(e) => onAssetTagChange?.(e.target.value)}
                onBlur={onBlur}
                placeholder="MED-AX-2207"
                className={fieldErrorClass(Boolean(error), "font-mono")}
                {...fieldAria("assetTag", error)}
              />
              {error ? <FormFieldError field="assetTag" message={error} /> : (
                <p className="text-xs text-muted-foreground">
                  This exact tag is encoded in the QR and used in QR Tracking lookup.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Asset tag</p>
              <p className="font-mono text-sm font-semibold tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">{tag || "—"}</p>
            </div>
          )}

          <div className={cn("flex flex-col gap-2", !tag && "opacity-70")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!tag || busy}
              onClick={() => void runDownload()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              <span>Download label</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
