import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { getMobileNavTabs } from "@/config/mobileNav";
import { navItems } from "@/config/nav";
import { getUserRoles, userCanAccessModule } from "@/lib/userRoles";
import { cn } from "@/lib/utils";

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { rbacMatrix } = useSettings();

  if (!user) return null;

  const userRoles = getUserRoles(user);
  const bottomTabPaths = new Set(getMobileNavTabs(userRoles, rbacMatrix).map((t) => t.to));

  const moreItems = navItems.filter((item) => {
    if (item.to === "/app") return false;
    if (!userCanAccessModule(user, item.label, rbacMatrix, item.roles)) return false;
    return !bottomTabPaths.has(item.to);
  });

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[20px] pb-safe">
        <DrawerHeader className="border-b border-border/60 pb-4">
          <DrawerTitle className="font-display text-lg">More Options</DrawerTitle>
        </DrawerHeader>
        {moreItems.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 p-4">
            {moreItems.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => go(item.to)}
                className="flex flex-col items-center gap-2 rounded-[16px] border border-border/60 bg-card p-4 transition-colors active:bg-muted/50"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-6 w-6" />
                </span>
                <span className="text-center text-xs font-medium text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            All available modules are in the bottom navigation.
          </p>
        )}
        <div className="border-t border-border/60 p-4">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              void logout().then(() => navigate("/login"));
            }}
            className={cn(
              "mobile-btn-secondary w-full justify-center text-destructive",
              "border-destructive/30 hover:bg-destructive/5",
            )}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Sign Out
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
