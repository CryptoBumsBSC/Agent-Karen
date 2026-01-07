import { startBot } from "./bot";

console.log("🤖 Starting AgentKarenBot...");

startBot().catch((err) => {
  console.error("Failed to start bot:", err);
  process.exit(1);
});
