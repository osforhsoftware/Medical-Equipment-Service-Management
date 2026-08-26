import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Loader2, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { QrCameraScanner } from "@/components/shared/QrCameraScanner";
import { ScannedEquipmentDetails } from "@/components/shared/ScannedEquipmentDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, type BackendEquipmentHistory } from "@/lib/api";
import { lookupScannedEquipment } from "@/lib/equipmentQrLookup";
import { toast } from "@/lib/toast";

export default function QRTracking() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<BackendEquipmentHistory | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!history?.equipment.assetTag) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(history.equipment.assetTag, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [history]);

  const scan = async (raw: string, source: "camera" | "manual") => {
    const value = raw.trim();
    if (!value) return;
    setQuery(value);
    setLoading(true);
    try {
      const result = await lookupScannedEquipment(value, source);
      setQuery(result.assetTag);
      setHistory(result.history);
    } catch (error) {
      setHistory(null);
      toast({
        title: "Asset not found",
        description: error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Equipment lookup failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scanned = history?.equipment ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="QR Code Tracking" description="Scan an equipment QR code to open its full product details and service history." />

      <div className="no-print grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Scan Asset Tag</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <QrCameraScanner disabled={loading} onDetect={(value) => void scan(value, "camera")} />
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void scan(query, "manual")}
                placeholder="MED-AX-2207"
                className="font-mono"
              />
              <Button onClick={() => void scan(query, "manual")} variant="brand" disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />} Look up
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Equipment Detail</CardTitle></CardHeader>
          <CardContent>
            {history && scanned ? (
              <>
                <div className="no-print space-y-4">
                  <ScannedEquipmentDetails history={history} qrDataUrl={qrDataUrl} />
                  <Button variant="outline" onClick={() => window.print()} disabled={!qrDataUrl}>
                    <Printer className="mr-2 h-4 w-4" /> Print equipment label
                  </Button>
                </div>
                <div className="qr-print-label hidden rounded-xl border-2 border-slate-900 bg-white p-6 text-slate-950 print:block">
                  <div className="flex items-center gap-6">
                    {qrDataUrl ? <img src={qrDataUrl} alt={`QR code for ${scanned.assetTag}`} className="h-40 w-40" /> : null}
                    <div>
                      <p className="text-xl font-bold">{scanned.name}</p>
                      <p>{scanned.manufacturer} · {scanned.model}</p>
                      <p className="mt-3 font-mono text-lg font-bold">{scanned.assetTag}</p>
                      <p className="mt-1 text-sm">Serial: {scanned.serialNumber}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <QrCode className="h-10 w-10" />
                <p className="text-sm">Scan a QR code or enter an asset tag to see all product details.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
