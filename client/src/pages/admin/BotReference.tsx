import { useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Search, MessageCircle, Shield, Sparkles, Gamepad2, Crown } from "lucide-react";

type Cmd = { name: string; desc: string; role: "everyone" | "admin" | "owner" };

const COMMANDS: Record<string, Cmd[]> = {
  "General / Info": [
    { name: "/start", desc: "Greeting & intro from Karen", role: "everyone" },
    { name: "/help", desc: "Show available commands", role: "everyone" },
    { name: "/info", desc: "Project information", role: "everyone" },
    { name: "/safety", desc: "Safety guidelines & warnings", role: "everyone" },
    { name: "/legal", desc: "Legal disclaimer (NFTs are not investments)", role: "everyone" },
    { name: "/characters", desc: "List Dudleyverse characters", role: "everyone" },
    { name: "/community", desc: "About this community", role: "everyone" },
    { name: "/communityinfo", desc: "Community stats & profile", role: "everyone" },
    { name: "/status", desc: "Bot status & subscription tier", role: "everyone" },
    { name: "/myprofile", desc: "Your member profile", role: "everyone" },
  ],
  "AI & Chat": [
    { name: "/ask <question>", desc: "Ask Karen anything (uses GPT)", role: "everyone" },
    { name: "/answer", desc: "Karen answers the replied-to message", role: "everyone" },
    { name: "/karen <prompt>", desc: "Talk directly to Karen", role: "everyone" },
    { name: "/joke", desc: "Random cannabis joke", role: "everyone" },
    { name: "/fact", desc: "Medical cannabis fact", role: "everyone" },
    { name: "/roast", desc: "Karen roasts the replied-to user", role: "everyone" },
    { name: "/story", desc: "Generate a Dudleyverse story", role: "everyone" },
    { name: "/budify", desc: "Generate a custom bud avatar (DALL·E)", role: "admin" },
    { name: "/legendary", desc: "Award a rare-strain avatar (max 7 ever)", role: "owner" },
  ],
  "Games & Leaderboards": [
    { name: "/play", desc: "Start Space Bud Invaders / Seed Storm", role: "everyone" },
    { name: "/seedstorm", desc: "Launch Seed Storm mini-app", role: "everyone" },
    { name: "/trivia", desc: "Start a trivia round", role: "everyone" },
    { name: "/puzzle", desc: "Word puzzle game", role: "everyone" },
    { name: "/guess <word>", desc: "Submit puzzle guess", role: "everyone" },
    { name: "/leaderboard", desc: "Trivia leaderboard", role: "everyone" },
    { name: "/puzzleboard", desc: "Puzzle leaderboard", role: "everyone" },
    { name: "/myscore", desc: "Your scores", role: "everyone" },
  ],
  "Referrals & Giveaways": [
    { name: "/myreferrals", desc: "Your referral link & stats", role: "everyone" },
    { name: "/refboard", desc: "Top referrers", role: "everyone" },
    { name: "/giveaway", desc: "Start a giveaway", role: "admin" },
    { name: "/enter", desc: "Enter active giveaway", role: "everyone" },
    { name: "/entries", desc: "Show entries", role: "admin" },
    { name: "/pickwinner", desc: "Pick winner of active giveaway", role: "admin" },
    { name: "/endgiveaway", desc: "End giveaway early", role: "admin" },
    { name: "/poll <question>", desc: "Create a poll", role: "admin" },
    { name: "/purge_referrals", desc: "Clear referral data (Owner)", role: "owner" },
  ],
  "Moderation": [
    { name: "/warn", desc: "Warn replied-to user (3 warns = mute)", role: "admin" },
    { name: "/mute <minutes>", desc: "Mute replied-to user", role: "admin" },
    { name: "/unmute", desc: "Unmute replied-to user", role: "admin" },
    { name: "/ban", desc: "Ban replied-to user", role: "admin" },
    { name: "/kick", desc: "Kick replied-to user", role: "admin" },
    { name: "/lockdown", desc: "Enable raid lockdown manually", role: "admin" },
    { name: "/unlock", desc: "End lockdown / raid mode", role: "admin" },
    { name: "/raidmode", desc: "Toggle anti-raid mode", role: "admin" },
    { name: "/raidstatus", desc: "Show raid mode status", role: "admin" },
    { name: "/banlist", desc: "View ban/kick history", role: "owner" },
    { name: "/violations", desc: "View security violation log", role: "owner" },
    { name: "/modstats", desc: "Moderation statistics", role: "admin" },
    { name: "/stats", desc: "Bot learning stats", role: "admin" },
  ],
  "Trust System": [
    { name: "/trust", desc: "Vouch for replied-to user", role: "admin" },
    { name: "/untrust", desc: "Remove trust", role: "admin" },
    { name: "/trustinfo", desc: "Your trust info", role: "everyone" },
    { name: "/trustpoints", desc: "Your trust points", role: "everyone" },
    { name: "/trustboard", desc: "Trust leaderboard", role: "everyone" },
    { name: "/trustset <points>", desc: "Set user's trust points", role: "owner" },
    { name: "/trustremove", desc: "Remove trust manually", role: "owner" },
    { name: "/trustfreeze", desc: "Freeze a user's trust", role: "admin" },
    { name: "/trustunfreeze", desc: "Unfreeze a user's trust", role: "admin" },
    { name: "/trustbulk", desc: "Bulk trust operations", role: "owner" },
    { name: "/trusthelp", desc: "Owner trust system guide", role: "owner" },
  ],
  "Community Setup (per-group)": [
    { name: "/setup", desc: "Start community onboarding wizard", role: "admin" },
    { name: "/settings", desc: "Open feature toggle menu", role: "admin" },
    { name: "/toggle <feature>", desc: "Toggle a feature on/off", role: "admin" },
    { name: "/setnickname <name>", desc: "Rename Karen in this group", role: "admin" },
    { name: "/setwelcome <msg>", desc: "Custom welcome message", role: "admin" },
    { name: "/settimezone <tz>", desc: "Set group timezone", role: "admin" },
    { name: "/setname", desc: "Set your display name", role: "everyone" },
    { name: "/setlocation", desc: "Set your location", role: "everyone" },
    { name: "/setbirthday", desc: "Set your birthday for celebrations", role: "everyone" },
    { name: "/setlikes", desc: "Set your interests", role: "everyone" },
    { name: "/setrole <role>", desc: "Set user's community role", role: "admin" },
    { name: "/setadmin", desc: "Mark user as bot admin", role: "owner" },
    { name: "/addadmin", desc: "Add bot admin", role: "owner" },
    { name: "/removeadmin", desc: "Remove bot admin", role: "owner" },
    { name: "/listadmins", desc: "List bot admins", role: "admin" },
    { name: "/changeadmin", desc: "Transfer admin role", role: "owner" },
    { name: "/restore", desc: "Restore default settings", role: "owner" },
  ],
  "Global Owner / SaaS": [
    { name: "/communities", desc: "List every group Karen is in", role: "owner" },
    { name: "/activate <chatId>", desc: "Activate paid subscription", role: "owner" },
    { name: "/deactivate <chatId>", desc: "Deactivate subscription", role: "owner" },
    { name: "/makefree <chatId>", desc: "Mark as free tier", role: "owner" },
    { name: "/extendtrial <chatId> <days>", desc: "Extend trial", role: "owner" },
    { name: "/bangroup <chatId>", desc: "Ban a group (bot goes silent)", role: "owner" },
    { name: "/leavegroup <chatId>", desc: "Remove bot from group", role: "owner" },
    { name: "/adminhelp", desc: "Admin command reference", role: "admin" },
    { name: "/ownerhelp", desc: "Owner command reference", role: "owner" },
  ],
};

