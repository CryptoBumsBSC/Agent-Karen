import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type Community = {
  chatId: string; displayName: string; botNickname: string;
  status: string; trialExpiresAt: string | null; isOnboarded: boolean;
  memberCount: number;
  todayStats: { newJoins: number; messagesBlocked: number; warnCount: number; muteCount: number; spamBlocked: number; scamsBlocked: number; } | null;
  createdAt: string;
};

type SortKey = "name" | "status" | "trial" | "members" | "warns" | "mutes" | "bans" | "deletions";

function statusVariant(s: string) {
  if (s === "active") return "default";
  if (s === "trial") return "secondary";
  if (s === "complimentary") return "outline";
  if (s === "free") return "outline";
  if (s === "banned") return "destructive";
  return "outline";
}

function daysLeft(d: string | null) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function sortValue(c: Community, key: SortKey): string | number {
  const s = c.todayStats;
  switch (key) {
    case "name": return c.displayName?.toLowerCase() || "";
    case "status": return c.status;
    case "trial": return c.trialExpiresAt ? new Date(c.trialExpiresAt).getTime() : Infinity;
    case "members": return c.memberCount || 0;
    case "warns": return s?.warnCount || 0;
    case "mutes": return s?.muteCount || 0;
    case "bans": return (s?.spamBlocked || 0) + (s?.scamsBlocked || 0);
    case "deletions": return s?.messagesBlocked || 0;
  }
}

function SortHeader({ k, sort, setSort, children, className }: any) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        onClick={() => setSort({ key: k, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
        className="inline-flex items-center gap-1 hover-elevate active-elevate-2 px-2 py-1 -mx-2 -my-1 rounded text-left"
        data-testid={`sort-${k}`}
      >
        {children}
        <Icon className={`w-3 h-3 ${active ? "text-emerald-600" : "text-slate-400"}`} />
      </button>
    </TableHead>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<Community[]>({ queryKey: ["/api/admin/communities"] });
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const sorted = useMemo(() => {
    if (!data) return [];
    const arr = [...data];
    arr.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [data, sort]);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Communities</h1>
        <p className="text-slate-500 text-sm">All Telegram groups where Karen is active</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> {data?.length || 0} communities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-slate-500 py-8 text-center">Loading…</div>}
          {!isLoading && (!data || data.length === 0) && (
            <div className="text-slate-500 py-8 text-center" data-testid="text-empty">
              No communities yet. Add Karen to a Telegram group to get started.
            </div>
          )}
          {sorted.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader k="name" sort={sort} setSort={setSort}>Community</SortHeader>
                    <SortHeader k="status" sort={sort} setSort={setSort}>Status</SortHeader>
                    <SortHeader k="trial" sort={sort} setSort={setSort}>Trial Expiry</SortHeader>
                    <SortHeader k="members" sort={sort} setSort={setSort} className="text-right">Members</SortHeader>
                    <SortHeader k="warns" sort={sort} setSort={setSort} className="text-right">Warns</SortHeader>
                    <SortHeader k="mutes" sort={sort} setSort={setSort} className="text-right">Mutes</SortHeader>
                    <SortHeader k="bans" sort={sort} setSort={setSort} className="text-right">Bans Today</SortHeader>
                    <SortHeader k="deletions" sort={sort} setSort={setSort} className="text-right">Deletions</SortHeader>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(c => {
                    const dl = daysLeft(c.trialExpiresAt);
                    const expired = dl !== null && dl < 0;
                    const warning = dl !== null && dl <= 3 && dl >= 0;
                    const s = c.todayStats;
                    const banCount = (s?.spamBlocked || 0) + (s?.scamsBlocked || 0);
                    return (
                      <TableRow key={c.chatId} data-testid={`row-community-${c.chatId}`}>
                        <TableCell>
                          <div className="font-medium" data-testid={`text-name-${c.chatId}`}>{c.displayName}</div>
                          <div className="text-xs text-slate-500 font-mono">{c.chatId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(c.status)} className="capitalize" data-testid={`badge-status-${c.chatId}`}>{c.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {!c.trialExpiresAt ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : expired ? (
                            <span className="text-xs text-red-600 font-medium" data-testid={`trial-${c.chatId}`}>
                              Expired {Math.abs(dl!)}d ago
                            </span>
                          ) : (
                            <span className={`text-xs ${warning ? "text-amber-600 font-medium" : "text-slate-600 dark:text-slate-300"}`} data-testid={`trial-${c.chatId}`}>
                              {dl}d left
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.memberCount}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-600">{s?.warnCount || 0}</TableCell>
                        <TableCell className="text-right tabular-nums text-orange-600">{s?.muteCount || 0}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">{banCount}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">{s?.messagesBlocked || 0}</TableCell>
                        <TableCell>
                          <Link href={`/admin/community/${c.chatId}`}>
                            <a className="text-emerald-600 hover:text-emerald-700 inline-flex items-center text-sm" data-testid={`link-manage-${c.chatId}`}>
                              Manage <ChevronRight className="w-4 h-4" />
                            </a>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
