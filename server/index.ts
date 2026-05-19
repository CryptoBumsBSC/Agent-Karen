import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { createServer } from "http";
import { startBot } from "./bot";
import { pool } from "./db";
import { setupVite } from "./vite";
import { serveStatic } from "./static";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./adminRoutes";

console.log("🤖 Starting AgentKarenBot + Admin Portal...");

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

const PgStore = connectPgSimple(session);
const isProd = process.env.NODE_ENV === "production";

if (isProd && !process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET must be set in production");
  process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-prod";

// Trust Replit's proxy so secure cookies & req.protocol work correctly in prod
app.set("trust proxy", 1);

app.use(session({
  store: new PgStore({ pool, tableName: "session", createTableIfMissing: true }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", bot: "AgentKarenBot" });
});

// API routes
registerAdminRoutes(app);

async function main() {
  await registerRoutes(httpServer, app);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`✅ Web + API server listening on port ${port}`);
  });

  startBot().catch((err) => {
    console.error("Bot failed to start:", err);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
