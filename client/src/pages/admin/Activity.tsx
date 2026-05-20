import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AdminLayout, useMe } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity as ActivityIcon } from "lucide-react";

type Entry = {
  id: number;
  adminEmail: string;
  adminRole: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "feature.toggle": "Toggled feature",
  "community.status": "Changed community status",
  "community.trial.extend": "Extended trial",
  "community.delete": "Deleted community",
  "violation.clear": "Cleared violation",
  "team.invite": "Invited team member",
  "team.invite.cancel": "Cancelled invite",
  "team.role.change": "Changed role",
  "team.remove": "Removed team member",
  "global_ban.remove": "Removed global ban",
  "broadcast.send": "Sent broadcast",
};

function roleColor(r: string) {
  if (r === "owner") return "bg-purple-600";
  if (r === "admin") return "bg-blue-600";
  return "bg-slate-500";
}

function summarize(details: string | null): string {
  if (!details) return "";
  try {
    const d = JSON.parse(details);
    if (d.feature && typeof d.value === "boolean") return `${d.feature} → ${d.value ? "ON" : "OFF"}`;
    if (d.from && d.to) return `${d.from} → ${d.to}`;
    if (d.email && d.role) return `${d.email} (${d.role})`;
    if (d.email) return d.email;
    if (typeof d.success === "number") return `${d.success}/${d.total} delivered`;
    if (d.preview) return `"${d.preview.slice(0, 60)}${d.preview.length > 60 ? '…' : ''}"`;
    if (d.days) return `+${d.days} days`;
    if (d.displayName) return d.displayName;
    return JSON.stringify(d).slice(0, 80);
  } catch { return ""; }
}

export default function Activity() {
  const { data: me, isLoading: loadingMe } = useMe();
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<Entry[]>({
    queryKey: ["/api/admin/audit"],
    enabled: me?.user?.role === "owner" || me?.user?.role === "admin",
  });

  useEffect(() => {
    if (!loadingMe && me?.user && me.user.role === "moderator") navigate("/admin");
  }, [loadingMe, me, navigate]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ActivityIcon className="w-6 h-6" /> Activity Log
        </h1>
        <p className="text-slate-500 text-sm">Every change made in the admin portal (last 200 events)</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-slate-500 py-8 text-center">Loading…</div>}
          {data && data.length === 0 && (
            <div className="text-slate-500 py-8 text-center">No activity yet.</div>
          )}
          {data && data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(e => (
                  <TableRow key={e.id} data-testid={`row-audit-${e.id}`}>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{e.adminEmail}</div>
                      <Badge className={`${roleColor(e.adminRole)} text-white text-xs capitalize`}>{e.adminRole}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{ACTION_LABELS[e.action] || e.action}</div>
                      <code className="text-xs text-slate-400">{e.action}</code>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      {e.targetType && <div className="text-slate-400">{e.targetType}</div>}
                      {e.targetId || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-300 max-w-md">
                      {summarize(e.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
