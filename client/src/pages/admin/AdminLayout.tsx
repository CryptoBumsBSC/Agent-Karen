import { ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Bot, LogOut, Shield, Book, Activity } from "lucide-react";

export type Me = { id: number; email: string; role: "owner" | "admin" | "moderator"; displayName?: string | null };

export function useMe() {
  return useQuery<{ user: Me | null; needsBootstrap?: boolean }>({
    queryKey: ["/api/admin/auth/me"],
  });
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { data, isLoading } = useMe();
  const [, navigate] = useLocation();
  const [isDashboard] = useRoute("/admin");
  const [isTeam] = useRoute("/admin/team");
  const [isBot] = useRoute("/admin/bot");
  const [isRef] = useRoute("/admin/reference");
  const [isActivity] = useRoute("/admin/activity");

  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>;

  if (!data?.user) {
    if (data?.needsBootstrap) {
      navigate("/admin/bootstrap");
    } else {
      navigate("/admin/login");
    }
    return null;
  }

  const me = data.user;

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/auth/logout");
    queryClient.clear();
    navigate("/admin/login");
  };

  const nav = [
    { href: "/admin", label: "Communities", icon: LayoutDashboard, active: isDashboard, show: true },
    { href: "/admin/bot", label: "Bot Controls", icon: Bot, active: isBot, show: true },
    { href: "/admin/reference", label: "Bot Reference", icon: Book, active: isRef, show: true },
    { href: "/admin/activity", label: "Activity Log", icon: Activity, active: isActivity, show: me.role !== "moderator" },
    { href: "/admin/team", label: "Team", icon: Users, active: isTeam, show: me.role === "owner" },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100">Karen Admin</div>
              <div className="text-xs text-slate-500">v2.0 Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.filter(n => n.show).map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  data-testid={`link-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                    item.active
                      ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 mb-1">Signed in as</div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100" data-testid="text-user-email">{me.email}</div>
          <div className="text-xs text-slate-500 capitalize mb-3" data-testid="text-user-role">{me.role}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" /> Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
