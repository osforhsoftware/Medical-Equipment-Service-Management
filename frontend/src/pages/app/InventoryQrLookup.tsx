import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, QrCode } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { QrCameraScanner } from "@/components/shared/QrCameraScanner";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { lookupScannedInventory } from "@/lib/inventoryQrLookup";
import { toast } from "@/lib/toast";

export default function InventoryQrLookup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("sku") ?? "");
  const [loading, setLoading] = useState(false);
  const autoTried = useRef(false);

  const scan = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setQuery(value);
    setLoading(true);
    try {
      const result = await lookupScannedInventory(value);
      setQuery(result.sku);
      navigate(`/app/inventory/${result.item.id}`, { replace: true });
    } catch (error) {
      toast({
        title: "Part not found",
        description:
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Inventory lookup failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sku = searchParams.get("sku")?.trim();
    if (!sku || autoTried.current) return;
    autoTried.current = true;
    void scan(sku);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep-link lookup
  }, [searchParams]);

  return (
    <RoleGuard roles={["admin", "inventory", "engineer"]}>
      <div className="space-y-6">
        <PageHeader
          title="Inventory QR lookup"
          description="Scan a part or bin QR code to open that inventory item."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Scan part SKU</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <QrCameraScanner disabled={loading} onDetect={(value) => void scan(value)} />
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void scan(query)}
                  placeholder="Part ID / SKU"
                  className="font-mono"
                />
                <Button onClick={() => void scan(query)} variant="brand" disabled={loading || !query.trim()}>
                  {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />}{" "}
                  Look up
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Each inventory item QR encodes its Part ID / SKU (same value shown on the item detail page).</p>
              <p>Scanning or looking up a SKU opens that inventory item so you can check stock, bin location, and adjust levels.</p>
              {loading ? (
                <p className="flex items-center gap-2 text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening inventory item…
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleGuard>
  );
}
