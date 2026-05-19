import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data, isLoading, error: fetchError } = useQuery<{ email: string; role: string }>({
    queryKey: ["/api/admin/auth/invite", token],
  });

  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-500">Loading…</div>;
  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md"><CardContent className="pt-6 text-center text-red-600">Invite is invalid or expired.</CardContent></Card>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/admin/auth/invite/${token}`, { password, displayName });
      const json = await res.json();
      queryClient.setQueryData(["/api/admin/auth/me"], { user: json.user });
      navigate("/admin");
    } catch (err: any) {
      setError(err?.message?.replace(/^\d+:\s*/, "") || "Accept failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><Shield className="w-10 h-10 text-emerald-600" /></div>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            You've been invited as <span className="font-medium capitalize">{data?.role}</span><br />
            Email: <span className="font-mono text-xs">{data?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="displayName">Your name</Label>
              <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} data-testid="input-display-name" />
            </div>
            <div>
              <Label htmlFor="password">Set password (min 8 chars)</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="text-error">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full" data-testid="button-accept">
              {loading ? "Creating…" : "Accept & Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
