import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout, useMe } from "./AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plug, Trash2, Activity, Plus } from "lucide-react";

type Instance = {
  id: number;
  name: string;
  baseUrl: string;
  sharedSecret: string;
  isLocal: boolean;
  status: string;
  lastSeenAt: string | null;
  lastError: string | null;
};

export default function Instances() {
  const { data: me, isLoading } = useMe();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isOwner = me?.user?.role === "owner";

  useEffect(() => {
    if (!isLoading && me?.user && !isOwner) navigate("/admin");
  }, [isLoading, me, isOwner, navigate]);

  const { data: instances } = useQuery<Instance[]>({
    queryKey: ["/api/admin/instances"],
    enabled: isOwner,
  });

  const [form, setForm] = useState({ name: "", baseUrl: "", sharedSecret: "" });

  const add = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/instances", form); },
    onSuccess: () => {
      toast({ title: "Instance added" });
      setForm({ name: "", baseUrl: "", sharedSecret: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/instances"] });
    },
    onError: (e: any) => toast({ title: "Failed to add", description: e?.message, variant: "destructive" }),
  });

  const test = useMutation({
    mutationFn: async (id: number) => await apiRequest("POST", `/api/admin/instances/${id}/test`),
    onSuccess: async (res: any) => {
      const body = await res.json();
      toast({
        title: body.ok ? "Instance reachable" : "Instance unreachable",
        description: body.ok ? `Reports ${body.info?.memberCount ?? 0} members` : body.error,
        variant: body.ok ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/instances"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/instances/${id}`); },
    onSuccess: () => {
      toast({ title: "Instance removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/instances"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  if (!isOwner) return null;

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="w-6 h-6" /> Bot Instances
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Register every Karen bot deployment you own. Each fork exposes a Hub API protected by its own shared secret.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> Add a remote instance</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="text-xs font-medium block mb-1">Nickname</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="brandx-bot" data-testid="input-instance-name" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium block mb-1">Public URL</label>
              <Input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://brandx-bot.example.com" data-testid="input-instance-url" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Shared secret</label>
              <Input value={form.sharedSecret} onChange={e => setForm({ ...form, sharedSecret: e.target.value })} placeholder="HUB_LOCAL_SECRET from that fork" data-testid="input-instance-secret" />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => add.mutate()} disabled={add.isPending || !form.name || !form.baseUrl || !form.sharedSecret} data-testid="button-add-instance">
              Add instance
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Registered instances</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(instances || []).map(i => (
                <TableRow key={i.id} data-testid={`row-instance-${i.id}`}>
                  <TableCell className="font-medium">
                    {i.name}
                    {i.isLocal && <Badge variant="secondary" className="ml-2">local</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{i.baseUrl}</TableCell>
                  <TableCell>
                    <Badge
                      variant={i.status === "ok" ? "default" : i.status === "down" ? "destructive" : "secondary"}
                      data-testid={`badge-status-${i.id}`}
                    >
                      {i.status}
                    </Badge>
                    {i.lastError && <div className="text-xs text-red-500 mt-1">{i.lastError}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {i.lastSeenAt ? new Date(i.lastSeenAt).toLocaleString() : "never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => test.mutate(i.id)} disabled={test.isPending} data-testid={`button-test-${i.id}`}>
                      <Activity className="w-4 h-4 mr-1" /> Test
                    </Button>
                    {!i.isLocal && (
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove ${i.name}?`)) remove.mutate(i.id); }} data-testid={`button-remove-${i.id}`}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!instances || instances.length === 0) && (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">No instances registered yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Show local secret + setup guide for forks */}
      {instances?.find(i => i.isLocal) && (
        <Card className="mt-6 border-emerald-200">
          <CardHeader><CardTitle className="text-base">This instance's Hub secret</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-2">
              Other Hubs can register THIS deployment using the following secret. To rotate it, edit the <code>bot_instances</code> row directly or set <code>HUB_LOCAL_SECRET</code> in environment variables and re-create the row.
            </p>
            <code className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded block break-all" data-testid="text-local-secret">
              {instances.find(i => i.isLocal)?.sharedSecret}
            </code>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}
