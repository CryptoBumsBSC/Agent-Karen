import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "./db";
import {
  adminUsers, adminInvites, adminAuditLog, communities, chatFeatureSettings,
  moderationStats, violationLogs, globalBans, memberScores, banEvents,
} from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  invalidateFeatureCache, invalidateCommunityCache, getBotInstance,
} from "./bot";

// ---------- Session typing ----------
declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: string;
    email?: string;
  }
}

type Role = "owner" | "admin" | "moderator";
const ROLE_RANK: Record<Role, number> = { moderator: 1, admin: 2, owner: 3 };

// Revalidate session principal against DB on every protected request.
// Prevents deleted/demoted users from retaining access via stale session cookies.
async function loadSessionUser(req: Request): Promise<{ id: number; role: Role; email: string } | null> {
  if (!req.session.userId) return null;
  const [u] = await db.select().from(adminUsers).where(eq(adminUsers.id, req.session.userId)).limit(1);
  if (!u) {
    req.session.destroy(() => {});
    return null;
  }
  // Keep session in sync with DB role
  if (req.session.role !== u.role) req.session.role = u.role;
  return { id: u.id, role: u.role as Role, email: u.email };
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await loadSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not logged in" });
  (req as any).adminUser = user;
  next();
}

function requireRole(min: Role) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not logged in" });
    if (ROLE_RANK[user.role] < ROLE_RANK[min]) {
      return res.status(403).json({ error: `Requires ${min} role` });
    }
    (req as any).adminUser = user;
    next();
  };
}

// ---------- FEATURE GROUPS (for community detail page) ----------
export const FEATURE_GROUPS = {
  Safety: ["spam", "scam", "drugs", "dealers", "hate", "links", "files", "edits"],
  Security: ["raid", "impersonation", "newuser", "captcha", "accountAge", "massMention", "crossBan", "bioScan"],
  "AI & Personality": ["personality", "learning", "aiChat", "medicalQA", "gifs", "stories"],
  Community: ["scheduled", "referrals", "giveaways", "games", "trust"],
} as const;

const ALL_FEATURES = Object.values(FEATURE_GROUPS).flat();

// ---------- Helpers ----------
function todayStr() { return new Date().toISOString().slice(0, 10); }

