import { IndianRupee, Lock, MapPin, Package, PackageMinus, RefreshCw } from "lucide-react";
import { ModuleFlowStrip } from "@/components/shared/ModuleFlowStrip";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { userCanOpenPage } from "@/lib/userRoles";

export const INVENTORY_STAGES = ["overview", "parts", "reserve", "issue", "locations", "reorder", "cost"] as const;
export type InventoryStage = (typeof INVENTORY_STAGES)[number];

const FLOW_STEPS = [
  { id: "parts", label: "Parts", to: "/app/inventory?stage=parts", icon: Package },
  { id: "reserve", label: "Reserve", to: "/app/stock-reservations", icon: Lock },
  { id: "issue", label: "Stock issue", to: "/app/stock-ledger", icon: PackageMinus },
  { id: "locations", label: "Locations", to: "/app/stock-transfers", icon: MapPin },
  { id: "reorder", label: "Reorder", to: "/app/stock-purchase-requests", icon: RefreshCw },
  { id: "cost", label: "Cost", to: "/app/inventory?stage=cost", icon: IndianRupee },
] as const;

export function inventoryStageFromLocation(pathname: string, stageParam: string | null): InventoryStage {
  if (pathname.startsWith("/app/stock-reservations")) return "reserve";
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
  const { user } = useAuth();
  const { rbacMatrix } = useSettings();
  const steps = FLOW_STEPS.filter((step) => user && userCanOpenPage(user, step.to, rbacMatrix));
  return (
    <ModuleFlowStrip
      overviewTo="/app/inventory"
      overviewActive={stage === "overview"}
      activeId={stage}
      steps={[...steps]}
      flowLabel="Stock"
    />
  );
}
