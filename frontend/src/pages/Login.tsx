import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Boxes, FileText, Loader2 } from "lucide-react";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

function homeForRole(role: string) {
  return role === "customer" ? "/portal" : "/app";
}

type Mode = "login" | "forgot" | "reset";

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
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

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const loadingId = toast.loading("Signing in...");
    try {
      const loggedInUser = await login(username.trim(), password);
      toast.success("Signed in successfully", { id: loadingId, force: true });
      navigate(homeForRole(loggedInUser.role));
    } catch (err) {
      toast.apiError(err, { id: loadingId, fallback: "Unable to sign in. Check your credentials.", force: true });
    } finally {
      setSubmitting(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const loadingId = toast.loading("Sending reset link...");
    try {
      const result = await api.forgotPassword(email.trim());
      toast.success("Check your email", {
        id: loadingId,
        description: "If an account exists for that email, a reset link has been sent.",
        force: true,
      });
      if (result && typeof result === "object" && "resetToken" in result && result.resetToken) {
        setResetToken(result.resetToken);
        setMode("reset");
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
    setSubmitting(true);
    const loadingId = toast.loading("Updating password...");
    try {
      await api.resetPassword(resetToken.trim(), password);
      toast.success("Password updated", {
        id: loadingId,
        description: "You can sign in with your new password.",
        force: true,
      });
      setMode("login");
      setPassword("");
      setResetToken("");
    } catch (err) {
      toast.apiError(err, { id: loadingId, fallback: "Invalid or expired token.", force: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <div className="brand-grid relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex xl:p-16">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-sidebar-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-primary/35 blur-3xl" />
        <div className="relative w-fit rounded-2xl bg-white px-5 py-3 shadow-elevated">
          <MesmsLogo size="hero" />
        </div>

        <div className="relative space-y-6">
          <div className="inline-flex w-fit items-center rounded-full border border-sidebar-primary/25 bg-sidebar-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
            Smarter medical service operations
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-sidebar-accent-foreground xl:text-5xl">
            Medical Equipment Service Management
          </h1>
          <p className="max-w-md text-sidebar-foreground/70">
            The multi-tenant operations platform for medical device service companies — from inspection and
            estimates to repairs, inventory and billing.
          </p>
          <div className="grid max-w-md gap-3">
            {[
              { icon: FileText, t: "End-to-end service workflow", d: "Request → inspection → estimate → repair → invoice" },
              { icon: Boxes, t: "Inventory reservation system", d: "Reserve before deduct, low-stock alerts" },
              { icon: ShieldCheck, t: "Role-based access control", d: "8 roles, tenant separation, audit logs" },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/65 p-3.5 backdrop-blur-sm">
                <div className="rounded-lg bg-sidebar-primary/15 p-2">
                  <f.icon className="h-5 w-5 text-sidebar-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-sidebar-accent-foreground">{f.t}</p>
                  <p className="text-xs text-sidebar-foreground/60">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">SaaS-ready · End-to-end service management · QR equipment tracking</p>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden p-6 sm:p-10">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative w-full max-w-md animate-scale-in rounded-2xl border border-primary/10 bg-card/90 p-6 shadow-elevated backdrop-blur sm:p-8">
          <div className="mb-8 lg:hidden">
            <MesmsLogo size="lg" className="mb-4" />
            <h1 className="font-display text-2xl font-bold">Welcome to MESMS</h1>
          </div>

          <div className="mb-6 hidden lg:block">
            <h2 className="font-display text-2xl font-bold">
              {mode === "login" ? "Sign in" : mode === "forgot" ? "Forgot password" : "Reset password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Access your service operations workspace."
                : mode === "forgot"
                  ? "Enter the email on your account to receive a reset link."
                  : "Enter your reset token and choose a new password."}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-5">
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
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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
            <form onSubmit={submitForgot} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("login")}>
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === "reset" ? (
            <form onSubmit={submitReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="resetToken">Reset token</Label>
                <Input id="resetToken" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
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
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("login")}>
                Back to sign in
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
