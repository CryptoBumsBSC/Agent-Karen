import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, MessageSquare, Shield, ChevronRight } from "lucide-react";

type Community = {
  chatId: string; displayName: string; botNickname: string;
  status: string; trialExpiresAt: string | null; isOnboarded: boolean;
  memberCount: number;
  todayStats: { newJoins: number; messagesBlocked: number; warnCount: number; muteCount: number; spamBlocked: number; scamsBlocked: number; } | null;
  createdAt: string;
};

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
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery<Community[]>({ queryKey: ["/api/admin/communities"] });

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
          {data && data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Community</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Today's Activity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(c => {
                  const dl = daysLeft(c.trialExpiresAt);
                  return (
                    <TableRow key={c.chatId} data-testid={`row-community-${c.chatId}`}>
                      <TableCell>
                        <div className="font-medium" data-testid={`text-name-${c.chatId}`}>{c.displayName}</div>
                        <div className="text-xs text-slate-500 font-mono">{c.chatId}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(c.status)} className="capitalize" data-testid={`badge-status-${c.chatId}`}>{c.status}</Badge>
                        {c.status === "trial" && dl !== null && (
                          <div className="text-xs text-slate-500 mt-1">{dl} days left</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm"><Users className="w-3 h-3" /> {c.memberCount}</div>
                      </TableCell>
                      <TableCell>
                        {c.todayStats ? (
                          <div className="flex gap-3 text-xs">
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {c.todayStats.messagesBlocked || 0}</span>
                            <span className="flex items-center gap-1 text-amber-600"><Shield className="w-3 h-3" /> {(c.todayStats.warnCount || 0) + (c.todayStats.muteCount || 0)}</span>
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
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
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
