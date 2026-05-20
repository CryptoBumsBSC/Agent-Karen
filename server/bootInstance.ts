import { randomBytes } from "crypto";
import { db } from "./db";
import { botInstances } from "@shared/schema";
import { eq } from "drizzle-orm";

// Ensures a row exists in bot_instances for this deployment so the Hub
// always has a baseline "local" entry to aggregate against. The shared
// secret is auto-generated the first time and never rotated unless the
// row is manually edited or deleted.
export async function ensureLocalInstance() {
  try {
    const [existing] = await db.select().from(botInstances).where(eq(botInstances.isLocal, true)).limit(1);
    if (existing) {
      const newUrl = process.env.PUBLIC_URL?.replace(/\/+$/, "");
      if (newUrl && newUrl !== existing.baseUrl) {
        await db.update(botInstances).set({ baseUrl: newUrl }).where(eq(botInstances.id, existing.id));
      }
      return;
    }
    const name = process.env.LOCAL_INSTANCE_NAME?.trim() || "local";
    const baseUrl = (process.env.PUBLIC_URL?.replace(/\/+$/, "")) || "http://127.0.0.1:5000";
    const sharedSecret = process.env.HUB_LOCAL_SECRET || randomBytes(32).toString("hex");
    await db.insert(botInstances).values({
      name, baseUrl, sharedSecret, isLocal: true, status: "ok",
      lastSeenAt: new Date(),
    });
    console.log(`🔗 Registered local bot instance "${name}" — share its secret with Hub admins.`);
  } catch (e) {
    console.error("ensureLocalInstance failed:", e);
  }
}
