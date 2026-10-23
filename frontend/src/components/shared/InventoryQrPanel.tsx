import { useEffect, useState } from "react";
import { Download, Loader2, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  downloadInventoryQrPng,
  inventoryQrLabelDataUrl,
  printInventoryQrLabel,
  QR_LABEL_SIZE_MM,
} from "@/lib/inventoryQr";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type InventoryQrPanelProps = {
  sku: string;
  binLocation?: string | null;
};

export function InventoryQrPanel({ sku, binLocation }: InventoryQrPanelProps) {
  const [labelDataUrl, setLabelDataUrl] = useState("");
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const tag = sku.trim();
  const bin = binLocation?.trim() || "";

  useEffect(() => {
    if (!tag) {
      setLabelDataUrl("");
      return;
    }
    let cancelled = false;
    void inventoryQrLabelDataUrl(tag)
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
    setBusy("download");
    try {
      await downloadInventoryQrPng(tag);
      toast({
        title: "QR label downloaded",
        description: `${tag}-label.png is ready to print at ${QR_LABEL_SIZE_MM} × ${QR_LABEL_SIZE_MM} mm.`,
      });
    } catch {
      toast({ title: "Download failed", description: "Unable to create the QR label.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const runPrint = async () => {
    if (!tag) return;
    setBusy("print");
    try {
      await printInventoryQrLabel(tag);
    } catch {
      toast({ title: "Print failed", description: "Unable to open the QR label for printing.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-4 flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <QrCode className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Part / bin QR code</p>
          <p className="text-xs text-muted-foreground">
            This code encodes the part SKU stored on the inventory item. Download or print it for bin and part labels.
          </p>
          <p className="mt-1 text-xs font-medium text-foreground">
            QR Label Size: {QR_LABEL_SIZE_MM} × {QR_LABEL_SIZE_MM} mm
          </p>
        </div>
      </div>

      <div className={cn("flex flex-col items-stretch gap-4")}>
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
                SKU required to preview the label
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">Part ID / SKU</p>
            <p className="font-mono text-sm font-semibold tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">
              {tag || "—"}
            </p>
            {bin ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Bin: <span className="font-medium text-foreground">{bin}</span>
              </p>
            ) : null}
          </div>

          <div className={cn("flex flex-col gap-2", !tag && "opacity-70")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!tag || busy !== null}
              onClick={() => void runDownload()}
            >
              {busy === "download" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              <span>Download label</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!tag || busy !== null}
              onClick={() => void runPrint()}
            >
              {busy === "print" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              <span>Print label</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
