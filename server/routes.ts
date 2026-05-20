import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { randomBytes } from "crypto";
import {
  activateCommunity,
  deactivateCommunity,
  makeComplimentary,
  banCommunity,
} from "./communityService";

// ─── Session store ────────────────────────────────────────────────────────────
// Short-lived tokens (8 hours) issued after successful server-side PIN validation.
// The master secret (DASHBOARD_SECRET) never leaves the server.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
interface Session { expiresAt: number }
const sessions = new Map<string, Session>();

function createSession(): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function isValidSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireDashboardAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !isValidSession(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === Characters ===
  app.get(api.characters.list.path, async (req, res) => {
    const chars = await storage.getCharacters();
    res.json(chars);
  });

  // === Content ===
  app.get(api.content.list.path, async (req, res) => {
    const type = req.query.type as string | undefined;
    const content = await storage.getContentItems(type);
    res.json(content);
  });

  // === Dashboard auth ===
  // Validates PIN server-side against DASHBOARD_SECRET env var.
  // Returns a short-lived session token — the master secret never reaches the client.
  app.post("/api/dashboard/auth", (req, res) => {
    const { pin } = req.body as { pin?: string };
    const secret = process.env.DASHBOARD_SECRET;
    if (!secret) {
      console.error("[Dashboard] DASHBOARD_SECRET env var is not set — dashboard login is disabled");
      return res.status(503).json({ error: "Dashboard authentication is not configured. Set DASHBOARD_SECRET." });
    }
    if (!pin || pin !== secret) {
      return res.status(401).json({ error: "Invalid PIN" });
    }
    const token = createSession();
    return res.json({ token });
  });

  // === Dashboard: list communities ===
  app.get("/api/dashboard/communities", requireDashboardAuth, async (req, res) => {
    try {
      const comms = await storage.getCommunities();
      const withFeatures = await Promise.all(
        comms.map(async (c) => {
          const features = await storage.getCommunityFeatures(c.chatId);
          return { ...c, features: features ?? null };
        })
      );
      res.json(withFeatures);
    } catch (err) {
      console.error("Dashboard communities error:", err);
      res.status(500).json({ error: "Failed to load communities" });
    }
  });

  // === Dashboard: update community subscription status ===
  // Routes through the shared communityService so behavior (DB update, cache
  // invalidation, Telegram group notification) matches bot command logic exactly.
  const statusSchema = z.object({
    status: z.enum(["active", "free", "complimentary", "trial", "banned"]),
  });

  app.post(
    "/api/dashboard/communities/:chatId/status",
    requireDashboardAuth,
    async (req, res) => {
      try {
        const { chatId } = req.params;
        const parsed = statusSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid status value" });
        }

        const community = await storage.getCommunityById(chatId);
        if (!community) {
          return res.status(404).json({ error: "Community not found" });
        }

        const { status } = parsed.data;
        switch (status) {
          case "active":       await activateCommunity(chatId);       break;
          case "free":         await deactivateCommunity(chatId);     break;
          case "complimentary":await makeComplimentary(chatId);        break;
          case "banned":       await banCommunity(chatId);             break;
          default:
            return res.status(400).json({ error: `Unhandled status: ${status}` });
        }

        // Fetch fresh record to return up-to-date state
        const updated = await storage.getCommunityById(chatId);
        res.json(updated);
      } catch (err) {
        console.error("Update community status error:", err);
        res.status(500).json({ error: "Failed to update status" });
      }
    }
  );

  // === SEED DATA ===
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingChars = await storage.getCharacters();
  if (existingChars.length === 0) {
    console.log("Seeding database...");

    await storage.createCharacter({ name: "Dudley Bud", description: "The main character, a chill cannabis bud.", role: "Protagonist" });
    await storage.createCharacter({ name: "Blaze", description: "Dudley's adventurous friend.", role: "Friend" });
    await storage.createCharacter({ name: "Kush", description: "The wise elder bud.", role: "Elder" });
    await storage.createCharacter({ name: "Sativa", description: "The energetic uplifting character.", role: "Energetic" });
    await storage.createCharacter({ name: "Indica", description: "The relaxed, mellow character.", role: "Relaxed" });

    const jokes = [
      "Why did the cannabis plant go to school? To get a little higher education! 🌿📚",
      "What's a stoner's favorite type of music? Rock... and roll! 🎸",
      "Why don't cannabis plants ever get lost? They always follow the high way! 🛣️",
      "What did the cannabis say to the paper? Let's roll! 📜",
      "Why was the cannabis plant so good at meditation? It knew how to find inner peace! 🧘",
    ];
    for (const joke of jokes) await storage.createContentItem({ type: "joke", content: joke });

    const facts = [
      "🏥 Medical cannabis has been shown to help with chronic pain management in numerous clinical studies.",
      "🧠 CBD (cannabidiol) is non-psychoactive and has been researched for anxiety and seizure disorders.",
      "⚕️ Always consult healthcare professionals before using cannabis for medical purposes.",
    ];
    for (const fact of facts) await storage.createContentItem({ type: "fact", content: fact });

    await storage.createContentItem({ type: "project_info", title: "What We Are", content: "✅ Creative Web3 storytelling\n✅ Digital art & character universe\n✅ Community-driven entertainment\n✅ Animation, games & experiences" });
    await storage.createContentItem({ type: "project_info", title: "What We're NOT", content: "❌ Investment opportunity\n❌ Financial product\n❌ Promise of profit" });

    const legalPoints = [
      "Not investments, securities, financial products",
      "No returns, income, or appreciation promised",
      "Entertainment, culture, and community engagement only",
    ];
    for (const point of legalPoints) await storage.createContentItem({ type: "legal", content: point });

    console.log("Database seeded!");
  }
}
