import { Navigate } from "react-router-dom";
import { RoleGuard } from "@/components/auth/RoleGuard";

export default function SalesNew() {
  return (
    <RoleGuard roles={["admin", "coordinator", "estimator"]}>
      <Navigate to="/app/sales?new=1" replace />
    </RoleGuard>
  );
}
