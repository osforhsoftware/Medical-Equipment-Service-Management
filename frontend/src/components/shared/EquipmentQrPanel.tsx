import { useEffect, useState } from "react";
import { Download, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { downloadEquipmentQrPng, equipmentQrDataUrl } from "@/lib/equipmentQr";
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
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const tag = assetTag.trim();

  useEffect(() => {
    if (!tag) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    void equipmentQrDataUrl(tag, 240)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
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
        title: "QR image downloaded",
        description: `${tag} PNG is ready to print and stick on the machine.`,
      });
    } catch {
      toast({ title: "Download failed", description: "Unable to create the QR file.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <QrCode className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Asset QR code</p>
          <p className="text-xs text-muted-foreground">Enter a tag to preview the QR, then download it for the machine.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-start">
        <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-background p-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR code for ${tag}`} className="h-full w-full object-contain" />
          ) : (
            <div className="px-3 text-center text-xs text-muted-foreground">
              <QrCode className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Enter an asset tag to preview the QR
            </div>
          )}
        </div>

        <div className="grid gap-3">
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
                <p className="text-xs text-muted-foreground">This exact tag is encoded in the QR and used in QR Tracking lookup.</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">Asset tag</p>
              <p className="font-mono text-sm font-semibold">{tag || "—"}</p>
            </div>
          )}

          <div className={cn("flex flex-wrap gap-2", !tag && "opacity-70")}>
            <Button type="button" variant="outline" size="sm" disabled={!tag || busy} onClick={() => void runDownload()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download image
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
