import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card sm:p-10">
        <MesmsLogo size="lg" className="mx-auto mb-6" />
        <p className="text-5xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          The page you requested may have moved or is not available in your workspace.
        </p>
        <Button asChild className="mt-6">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Return home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