type Feature = { key: string; name: string; desc: string };
const FEATURES: Record<string, Feature[]> = {
  "Safety (8)": [
    { key: "spam", name: "Anti-Spam", desc: "Rate limits, duplicate detection, sticker/GIF/voice spam, emoji flood" },
    { key: "scam", name: "Scam Detection", desc: "Domain blocklists, risk scoring, phishing & wallet-drainer phrases, seed phrase detection" },
    { key: "drugs", name: "Drug Detection", desc: "Blocks hard drug trafficking while allowing cannabis culture talk" },
    { key: "dealers", name: "Dealer Detection", desc: "Progressive punishment for plug/menu/dealer signals in messages, bio, and username" },
    { key: "hate", name: "Hate Speech Filter", desc: "Base64-obscured slur detection with l33t-speak normalization" },
    { key: "links", name: "Link Control", desc: "New users can't post links; allowlist for official domains; blocks URL shorteners" },
    { key: "files", name: "Dangerous File Blocking", desc: "Blocks .exe, .bat, .apk, .scr and other executables with admin alerts" },
    { key: "edits", name: "Edit Monitoring", desc: "Detects new users editing innocent messages to sneak in scams/links" },
  ],
  "Security (8)": [
    { key: "raid", name: "Anti-Raid Mode", desc: "5+ joins in 2 min auto-triggers lockdown that restricts new users for 5 min" },
    { key: "impersonation", name: "Admin Impersonation", desc: "Levenshtein matching catches usernames similar to admins (l33t speak included)" },
    { key: "newuser", name: "New User Restrictions", desc: "First-24h users can't forward; first-48h can't share contacts" },
    { key: "captcha", name: "Join CAPTCHA", desc: "Tap-to-verify on join; unverified users auto-banned after 10 min" },
    { key: "accountAge", name: "Account Age Check", desc: "Flags brand-new accounts joining as likely raiders" },
    { key: "massMention", name: "Mass Mention Block", desc: "Blocks messages tagging many users at once" },
    { key: "crossBan", name: "Global Ban Sync", desc: "Bans in one Karen-managed group propagate to all communities" },
    { key: "bioScan", name: "Bio Scam Scan", desc: "Scans new-member name/username for dealer signals on join" },
  ],
  "AI & Personality (6)": [
    { key: "personality", name: "Karen Personality", desc: "Mood-based responses, catchphrases, running gags, milestone celebrations" },
    { key: "learning", name: "Bot Learning", desc: "Learns from thumbs up/down feedback; reuses proven responses to save API costs" },
    { key: "aiChat", name: "AI Chat (GPT)", desc: "GPT-4o-mini powered Q&A, smart replies, sassy comebacks" },
    { key: "medicalQA", name: "Medical Q&A", desc: "THC/CBD knowledge, FDA-approved drugs, AU TGA + US FDA access systems" },
    { key: "gifs", name: "GIF Reactions", desc: "15-25% chance of mood-matching GIF on responses" },
    { key: "stories", name: "Story Generator", desc: "Template-based random Dudleyverse stories (zero API cost)" },
  ],
  "Community (5)": [
    { key: "scheduled", name: "Scheduled Posts", desc: "Daily recipes (4pm), quotes (10am), birthdays (9am), winner announcements (11:55pm)" },
    { key: "referrals", name: "Referral Program", desc: "Per-user invite links, points, leaderboards, anti-gaming verification" },
    { key: "giveaways", name: "Giveaways", desc: "Run giveaways with entry tracking and random winner selection" },
    { key: "games", name: "Games", desc: "Space Bud Invaders, Seed Storm, Trivia, Word Puzzle with leaderboards" },
    { key: "trust", name: "Trust System", desc: "45-day eligibility gate, 0-100 trust score, 4 trust levels with progressive perks" },
  ],
};

