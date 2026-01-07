import { Bot, Context, session } from "grammy";

// === BOT TOKEN ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set in environment variables");
}

// === SESSION DATA ===
interface SessionData {
  karenMode: boolean;
}

type MyContext = Context & { session: SessionData };

// === CONTENT DATA ===
const PROJECT_INFO = `🌿 **Dudley Bud - Web3 Cannabis Character Universe**

Built on Base blockchain, Dudley Bud is a creative storytelling project featuring:

📦 **Collections:**
- Limited Whitelist NFTs (priority access)
- Dudley420 Collection: 1,000 NFTs @ 0.01 BASE

🎭 **What We Are:**
✅ Creative Web3 storytelling
✅ Digital art & character universe
✅ Community-driven entertainment
✅ Animation, games & experiences

❌ **What We're NOT:**
❌ Investment opportunity
❌ Financial product
❌ Promise of profit

🎁 **Community Gifts:**
Up to 25% of profits may be allocated to discretionary community gifts - but these are NOT guaranteed, automatic, or proportional.

🌐 **Links:**
Website: dudleybud.com
X: x.com/dudley420
Telegram: t.me/dudley420

⚠️ **Important:** NFTs are for entertainment and collecting only. No financial returns promised!`;

const LEGAL_POINTS = [
  "Not investments, securities, financial products",
  "No returns, income, or appreciation promised",
  "Entertainment, culture, and community engagement only",
  "Community gifts are discretionary, non-guaranteed",
  "Only mint if you appreciate the art and can afford to lose"
];

const JOKES = [
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

const FACTS = [
  "🏥 Medical cannabis has been shown to help with chronic pain management in numerous clinical studies.",
  "🧠 CBD (cannabidiol) is non-psychoactive and has been researched for anxiety and seizure disorders.",
  "💊 Cannabis contains over 100 cannabinoids, each with potentially different therapeutic properties.",
  "🌿 Medical cannabis is legal in 38+ US states and many countries worldwide for various conditions.",
  "📊 Studies show cannabis can help with nausea, especially in chemotherapy patients.",
  "🔬 The endocannabinoid system in our bodies naturally interacts with cannabis compounds.",
  "⚕️ Always consult healthcare professionals before using cannabis for medical purposes."
];

const CHARACTERS = [
  { name: "Dudley Bud", desc: "The main character, a chill cannabis bud" },
  { name: "Blaze", desc: "Dudley's adventurous friend" },
  { name: "Kush", desc: "The wise elder bud" },
  { name: "Sativa", desc: "The energetic uplifting character" },
  { name: "Indica", desc: "The relaxed, mellow character" }
];

// === SCAM DETECTION PATTERNS ===
const SCAM_PATTERNS = {
  blackmail: [
    "i have your video",
    "i have your photos",
    "send me intimate",
    "pay me or i'll send",
    "bitcoin",
    "gift cards"
  ],
  phishing: [
    "connect wallet to claim",
    "click here to secure your",
    "share your seed phrase",
    "approve this transaction",
    "send 0.1 eth",
    "limited time offer"
  ],
  hacker: [
    "problem with your telegram",
    "send me the activation",
    "send me the login",
    "send me the 2fa",
    "send me the otp",
    "security alert",
    "your device is infected",
    "telegram premium subscription",
    "run this code",
    "install remote access",
    "anydesk",
    "teamviewer"
  ],
  marketing: [
    "marketing",
    "promotion",
    "advertising",
    "sponsor",
    "partnership"
  ],
  crypto: [
    "investment",
    "profit",
    "guaranteed",
    "double your",
    "airdrop"
  ]
};

const SUSPICIOUS_USERNAMES = ["xxx", "porn", "nsfw", "onlyfans", "sex"];
const CRYPTO_ADDRESS_REGEX = /(0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,39}|eth:|btc:)/i;

// === HELPER FUNCTIONS ===
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function detectScam(text: string, username?: string): { isScam: boolean; flags: string[] } {
  const flags: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerUsername = username?.toLowerCase() || "";

  // Check username
  for (const term of SUSPICIOUS_USERNAMES) {
    if (lowerUsername.includes(term)) {
      flags.push(`Suspicious username pattern: ${term}`);
    }
  }

  // Check crypto addresses
  if (CRYPTO_ADDRESS_REGEX.test(text)) {
    flags.push("Contains crypto address");
  }

  // Check scam patterns
  for (const [category, patterns] of Object.entries(SCAM_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        flags.push(`${category}: "${pattern}"`);
      }
    }
  }

  return { isScam: flags.length > 0, flags };
}

function karenResponse(message: string): string {
  const karenPhrases = [
    "Excuse me?! ",
    "I demand to speak to the manager about this! ",
    "This is absolutely unacceptable! ",
    "Do you know who I am?! ",
    "I'm going to report this! "
  ];
  return getRandomItem(karenPhrases) + message;
}

