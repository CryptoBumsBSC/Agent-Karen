import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout, useMe } from "./AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2 } from "lucide-react";

type Detail = {
  community: { chatId: string; displayName: string; botNickname: string; status: string; trialExpiresAt: string | null; isOnboarded: boolean; };
  features: Record<string, any>;
  featureGroups: Record<string, string[]>;
  memberCount: number;
};

const FEATURE_LABELS: Record<string, string> = {
  spam: "Anti-Spam", scam: "Scam Detection", drugs: "Drug Detection", dealers: "Dealer Detection",
  hate: "Hate Speech Filter", links: "Link Control", files: "Dangerous File Blocking", edits: "Edit Monitoring",
  raid: "Anti-Raid Mode", impersonation: "Admin Impersonation", newuser: "New User Restrictions",
  captcha: "Join CAPTCHA", accountAge: "Account Age Check", massMention: "Mass Mention Block",
  crossBan: "Global Ban Sync", bioScan: "Bio Scam Scan",
  personality: "Karen Personality", learning: "Bot Learning", aiChat: "AI Chat (GPT)", medicalQA: "Medical Q&A",
  gifs: "GIF Reactions", stories: "Story Generator",
  scheduled: "Scheduled Posts", referrals: "Referral Program", giveaways: "Giveaways", games: "Games", trust: "Trust System",
};

