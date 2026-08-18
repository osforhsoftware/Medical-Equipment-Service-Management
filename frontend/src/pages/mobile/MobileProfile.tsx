import { useNavigate } from "react-router-dom";
import {
  Bell,
  Boxes,
  ChevronRight,
  ClipboardList,
  LogOut,
  QrCode,
  Receipt,
  Search,
  Settings,
  User,
  Wrench,
} from "lucide-react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { useMobileUnreadCount } from "@/components/mobile/MobileLayout";
import { useAuth } from "@/context/AuthContext";
import { roleLabels } from "@/data/mock";
import { cn } from "@/lib/utils";

const MENU_SECTIONS = [
  {
    title: "Field Service",
    items: [
      { label: "Service Jobs", icon: Wrench, to: "/app/jobs" },
      { label: "Service Tickets", icon: ClipboardList, to: "/app/service-tickets" },
      { label: "Inspections", icon: Search, to: "/app/inspections" },
      { label: "QR Scanner", icon: QrCode, to: "/app/qr-tracking" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Inventory", icon: Boxes, to: "/app/inventory" },
      { label: "Billing", icon: Receipt, to: "/app/billing" },
      { label: "Notifications", icon: Bell, to: "/app/notifications" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", icon: Settings, to: "/app/settings" },
    ],
  },
] as const;

export default function MobileProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useMobileUnreadCount();

  if (!user) return null;

  return (
    <div className="mobile-page">
      <MobileHeader
        title="Profile"
        subtitle={roleLabels[user.role]}
        unreadCount={unread}
        onNotifications={() => navigate("/app/notifications")}
      />

      {/* Profile card */}
      <div className="mobile-card mt-4 flex items-center gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] text-2xl font-bold text-white shadow-md"
          style={{ backgroundColor: `hsl(${user.avatarColor})` }}
        >
          {user.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-foreground">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <User className="h-3 w-3" />
            {roleLabels[user.role]}
          </span>
        </div>
      </div>

      {/* Menu sections */}
      {MENU_SECTIONS.map((section) => (
        <section key={section.title} className="mt-6">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </h3>
          <div className="mobile-card !p-0 overflow-hidden divide-y divide-border/60">
            {section.items.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors active:bg-muted/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                {item.label === "Notifications" && unread > 0 && (
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => void logout().then(() => navigate("/login"))}
        className={cn("mobile-btn-secondary mt-8 w-full text-destructive", "border-destructive/30 hover:bg-destructive/5")}
      >
        <LogOut className="mr-2 h-5 w-5" />
        Sign Out
      </button>
    </div>
  );
}
