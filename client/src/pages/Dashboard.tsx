import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import {
  ShieldCheck, Clock, Zap, Gift, Ban, Users,
  CheckCircle, RefreshCw, Lock, LayoutDashboard,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// The session token is issued by the server after PIN validation.
// The master secret (DASHBOARD_SECRET) never exists in client-side code.
function getSessionToken(): string {
  return sessionStorage.getItem("dashboard_session") || "";
}

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${getSessionToken()}` };
}

type FeatureSettings = {
  spam: boolean; scam: boolean; drugs: boolean; dealers: boolean;
  hate: boolean; raid: boolean; links: boolean; edits: boolean;
  files: boolean; impersonation: boolean; newuser: boolean; gifs: boolean;
  personality: boolean; learning: boolean; scheduled: boolean;
  referrals: boolean; giveaways: boolean; games: boolean; trust: boolean;
  stories: boolean; captcha: boolean; accountAge: boolean;
  massMention: boolean; crossBan: boolean; bioScan: boolean;
  aiChat: boolean; medicalQA: boolean;
} | null;

type Community = {
  id: number;
  chatId: string;
  displayName: string;
  botNickname: string | null;
  status: string;
  trialExpiresAt: string | null;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
  features: FeatureSettings;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  trial:        { label: "Trial",         color: "bg-amber-100 text-amber-800 border-amber-200",    icon: Clock },
  active:       { label: "Active",        color: "bg-green-100 text-green-800 border-green-200",    icon: CheckCircle },
  free:         { label: "Free",          color: "bg-gray-100 text-gray-600 border-gray-200",       icon: Zap },
  complimentary:{ label: "Complimentary", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Gift },
  banned:       { label: "Banned",        color: "bg-red-100 text-red-800 border-red-200",          icon: Ban },
};

const FEATURE_LABELS: Record<string, string> = {
  spam: "Spam Filter", scam: "Scam Protection", drugs: "Drug Detection",
  dealers: "Dealer Detection", hate: "Hate Speech", raid: "Anti-Raid",
  links: "Link Control", edits: "Edit Tracking", files: "File Blocking",
  impersonation: "Impersonation", newuser: "New User Guard", gifs: "GIF Reactions",
  personality: "Personality", learning: "Bot Learning", scheduled: "Scheduled Posts",
  referrals: "Referrals", giveaways: "Giveaways", games: "Games",
  trust: "Trust System", stories: "Story Generator", captcha: "CAPTCHA",
  accountAge: "Account Age", massMention: "Mass Mention", crossBan: "Cross-Ban",
  bioScan: "Bio Scan", aiChat: "AI Chat", medicalQA: "Medical Q&A",
};

// ─── PIN Gate ─────────────────────────────────────────────────────────────────
// Sends PIN to the server for validation. Server issues a short-lived session
// token — the master secret (DASHBOARD_SECRET) never exists in client code.
function PinGate({ onUnlock }: { onUnlock: (token: string) => void }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.status === 503) {
        setError("Dashboard authentication is not configured on the server. Set the DASHBOARD_SECRET env var.");
        return;
      }
      if (!res.ok) {
        setError("Incorrect PIN. Try again.");
        setPin("");
        return;
      }
      const { token } = await res.json();
      sessionStorage.setItem("dashboard_session", token);
      onUnlock(token);
      toast({ title: "Welcome back, boss." });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-body">
      <Navigation />
      <main className="flex-grow flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-white border border-primary/20 rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-1">Owner Dashboard</h2>
          <p className="text-sm text-gray-500 mb-6">Enter your PIN to continue</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              data-testid="input-dashboard-pin"
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(""); }}
              placeholder="PIN"
              autoComplete="current-password"
              className={`w-full text-center text-xl tracking-widest border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40 transition-all ${error ? "border-red-400 bg-red-50" : "border-gray-200"}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              data-testid="button-dashboard-unlock"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Unlock"}
            </button>
          </form>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-gray-100 text-gray-600 border-gray-200", icon: Zap };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Feature Grid ─────────────────────────────────────────────────────────────
function FeatureGrid({ features }: { features: FeatureSettings }) {
  if (!features) return <p className="text-xs text-gray-400 italic">No feature settings recorded yet</p>;
  const entries = Object.entries(FEATURE_LABELS);
  const on  = entries.filter(([k]) => (features as any)[k] === true);
  const off = entries.filter(([k]) => (features as any)[k] === false);
  return (
    <div className="flex flex-wrap gap-1.5">
      {on.map(([k, label]) => (
        <span key={k} data-testid={`feature-on-${k}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">
          <CheckCircle className="w-3 h-3" /> {label}
        </span>
      ))}
      {off.map(([k, label]) => (
        <span key={k} data-testid={`feature-off-${k}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-400 border border-gray-200">
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Community Card ───────────────────────────────────────────────────────────
function CommunityCard({ community, onStatusChange }: { community: Community; onStatusChange: (chatId: string, status: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const isTrialExpired = community.status === "trial" && community.trialExpiresAt && new Date(community.trialExpiresAt) < new Date();
  const trialDaysLeft  = community.trialExpiresAt
    ? Math.ceil((new Date(community.trialExpiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`card-community-${community.chatId}`}
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 data-testid={`text-community-name-${community.chatId}`} className="font-bold text-gray-900 truncate">{community.displayName}</h3>
              <p className="text-xs text-gray-400 font-mono">{community.chatId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={community.status} />
            {community.isOnboarded && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                <ShieldCheck className="w-3 h-3" /> Onboarded
              </span>
            )}
          </div>
        </div>

        {/* Trial expiry */}
        {community.status === "trial" && community.trialExpiresAt && (
          <div className={`mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg ${isTrialExpired ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            {isTrialExpired
              ? "Trial has expired"
              : `Trial expires in ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} — ${new Date(community.trialExpiresAt).toLocaleDateString()}`}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {community.status !== "active" && (
            <button data-testid={`button-activate-${community.chatId}`} onClick={() => onStatusChange(community.chatId, "active")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
              <CheckCircle className="w-3.5 h-3.5" /> Activate
            </button>
          )}
          {community.status !== "complimentary" && (
            <button data-testid={`button-makefree-${community.chatId}`} onClick={() => onStatusChange(community.chatId, "complimentary")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors">
              <Gift className="w-3.5 h-3.5" /> Complimentary
            </button>
          )}
          {community.status !== "free" && (
            <button data-testid={`button-deactivate-${community.chatId}`} onClick={() => onStatusChange(community.chatId, "free")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
              <Zap className="w-3.5 h-3.5" /> Downgrade
            </button>
          )}
          {community.status !== "banned" && (
            <button data-testid={`button-ban-${community.chatId}`} onClick={() => onStatusChange(community.chatId, "banned")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
              <Ban className="w-3.5 h-3.5" /> Ban
            </button>
          )}
        </div>

        {/* Feature toggles expand */}
        <button
          data-testid={`button-features-toggle-${community.chatId}`}
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Hide features" : "Show feature toggles"}
        </button>

        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 pt-3 border-t border-gray-100">
            <FeatureGrid features={community.features} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Dashboard Content ────────────────────────────────────────────────────────
function DashboardContent() {
  const { toast } = useToast();

  const { data: communities = [], isLoading, isError, refetch, isFetching } = useQuery<Community[]>({
    queryKey: ["/api/dashboard/communities"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/communities", { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ chatId, status }: { chatId: string; status: string }) => {
      const res = await fetch(`/api/dashboard/communities/${encodeURIComponent(chatId)}/status`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/communities"] });
      toast({ title: "Status updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const counts = {
    total:         communities.length,
    active:        communities.filter(c => c.status === "active").length,
    trial:         communities.filter(c => c.status === "trial").length,
    free:          communities.filter(c => c.status === "free").length,
    complimentary: communities.filter(c => c.status === "complimentary").length,
  };

  return (
    <div className="min-h-screen flex flex-col font-body bg-gray-50">
      <Navigation />
      <main className="flex-grow container max-w-4xl mx-auto px-4 py-10">

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-gray-900">Community Dashboard</h1>
              <p className="text-sm text-gray-500">Owner-only · Manage Telegram group subscriptions</p>
            </div>
          </div>
        </motion.div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Total",         value: counts.total,         color: "text-gray-900", bg: "bg-white" },
            { label: "Active",        value: counts.active,        color: "text-green-700", bg: "bg-green-50" },
            { label: "Trial",         value: counts.trial,         color: "text-amber-700", bg: "bg-amber-50" },
            { label: "Free",          value: counts.free,          color: "text-gray-600",  bg: "bg-gray-100" },
            { label: "Complimentary", value: counts.complimentary, color: "text-purple-700", bg: "bg-purple-50" },
          ].map(stat => (
            <div key={stat.label} data-testid={`stat-${stat.label.toLowerCase()}`} className={`${stat.bg} rounded-xl p-4 border border-gray-200 text-center`}>
              <div className={`text-2xl font-bold font-display ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex justify-end mb-4">
          <button
            data-testid="button-refresh-communities"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* States */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                  <div className="space-y-2">
                    <div className="h-4 w-40 bg-gray-200 rounded" />
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-16">
            <p className="text-red-600 font-medium mb-2">Failed to load communities.</p>
            <button onClick={() => refetch()} className="text-sm text-primary underline">Try again</button>
          </div>
        )}

        {!isLoading && !isError && communities.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No communities registered yet</p>
            <p className="text-sm mt-1">Communities appear here once a Telegram group adds the bot</p>
          </div>
        )}

        {!isLoading && !isError && communities.length > 0 && (
          <div className="space-y-4">
            {communities.map(community => (
              <CommunityCard
                key={community.chatId}
                community={community}
                onStatusChange={(chatId, status) => mutation.mutate({ chatId, status })}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [sessionToken, setSessionToken] = useState<string | null>(
    () => sessionStorage.getItem("dashboard_session")
  );

  if (!sessionToken) {
    return <PinGate onUnlock={(token) => setSessionToken(token)} />;
  }

  return <DashboardContent />;
}
