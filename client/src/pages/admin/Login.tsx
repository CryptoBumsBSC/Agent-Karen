import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMe } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export default function AdminLogin() {
  const { data } = useMe();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (data?.user) { navigate("/admin"); return null; }
  if (data?.needsBootstrap) { navigate("/admin/bootstrap"); return null; }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/auth/login", { email, password });
      const json = await res.json();
      queryClient.setQueryData(["/api/admin/auth/me"], { user: json.user });
      navigate("/admin");
    } catch (err: any) {
      setError(err?.message?.replace(/^\d+:\s*/, "") || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><Shield className="w-10 h-10 text-emerald-600" /></div>
          <CardTitle>Karen Admin Portal</CardTitle>
          <CardDescription>Sign in to manage your communities</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" />
            </div>
            {error && <div className="text-sm text-red-600" data-testid="text-error">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full" data-testid="button-login">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
