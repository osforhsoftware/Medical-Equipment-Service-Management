import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, QrCode } from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { MobileSearchBar } from "@/components/mobile/MobileSearchBar";
import { useMobileUnreadCount } from "@/hooks/useMobilePullRefresh";
import { QrCameraScanner } from "@/components/shared/QrCameraScanner";
import { ScannedEquipmentDetails } from "@/components/shared/ScannedEquipmentDetails";
import { ApiError, type BackendEquipmentHistory } from "@/lib/api";
import { lookupScannedEquipment } from "@/lib/equipmentQrLookup";
import { toast } from "@/lib/toast";

export default function MobileQR() {
  const navigate = useNavigate();
  const unread = useMobileUnreadCount();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<BackendEquipmentHistory | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="mobile-page">
      <MobileHeader
        title="Scan Equipment"
        subtitle="QR & asset tag lookup"
        unreadCount={unread}
        onNotifications={() => navigate("/app/notifications")}
      />

      <div className="mobile-card mt-4">
        <QrCameraScanner disabled={loading} onDetect={(value) => void scan(value, "camera")} />
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
        onClick={() => void scan(query, "manual")}
        disabled={loading || !query.trim()}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
        Look Up Equipment
      </button>

      {history ? (
        <section className="mt-6">
          <div className="mobile-card">
            <ScannedEquipmentDetails history={history} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
