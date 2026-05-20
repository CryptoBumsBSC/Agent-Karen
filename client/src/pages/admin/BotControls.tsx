import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout, useMe } from "./AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Users, MessageSquare, Shield, Trash2 } from "lucide-react";

type Stats = {
  communities: number; activeCommunities: number; trialCommunities: number;
  totalMembers: number;
  todayStats: { newJoins: number; messagesBlocked: number; warnCount: number; muteCount: number; spamBlocked: number; scamsBlocked: number };
  totalViolations: number; globalBans: number;
};

export default function BotControls() {
  const { data: me, isLoading: loadingMe } = useMe();
  const role = me?.user?.role || "moderator";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Bot controls are admin+ only — moderators get redirected
  useEffect(() => {
    if (!loadingMe && me?.user && me.user.role === "moderator") navigate("/admin");
  }, [loadingMe, me, navigate]);

  const isPrivileged = role === "owner" || role === "admin";
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/admin/stats"], enabled: isPrivileged });
  const { data: bans } = useQuery<any[]>({ queryKey: ["/api/admin/global-bans"], enabled: isPrivileged });

  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"active" | "all">("active");

  const broadcast = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/broadcast", { message, target });
      return res.json();
    },
    onSuccess: (res: any) => {
      toast({ title: "Broadcast sent", description: `${res.success} successful, ${res.failed} failed (of ${res.total} groups)` });
      setMessage("");
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeBan = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/global-bans/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/global-bans"] }),
  });

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bot Controls</h1>
        <p className="text-slate-500 text-sm">Global view, broadcast, and ban management</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Communities" value={stats?.communities ?? "—"} hint={`${stats?.activeCommunities ?? 0} active · ${stats?.trialCommunities ?? 0} trial`} icon={<Shield className="w-4 h-4" />} />
        <StatCard label="Total Members" value={stats?.totalMembers ?? "—"} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Messages Blocked Today" value={stats?.todayStats?.messagesBlocked ?? 0} icon={<MessageSquare className="w-4 h-4" />} />
        <StatCard label="Global Bans" value={stats?.globalBans ?? 0} icon={<Shield className="w-4 h-4" />} />
      </div>

      {stats && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Today's Moderation</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div><div className="text-xs text-slate-500">New Joins</div><div className="text-lg font-bold" data-testid="text-stat-joins">{stats.todayStats.newJoins}</div></div>
              <div><div className="text-xs text-slate-500">Warns</div><div className="text-lg font-bold">{stats.todayStats.warnCount}</div></div>
              <div><div className="text-xs text-slate-500">Mutes</div><div className="text-lg font-bold">{stats.todayStats.muteCount}</div></div>
              <div><div className="text-xs text-slate-500">Spam Blocked</div><div className="text-lg font-bold">{stats.todayStats.spamBlocked}</div></div>
              <div><div className="text-xs text-slate-500">Scams Blocked</div><div className="text-lg font-bold">{stats.todayStats.scamsBlocked}</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {role === "owner" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" /> Broadcast Message</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Type your announcement (Markdown supported)…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              className="mb-3"
              data-testid="input-broadcast-message"
            />
            <div className="flex gap-3 items-center">
              <Select value={target} onValueChange={(v) => setTarget(v as any)}>
                <SelectTrigger className="w-56" data-testid="select-broadcast-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active + trial + comp</SelectItem>
                  <SelectItem value="all">Every community (incl. free/banned)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={!message || broadcast.isPending}
                onClick={() => { if (confirm(`Send to ${target === "all" ? "ALL" : "active"} communities?`)) broadcast.mutate(); }}
                data-testid="button-broadcast"
              >
                {broadcast.isPending ? "Sending…" : "Send Broadcast"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Global Ban List</CardTitle></CardHeader>
        <CardContent>
          {!bans || bans.length === 0 ? (
            <div className="text-sm text-slate-500">No global bans</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Reason</TableHead><TableHead>Banned In</TableHead><TableHead>Date</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bans.map(b => (
                  <TableRow key={b.id} data-testid={`row-ban-${b.id}`}>
                    <TableCell>
                      <div className="text-sm">{b.displayName || b.username || b.userId}</div>
                      {b.username && <div className="text-xs text-slate-500">@{b.username}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{b.reason}</TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">{b.bannedInChatId}</TableCell>
                    <TableCell className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {(role === "owner" || role === "admin") && (
                        <Button size="sm" variant="ghost" onClick={() => removeBan.mutate(b.id)} data-testid={`button-unban-${b.id}`}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
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

function StatCard({ label, value, hint, icon }: { label: string; value: any; hint?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{label}</span>{icon}
        </div>
        <div className="text-2xl font-bold" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</div>
        {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
