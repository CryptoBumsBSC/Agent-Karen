import { useQuery } from "@tanstack/react-query";
import { AdminLayout, useMe } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, Server } from "lucide-react";

type AggRow = {
  id: number;
  name: string;
  baseUrl: string;
  isLocal: boolean;
  status: "ok" | "down";
  info?: { memberCount: number; uptimeSec: number; version: string };
  stats?: {
    communities: number;
    activeCommunities: number;
    trialCommunities: number;
    totalMembers: number;
    totalViolations: number;
    todayStats: { newJoins: number; messagesBlocked: number; warnCount: number; muteCount: number; spamBlocked: number; scamsBlocked: number };
  };
  error?: string | null;
};

export default function AllBots() {
  const { data: me } = useMe();
  const role = me?.user?.role || "moderator";
  const enabled = role === "owner" || role === "admin";

  const { data, isLoading, isFetching } = useQuery<AggRow[]>({
    queryKey: ["/api/admin/instances/aggregate"],
    enabled,
    refetchInterval: 60_000,
  });

  if (!enabled) return null;

  const rows = data || [];
  const totals = rows.reduce((acc, r) => ({
    communities: acc.communities + (r.stats?.communities ?? 0),
    members: acc.members + (r.stats?.totalMembers ?? 0),
    todayBans: acc.todayBans + ((r.stats?.todayStats?.spamBlocked ?? 0) + (r.stats?.todayStats?.scamsBlocked ?? 0)),
    healthy: acc.healthy + (r.status === "ok" ? 1 : 0),
  }), { communities: 0, members: 0, todayBans: 0, healthy: 0 });

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="w-6 h-6" /> All Bots
          </h1>
          <p className="text-sm text-slate-500 mt-1">Live overview across every registered bot deployment.</p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/instances/aggregate"] })}
          disabled={isFetching}
          data-testid="button-refresh-aggregate"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Top-line totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Bots online" value={`${totals.healthy} / ${rows.length}`} testId="summary-bots-online" />
        <SummaryCard label="Communities" value={totals.communities} testId="summary-communities" />
        <SummaryCard label="Members" value={totals.members.toLocaleString()} testId="summary-members" />
        <SummaryCard label="Spam+Scams today" value={totals.todayBans} testId="summary-bans-today" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading && <Card><CardContent className="py-10 text-center text-slate-500">Loading…</CardContent></Card>}
        {!isLoading && rows.length === 0 && (
          <Card><CardContent className="py-10 text-center text-slate-500">No instances registered yet.</CardContent></Card>
        )}
        {rows.map(r => (
          <Card key={r.id} data-testid={`card-instance-${r.id}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {r.name}
                  {r.isLocal && <Badge variant="secondary">local</Badge>}
                </span>
                <Badge variant={r.status === "ok" ? "default" : "destructive"}>{r.status}</Badge>
              </CardTitle>
              <div className="text-xs text-slate-500 font-mono truncate">{r.baseUrl}</div>
            </CardHeader>
            <CardContent>
              {r.status === "down" || !r.stats ? (
                <div className="text-sm text-red-500">{r.error || "Unreachable"}</div>
              ) : (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Communities" value={r.stats.communities} />
                  <Stat label="Active" value={r.stats.activeCommunities} />
                  <Stat label="Trial" value={r.stats.trialCommunities} />
                  <Stat label="Members" value={r.stats.totalMembers.toLocaleString()} />
                  <Stat label="Violations" value={r.stats.totalViolations} />
                  <Stat label="Joins today" value={r.stats.todayStats.newJoins} />
                  <Stat label="Warns today" value={r.stats.todayStats.warnCount} />
                  <Stat label="Mutes today" value={r.stats.todayStats.muteCount} />
                  <Stat label="Blocked today" value={r.stats.todayStats.spamBlocked + r.stats.todayStats.scamsBlocked} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ label, value, testId }: { label: string; value: any; testId: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-1" data-testid={testId}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
