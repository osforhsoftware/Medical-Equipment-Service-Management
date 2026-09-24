import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, ShieldCheck, Boxes, FileText, Loader2 } from "lucide-react";
import { FormFieldError } from "@/components/shared/FormFieldError";
import { RequiredMark } from "@/components/shared/RequiredMark";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CUSTOMER_PORTAL_ENABLED } from "@/config/features";
import { useAuth } from "@/context/AuthContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { consumeSessionExpiredNotice } from "@/lib/api";
import { fieldRules } from "@/lib/formValidation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const PORTAL_DISABLED_MESSAGE = "Customer Portal is temporarily unavailable.";

function homeForRole(role: string) {
  if (role === "customer") {
    return CUSTOMER_PORTAL_ENABLED ? "/portal" : "/login";
  }
  return "/app";
}

type Mode = "login" | "forgot";

const loginSchema = z.object({
  username: fieldRules.requiredString("Username"),
  password: fieldRules.requiredString("Password"),
});

export default function Login() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (consumeSessionExpiredNotice()) setSessionNotice(true);
  }, [loading]);

  useEffect(() => {
    if (loading || !user) return;
    if (user.role === "customer" && !CUSTOMER_PORTAL_ENABLED) {
      void logout();
      toast.info(PORTAL_DISABLED_MESSAGE);
    }
  }, [loading, user, logout]);

  const loginValidation = useFormValidation({
    fieldOrder: ["username", "password"],
    schema: loginSchema,
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    loginValidation.reset();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <MesmsLogo size="lg" />
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </p>
      </div>
    );
  }

  if (user && !(user.role === "customer" && !CUSTOMER_PORTAL_ENABLED)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = { username: username.trim(), password };
    if (!loginValidation.validateAll(values)) return;

    setSubmitting(true);
    const loadingId = toast.loading("Signing in...");
    try {
      const loggedInUser = await login(values.username, values.password);
      if (loggedInUser.role === "customer" && !CUSTOMER_PORTAL_ENABLED) {
        await logout();
        toast.error(PORTAL_DISABLED_MESSAGE, { id: loadingId, force: true });
        return;
      }
      toast.success("Signed in successfully", { id: loadingId, force: true });
      navigate(homeForRole(loggedInUser.role));
    } catch (err) {
      toast.apiError(err, {
        id: loadingId,
        fallback: "Unable to sign in. Check your credentials.",
        force: true,
        authForm: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <div className="brand-grid brand-panel relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-[24rem] w-[24rem] rounded-full bg-primary/30 blur-3xl" />
        <div className="relative w-fit rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md shadow-xl">
          <MesmsLogo size="hero" variant="stacked" theme="dark" />
        </div>

        <div className="relative space-y-5">
          <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Smarter medical service operations
          </div>
          <h1 className="max-w-lg text-4xl font-semibold leading-tight text-white xl:text-[2.6rem]">
            Medical Equipment Service Management
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/70">
            The multi-tenant operations platform for medical device service companies — from inspection and
            estimates to repairs, inventory and billing.
          </p>
          <div className="grid max-w-md gap-2.5">
            {[
              { icon: FileText, t: "End-to-end service workflow", d: "Request → inspection → estimate → repair → invoice" },
              { icon: Boxes, t: "Inventory reservation system", d: "Reserve before deduct, low-stock alerts" },
              { icon: ShieldCheck, t: "Role-based access control", d: "8 roles, tenant separation, audit logs" },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="rounded-md bg-accent/15 p-2">
                  <f.icon className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{f.t}</p>
                  <p className="text-xs text-white/55">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">SaaS-ready · End-to-end service management · QR equipment tracking</p>
      </div>

      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="relative w-full max-w-[400px] rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="mb-8 lg:hidden">
            <MesmsLogo size="md" variant="horizontal" className="mb-4" />
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to MESMS</h1>
            {sessionNotice ? (
              <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Your session ended. Please sign in again.
              </p>
            ) : null}
          </div>

          <div className="mb-6 hidden lg:block">
            <MesmsLogo size="md" variant="horizontal" className="mb-5" />
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Sign in" : "Forgot password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Access your service operations workspace."
                : "Password resets are handled by your administrator."}
            </p>
            {sessionNotice ? (
              <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Your session ended. Please sign in again.
              </p>
            ) : null}
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-5" noValidate>
              <div className="space-y-2" data-field="username">
                <Label htmlFor="username" className={loginValidation.shouldShow("username") ? "text-destructive" : undefined}>
                  Username
                  <RequiredMark />
                </Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUsername(value);
                    loginValidation.handleChange("username", { username: value, password });
                  }}
                  onBlur={() => loginValidation.handleBlur("username", { username, password })}
                  aria-invalid={loginValidation.shouldShow("username") || undefined}
                  aria-describedby={loginValidation.shouldShow("username") ? "username-error" : undefined}
                  className={cn(loginValidation.shouldShow("username") && "border-destructive focus-visible:ring-destructive")}
                />
                {loginValidation.shouldShow("username") && (
                  <FormFieldError field="username" message={loginValidation.errors.username} />
                )}
              </div>
              <div className="space-y-2" data-field="password">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className={loginValidation.shouldShow("password") ? "text-destructive" : undefined}>
                    Password
                    <RequiredMark />
                  </Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => switchMode("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    loginValidation.handleChange("password", { username, password: value });
                  }}
                  onBlur={() => loginValidation.handleBlur("password", { username, password })}
                  aria-invalid={loginValidation.shouldShow("password") || undefined}
                  aria-describedby={loginValidation.shouldShow("password") ? "password-error" : undefined}
                  className={cn(loginValidation.shouldShow("password") && "border-destructive focus-visible:ring-destructive")}
                />
                {loginValidation.shouldShow("password") && (
                  <FormFieldError field="password" message={loginValidation.errors.password} />
                )}
              </div>
              <Button type="submit" disabled={submitting} variant="brand" className="w-full">
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
          ) : null}

          {mode === "forgot" ? (
            <div className="space-y-5">
              <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                Please contact your system administrator to reset your password.
              </div>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => switchMode("login")}
              >
                Back to sign in
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
