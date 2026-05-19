import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMe } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, AlertCircle } from "lucide-react";

export default function AdminBootstrap() {
  const { data, isLoading } = useMe();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isLoading) return null;
  if (data?.user) { navigate("/admin"); return null; }
  if (!data?.needsBootstrap) { navigate("/admin/login"); return null; }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError(""); setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/auth/bootstrap", { email, password, displayName });
      const json = await res.json();
      queryClient.setQueryData(["/api/admin/auth/me"], { user: json.user });
      navigate("/admin");
    } catch (err: any) {
      setError(err?.message?.replace(/^\d+:\s*/, "") || "Setup failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><Shield className="w-10 h-10 text-emerald-600" /></div>
          <CardTitle>First-Time Setup</CardTitle>
          <CardDescription>Create the Owner account for the Karen Admin Portal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 p-3 rounded mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>This is a one-time setup. Whoever creates this account becomes the global Owner with full control.</span>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="displayName">Your name</Label>
              <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} data-testid="input-display-name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email" />
            </div>
            <div>
              <Label htmlFor="password">Password (min 8 chars)</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="text-error">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full" data-testid="button-bootstrap">
              {loading ? "Creating account…" : "Create Owner Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
