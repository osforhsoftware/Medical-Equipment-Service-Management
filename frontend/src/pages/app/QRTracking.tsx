import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, ScanLine, MapPin, History, Loader2, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, type BackendEquipment, type BackendServiceRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

export default function QRTracking() {
  const [query, setQuery] = useState("");
  const [scanned, setScanned] = useState<BackendEquipment | null>(null);
  const [history, setHistory] = useState<BackendServiceRequest[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scanned) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(scanned.assetTag, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [scanned]);

  const scan = async () => {
    const assetTag = query.trim();
    if (!assetTag) return;
    setLoading(true);
    try {
      await api.recordQrScan(assetTag, "manual");
      const result = await api.getEquipmentHistory(assetTag);
      setScanned(result.equipment);
      setHistory(result.requests);
    } catch (error) {
      setScanned(null);
      setHistory([]);
      const message = error instanceof ApiError ? error.message : "Equipment lookup failed";
      toast({ title: "Asset not found", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="QR Code Tracking" description="Scan equipment asset tags to view location and service history." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Scan Asset Tag</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
              <div className="text-center text-muted-foreground">
                <ScanLine className="mx-auto h-12 w-12" />
                <p className="mt-2 text-xs">Point camera at QR code</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void scan()}
                placeholder="MED-AX-2207"
                className="font-mono"
              />
              <Button onClick={() => void scan()} variant="brand" disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />} Look up
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Equipment Detail</CardTitle></CardHeader>
          <CardContent>
            {scanned ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold">{scanned.name}</h3>
                    <p className="text-sm text-muted-foreground">{scanned.manufacturer} · {scanned.model}</p>
                    <span className="mt-1 inline-block rounded-md bg-muted px-2 py-1 font-mono text-xs">{scanned.assetTag}</span>
                  </div>
                  <StatusBadge status={scanned.condition} />
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
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Field label="Customer" value={scanned.customerName} />
                  <Field label="Location" value={scanned.location} icon={MapPin} />
                  <Field label="Serial" value={scanned.serialNumber} />
                  <Field label="Installed" value={formatDate(scanned.installDate)} />
                  <Field label="Warranty End" value={formatDate(scanned.warrantyEnd)} />
                  <Field label="Last Service" value={scanned.lastServiceDate ? formatDate(scanned.lastServiceDate) : "Not recorded"} />
                </div>
                <Button variant="outline" onClick={() => window.print()} disabled={!qrDataUrl}>
                  <Printer className="mr-2 h-4 w-4" /> Print equipment label
                </Button>
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-sm font-medium"><History className="h-4 w-4 text-primary" /> Lifetime Service History</p>
                  <ol className="relative space-y-3 border-l border-border pl-4 text-sm">
                    {history.map((item) => (
                      <li key={item.id} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <span className="font-medium">{item.type}</span> — {item.description}
                        <span className="block text-xs text-muted-foreground">
                          {item.reference} · {formatDate(item.createdAt)} · {item.status}
                        </span>
                      </li>
                    ))}
                    {history.length === 0 ? (
                      <li className="text-muted-foreground">No service records found for this equipment.</li>
                    ) : null}
                  </ol>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <QrCode className="h-10 w-10" />
                <p className="text-sm">Scan or enter an asset tag to begin.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{Icon && <Icon className="h-3 w-3" />} {label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
