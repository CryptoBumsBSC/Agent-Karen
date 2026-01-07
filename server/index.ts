import { startBot } from "./bot";
import { createServer } from "http";

console.log("🤖 Starting AgentKarenBot...");

// Simple health check server for Replit workflow
const healthServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", bot: "AgentKarenBot" }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const port = parseInt(process.env.PORT || "5000", 10);
healthServer.listen(port, "0.0.0.0", () => {
  console.log(`Health check server running on port ${port}`);
});

startBot().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
