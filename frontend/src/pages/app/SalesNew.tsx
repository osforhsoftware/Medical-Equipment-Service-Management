import { Navigate } from "react-router-dom";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SALES_WRITE_ROLES } from "@/config/roles";

export default function SalesNew() {
  return (
    <RoleGuard roles={SALES_WRITE_ROLES}>
      <Navigate to="/app/sales?new=1" replace />
    </RoleGuard>
  );
}
