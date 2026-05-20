import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { botInstances, communities, memberScores, moderationStats, violationLogs } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";

// Instance-side Hub API. Forks expose these endpoints so a central Hub
// (this same app, or another deployment) can pull stats and verify the
// instance is alive. Auth is a shared secret header — no sessions involved.

function todayStr() { return new Date().toISOString().slice(0, 10); }

async function requireHubSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-hub-secret");
  if (!provided) return res.status(401).json({ error: "Missing x-hub-secret" });
  const [local] = await db.select().from(botInstances).where(eq(botInstances.isLocal, true)).limit(1);
  if (!local) return res.status(503).json({ error: "Local instance not initialized" });
  if (provided !== local.sharedSecret) return res.status(403).json({ error: "Invalid hub secret" });
  next();
}

export function registerHubApi(app: Express) {
  // Public-ish: lets a Hub discover what this instance calls itself before pairing.
  // Returns minimal info — secret-protected endpoints below give the real data.
  app.get("/api/hub/info", requireHubSecret, async (_req, res) => {
    const [local] = await db.select().from(botInstances).where(eq(botInstances.isLocal, true)).limit(1);
    const [{ memberCount }] = await db.select({ memberCount: sql<number>`count(*)::int` }).from(memberScores);
    res.json({
      name: local?.name || "unnamed",
      version: "1.0.0",
      memberCount,
      uptimeSec: Math.round(process.uptime()),
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    });
  });

  app.get("/api/hub/stats", requireHubSecret, async (_req, res) => {
    const [{ communityCount }] = await db.select({ communityCount: sql<number>`count(*)::int` }).from(communities);
    const [{ active }] = await db.select({ active: sql<number>`count(*)::int` })
      .from(communities).where(eq(communities.status, "active"));
    const [{ trial }] = await db.select({ trial: sql<number>`count(*)::int` })
      .from(communities).where(eq(communities.status, "trial"));
    const [{ members }] = await db.select({ members: sql<number>`count(*)::int` }).from(memberScores);
    const [{ violations }] = await db.select({ violations: sql<number>`count(*)::int` }).from(violationLogs);

    const today = todayStr();
    const todayRows = await db.select().from(moderationStats).where(eq(moderationStats.date, today));
    const todayAgg = todayRows.reduce((acc, r) => ({
      newJoins: acc.newJoins + (r.newJoins ?? 0),
      messagesBlocked: acc.messagesBlocked + (r.messagesBlocked ?? 0),
      warnCount: acc.warnCount + (r.warnCount ?? 0),
      muteCount: acc.muteCount + (r.muteCount ?? 0),
      spamBlocked: acc.spamBlocked + (r.spamBlocked ?? 0),
      scamsBlocked: acc.scamsBlocked + (r.scamsBlocked ?? 0),
    }), { newJoins: 0, messagesBlocked: 0, warnCount: 0, muteCount: 0, spamBlocked: 0, scamsBlocked: 0 });

    res.json({
      communities: communityCount,
      activeCommunities: active,
      trialCommunities: trial,
      totalMembers: members,
      totalViolations: violations,
      todayStats: todayAgg,
    });
  });

  app.get("/api/hub/communities", requireHubSecret, async (_req, res) => {
    const rows = await db.select({
      chatId: communities.chatId,
      displayName: communities.displayName,
      status: communities.status,
      trialExpiresAt: communities.trialExpiresAt,
    }).from(communities);
    res.json(rows);
  });
}
