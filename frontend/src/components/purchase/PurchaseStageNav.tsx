import { FileText, Landmark, Package, PackageCheck, Receipt, RefreshCw, Ship, Truck } from "lucide-react";
import { ModuleFlowStrip } from "@/components/shared/ModuleFlowStrip";

/** PDF Purchasing & Landed Cost: Request → RFQ → Quote → PO → Shipment → Customs → GRN → Stock */
export const PURCHASE_STAGES = [
  "overview",
  "request",
  "rfq",
  "quotes",
  "po",
  "shipment",
  "customs",
  "grn",
  "stock",
] as const;
export type PurchaseStage = (typeof PURCHASE_STAGES)[number];

const FLOW_STEPS = [
  { id: "request", label: "Purchase request", to: "/app/stock-purchase-requests?desk=purchase", icon: RefreshCw },
  { id: "rfq", label: "RFQ", to: "/app/rfqs?stage=rfq", icon: FileText },
  { id: "quotes", label: "Supplier quote", to: "/app/rfqs?stage=quotes", icon: Truck },
  { id: "po", label: "PO", to: "/app/purchase-orders", icon: Receipt },
  { id: "shipment", label: "Shipment", to: "/app/purchase-orders?stage=shipment", icon: Ship },
  { id: "customs", label: "Customs", to: "/app/purchase-orders?stage=customs", icon: Landmark },
  { id: "grn", label: "GRN", to: "/app/purchase-orders?stage=grn", icon: PackageCheck },
  { id: "stock", label: "Stock", to: "/app/purchase-orders?stage=stock", icon: Package },
] as const;

export function purchaseStageFromLocation(pathname: string, stageParam: string | null): PurchaseStage {
  if (pathname.startsWith("/app/stock-purchase-requests")) return "request";
  if (pathname.startsWith("/app/purchase-orders")) {
    if (stageParam === "grn" || stageParam === "shipment" || stageParam === "customs" || stageParam === "stock") {
      return stageParam;
    }
    // Legacy bookmark
    if (stageParam === "landed") return "customs";
    return "po";
  }
  if (stageParam === "quotes") return "quotes";
  if (stageParam === "rfq") return "rfq";
  if (stageParam === "request") return "request";
  if (stageParam === "overview") return "overview";
  if (pathname.startsWith("/app/rfqs")) return "overview";
  return "rfq";
}

export function PurchaseStageNav({ stage }: { stage: PurchaseStage }) {
  return (
    <ModuleFlowStrip
      overviewTo="/app/rfqs"
      overviewActive={stage === "overview"}
      activeId={stage}
      steps={[...FLOW_STEPS]}
      flowLabel="Buy"
    />
  );
}