// === BOT SETUP ===
export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(BOT_TOKEN!);

  // Session middleware
  bot.use(session({
    initial: (): SessionData => ({ karenMode: false })
  }));

  // === COMMAND HANDLERS ===

  // /start - Welcome message
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name || "friend";
    const welcome = `🌿 Welcome to Dudley Bud, ${name}! 👋

Great to have you here! Before we get started:

📌 Please read the **pinned messages**
🚫 Our team **NEVER DMs first**
🔗 **NEVER click links** unless approved by admins

Got questions? Just ask! I'm here to help! 😊🌿

**Commands:**
/info - Project information
/joke - Get a cannabis joke
/fact - Learn a medical fact
/legal - Legal disclaimers
/characters - Meet the cast
/karen - Toggle Karen mode
/safety - Safety reminders`;

    await ctx.reply(welcome, { parse_mode: "Markdown" });
  });

  // /info - Project info
  bot.command("info", async (ctx) => {
    await ctx.reply(PROJECT_INFO, { parse_mode: "Markdown" });
  });

  // /joke - Random joke
  bot.command("joke", async (ctx) => {
    const joke = getRandomItem(JOKES);
    const response = ctx.session.karenMode ? karenResponse(joke) : joke;
    await ctx.reply(response);
  });

  // /fact - Random medical fact
  bot.command("fact", async (ctx) => {
    const fact = getRandomItem(FACTS);
    const response = ctx.session.karenMode ? karenResponse(fact) : fact;
    await ctx.reply(response);
  });

  // /legal - Legal disclaimers
  bot.command("legal", async (ctx) => {
    const legalText = `⚖️ **Key Legal Points:**

${LEGAL_POINTS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

⚠️ **Remember:** NFTs are for entertainment and collecting only!`;
    await ctx.reply(legalText, { parse_mode: "Markdown" });
  });

  // /characters - Character list
  bot.command("characters", async (ctx) => {
    const charText = `🎭 **Meet the Dudley Bud Universe:**

${CHARACTERS.map(c => `🌿 **${c.name}** - ${c.desc}`).join("\n")}`;
    await ctx.reply(charText, { parse_mode: "Markdown" });
  });

  // /karen - Toggle Karen mode
  bot.command("karen", async (ctx) => {
    ctx.session.karenMode = !ctx.session.karenMode;
    if (ctx.session.karenMode) {
      await ctx.reply("😤 Karen mode ACTIVATED! I demand to speak to the manager!");
    } else {
      await ctx.reply("😊 Karen mode deactivated. Back to being chill! 🌿");
    }
  });

  // /safety - Safety reminders
  bot.command("safety", async (ctx) => {
    const safetyText = `🛡️ **Safety Reminders:**

📌 Always read pinned messages
🚫 Team NEVER DMs first
🔗 NEVER click links unless approved & pinned by team
👥 Watch for crypto addresses in usernames
🎭 Beware of marketing DMs
📞 Voice verify any 'proposals'

**Scam Red Flags:**
❌ "Connect wallet to claim rewards"
❌ "Share your seed phrase"
❌ "Send crypto to get more back"
❌ "I have your video/photos"

Stay safe, fam! 🌿`;
    await ctx.reply(safetyText, { parse_mode: "Markdown" });
  });

  // === NEW MEMBER HANDLER ===
  bot.on("message:new_chat_members", async (ctx) => {
    for (const member of ctx.message.new_chat_members) {
      const name = member.first_name || "friend";
      const username = member.username || "";

      // Check for suspicious user
      const { isScam, flags } = detectScam("", username);

      if (isScam) {
        await ctx.reply(`⚠️ Warning: New member @${username} has suspicious indicators:\n${flags.join("\n")}\n\nAdmins, please verify! 👀`);
      }

      const welcome = `🌿 Welcome to Dudley Bud, ${name}! 👋

Great to have you here! Before we get started:

📌 Please read the **pinned messages**
🚫 Our team **NEVER DMs first**
🔗 **NEVER click links** unless approved by admins

Got questions? Just ask! We're here to help! 😊🌿`;

      await ctx.reply(welcome, { parse_mode: "Markdown" });
    }
  });

  // === SCAM DETECTION MIDDLEWARE ===
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    const username = ctx.from?.username;

    const { isScam, flags } = detectScam(text, username);

    if (isScam) {
      const warningMessage = ctx.session.karenMode
        ? karenResponse(`⚠️ SUSPICIOUS MESSAGE DETECTED!\n\nFlags:\n${flags.join("\n")}\n\nAdmins, please review!`)
        : `⚠️ Suspicious message detected!\n\nFlags:\n${flags.join("\n")}\n\nAdmins, please review! 👀`;

      await ctx.reply(warningMessage, { reply_parameters: { message_id: ctx.message.message_id } });
    }

    await next();
  });

  return bot;
}

// === START BOT ===
export async function startBot() {
  const bot = createBot();

  console.log("🤖 AgentKarenBot starting...");

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  await bot.start({
    onStart: () => {
      console.log("🌿 AgentKarenBot is running!");
    },
  });
}
