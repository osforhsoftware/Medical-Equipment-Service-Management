import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Boxes, FileText, Loader2 } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

function homeForRole(role: string) {
  return role === "customer" ? "/portal" : "/app";
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("medical_equment");
  const [password, setPassword] = useState("medical@961");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const loggedInUser = await login(username.trim(), password);
      navigate(homeForRole(loggedInUser.role));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to sign in. Check your credentials.";
      toast({ title: "Sign in failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <MesmsLogo size="hero" className="relative" />

        <div className="relative space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground">
            Medical Equipment Service Management
          </h1>
          <p className="max-w-md text-sidebar-foreground/70">
            The multi-tenant operations platform for medical device service companies — from inspection and
            estimates to repairs, inventory, AMC and billing.
          </p>
          <div className="grid max-w-md gap-3">
            {[
              { icon: FileText, t: "End-to-end service workflow", d: "Request → inspection → estimate → repair → invoice" },
              { icon: Boxes, t: "Inventory reservation system", d: "Reserve before deduct, low-stock alerts" },
              { icon: ShieldCheck, t: "Role-based access control", d: "8 roles, tenant separation, audit logs" },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3 rounded-xl bg-sidebar-accent/60 p-3">
                <f.icon className="mt-0.5 h-5 w-5 text-sidebar-primary" />
                <div>
                  <p className="text-sm font-medium text-sidebar-accent-foreground">{f.t}</p>
                  <p className="text-xs text-sidebar-foreground/60">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">SaaS-ready · Multi-branch · QR equipment tracking</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md animate-scale-in">
          <div className="mb-8 lg:hidden">
            <MesmsLogo size="lg" className="mb-4" />
            <h1 className="font-display text-2xl font-bold">Welcome to MESMS</h1>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="font-display text-2xl font-bold">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Access your service operations workspace.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Default admin: <span className="font-mono">medical_equment</span>
          </p>
        </div>
      </div>
    </div>
  );
}
