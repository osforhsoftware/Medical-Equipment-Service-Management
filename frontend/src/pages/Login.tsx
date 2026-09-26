import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, Loader2 } from "lucide-react";
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
  username: fieldRules.requiredString("Username or email"),
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
        <MesmsLogo size="lg" showSubtitle={false} />
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
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <MesmsLogo size="lg" variant="stacked" showSubtitle={false} className="mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "login" ? "Sign in" : "Forgot password"}
          </h1>
          {sessionNotice ? (
            <p className="mt-3 w-full rounded-md border border-border bg-muted px-3 py-2 text-left text-sm text-muted-foreground">
              Your session ended. Please sign in again.
            </p>
          ) : null}
        </div>

        {mode === "login" ? (
          <form onSubmit={submitLogin} className="space-y-5" noValidate>
            <div className="space-y-2" data-field="username">
              <Label htmlFor="username" className={loginValidation.shouldShow("username") ? "text-destructive" : undefined}>
                Username or email
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
  );
}
