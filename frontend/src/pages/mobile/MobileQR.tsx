import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { HardDrive, History, Loader2, MapPin, QrCode, ScanLine } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileSearchBar } from "@/components/mobile/MobileSearchBar";
import { WorkflowStatusChip } from "@/components/mobile/WorkflowStatusChip";
import { useMobileUnreadCount } from "@/components/mobile/MobileLayout";
import { ApiError, api, type BackendEquipment, type BackendServiceRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function MobileQR() {
  const navigate = useNavigate();
  const unread = useMobileUnreadCount();
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
    void QRCode.toDataURL(scanned.assetTag, { width: 200, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [scanned]);

  const scan = async (assetTag?: string) => {
    const tag = (assetTag ?? query).trim();
    if (!tag) return;
    setLoading(true);
    try {
      await api.recordQrScan(tag, "manual");
      const result = await api.getEquipmentHistory(tag);
      setScanned(result.equipment);
      setHistory(result.requests);
    } catch (error) {
      setScanned(null);
      setHistory([]);
      toast({
        title: "Asset not found",
        description: error instanceof ApiError ? error.message : "Equipment lookup failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-page">
      <MobileHeader
        title="Scan Equipment"
        subtitle="QR & asset tag lookup"
        unreadCount={unread}
        onNotifications={() => navigate("/app/notifications")}
      />

      {/* Scan zone */}
      <div className="mobile-card mt-4 flex aspect-[4/3] flex-col items-center justify-center border-2 border-dashed border-primary/20 bg-primary/5">
        <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-primary/10">
          <ScanLine className="h-10 w-10 text-primary" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">Point camera at equipment QR code</p>
        <p className="mt-1 text-xs text-muted-foreground">Or enter asset tag / serial number below</p>
      </div>

      <div className="mt-4">
        <MobileSearchBar
          value={query}
          onChange={setQuery}
          placeholder="Asset tag, serial number, equipment…"
        />
      </div>

      <button
        type="button"
        className="mobile-btn-primary mt-4 w-full"
        onClick={() => void scan()}
        disabled={loading || !query.trim()}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
        Look Up Equipment
      </button>

      {scanned && (
        <section className="mt-6 space-y-4">
          <div className="mobile-card">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-primary/10">
                <HardDrive className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold">{scanned.name}</h2>
                <p className="text-sm text-muted-foreground">{scanned.manufacturer} · {scanned.model}</p>
                <span className="mt-2 inline-block rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs">{scanned.assetTag}</span>
                <div className="mt-2">
                  <WorkflowStatusChip status={scanned.condition} />
                </div>
              </div>
              {qrDataUrl && (
                <img src={qrDataUrl} alt="" className="h-16 w-16 rounded-lg border border-border" />
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <InfoField label="Customer" value={scanned.customerName} />
              <InfoField label="Location" value={scanned.location} icon={MapPin} />
              <InfoField label="Serial" value={scanned.serialNumber} />
              <InfoField label="Last Service" value={scanned.lastServiceDate ? formatDate(scanned.lastServiceDate) : "—"} />
            </div>
          </div>

          <div className="mobile-card">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-primary" />
              Service History
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No service records found.</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-primary/20 pl-4">
                {history.map((item) => (
                  <li key={item.id} className="text-sm">
                    <p className="font-medium">{item.type}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.reference} · {formatDate(item.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function InfoField({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof MapPin }) {
  return (
    <div className="rounded-[14px] border border-border/60 bg-muted/30 p-3">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