export default function CommunityDetail() {
  const { chatId } = useParams<{ chatId: string }>();
  const { data: me } = useMe();
  const { toast } = useToast();
  const role = me?.user?.role || "moderator";
  const canEdit = role === "owner" || role === "admin";

  const { data, isLoading } = useQuery<Detail>({ queryKey: ["/api/admin/communities", chatId] });

  const [trialDays, setTrialDays] = useState(7);

  const toggleFeature = useMutation({
    mutationFn: async ({ feature, value }: { feature: string; value: boolean }) => {
      await apiRequest("PATCH", `/api/admin/communities/${chatId}/features`, { feature, value });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/communities", chatId] }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => { await apiRequest("PATCH", `/api/admin/communities/${chatId}/status`, { status }); },
    onSuccess: () => {
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communities", chatId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communities"] });
    },
  });

  const extendTrial = useMutation({
    mutationFn: async () => { await apiRequest("PATCH", `/api/admin/communities/${chatId}/trial`, { days: trialDays }); },
    onSuccess: () => {
      toast({ title: `Trial extended by ${trialDays} days` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communities", chatId] });
    },
  });

  const removeCommunity = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/admin/communities/${chatId}`); },
    onSuccess: () => {
      toast({ title: "Community removed" });
      window.location.href = "/admin";
    },
  });

  if (isLoading || !data) return <AdminLayout><div className="text-slate-500">Loading…</div></AdminLayout>;
  const c = data.community;

  return (
    <AdminLayout>
      <Link href="/admin">
        <a className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-3" data-testid="link-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Communities
        </a>
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100" data-testid="text-community-name">{c.displayName}</h1>
          <div className="text-sm text-slate-500 font-mono mt-1">{c.chatId}</div>
          <div className="mt-2 flex items-center gap-2">
            <Badge className="capitalize" data-testid="badge-status">{c.status}</Badge>
            {c.trialExpiresAt && <span className="text-xs text-slate-500">Trial expires {new Date(c.trialExpiresAt).toLocaleDateString()}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" data-testid="text-member-count">{data.memberCount}</div>
          <div className="text-xs text-slate-500">members</div>
        </div>
      </div>

      <Tabs defaultValue="features">
        <TabsList>
          <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
          <TabsTrigger value="violations" data-testid="tab-violations">Violations</TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">Top Members</TabsTrigger>
          {canEdit && <TabsTrigger value="settings" data-testid="tab-settings">Subscription</TabsTrigger>}
        </TabsList>

        <TabsContent value="features" className="space-y-4 mt-4">
          {!canEdit && <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 p-3 rounded">View-only mode. Admins and Owners can edit toggles.</div>}
          {Object.entries(data.featureGroups).map(([group, features]) => (
            <Card key={group}>
              <CardHeader><CardTitle className="text-base">{group}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {features.map(f => (
                  <div key={f} className="flex items-center justify-between py-2 px-3 border rounded" data-testid={`row-feature-${f}`}>
                    <div>
                      <div className="text-sm font-medium">{FEATURE_LABELS[f] || f}</div>
                      <div className="text-xs text-slate-500 font-mono">{f}</div>
                    </div>
                    <Switch
                      checked={!!data.features[f]}
                      disabled={!canEdit || toggleFeature.isPending}
                      onCheckedChange={(v) => toggleFeature.mutate({ feature: f, value: v })}
                      data-testid={`switch-${f}`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="violations" className="mt-4">
          <ViolationsList chatId={chatId} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <MembersList chatId={chatId} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="settings" className="mt-4 space-y-4">
            {/* Status change + community removal are owner-only */}
            {role === "owner" && (
              <Card>
                <CardHeader><CardTitle className="text-base">Subscription Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-3 items-end">
                    <div>
                      <label className="text-sm font-medium block mb-1">Change status</label>
                      <Select value={c.status} onValueChange={(v) => changeStatus.mutate(v)}>
                        <SelectTrigger className="w-48" data-testid="select-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active (paid)</SelectItem>
                          <SelectItem value="complimentary">Complimentary</SelectItem>
                          <SelectItem value="free">Free (limited)</SelectItem>
                          <SelectItem value="banned">Banned (bot silent)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Trial extension is available to admins and owners */}
            <Card>
              <CardHeader><CardTitle className="text-base">Extend Trial</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-3 items-end">
                  <div>
                    <label className="text-sm font-medium block mb-1">Days to add</label>
                    <Input type="number" min={1} max={365} value={trialDays} onChange={e => setTrialDays(parseInt(e.target.value) || 1)} className="w-32" data-testid="input-trial-days" />
                  </div>
                  <Button onClick={() => extendTrial.mutate()} data-testid="button-extend-trial">Extend</Button>
                </div>
                {role !== "owner" && (
                  <p className="text-xs text-slate-500 mt-2">Status changes and removing the community require Owner role.</p>
                )}
              </CardContent>
            </Card>
            {role === "owner" && (
              <Card className="border-red-200">
                <CardHeader><CardTitle className="text-base text-red-600">Danger Zone</CardTitle></CardHeader>
                <CardContent>
                  <Button variant="destructive" onClick={() => { if (confirm("Remove this community? The bot will lose all settings.")) removeCommunity.mutate(); }} data-testid="button-remove-community">
                    <Trash2 className="w-4 h-4 mr-2" /> Remove community
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </AdminLayout>
  );
}

function ViolationsList({ chatId }: { chatId: string }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/communities", chatId, "violations"] });
  const { toast } = useToast();
  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/violations/${id}`); },
    onSuccess: () => {
      toast({ title: "Cleared" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/communities", chatId, "violations"] });
    },
  });
  if (isLoading) return <div className="text-slate-500">Loading…</div>;
  if (!data || data.length === 0) return <div className="text-slate-500 text-sm">No violations recorded</div>;
  return (
    <Card><CardContent className="pt-4 space-y-2">
      {data.map(v => (
        <div key={v.id} className="flex items-start justify-between py-2 border-b last:border-0 text-sm" data-testid={`row-violation-${v.id}`}>
          <div className="flex-1">
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className="text-xs">{v.violationType}</Badge>
              <span className="text-xs text-slate-500">{v.actionTaken}</span>
              <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleString()}</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">@{v.username || v.userId}</div>
            {v.violatingContent && <div className="text-xs text-slate-500 truncate mt-1 font-mono">{v.violatingContent}</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => del.mutate(v.id)} data-testid={`button-clear-violation-${v.id}`}>
            <Trash2 className="w-4 h-4 text-slate-400" />
          </Button>
        </div>
      ))}
    </CardContent></Card>
  );
}

function MembersList({ chatId }: { chatId: string }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/communities", chatId, "members"] });
  if (isLoading) return <div className="text-slate-500">Loading…</div>;
  if (!data || data.length === 0) return <div className="text-slate-500 text-sm">No member data yet</div>;
  return (
    <Card><CardContent className="pt-4 divide-y">
      {data.map(m => (
        <div key={m.id} className="flex items-center justify-between py-2 text-sm" data-testid={`row-member-${m.id}`}>
          <div>
            <div className="font-medium">{m.firstName || m.username || m.telegramUserId}</div>
            {m.username && <div className="text-xs text-slate-500">@{m.username}</div>}
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{m.messageCount} msgs</div>
            <div>{m.triviaPoints} trivia · {m.referralPoints} ref</div>
          </div>
        </div>
      ))}
    </CardContent></Card>
  );
}