function roleBadge(role: Cmd["role"]) {
  if (role === "owner") return <Badge variant="default" className="bg-purple-600">Owner</Badge>;
  if (role === "admin") return <Badge variant="secondary">Admin</Badge>;
  return <Badge variant="outline">Everyone</Badge>;
}

const ICONS: Record<string, any> = {
  "General / Info": MessageCircle,
  "AI & Chat": Sparkles,
  "Games & Leaderboards": Gamepad2,
  "Referrals & Giveaways": Sparkles,
  "Moderation": Shield,
  "Trust System": Shield,
  "Community Setup (per-group)": Book,
  "Global Owner / SaaS": Crown,
};

export default function BotReference() {
  const [q, setQ] = useState("");
  const lower = q.trim().toLowerCase();
  const totalCmds = Object.values(COMMANDS).reduce((n, c) => n + c.length, 0);
  const totalFeatures = Object.values(FEATURES).reduce((n, c) => n + c.length, 0);

  const matchCmd = (c: Cmd) => !lower || c.name.toLowerCase().includes(lower) || c.desc.toLowerCase().includes(lower);
  const matchFeat = (f: Feature) => !lower || f.key.toLowerCase().includes(lower) || f.name.toLowerCase().includes(lower) || f.desc.toLowerCase().includes(lower);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bot Reference</h1>
        <p className="text-slate-500 text-sm">
          {totalCmds} commands · {totalFeatures} toggleable features
        </p>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search commands or features…"
          className="pl-9"
          value={q}
          onChange={e => setQ(e.target.value)}
          data-testid="input-search"
        />
      </div>

      <Tabs defaultValue="commands">
        <TabsList>
          <TabsTrigger value="commands" data-testid="tab-commands">Commands ({totalCmds})</TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">Features ({totalFeatures})</TabsTrigger>
        </TabsList>

        <TabsContent value="commands" className="space-y-4 mt-4">
          {Object.entries(COMMANDS).map(([group, cmds]) => {
            const visible = cmds.filter(matchCmd);
            if (visible.length === 0) return null;
            const Icon = ICONS[group] || Book;
            return (
              <Card key={group}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className="w-4 h-4" /> {group}
                    <span className="text-xs text-slate-400 font-normal ml-auto">{visible.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {visible.map(c => (
                    <div key={c.name} className="flex items-start justify-between py-2 gap-3" data-testid={`row-cmd-${c.name.slice(1)}`}>
                      <div className="flex-1 min-w-0">
                        <code className="text-sm font-mono text-emerald-700 dark:text-emerald-400">{c.name}</code>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.desc}</div>
                      </div>
                      <div className="flex-shrink-0">{roleBadge(c.role)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="features" className="space-y-4 mt-4">
          {Object.entries(FEATURES).map(([group, feats]) => {
            const visible = feats.filter(matchFeat);
            if (visible.length === 0) return null;
            return (
              <Card key={group}>
                <CardHeader><CardTitle className="text-base">{group}</CardTitle></CardHeader>
                <CardContent className="divide-y">
                  {visible.map(f => (
                    <div key={f.key} className="py-3" data-testid={`row-feature-${f.key}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{f.name}</span>
                        <code className="text-xs text-slate-500 font-mono">{f.key}</code>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{f.desc}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
