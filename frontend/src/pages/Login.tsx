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
import { useAuth } from "@/context/AuthContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { api, consumeSessionExpiredNotice } from "@/lib/api";
import { fieldRules } from "@/lib/formValidation";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function homeForRole(role: string) {
  return role === "customer" ? "/portal" : "/app";
}

type Mode = "login" | "forgot" | "reset";

const loginSchema = z.object({
  username: fieldRules.requiredString("Username"),
  password: fieldRules.requiredString("Password"),
});

const forgotSchema = z.object({
  email: fieldRules.email(true),
});

const resetSchema = z.object({
  resetToken: fieldRules.requiredString("Reset token"),
  password: fieldRules.password(8),
});

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (consumeSessionExpiredNotice()) setSessionNotice(true);
  }, [loading]);

  const loginValidation = useFormValidation({
    fieldOrder: ["username", "password"],
    schema: loginSchema,
  });
  const forgotValidation = useFormValidation({
    fieldOrder: ["email"],
    schema: forgotSchema,
  });
  const resetValidation = useFormValidation({
    fieldOrder: ["resetToken", "password"],
    schema: resetSchema,
  });

  const switchMode = (next: Mode) => {
    setMode(next);
    loginValidation.reset();
    forgotValidation.reset();
    resetValidation.reset();
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

  if (user) {
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

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = { email: email.trim() };
    if (!forgotValidation.validateAll(values)) return;

    setSubmitting(true);
    const loadingId = toast.loading("Sending reset link...");
    try {
      const result = await api.forgotPassword(values.email);
      toast.success("Check your email", {
        id: loadingId,
        description: "If an account exists for that email, a reset link has been sent.",
        force: true,
      });
      if (result && typeof result === "object" && "resetToken" in result && result.resetToken) {
        setResetToken(result.resetToken);
        switchMode("reset");
        toast.info("Dev reset token ready", {
          description: "Non-production: paste the token and choose a new password.",
        });
      }
    } catch (err) {
      toast.apiError(err, { id: loadingId, fallback: "Unable to start password reset.", force: true });
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = { resetToken: resetToken.trim(), password };
    if (!resetValidation.validateAll(values)) return;

    setSubmitting(true);
    const loadingId = toast.loading("Updating password...");
    try {
      await api.resetPassword(values.resetToken, values.password);
      toast.success("Password updated", {
        id: loadingId,
        description: "You can sign in with your new password.",
        force: true,
      });
      switchMode("login");
      setPassword("");
      setResetToken("");
    } catch (err) {
      toast.apiError(err, { id: loadingId, fallback: "Invalid or expired token.", force: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <div className="brand-grid brand-panel relative hidden flex-col justify-between overflow-hidden p-12 lg:flex xl:p-16">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-[24rem] w-[24rem] rounded-full bg-primary/30 blur-3xl" />
        <div className="relative w-fit rounded-lg bg-white px-4 py-2.5 shadow-md">
          <MesmsLogo size="hero" />
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
            <MesmsLogo size="lg" className="mb-4" />
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to MESMS</h1>
            {sessionNotice ? (
              <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Your session ended. Please sign in again.
              </p>
            ) : null}
          </div>

          <div className="mb-6 hidden lg:block">
            <MesmsLogo size="lg" className="mb-5" />
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Sign in" : mode === "forgot" ? "Forgot password" : "Reset password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Access your service operations workspace."
                : mode === "forgot"
                  ? "Enter the email on your account to receive a reset link."
                  : "Enter your reset token and choose a new password."}
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
            <form onSubmit={submitForgot} className="space-y-5" noValidate>
              <div className="space-y-2" data-field="email">
                <Label htmlFor="email" className={forgotValidation.shouldShow("email") ? "text-destructive" : undefined}>
                  Email
                  <RequiredMark />
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmail(value);
                    forgotValidation.handleChange("email", { email: value });
                  }}
                  onBlur={() => forgotValidation.handleBlur("email", { email })}
                  aria-invalid={forgotValidation.shouldShow("email") || undefined}
                  aria-describedby={forgotValidation.shouldShow("email") ? "email-error" : undefined}
                  className={cn(forgotValidation.shouldShow("email") && "border-destructive focus-visible:ring-destructive")}
                />
                {forgotValidation.shouldShow("email") && (
                  <FormFieldError field="email" message={forgotValidation.errors.email} />
                )}
              </div>
              <Button type="submit" disabled={submitting} variant="brand" className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => switchMode("login")}>
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === "reset" ? (
            <form onSubmit={submitReset} className="space-y-5" noValidate>
              <div className="space-y-2" data-field="resetToken">
                <Label htmlFor="resetToken" className={resetValidation.shouldShow("resetToken") ? "text-destructive" : undefined}>
                  Reset token
                  <RequiredMark />
                </Label>
                <Input
                  id="resetToken"
                  value={resetToken}
                  onChange={(e) => {
                    const value = e.target.value;
                    setResetToken(value);
                    resetValidation.handleChange("resetToken", { resetToken: value, password });
                  }}
                  onBlur={() => resetValidation.handleBlur("resetToken", { resetToken, password })}
                  aria-invalid={resetValidation.shouldShow("resetToken") || undefined}
                  aria-describedby={resetValidation.shouldShow("resetToken") ? "resetToken-error" : undefined}
                  className={cn(resetValidation.shouldShow("resetToken") && "border-destructive focus-visible:ring-destructive")}
                />
                {resetValidation.shouldShow("resetToken") && (
                  <FormFieldError field="resetToken" message={resetValidation.errors.resetToken} />
                )}
              </div>
              <div className="space-y-2" data-field="password">
                <Label htmlFor="newPassword" className={resetValidation.shouldShow("password") ? "text-destructive" : undefined}>
                  New password
                  <RequiredMark />
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);
                    resetValidation.handleChange("password", { resetToken, password: value });
                  }}
                  onBlur={() => resetValidation.handleBlur("password", { resetToken, password })}
                  aria-invalid={resetValidation.shouldShow("password") || undefined}
                  aria-describedby={resetValidation.shouldShow("password") ? "password-error" : undefined}
                  className={cn(resetValidation.shouldShow("password") && "border-destructive focus-visible:ring-destructive")}
                />
                {resetValidation.shouldShow("password") && (
                  <FormFieldError field="password" message={resetValidation.errors.password} />
                )}
              </div>
              <Button type="submit" disabled={submitting} variant="brand" className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => switchMode("login")}>
                Back to sign in
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
