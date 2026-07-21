import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface BranchState {
  branchId: string; // "all" or branch id
  setBranchId: (id: string) => void;
}

const BranchContext = createContext<BranchState | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchId] = useState("all");
  const value = useMemo(() => ({ branchId, setBranchId }), [branchId]);
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
}
