import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-page p-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-primary/10 bg-card/90 p-8 text-center shadow-elevated backdrop-blur sm:p-12">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-primary" />
        <MesmsLogo size="lg" className="mx-auto mb-8" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary shadow-sm">
          <Stethoscope className="h-8 w-8" />
        </div>
        <p className="font-display text-7xl font-bold text-gradient">404</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Page not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page you requested may have moved or is not available in your workspace.
        </p>
        <Button asChild variant="brand" className="mt-7">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Return home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