async function audit(
  req: Request,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details?: any,
) {
  const user = (req as any).adminUser || { id: req.session.userId, email: req.session.email, role: req.session.role };
  try {
    await db.insert(adminAuditLog).values({
      adminUserId: user?.id ?? null,
      adminEmail: user?.email ?? "unknown",
      adminRole: user?.role ?? "unknown",
      action,
      targetType,
      targetId,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (e) {
    console.error("audit log write failed:", e);
  }
}

export function registerAdminRoutes(app: Express) {
  // ===== AUTH =====
  app.get("/api/admin/auth/me", async (req, res) => {
    if (!req.session.userId) return res.json({ user: null, needsBootstrap: await needsBootstrap() });
    const [u] = await db.select().from(adminUsers).where(eq(adminUsers.id, req.session.userId)).limit(1);
    if (!u) { req.session.destroy(() => {}); return res.json({ user: null }); }
    res.json({ user: { id: u.id, email: u.email, role: u.role, displayName: u.displayName } });
  });

  app.post("/api/admin/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const [u] = await db.select().from(adminUsers).where(eq(adminUsers.email, String(email).toLowerCase())).limit(1);
    if (!u) return res.status(401).json({ error: "Invalid email or password" });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.email = u.email;
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, u.id));
    res.json({ user: { id: u.id, email: u.email, role: u.role, displayName: u.displayName } });
  });

  app.post("/api/admin/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // Bootstrap: create the FIRST owner when no users exist yet
  app.post("/api/admin/auth/bootstrap", async (req, res) => {
    if (!(await needsBootstrap())) return res.status(403).json({ error: "Bootstrap already completed" });
    const { email, password, displayName } = req.body || {};
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: "Email and password (min 8 chars) required" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [u] = await db.insert(adminUsers).values({
      email: String(email).toLowerCase(),
      passwordHash,
      displayName: displayName || null,
      role: "owner",
    }).returning();
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.email = u.email;
    res.json({ user: { id: u.id, email: u.email, role: u.role, displayName: u.displayName } });
  });

  // Accept invite — token + new password creates user
  app.get("/api/admin/auth/invite/:token", async (req, res) => {
    const [inv] = await db.select().from(adminInvites).where(eq(adminInvites.token, req.params.token)).limit(1);
    if (!inv) return res.status(404).json({ error: "Invite not found" });
    if (inv.acceptedAt) return res.status(410).json({ error: "Invite already used" });
    if (inv.expiresAt < new Date()) return res.status(410).json({ error: "Invite expired" });
    res.json({ email: inv.email, role: inv.role });
  });

  app.post("/api/admin/auth/invite/:token", async (req, res) => {
    const { password, displayName } = req.body || {};
    if (!password || password.length < 8) return res.status(400).json({ error: "Password min 8 chars" });
    const [inv] = await db.select().from(adminInvites).where(eq(adminInvites.token, req.params.token)).limit(1);
    if (!inv) return res.status(404).json({ error: "Invite not found" });
    if (inv.acceptedAt) return res.status(410).json({ error: "Invite already used" });
    if (inv.expiresAt < new Date()) return res.status(410).json({ error: "Invite expired" });
    const passwordHash = await bcrypt.hash(password, 10);
    const [u] = await db.insert(adminUsers).values({
      email: inv.email.toLowerCase(),
      passwordHash,
      displayName: displayName || null,
      role: inv.role,
      invitedBy: inv.invitedBy,
    }).returning();
    await db.update(adminInvites).set({ acceptedAt: new Date() }).where(eq(adminInvites.id, inv.id));
    req.session.userId = u.id;
    req.session.role = u.role;
    req.session.email = u.email;
    res.json({ user: { id: u.id, email: u.email, role: u.role, displayName: u.displayName } });
  });

  // ===== TEAM (owner-only) =====
  app.get("/api/admin/team", requireRole("owner"), async (_req, res) => {
    const users = await db.select().from(adminUsers).orderBy(adminUsers.createdAt);
    const invites = await db.select().from(adminInvites)
      .where(sql`${adminInvites.acceptedAt} IS NULL AND ${adminInvites.expiresAt} > NOW()`);
    res.json({
      users: users.map(u => ({ id: u.id, email: u.email, role: u.role, displayName: u.displayName, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
      invites: invites.map(i => ({ id: i.id, email: i.email, role: i.role, token: i.token, expiresAt: i.expiresAt })),
    });
  });

  app.post("/api/admin/team/invite", requireRole("owner"), async (req, res) => {
    const { email, role } = req.body || {};
    if (!email || !["owner", "admin", "moderator"].includes(role)) {
      return res.status(400).json({ error: "Email and valid role required" });
    }
    const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, String(email).toLowerCase())).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: "User with that email already exists" });
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [inv] = await db.insert(adminInvites).values({
      email: String(email).toLowerCase(),
      role,
      token,
      invitedBy: req.session.userId!,
      expiresAt,
    }).returning();
    await audit(req, "team.invite", "team_member", String(inv.id), { email: inv.email, role: inv.role });
    res.json({ invite: inv, acceptUrl: `/admin/accept-invite/${token}` });
  });

  app.delete("/api/admin/team/invite/:id", requireRole("owner"), async (req, res) => {
    await db.delete(adminInvites).where(eq(adminInvites.id, parseInt(req.params.id)));
    await audit(req, "team.invite.cancel", "team_member", req.params.id);
    res.json({ ok: true });
  });

  app.patch("/api/admin/team/:id", requireRole("owner"), async (req, res) => {
    const id = parseInt(req.params.id);
    const { role } = req.body || {};
    if (!["owner", "admin", "moderator"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    if (id === req.session.userId && role !== "owner") {
      return res.status(400).json({ error: "Cannot demote yourself" });
    }
    const [before] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    await db.update(adminUsers).set({ role }).where(eq(adminUsers.id, id));
    await audit(req, "team.role.change", "team_member", String(id), { from: before?.role, to: role, email: before?.email });
    res.json({ ok: true });
  });

  app.delete("/api/admin/team/:id", requireRole("owner"), async (req, res) => {
    const id = parseInt(req.params.id);
    if (id === req.session.userId) return res.status(400).json({ error: "Cannot remove yourself" });
    const [before] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
    await audit(req, "team.remove", "team_member", String(id), { email: before?.email, role: before?.role });
    res.json({ ok: true });
  });

  // ===== COMMUNITIES DASHBOARD =====
  app.get("/api/admin/communities", requireAuth, async (_req, res) => {
    const rows = await db.select().from(communities).orderBy(desc(communities.createdAt));
    const today = todayStr();
    const result = [] as any[];
    for (const c of rows) {
      const [stats] = await db.select().from(moderationStats)
        .where(and(eq(moderationStats.chatId, c.chatId), eq(moderationStats.date, today)))
        .limit(1);
      const [{ count: memberCount }] = await db.select({ count: sql<number>`count(*)::int` })
        .from(memberScores).where(eq(memberScores.chatId, c.chatId));
      result.push({
        chatId: c.chatId,
        displayName: c.displayName,
        botNickname: c.botNickname,
        status: c.status,
        trialExpiresAt: c.trialExpiresAt,
        isOnboarded: c.isOnboarded,
        memberCount,
        todayStats: stats ? {
          newJoins: stats.newJoins, messagesBlocked: stats.messagesBlocked,
          warnCount: stats.warnCount, muteCount: stats.muteCount,
          spamBlocked: stats.spamBlocked, scamsBlocked: stats.scamsBlocked,
        } : null,
        createdAt: c.createdAt,
      });
    }
    res.json(result);
  });

  // ===== COMMUNITY DETAIL =====
  app.get("/api/admin/communities/:chatId", requireAuth, async (req, res) => {
    const chatId = req.params.chatId;
    const [c] = await db.select().from(communities).where(eq(communities.chatId, chatId)).limit(1);
    if (!c) return res.status(404).json({ error: "Community not found" });
    let [features] = await db.select().from(chatFeatureSettings).where(eq(chatFeatureSettings.chatId, chatId)).limit(1);
    if (!features) {
      [features] = await db.insert(chatFeatureSettings).values({ chatId }).returning();
    }
    const [{ count: memberCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(memberScores).where(eq(memberScores.chatId, chatId));
    res.json({
      community: c,
      features,
      featureGroups: FEATURE_GROUPS,
      memberCount,
    });
  });

  app.patch("/api/admin/communities/:chatId/features", requireRole("admin"), async (req, res) => {
    const chatId = req.params.chatId;
    const { feature, value } = req.body || {};
    if (!ALL_FEATURES.includes(feature)) return res.status(400).json({ error: "Unknown feature" });
    if (typeof value !== "boolean") return res.status(400).json({ error: "Value must be boolean" });
    await db.insert(chatFeatureSettings)
      .values({ chatId, [feature]: value } as any)
      .onConflictDoUpdate({ target: chatFeatureSettings.chatId, set: { [feature]: value } as any });
    invalidateFeatureCache(chatId);
    await audit(req, "feature.toggle", "community", chatId, { feature, value });
    res.json({ ok: true });
  });

  app.patch("/api/admin/communities/:chatId/status", requireRole("owner"), async (req, res) => {
    const chatId = req.params.chatId;
    const { status } = req.body || {};
    if (!["trial", "active", "free", "complimentary", "banned"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const [before] = await db.select().from(communities).where(eq(communities.chatId, chatId)).limit(1);
    await db.update(communities).set({ status, updatedAt: new Date() }).where(eq(communities.chatId, chatId));
    invalidateCommunityCache(chatId);
    await audit(req, "community.status", "community", chatId, { from: before?.status, to: status });
    res.json({ ok: true });
  });

  app.patch("/api/admin/communities/:chatId/trial", requireRole("admin"), async (req, res) => {
    const chatId = req.params.chatId;
    const { days } = req.body || {};
    const d = parseInt(days);
    if (!d || d < 1 || d > 365) return res.status(400).json({ error: "Days must be 1-365" });
    const [c] = await db.select().from(communities).where(eq(communities.chatId, chatId)).limit(1);
    if (!c) return res.status(404).json({ error: "Not found" });
    const base = c.trialExpiresAt && c.trialExpiresAt > new Date() ? c.trialExpiresAt : new Date();
    const newExpiry = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);
    await db.update(communities).set({ trialExpiresAt: newExpiry, updatedAt: new Date() })
      .where(eq(communities.chatId, chatId));
    invalidateCommunityCache(chatId);
    await audit(req, "community.trial.extend", "community", chatId, { days: d, newExpiry });
    res.json({ ok: true, trialExpiresAt: newExpiry });
  });

  app.delete("/api/admin/communities/:chatId", requireRole("owner"), async (req, res) => {
    const chatId = req.params.chatId;
    const [before] = await db.select().from(communities).where(eq(communities.chatId, chatId)).limit(1);
    await db.delete(chatFeatureSettings).where(eq(chatFeatureSettings.chatId, chatId));
    await db.delete(communities).where(eq(communities.chatId, chatId));
    invalidateCommunityCache(chatId);
    invalidateFeatureCache(chatId);
    await audit(req, "community.delete", "community", chatId, { displayName: before?.displayName });
    res.json({ ok: true });
  });

  // ===== VIOLATIONS =====
  app.get("/api/admin/communities/:chatId/violations", requireAuth, async (req, res) => {
    const rows = await db.select().from(violationLogs)
      .where(eq(violationLogs.chatId, req.params.chatId))
      .orderBy(desc(violationLogs.createdAt))
      .limit(100);
    res.json(rows);
  });

  // Per task spec: moderators (and above) can clear individual violations
  app.delete("/api/admin/violations/:id", requireAuth, async (req, res) => {
    await db.delete(violationLogs).where(eq(violationLogs.id, parseInt(req.params.id)));
    await audit(req, "violation.clear", "violation", req.params.id);
    res.json({ ok: true });
  });

  // Top members
  app.get("/api/admin/communities/:chatId/members", requireAuth, async (req, res) => {
    const rows = await db.select().from(memberScores)
      .where(eq(memberScores.chatId, req.params.chatId))
      .orderBy(desc(memberScores.messageCount))
      .limit(50);
    res.json(rows);
  });

  // Recent ban events
  app.get("/api/admin/communities/:chatId/bans", requireAuth, async (req, res) => {
    const rows = await db.select().from(banEvents)
      .where(eq(banEvents.chatId, req.params.chatId))
      .orderBy(desc(banEvents.createdAt))
      .limit(50);
    res.json(rows);
  });

  // ===== BOT CONTROLS / GLOBAL (admin+) =====
  // Moderators are limited to per-community dashboard + violation clear,
  // so global stats / bans are gated to admin and owner.
  app.get("/api/admin/stats", requireRole("admin"), async (_req, res) => {
    const [{ communities: communityCount }] = await db.select({
      communities: sql<number>`count(*)::int`,
    }).from(communities);
    const [{ active }] = await db.select({ active: sql<number>`count(*)::int` })
      .from(communities).where(eq(communities.status, "active"));
    const [{ trial }] = await db.select({ trial: sql<number>`count(*)::int` })
      .from(communities).where(eq(communities.status, "trial"));
    const [{ members }] = await db.select({ members: sql<number>`count(distinct ${memberScores.telegramUserId})::int` })
      .from(memberScores);
    const today = todayStr();
    const todays = await db.select().from(moderationStats).where(eq(moderationStats.date, today));
    const todayAgg = todays.reduce((acc, s) => ({
      newJoins: acc.newJoins + (s.newJoins || 0),
      messagesBlocked: acc.messagesBlocked + (s.messagesBlocked || 0),
      warnCount: acc.warnCount + (s.warnCount || 0),
      muteCount: acc.muteCount + (s.muteCount || 0),
      spamBlocked: acc.spamBlocked + (s.spamBlocked || 0),
      scamsBlocked: acc.scamsBlocked + (s.scamsBlocked || 0),
    }), { newJoins: 0, messagesBlocked: 0, warnCount: 0, muteCount: 0, spamBlocked: 0, scamsBlocked: 0 });
    const [{ violations }] = await db.select({ violations: sql<number>`count(*)::int` }).from(violationLogs);
    const [{ bans }] = await db.select({ bans: sql<number>`count(*)::int` }).from(globalBans);
    res.json({
      communities: communityCount, activeCommunities: active, trialCommunities: trial,
      totalMembers: members, todayStats: todayAgg, totalViolations: violations, globalBans: bans,
    });
  });

  app.get("/api/admin/global-bans", requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(globalBans).orderBy(desc(globalBans.createdAt)).limit(200);
    res.json(rows);
  });

  app.delete("/api/admin/global-bans/:id", requireRole("admin"), async (req, res) => {
    await db.delete(globalBans).where(eq(globalBans.id, parseInt(req.params.id)));
    await audit(req, "global_ban.remove", "global_ban", req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/admin/broadcast", requireRole("owner"), async (req, res) => {
    const { message, target } = req.body || {};
    if (!message || typeof message !== "string" || message.length < 1) {
      return res.status(400).json({ error: "Message required" });
    }
    const bot = getBotInstance();
    if (!bot) return res.status(503).json({ error: "Bot not available" });
    const tgt = target || "active"; // "active" | "all"
    const rows = tgt === "all"
      ? await db.select().from(communities)
      : await db.select().from(communities).where(sql`${communities.status} IN ('active', 'trial', 'complimentary')`);
    let success = 0, failed = 0;
    for (const c of rows) {
      try {
        await bot.api.sendMessage(c.chatId, message, { parse_mode: "Markdown" } as any);
        success++;
      } catch { failed++; }
    }
    await audit(req, "broadcast.send", "global", null, {
      target: tgt, total: rows.length, success, failed,
      preview: message.slice(0, 200),
    });
    res.json({ ok: true, success, failed, total: rows.length });
  });

  // ===== AUDIT LOG (admin+) =====
  app.get("/api/admin/audit", requireRole("admin"), async (_req, res) => {
    const rows = await db.select().from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(200);
    res.json(rows);
  });
}

async function needsBootstrap(): Promise<boolean> {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(adminUsers);
    return count === 0;
  } catch { return false; }
}
