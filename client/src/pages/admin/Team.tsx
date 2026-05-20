import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout, useMe } from "./AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, UserPlus } from "lucide-react";

type TeamData = {
  users: { id: number; email: string; role: string; displayName: string | null; createdAt: string; lastLoginAt: string | null }[];
  invites: { id: number; email: string; role: string; token: string; expiresAt: string }[];
};

export default function AdminTeam() {
  const { data: me, isLoading: loadingMe } = useMe();
  const [, navigate] = useLocation();

  // Client-side guard: only Owners can access this page (backend also enforces 403)
  useEffect(() => {
    if (!loadingMe && me?.user && me.user.role !== "owner") navigate("/admin");
  }, [loadingMe, me, navigate]);

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["/api/admin/team"],
    enabled: me?.user?.role === "owner",
  });
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "admin" | "moderator">("moderator");

  const inviteMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/team/invite", { email, role });
      return res.json();
    },
    onSuccess: (res) => {
      const fullUrl = `${window.location.origin}${res.acceptUrl}`;
      navigator.clipboard.writeText(fullUrl).catch(() => {});
      toast({ title: "Invite created", description: "Link copied to clipboard" });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      await apiRequest("PATCH", `/api/admin/team/${id}`, { role });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] }),
  });

  const removeUser = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/team/${id}`); },
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/team/invite/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] }),
  });

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Team</h1>
        <p className="text-slate-500 text-sm">Invite team members and manage their access roles</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invite new member</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-invite-email" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger className="w-40" data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => inviteMut.mutate()} disabled={!email || inviteMut.isPending} data-testid="button-send-invite">
              {inviteMut.isPending ? "Creating…" : "Generate Invite Link"}
            </Button>
          </div>
          <div className="text-xs text-slate-500 mt-3">
            Invite link will be copied to your clipboard. Share it directly with the new team member.
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Active Members</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="text-slate-500">Loading…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name / Email</TableHead><TableHead>Role</TableHead><TableHead>Last Login</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.users.map(u => (
                  <TableRow key={u.id} data-testid={`row-member-${u.id}`}>
                    <TableCell>
                      <div className="font-medium">{u.displayName || u.email.split("@")[0]}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => changeRole.mutate({ id: u.id, role: v })} disabled={u.id === me?.user?.id}>
                        <SelectTrigger className="w-32" data-testid={`select-role-${u.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</TableCell>
                    <TableCell>
                      {u.id !== me?.user?.id && (
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove this member?")) removeUser.mutate(u.id); }} data-testid={`button-remove-${u.id}`}>
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

      {data && data.invites.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Pending Invites</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Expires</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.invites.map(inv => (
                  <TableRow key={inv.id} data-testid={`row-invite-${inv.id}`}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{inv.role}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-500">{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/admin/accept-invite/${inv.token}`);
                        toast({ title: "Link copied" });
                      }} data-testid={`button-copy-${inv.id}`}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelInvite.mutate(inv.id)} data-testid={`button-cancel-${inv.id}`}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}
