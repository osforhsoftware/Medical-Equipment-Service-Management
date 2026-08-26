import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SalePad } from "@/components/sales/SalePad";
import { Button } from "@/components/ui/button";

export default function SalesNew() {
  const navigate = useNavigate();

  return (
    <RoleGuard roles={["admin", "coordinator", "estimator"]}>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground" asChild>
          <Link to="/app/sales">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Sales
          </Link>
        </Button>
        <SalePad mode="create" onSaved={(order) => navigate(`/app/sales/orders/${order.id}`)} />
      </div>
    </RoleGuard>
  );
}
