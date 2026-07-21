import { useState } from "react";
import { QrCode, ScanLine, MapPin, History } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { equipment } from "@/data/mock";
import type { Equipment } from "@/data/types";

export default function QRTracking() {
  const [query, setQuery] = useState("");
  const [scanned, setScanned] = useState<Equipment | null>(null);

  const scan = () => {
    const found = equipment.find((e) => e.assetTag.toLowerCase() === query.trim().toLowerCase()) ?? equipment[0];
    setScanned(found);
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
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="MED-AX-2207" className="font-mono" />
              <Button onClick={scan} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                <QrCode className="mr-1 h-4 w-4" /> Look up
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
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Field label="Customer" value={scanned.customerName} />
                  <Field label="Location" value={scanned.location} icon={MapPin} />
                  <Field label="Serial" value={scanned.serialNumber} />
                  <Field label="Installed" value={scanned.installDate} />
                  <Field label="Warranty End" value={scanned.warrantyEnd} />
                  <Field label="Last Service" value={scanned.lastServiceDate} />
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="mb-3 flex items-center gap-1.5 text-sm font-medium"><History className="h-4 w-4 text-primary" /> Lifetime Service History</p>
                  <ol className="relative space-y-3 border-l border-border pl-4 text-sm">
                    {["Calibration — passed (2026-04-02)", "Filter replacement (2026-01-15)", "Annual PM (2025-09-20)", "Commissioning (installed)"].map((h, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                        {h}
                      </li>
                    ))}
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
