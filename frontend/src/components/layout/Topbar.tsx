import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MesmsLogo } from "@/components/shared/MesmsLogo";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { api, type BackendBranch } from "@/lib/api";
import { NOTIFICATIONS_UPDATED } from "@/lib/notifications-events";
import { roleLabels } from "@/data/mock";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const { branchId, setBranchId } = useBranch();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [branches, setBranches] = useState<BackendBranch[]>([]);

  const loadUnreadCount = async () => {
    try {
      const { count } = await api.getNotificationsUnreadCount();
      setUnread(count);
    } catch {
      setUnread(0);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadUnreadCount();
    void api.listBranches().then(setBranches).catch(() => { /* ignore */ });

    const onUpdated = () => {
      void loadUnreadCount();
    };
    window.addEventListener(NOTIFICATIONS_UPDATED, onUpdated);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED, onUpdated);
  }, [user]);
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6">
      <button onClick={onMenu} className="text-muted-foreground lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search requests, equipment, customers…" className="bg-background pl-9" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <MesmsLogo size="sm" className="mr-1 hidden md:block" />
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="hidden w-44 sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("/app/notifications")}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: `hsl(${user.avatarColor})` }}
            >
              {user.name.charAt(0)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs font-normal text-muted-foreground">{roleLabels[user.role]}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/settings")}>Settings</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void logout().then(() => navigate("/login"));
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
