import { IndianRupee, MapPin, Package, PackageMinus, RefreshCw } from "lucide-react";
import { ModuleFlowStrip } from "@/components/shared/ModuleFlowStrip";

export const INVENTORY_STAGES = ["overview", "parts", "issue", "locations", "reorder", "cost"] as const;
export type InventoryStage = (typeof INVENTORY_STAGES)[number];

const FLOW_STEPS = [
  { id: "parts", label: "Parts", to: "/app/inventory?stage=parts", icon: Package },
  { id: "issue", label: "Stock issue", to: "/app/stock-ledger", icon: PackageMinus },
  { id: "locations", label: "Locations", to: "/app/stock-transfers", icon: MapPin },
  { id: "reorder", label: "Reorder", to: "/app/stock-purchase-requests", icon: RefreshCw },
  { id: "cost", label: "Cost", to: "/app/inventory?stage=cost", icon: IndianRupee },
] as const;

export function inventoryStageFromLocation(pathname: string, stageParam: string | null): InventoryStage {
  if (pathname.startsWith("/app/stock-ledger")) return "issue";
  if (pathname.startsWith("/app/stock-transfers") || pathname.startsWith("/app/stock-locations")) return "locations";
  if (pathname.startsWith("/app/stock-purchase-requests")) return "reorder";
  if (stageParam === "cost") return "cost";
  if (stageParam === "parts") return "parts";
  if (stageParam === "overview") return "overview";
  // Bare /app/inventory → Overview hub
  if (pathname.startsWith("/app/inventory")) return "overview";
  return "parts";
}

export function InventoryStageNav({ stage }: { stage: InventoryStage }) {
  return (
    <ModuleFlowStrip
      overviewTo="/app/inventory"
      overviewActive={stage === "overview"}
      activeId={stage}
      steps={[...FLOW_STEPS]}
      flowLabel="Stock"
    />
  );
}
