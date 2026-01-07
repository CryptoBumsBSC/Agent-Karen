import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Characters ===
  app.get(api.characters.list.path, async (req, res) => {
    const chars = await storage.getCharacters();
    res.json(chars);
  });

  // === Content (Jokes, Facts, Legal, etc.) ===
  app.get(api.content.list.path, async (req, res) => {
    const type = req.query.type as string | undefined;
    const content = await storage.getContentItems(type);
    res.json(content);
  });

  // === SEED DATA ===
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingChars = await storage.getCharacters();
  if (existingChars.length === 0) {
    console.log("Seeding database...");
    
    // Characters
    await storage.createCharacter({
      name: "Dudley Bud",
      description: "The main character, a chill cannabis bud.",
      role: "Protagonist",
    });
    await storage.createCharacter({
      name: "Blaze",
      description: "Dudley's adventurous friend.",
      role: "Friend",
    });
    await storage.createCharacter({
      name: "Kush",
      description: "The wise elder bud.",
      role: "Elder",
    });
    await storage.createCharacter({
      name: "Sativa",
      description: "The energetic uplifting character.",
      role: "Energetic",
    });
    await storage.createCharacter({
      name: "Indica",
      description: "The relaxed, mellow character.",
      role: "Relaxed",
    });

    // Jokes
    const jokes = [
      "Why did the cannabis plant go to school? To get a little higher education! 🌿📚",
      "What's a stoner's favorite type of music? Rock... and roll! 🎸",
      "Why don't cannabis plants ever get lost? They always follow the high way! 🛣️",
      "What did the cannabis say to the paper? Let's roll! 📜",
      "Why was the cannabis plant so good at meditation? It knew how to find inner peace! 🧘",
      "What do you call a cannabis plant that tells jokes? A pun-t! 😄",
      "Why did Dudley Bud become a comedian? He wanted to get everyone's spirits lifted! 🎭",
      "What's Dudley's favorite subject? Higher mathematics! ➕",
      "Why don't cannabis plants use social media? They prefer to stay grounded! 🌱",
      "What did one bud say to another? We make a great joint effort! 🤝"
    ];
    for (const joke of jokes) {
      await storage.createContentItem({ type: "joke", content: joke });
    }

    // Facts
    const facts = [
      "🏥 Medical cannabis has been shown to help with chronic pain management in numerous clinical studies.",
      "🧠 CBD (cannabidiol) is non-psychoactive and has been researched for anxiety and seizure disorders.",
      "💊 Cannabis contains over 100 cannabinoids, each with potentially different therapeutic properties.",
      "🌿 Medical cannabis is legal in 38+ US states and many countries worldwide for various conditions.",
      "📊 Studies show cannabis can help with nausea, especially in chemotherapy patients.",
      "🔬 The endocannabinoid system in our bodies naturally interacts with cannabis compounds.",
      "⚕️ Always consult healthcare professionals before using cannabis for medical purposes."
    ];
    for (const fact of facts) {
      await storage.createContentItem({ type: "fact", content: fact });
    }

    // Legal & Project Info
    await storage.createContentItem({
      type: "project_info",
      title: "What We Are",
      content: "✅ Creative Web3 storytelling\n✅ Digital art & character universe\n✅ Community-driven entertainment\n✅ Animation, games & experiences"
    });
    await storage.createContentItem({
      type: "project_info",
      title: "What We're NOT",
      content: "❌ Investment opportunity\n❌ Financial product\n❌ Promise of profit"
    });

    // Scam Terms (Sample)
    const scamTerms = [
      { content: "I have your video/photos", category: "Porn/Blackmail" },
      { content: "Send me intimate pics/videos", category: "Porn/Blackmail" },
      { content: "Pay me or I'll send this to your family/friends", category: "Porn/Blackmail" },
      { content: "Bitcoin/gift cards/cryptocurrency", category: "Porn/Blackmail" },
      { content: "Connect wallet to claim rewards", category: "Phishing" },
      { content: "Click here to secure your Web3 wallet", category: "Phishing" },
      { content: "Share your seed phrase/QR code to verify", category: "Phishing" }
    ];
    for (const term of scamTerms) {
      await storage.createContentItem({ type: "scam_term", content: term.content, category: term.category });
    }

     // Legal Points
    const legalPoints = [
        "Not investments, securities, financial products",
        "No returns, income, or appreciation promised",
        "Entertainment, culture, and community engagement only",
        "Community gifts are discretionary, non-guaranteed",
        "Only mint if you appreciate the art and can afford to lose"
    ];
    for (const point of legalPoints) {
        await storage.createContentItem({ type: "legal", content: point });
    }

    console.log("Database seeded!");
  }
}
