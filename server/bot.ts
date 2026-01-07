import { Bot, Context, session } from "grammy";
import OpenAI from "openai";
import { db } from "./db";
import { communityProfiles, memberScores } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

// === BOT TOKEN ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// === OpenAI Client ===
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// === SESSION DATA ===
interface UserMemoryData {
  messageCount: number;
  positiveScore: number;
  negativeScore: number;
  lastMessages: string[];
  isRoastTarget: boolean;
}

interface SessionData {
  karenMode: boolean;
  userMemory: Map<string, UserMemoryData>;
  lastActivityTime: number;
}

type MyContext = Context & { session: SessionData };

// === CONTENT DATA ===
const PROJECT_INFO = `Dudley Bud - Web3 Cannabis Character Universe

Built on Base blockchain, Dudley Bud is a creative storytelling project featuring:

Collections:
- Limited Whitelist NFTs (priority access)
- Dudley420 Collection: 1,000 NFTs @ 0.01 BASE

What We Are:
- Creative Web3 storytelling
- Digital art & character universe
- Community-driven entertainment
- Animation, games & experiences

What We're NOT:
- Investment opportunity
- Financial product
- Promise of profit

Community Gifts:
Up to 25% of profits may be allocated to discretionary community gifts - but these are NOT guaranteed, automatic, or proportional.

Links:
Website: dudleybud.com
X: x.com/dudley420
Telegram: t.me/dudley420

Important: NFTs are for entertainment and collecting only. No financial returns promised!`;

const LEGAL_POINTS = [
  "Not investments, securities, financial products",
  "No returns, income, or appreciation promised",
  "Entertainment, culture, and community engagement only",
  "Community gifts are discretionary, non-guaranteed",
  "Only mint if you appreciate the art and can afford to lose"
];

const JOKES = [
  "Why did the cannabis plant go to school? To get a little higher education!",
  "What's a stoner's favorite type of music? Rock... and roll!",
  "Why don't cannabis plants ever get lost? They always follow the high way!",
  "What did the cannabis say to the paper? Let's roll!",
  "Why was the cannabis plant so good at meditation? It knew how to find inner peace!",
  "What do you call a cannabis plant that tells jokes? A pun-t!",
  "Why did Dudley Bud become a comedian? He wanted to get everyone's spirits lifted!",
  "What's Dudley's favorite subject? Higher mathematics!",
  "Why don't cannabis plants use social media? They prefer to stay grounded!",
  "What did one bud say to another? We make a great joint effort!"
];

const FACTS = [
  "Medical cannabis has been shown to help with chronic pain management in numerous clinical studies.",
  "CBD (cannabidiol) is non-psychoactive and has been researched for anxiety and seizure disorders.",
  "Cannabis contains over 100 cannabinoids, each with potentially different therapeutic properties.",
  "Medical cannabis is legal in 38+ US states and many countries worldwide for various conditions.",
  "Studies show cannabis can help with nausea, especially in chemotherapy patients.",
  "The endocannabinoid system in our bodies naturally interacts with cannabis compounds.",
  "Always consult healthcare professionals before using cannabis for medical purposes."
];

const CHARACTERS = [
  { name: "Dudley-Bud", desc: "The Boss, the Weed King, the Dudleyverse leader - the project lead" },
  { name: "WeedWacker-Ryan", desc: "Dudley's best friend, has a secret crush on Agent Karen" },
  { name: "Agent Karen", desc: "Always hunting Roach and following Dudley and the crew" },
  { name: "Roach", desc: "Shit-talking cockroach that lives off crumbs under Dudley's couch" },
  { name: "Basil", desc: "The pot-smoking basil plant" },
  { name: "Crunch Wrap", desc: "The pot-smoking cool casual friend, always looking out for everyone and always hungry" },
  { name: "Gunja-Mai", desc: "Dudley-Bud's grandmother" },
  { name: "Blinky", desc: "Friend and advisor to Dudley and the crew" },
  { name: "Nova", desc: "Wild pony stallion" },
  { name: "Pinko", desc: "Agent Karen's boss - cross-dressing pink-haired billy goat who works for some dodgy government department" }
];

const ROASTS = [
  "I've seen better takes from a fortune cookie, and those are mass-produced!",
  "Your crypto portfolio probably looks like your life choices - questionable at best.",
  "Even Dudley Bud is higher than your IQ right now.",
  "I'd roast you harder but I don't want to exceed your reading level.",
  "You're the reason they put instructions on shampoo bottles.",
  "Your opinion is like a fart in the wind - temporary and nobody asked for it.",
  "I've met smarter people at a 'Buy High Sell Low' convention.",
  "You're not a clown, you're the entire circus performing on the blockchain."
];

// === SCAM DETECTION PATTERNS ===
const SCAM_PATTERNS = {
  blackmail: ["i have your video", "i have your photos", "send me intimate", "pay me or i'll send", "bitcoin", "gift cards"],
  phishing: ["connect wallet to claim", "click here to secure your", "share your seed phrase", "approve this transaction", "send 0.1 eth", "limited time offer"],
  hacker: ["problem with your telegram", "send me the activation", "send me the login", "send me the 2fa", "send me the otp", "security alert", "your device is infected", "telegram premium subscription", "run this code", "install remote access", "anydesk", "teamviewer"],
  marketing: ["marketing", "promotion", "advertising", "sponsor", "partnership"],
  crypto: ["investment", "profit", "guaranteed", "double your", "airdrop"]
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

  for (const term of SUSPICIOUS_USERNAMES) {
    if (lowerUsername.includes(term)) {
      flags.push(`Suspicious username pattern: ${term}`);
    }
  }

  if (CRYPTO_ADDRESS_REGEX.test(text)) {
    flags.push("Contains crypto address");
  }

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

// === AI FUNCTIONS ===
async function getAIResponse(prompt: string, context: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are AgentKarenBot for Dudley Bud - Web3 cannabis universe on Base blockchain. Be chill, witty, friendly. Keep replies to 1-2 sentences. Use slang like "fam", "vibes", "LFG".

Project: dudleybud.com | NFTs for entertainment only, no investment promises.

Characters: Dudley-Bud (Boss/Weed King), WeedWacker-Ryan (bestie, crushes on Karen), Agent Karen (hunts Roach), Roach (trash-talking cockroach under couch), Basil (pot-smoking plant), Crunch Wrap (hungry raccoon), Gunja-Mai (grandma in leopard print), Blinky (alien hydro wizard), Nova (mysterious guitarist), Pinko (Karen's boss, pink-haired goat).

Adventures: Christmas Shopping (dolphin bong, Ancient Forest Grandpa incense), New Year 2026 (Nova's guitar, Karen's mysterious call), Blinky's Hydro Lesson (Power Bloom Mode), Great Bong Run (Galaxy Nebula XL, Mario Kart battle), Epic Picnic (chef-420.com, glowing fruit), Karen's First Encounter ("going in my report!"), BBQ of Destiny (moon BBQ dreams), Roch Moves In (couch fortress), Namast-Hay Gummies Quest (cotton candy disaster), Candy Chaos (time-bending fudge), Grow-op Saga (Rick the raccoon thief).`
        },
        { role: "user", content: `${prompt}` }
      ],
      max_tokens: 80,
    });
    return response.choices[0]?.message?.content || "I'm having trouble thinking right now. Try again!";
  } catch (error) {
    console.error("AI Error:", error);
    return "My brain is a bit foggy right now. Ask me again later!";
  }
}

async function generateRoast(targetName: string, context: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Witty roast comedian for Dudley Bud. Playful, edgy but not mean. Crypto/cannabis vibes. 1-2 sentences max.`
        },
        { role: "user", content: `Roast ${targetName}` }
      ],
      max_tokens: 60,
    });
    return response.choices[0]?.message?.content || getRandomItem(ROASTS);
  } catch (error) {
    return getRandomItem(ROASTS);
  }
}

async function generateDadJoke(): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a dad joke master. Generate ONE fresh, original dad joke. Cannabis/stoner themed jokes are welcome but not required. Keep it clean and punny. Just the joke, no intro.`
        },
        { role: "user", content: `Tell me a fresh dad joke` }
      ],
      max_tokens: 60,
    });
    return response.choices[0]?.message?.content || getRandomItem(JOKES);
  } catch (error) {
    return getRandomItem(JOKES);
  }
}

// === CRYPTO MARKET DATA ===
interface CoinData {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

async function fetchCryptoMarket(): Promise<{ topCoins: CoinData[], memeCoins: CoinData[], trending: string }> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&sparkline=false"
    );
    
    if (!response.ok) {
      throw new Error("CoinGecko API error");
    }
    
    const data = await response.json() as any[];
    
    // Top 10 by market cap
    const topCoins: CoinData[] = data.slice(0, 10).map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h || 0
    }));
    
    // Meme coins (filter known meme coins)
    const memeSymbols = ["doge", "shib", "pepe", "floki", "bonk", "wif", "brett", "turbo", "wojak"];
    const memeCoins: CoinData[] = data
      .filter((coin: any) => memeSymbols.includes(coin.symbol.toLowerCase()))
      .slice(0, 5)
      .map((coin: any) => ({
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h || 0
      }));
    
    const avgChange = topCoins.reduce((sum, c) => sum + c.change24h, 0) / topCoins.length;
    const trending = avgChange > 0 ? "Markets looking green today!" : "Markets taking a breather.";
    
    return { topCoins, memeCoins, trending };
  } catch (error) {
    console.error("Market data error:", error);
    return {
      topCoins: [],
      memeCoins: [],
      trending: "Market data temporarily unavailable"
    };
  }
}

// Search for a specific token
async function searchToken(query: string): Promise<CoinData | null> {
  try {
    const searchResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
    );
    
    if (!searchResponse.ok) return null;
    
    const searchData = await searchResponse.json() as any;
    const coin = searchData.coins?.[0];
    if (!coin) return null;
    
    // Get detailed price data
    const priceResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!priceResponse.ok) return null;
    
    const priceData = await priceResponse.json() as any;
    const coinPrice = priceData[coin.id];
    
    if (!coinPrice) return null;
    
    return {
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coinPrice.usd || 0,
      change24h: coinPrice.usd_24h_change || 0
    };
  } catch (error) {
    console.error("Token search error:", error);
    return null;
  }
}

// Detect crypto/NFT keywords in a question
function detectCryptoQuery(text: string): { isCrypto: boolean; tokens: string[] } {
  const lowerText = text.toLowerCase();
  
  // Common crypto keywords
  const cryptoKeywords = ["price", "worth", "cost", "value", "trading", "market", "pump", "dump", "moon", "ath", "all time high"];
  const hasCryptoIntent = cryptoKeywords.some(k => lowerText.includes(k));
  
  // Known popular tokens to detect
  const knownTokens = [
    "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "cardano", "ada",
    "dogecoin", "doge", "shiba", "shib", "pepe", "bonk", "wif", "floki",
    "xrp", "ripple", "bnb", "binance", "polygon", "matic", "avalanche", "avax",
    "chainlink", "link", "polkadot", "dot", "litecoin", "ltc", "uniswap", "uni",
    "aave", "maker", "mkr", "arbitrum", "arb", "optimism", "op", "base",
    "sui", "aptos", "apt", "near", "cosmos", "atom", "tron", "trx",
    "toncoin", "ton", "stellar", "xlm", "monero", "xmr", "hedera", "hbar"
  ];
  
  const foundTokens: string[] = [];
  for (const token of knownTokens) {
    if (lowerText.includes(token)) {
      foundTokens.push(token);
    }
  }
  
  return {
    isCrypto: hasCryptoIntent || foundTokens.length > 0,
    tokens: foundTokens
  };
}

// Fetch trending coins
async function fetchTrendingCoins(): Promise<string> {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/search/trending");
    if (!response.ok) return "";
    
    const data = await response.json() as any;
    const trending = data.coins?.slice(0, 7).map((c: any) => 
      `${c.item.name} (${c.item.symbol})`
    ).join(", ");
    
    return trending ? `Trending coins: ${trending}` : "";
  } catch {
    return "";
  }
}

// Detect cannabis-related queries
function detectCannabisQuery(text: string): { isRecipe: boolean; isMedical: boolean; keywords: string[] } {
  const lowerText = text.toLowerCase();
  
  // Recipe keywords
  const recipeKeywords = ["recipe", "edible", "edibles", "brownie", "cookie", "gummy", "gummies", "butter", "cannabutter", "oil", "infused", "cooking", "baking", "food", "drink", "tincture", "make", "how to cook"];
  const isRecipe = recipeKeywords.some(k => lowerText.includes(k)) && 
    (lowerText.includes("cannabis") || lowerText.includes("weed") || lowerText.includes("thc") || lowerText.includes("cbd") || lowerText.includes("marijuana"));
  
  // Medical keywords
  const medicalKeywords = ["medical", "medicine", "pain", "anxiety", "sleep", "insomnia", "depression", "ptsd", "seizure", "epilepsy", "nausea", "cancer", "arthritis", "inflammation", "chronic", "treatment", "therapy", "dosage", "strain", "indica", "sativa", "hybrid", "cbd", "thc", "health", "benefit", "side effect", "symptom"];
  const isMedical = medicalKeywords.some(k => lowerText.includes(k)) && 
    (lowerText.includes("cannabis") || lowerText.includes("weed") || lowerText.includes("marijuana") || lowerText.includes("thc") || lowerText.includes("cbd") || lowerText.includes("medical"));
  
  const foundKeywords: string[] = [];
  for (const k of [...recipeKeywords, ...medicalKeywords]) {
    if (lowerText.includes(k)) foundKeywords.push(k);
  }
  
  return { isRecipe, isMedical, keywords: foundKeywords };
}

// Medical cannabis disclaimer
const MEDICAL_DISCLAIMER = `\n\n--- DISCLAIMER ---\nThis is NOT medical advice. DYOR (Do Your Own Research). Always consult a licensed healthcare provider before using cannabis for medical purposes. Laws vary by location. Stay informed, stay safe!`;

// Fetch NFT data
async function fetchNFTData(query: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/nfts/list?per_page=100`
    );
    if (!response.ok) return null;
    
    const nfts = await response.json() as any[];
    const match = nfts.find((n: any) => 
      n.name.toLowerCase().includes(query.toLowerCase()) ||
      n.id.toLowerCase().includes(query.toLowerCase())
    );
    
    if (!match) return null;
    
    // Get NFT details
    const detailResponse = await fetch(
      `https://api.coingecko.com/api/v3/nfts/${match.id}`
    );
    if (!detailResponse.ok) return `Found NFT: ${match.name}`;
    
    const detail = await detailResponse.json() as any;
    return `${detail.name} NFT - Floor: ${detail.floor_price?.usd ? '$' + detail.floor_price.usd.toFixed(2) : 'N/A'}, 24h Volume: ${detail.volume_24h?.usd ? '$' + detail.volume_24h.usd.toFixed(0) : 'N/A'}`;
  } catch {
    return null;
  }
}

function formatMarketReport(topCoins: CoinData[], memeCoins: CoinData[], trending: string): string {
  const formatCoin = (coin: CoinData) => {
    const arrow = coin.change24h >= 0 ? "+" : "";
    const priceStr = coin.price >= 1 
      ? `$${coin.price.toFixed(2)}` 
      : `$${coin.price.toFixed(6)}`;
    return `${coin.symbol}: ${priceStr} (${arrow}${coin.change24h.toFixed(1)}%)`;
  };
  
  let report = `CRYPTO MARKET REPORT\n\n`;
  report += `${trending}\n\n`;
  
  if (topCoins.length > 0) {
    report += `TOP CRYPTOS:\n`;
    report += topCoins.map(formatCoin).join("\n");
    report += "\n\n";
  }
  
  if (memeCoins.length > 0) {
    report += `MEME COINS:\n`;
    report += memeCoins.map(formatCoin).join("\n");
    report += "\n\n";
  }
  
  report += `Dudley Bud keeps building! We're moving forward, one block at a time. Stay chill, stay safe!`;
  
  return report;
}

// === AUTO-ENGAGE MESSAGES ===
const AUTO_ENGAGE_MESSAGES = [
  "It's been quiet in here... Anyone want to hear a joke? Just say /joke!",
  "Dudley's getting lonely! What's everyone up to today?",
  "Time for a random fact! Did you know... type /fact to learn something new!",
  "The vibes are immaculate today. How's everyone feeling?",
  "Remember: We're not just a project, we're a family. Stay chill!",
  "Anyone checking the markets? Type /market for the latest crypto report!",
  "Dudley Bud tip of the day: Always verify, never trust random DMs!"
];

// === AUTO-ENGAGE TIMER ===
const autoEngageTimers: Map<number, NodeJS.Timeout> = new Map();
const AUTO_ENGAGE_MINUTES = 30; // Quiet time before auto-engage

// === ADMIN ACTIVITY TRACKING ===
interface AdminActivity {
  oderId: number;
  username: string;
  firstName: string;
  lastActive: number;
}

const adminActivity: Map<number, Map<number, AdminActivity>> = new Map(); // chatId -> (userId -> activity)
const adminCheckTimers: Map<number, NodeJS.Timeout> = new Map();
const adminLastAlerted: Map<number, Map<number, number>> = new Map(); // chatId -> (userId -> lastAlertedTime)
const ADMIN_INACTIVE_HOURS = 24;

// === ACTIVE CHATS TRACKING (for scheduled posts) ===
const activeChats: Set<number> = new Set();

// === TRIVIA SYSTEM ===
interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  category: 'cannabis' | 'crypto' | 'dudley';
  points: number;
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // Cannabis questions
  { question: "What is the main psychoactive compound in cannabis?", options: ["CBD", "THC", "CBN", "CBG"], correctIndex: 1, category: 'cannabis', points: 10 },
  { question: "Which cannabis strain type is known for energizing effects?", options: ["Indica", "Sativa", "Ruderalis", "Hemp"], correctIndex: 1, category: 'cannabis', points: 10 },
  { question: "What is the cannabis plant's flowering stage light cycle?", options: ["24/0", "18/6", "12/12", "20/4"], correctIndex: 2, category: 'cannabis', points: 15 },
  { question: "Which terpene gives cannabis its citrus smell?", options: ["Myrcene", "Limonene", "Pinene", "Linalool"], correctIndex: 1, category: 'cannabis', points: 15 },
  { question: "What does '420' refer to in cannabis culture?", options: ["Police code", "Time to smoke", "THC percentage", "California bill"], correctIndex: 1, category: 'cannabis', points: 10 },
  { question: "Which state was first to legalize recreational cannabis?", options: ["California", "Colorado", "Washington", "Oregon"], correctIndex: 1, category: 'cannabis', points: 15 },
  { question: "What is kief?", options: ["Cannabis oil", "Trichome crystals", "Stem fibers", "Leaf extract"], correctIndex: 1, category: 'cannabis', points: 10 },
  { question: "Which terpene is known for calming, lavender-like effects?", options: ["Caryophyllene", "Humulene", "Linalool", "Terpinolene"], correctIndex: 2, category: 'cannabis', points: 15 },
  // Crypto questions
  { question: "Who created Bitcoin?", options: ["Vitalik Buterin", "Satoshi Nakamoto", "Charlie Lee", "CZ"], correctIndex: 1, category: 'crypto', points: 10 },
  { question: "What blockchain is Dudley Bud built on?", options: ["Ethereum", "Solana", "Base", "Polygon"], correctIndex: 2, category: 'crypto', points: 10 },
  { question: "What does NFT stand for?", options: ["New File Token", "Non-Fungible Token", "Network Fund Transfer", "Native Finance Tech"], correctIndex: 1, category: 'crypto', points: 10 },
  { question: "What is a 'rug pull' in crypto?", options: ["Market crash", "Scam exit", "Price pump", "Whale dump"], correctIndex: 1, category: 'crypto', points: 15 },
  { question: "What does WAGMI mean?", options: ["We're All Getting Money In", "We're All Gonna Make It", "Wallet And Gas Mining Interface", "Web3 Asset Growth Index"], correctIndex: 1, category: 'crypto', points: 10 },
  { question: "What is 'gas' in crypto?", options: ["Fuel for mining", "Transaction fee", "Token burn", "Staking reward"], correctIndex: 1, category: 'crypto', points: 10 },
  { question: "What does DYOR mean?", options: ["Do Your Own Research", "Dump Your Old Reserves", "Digital Yield Optimization Rate", "Decentralized Yield Operations"], correctIndex: 0, category: 'crypto', points: 10 },
  { question: "What is a 'diamond hands' holder?", options: ["Jewelry collector", "Long-term holder", "Day trader", "Paper hands"], correctIndex: 1, category: 'crypto', points: 10 },
  // Dudley Bud questions
  { question: "What is Dudley Bud's main mission?", options: ["Get rich quick", "Creative storytelling", "Day trading", "Mining crypto"], correctIndex: 1, category: 'dudley', points: 15 },
  { question: "Are Dudley Bud NFTs meant for financial returns?", options: ["Yes, guaranteed profits", "No, entertainment only", "Maybe, depends on market", "Only for whales"], correctIndex: 1, category: 'dudley', points: 15 },
  { question: "Which is NOT a Dudley Bud character?", options: ["Blaze", "Kush", "Sativa", "Bitcoin Bob"], correctIndex: 3, category: 'dudley', points: 10 },
  { question: "What type of community is Dudley Bud building?", options: ["Pump and dump", "Creative and educational", "Mining pool", "Exchange platform"], correctIndex: 1, category: 'dudley', points: 15 },
];

interface ActiveTrivia {
  question: TriviaQuestion;
  startTime: number;
  answered: Set<number>;
}

const activeTrivias: Map<number, ActiveTrivia> = new Map(); // chatId -> active trivia

// === GIVEAWAY SYSTEM ===
interface Giveaway {
  chatId: number;
  prize: string;
  entries: Map<number, { username: string; firstName: string }>;
  createdBy: number;
  createdAt: number;
  active: boolean;
}

const activeGiveaways: Map<number, Giveaway> = new Map(); // chatId -> giveaway

// Check if user is chat owner/creator
async function isOwner(ctx: MyContext): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === "creator";
  } catch {
    return false;
  }
}

// Check if user is admin or creator
async function isAdmin(ctx: MyContext): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}

// === MODERATION SYSTEM ===
interface UserOffense {
  count: number;
  lastOffense: number;
  muteUntil: number;
}

// chatId -> (userId -> offense data)
const userOffenses: Map<number, Map<number, UserOffense>> = new Map();

// Mute durations: 15 min, 4 hours, 72 hours
const MUTE_DURATIONS = [
  15 * 60,           // 15 minutes in seconds
  4 * 60 * 60,       // 4 hours in seconds  
  72 * 60 * 60       // 72 hours in seconds
];

// Spam tracking
interface SpamTracker {
  messages: string[];
  timestamps: number[];
}
const spamTracking: Map<number, Map<number, SpamTracker>> = new Map(); // chatId -> (userId -> spam data)

// Leaderboard tracking
interface UserActivity {
  userId: number;
  username: string;
  firstName: string;
  messageCount: number;
}
const leaderboardData: Map<number, Map<number, UserActivity>> = new Map(); // chatId -> (userId -> activity)

// Get or create user offense record
function getUserOffenses(chatId: number, userId: number): UserOffense {
  if (!userOffenses.has(chatId)) {
    userOffenses.set(chatId, new Map());
  }
  const chatOffenses = userOffenses.get(chatId)!;
  if (!chatOffenses.has(userId)) {
    chatOffenses.set(userId, { count: 0, lastOffense: 0, muteUntil: 0 });
  }
  return chatOffenses.get(userId)!;
}

// Add offense and return mute duration
function addOffense(chatId: number, userId: number): { muteSeconds: number; offenseCount: number; notifyAdmin: boolean } {
  const offense = getUserOffenses(chatId, userId);
  offense.count++;
  offense.lastOffense = Date.now();
  
  // Get mute duration based on offense count (cap at max)
  const muteIndex = Math.min(offense.count - 1, MUTE_DURATIONS.length - 1);
  const muteSeconds = MUTE_DURATIONS[muteIndex];
  offense.muteUntil = Date.now() + (muteSeconds * 1000);
  
  // Notify admin after 2nd offense
  const notifyAdmin = offense.count >= 2;
  
  return { muteSeconds, offenseCount: offense.count, notifyAdmin };
}

// Check if message is spam
function isSpam(chatId: number, userId: number, message: string): boolean {
  if (!spamTracking.has(chatId)) {
    spamTracking.set(chatId, new Map());
  }
  const chatSpam = spamTracking.get(chatId)!;
  
  if (!chatSpam.has(userId)) {
    chatSpam.set(userId, { messages: [], timestamps: [] });
  }
  const tracker = chatSpam.get(userId)!;
  
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  // Clean old messages
  while (tracker.timestamps.length > 0 && tracker.timestamps[0] < fiveMinutesAgo) {
    tracker.timestamps.shift();
    tracker.messages.shift();
  }
  
  // Add current message
  tracker.messages.push(message.toLowerCase());
  tracker.timestamps.push(now);
  
  // Check for spam patterns
  // 1. More than 5 messages in 30 seconds
  const thirtySecondsAgo = now - 30000;
  const recentCount = tracker.timestamps.filter(t => t > thirtySecondsAgo).length;
  if (recentCount > 5) return true;
  
  // 2. Same message repeated 3+ times
  const lastThree = tracker.messages.slice(-3);
  if (lastThree.length === 3 && lastThree[0] === lastThree[1] && lastThree[1] === lastThree[2]) {
    return true;
  }
  
  // 3. Multiple links in short time
  const linkPattern = /https?:\/\/|t\.me\/|discord\.gg/gi;
  const recentLinks = tracker.messages.slice(-3).filter(m => linkPattern.test(m)).length;
  if (recentLinks >= 2) return true;
  
  return false;
}

// Update leaderboard
async function updateLeaderboard(chatId: number, userId: number, username: string, firstName: string) {
  if (!leaderboardData.has(chatId)) {
    leaderboardData.set(chatId, new Map());
  }
  const chatLeaderboard = leaderboardData.get(chatId)!;
  
  if (!chatLeaderboard.has(userId)) {
    chatLeaderboard.set(userId, { userId, username, firstName, messageCount: 0 });
  }
  const user = chatLeaderboard.get(userId)!;
  user.messageCount++;
  user.username = username; // Update in case it changed
  user.firstName = firstName;
  
  // Also persist to database for long-term tracking
  try {
    const telegramUserId = userId.toString();
    const chatIdStr = chatId.toString();
    
    const existing = await db.select().from(memberScores)
      .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatIdStr)))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(memberScores)
        .set({ 
          messageCount: (existing[0].messageCount || 0) + 1,
          username, 
          firstName, 
          lastActive: new Date() 
        })
        .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatIdStr)));
    } else {
      await db.insert(memberScores).values({
        telegramUserId,
        chatId: chatIdStr,
        username,
        firstName,
        triviaPoints: 0,
        triviaCorrect: 0,
        triviaAttempts: 0,
        messageCount: 1,
      });
    }
  } catch (e) {
    // Silent fail for message tracking - don't interrupt chat
  }
}

// Get top users for leaderboard
function getTopUsers(chatId: number, limit: number = 10): UserActivity[] {
  const chatLeaderboard = leaderboardData.get(chatId);
  if (!chatLeaderboard) return [];
  
  return Array.from(chatLeaderboard.values())
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, limit);
}

// Format mute duration for display
function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86400)} days`;
}

// === CANNABIS RECIPES (from chef-420.com inspiration) ===
const CANNABIS_RECIPES = [
  {
    name: "Classic Cannabutter",
    description: "The foundation of cannabis cooking! Perfect for brownies, cookies, and more.",
    ingredients: ["1 cup butter", "1 cup water", "7-10g decarbed cannabis flower"],
    steps: "Simmer butter and water, add decarbed cannabis, cook on low for 2-3 hours, strain and refrigerate."
  },
  {
    name: "Canna-Infused Honey",
    description: "Sweet and versatile - perfect for tea, toast, or drizzling on desserts!",
    ingredients: ["1 cup honey", "3.5g decarbed cannabis", "Cheesecloth"],
    steps: "Combine honey and cannabis in double boiler, simmer 40 mins, strain through cheesecloth. Store in jar."
  },
  {
    name: "Green Dragon Tincture",
    description: "Fast-acting and discreet! Add to drinks or use sublingually.",
    ingredients: ["7g decarbed cannabis", "4oz high-proof alcohol (Everclear)", "Mason jar"],
    steps: "Combine in jar, shake daily for 2-3 weeks, strain. A few drops go a long way!"
  },
  {
    name: "Cannabis Coconut Oil",
    description: "Versatile for cooking, baking, or even topicals!",
    ingredients: ["1 cup coconut oil", "7g decarbed cannabis flower"],
    steps: "Melt oil in slow cooker, add cannabis, cook on low 4-6 hours, strain. Great for edibles!"
  },
  {
    name: "Pot Brownies (Classic)",
    description: "The OG edible that started it all!",
    ingredients: ["1/2 cup cannabutter", "1 cup sugar", "2 eggs", "1/3 cup cocoa", "1/2 cup flour"],
    steps: "Mix all ingredients, pour into greased 8x8 pan, bake 25-30 mins at 350F. Start low, go slow!"
  },
  {
    name: "Cannabis-Infused Gummies",
    description: "Tasty, portable, and easy to dose!",
    ingredients: ["1 cup fruit juice", "1/4 cup cannabis tincture", "2 tbsp gelatin", "Honey to taste"],
    steps: "Heat juice, whisk in gelatin, add tincture and honey, pour into molds, refrigerate 2 hours."
  },
  {
    name: "Wake & Bake Pancakes",
    description: "Start your morning right with these fluffy cannabis pancakes!",
    ingredients: ["2 cups pancake mix", "3 tbsp melted cannabutter", "1.5 cups milk", "1 egg"],
    steps: "Mix all ingredients, cook on griddle until golden. Top with maple syrup!"
  },
  {
    name: "Canna-Chocolate Truffles",
    description: "Elegant, delicious, and perfect for sharing!",
    ingredients: ["8oz dark chocolate", "1/2 cup heavy cream", "2 tbsp cannabutter", "Cocoa powder"],
    steps: "Melt chocolate with cream and cannabutter, chill, roll into balls, dust with cocoa."
  },
  {
    name: "Green Goddess Salad Dressing",
    description: "Healthy and herbaceous - cannabis meets veggies!",
    ingredients: ["1/4 cup canna-olive oil", "2 tbsp lemon juice", "1 avocado", "Fresh herbs"],
    steps: "Blend all ingredients until smooth. Drizzle over your favorite salad!"
  },
  {
    name: "Cannabis Hot Chocolate",
    description: "Cozy, comforting, and uplifting for cold nights!",
    ingredients: ["2 cups milk", "2 tbsp cocoa", "1 tbsp cannabutter", "Marshmallows"],
    steps: "Heat milk, whisk in cocoa and cannabutter until smooth. Top with marshmallows!"
  }
];

// Get random recipe
function getRandomRecipe() {
  return CANNABIS_RECIPES[Math.floor(Math.random() * CANNABIS_RECIPES.length)];
}

// Get recipe based on search query (for /ask command)
function getCannabisRecipe(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Try to match specific recipe by keywords
  for (const recipe of CANNABIS_RECIPES) {
    const nameLower = recipe.name.toLowerCase();
    if (nameLower.split(" ").some(word => lowerQuery.includes(word) && word.length > 3)) {
      return `${recipe.name}\n\n${recipe.description}\n\nIngredients:\n${recipe.ingredients.map(i => `- ${i}`).join("\n")}\n\nInstructions: ${recipe.steps}\n\nTip: Start low, go slow!`;
    }
  }
  
  // Return random recipe if no specific match
  const random = CANNABIS_RECIPES[Math.floor(Math.random() * CANNABIS_RECIPES.length)];
  return `${random.name}\n\n${random.description}\n\nIngredients:\n${random.ingredients.map(i => `- ${i}`).join("\n")}\n\nInstructions: ${random.steps}\n\nTip: Start low, go slow!`;
}

// Format recipe for posting
function formatRecipePost(recipe: typeof CANNABIS_RECIPES[0]): string {
  return `DAILY RECIPE from chef-420.com

${recipe.name}

${recipe.description}

INGREDIENTS:
${recipe.ingredients.map(i => `- ${i}`).join("\n")}

HOW TO MAKE IT:
${recipe.steps}

Remember: Always dose responsibly! Start low, go slow.

More recipes at chef-420.com`;
}

// Forward declaration - will be set when bot is created
let botInstance: Bot<MyContext> | null = null;

// Update admin activity when they send a message
function updateAdminActivity(chatId: number, userId: number, username: string, firstName: string) {
  if (!adminActivity.has(chatId)) {
    adminActivity.set(chatId, new Map());
  }
  
  const chatAdmins = adminActivity.get(chatId)!;
  chatAdmins.set(userId, {
    oderId: userId,
    username,
    firstName,
    lastActive: Date.now()
  });
}

// Check and call out inactive admins (only once per 24 hours per admin)
async function checkInactiveAdmins(chatId: number) {
  if (!botInstance) return;
  
  try {
    // Get current admins from Telegram
    const admins = await botInstance.api.getChatAdministrators(chatId);
    const now = Date.now();
    const inactiveThreshold = ADMIN_INACTIVE_HOURS * 60 * 60 * 1000;
    
    const chatAdmins = adminActivity.get(chatId) || new Map();
    
    // Get or create alert tracking for this chat
    if (!adminLastAlerted.has(chatId)) {
      adminLastAlerted.set(chatId, new Map());
    }
    const chatAlerts = adminLastAlerted.get(chatId)!;
    
    const inactiveAdmins: string[] = [];
    
    for (const admin of admins) {
      // Skip bots
      if (admin.user.is_bot) continue;
      
      const userId = admin.user.id;
      const activity = chatAdmins.get(userId);
      const lastAlerted = chatAlerts.get(userId) || 0;
      
      // Check if admin is inactive (no activity or 24+ hours since last message)
      const isInactive = !activity || (now - activity.lastActive) > inactiveThreshold;
      
      // Check if we already alerted about this admin in the last 24 hours
      const alreadyAlerted = (now - lastAlerted) < inactiveThreshold;
      
      // Only alert if inactive AND we haven't alerted about them recently
      if (isInactive && !alreadyAlerted) {
        const mention = admin.user.username 
          ? `@${admin.user.username}` 
          : admin.user.first_name;
        inactiveAdmins.push(mention);
        
        // Mark as alerted
        chatAlerts.set(userId, now);
      }
    }
    
    if (inactiveAdmins.length > 0) {
      const message = `Hey ${inactiveAdmins.join(", ")} - haven't seen you in a while! The community misses you. Drop in when you can!`;
      await botInstance.api.sendMessage(chatId, message);
    }
  } catch (error) {
    console.error("Error checking admin activity:", error);
  }
}

// Start admin activity checker for a chat (runs every 24 hours)
function startAdminActivityChecker(chatId: number) {
  // Clear existing timer
  const existingTimer = adminCheckTimers.get(chatId);
  if (existingTimer) {
    clearInterval(existingTimer);
  }
  
  // Check every 24 hours (no initial check - wait for first 24h cycle)
  const timer = setInterval(() => {
    checkInactiveAdmins(chatId);
  }, 24 * 60 * 60 * 1000);
  
  adminCheckTimers.set(chatId, timer);
}

function resetAutoEngageTimer(chatId: number) {
  if (!botInstance) return;
  
  // Clear existing timer
  const existingTimer = autoEngageTimers.get(chatId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new timer
  const timer = setTimeout(async () => {
    if (!botInstance) return;
    try {
      const message = getRandomItem(AUTO_ENGAGE_MESSAGES);
      await botInstance.api.sendMessage(chatId, message);
      console.log(`Auto-engage sent to chat ${chatId}`);
    } catch (error) {
      console.error("Auto-engage error:", error);
    }
  }, AUTO_ENGAGE_MINUTES * 60 * 1000);
  
  autoEngageTimers.set(chatId, timer);
}

// === BOT SETUP ===
export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(BOT_TOKEN!);
  botInstance = bot; // Set for auto-engage timer

  // Set command menu in Telegram
  bot.api.setMyCommands([
    { command: "start", description: "Welcome message" },
    { command: "info", description: "Project information" },
    { command: "joke", description: "Get a cannabis joke" },
    { command: "fact", description: "Learn a medical fact" },
    { command: "legal", description: "Legal disclaimers" },
    { command: "characters", description: "Meet the cast" },
    { command: "market", description: "Live crypto prices" },
    { command: "roast", description: "Roast someone" },
    { command: "ask", description: "Ask me anything" },
    { command: "karen", description: "Toggle Karen mode" },
    { command: "safety", description: "Safety reminders" },
    { command: "enter", description: "Enter active giveaway" },
    { command: "entries", description: "Check giveaway entries" },
    { command: "trivia", description: "Start a trivia question" },
    { command: "answer", description: "Answer trivia (1-4)" },
    { command: "leaderboard", description: "Show top members" },
    { command: "myscore", description: "Check your trivia score" }
  ]).catch(err => console.error("Failed to set commands:", err));

  // Session middleware
  bot.use(session({
    initial: (): SessionData => ({ 
      karenMode: false,
      userMemory: new Map(),
      lastActivityTime: Date.now()
    })
  }));

  // === COMMAND HANDLERS ===

  // /start - Welcome message
  bot.command("start", async (ctx) => {
    const name = ctx.from?.first_name || "friend";
    const welcome = `Welcome to Dudley Bud, ${name}!

Great to have you here! Before we get started:

- Please read the pinned messages
- Our team NEVER DMs first
- NEVER click links unless approved by admins

Commands:
/info - Project information
/joke - Get a cannabis joke
/fact - Learn a medical fact
/legal - Legal disclaimers
/characters - Meet the cast
/market - Live crypto prices
/roast @username - Roast someone
/ask [question] - Ask me anything
/karen - Toggle Karen mode
/safety - Safety reminders

Got questions? Just ask!`;

    await ctx.reply(welcome);
  });

  // /info - Project info
  bot.command("info", async (ctx) => {
    await ctx.reply(PROJECT_INFO);
  });

  // /joke - Fresh dad joke
  bot.command("joke", async (ctx) => {
    const joke = await generateDadJoke();
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
    const legalText = `KEY LEGAL POINTS:

${LEGAL_POINTS.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Remember: NFTs are for entertainment and collecting only!`;
    await ctx.reply(legalText);
  });

  // /characters - Character list
  bot.command("characters", async (ctx) => {
    const charText = `MEET THE DUDLEY BUD UNIVERSE:

${CHARACTERS.map(c => `${c.name} - ${c.desc}`).join("\n")}`;
    await ctx.reply(charText);
  });

  // /karen - Toggle Karen mode
  bot.command("karen", async (ctx) => {
    ctx.session.karenMode = !ctx.session.karenMode;
    if (ctx.session.karenMode) {
      await ctx.reply("Karen mode ACTIVATED! I demand to speak to the manager!");
    } else {
      await ctx.reply("Karen mode deactivated. Back to being chill!");
    }
  });

  // === COMMUNITY PROFILE COMMANDS ===
  
  // /setbirthday - Set your birthday (MM-DD format)
  bot.command("setbirthday", async (ctx) => {
    if (!ctx.from) return;
    
    const birthday = ctx.message?.text?.replace("/setbirthday", "").trim();
    if (!birthday) {
      await ctx.reply("Usage: /setbirthday MM-DD\n\nExample: /setbirthday 04-20\n\nI'll remember and celebrate your birthday!");
      return;
    }
    
    // Validate format MM-DD
    const parts = birthday.split("-");
    if (parts.length !== 2) {
      await ctx.reply("Please use MM-DD format.\n\nExample: /setbirthday 04-20");
      return;
    }
    
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);
    
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      await ctx.reply("Invalid date! Use MM-DD format with valid month (01-12) and day (01-31).\n\nExample: /setbirthday 04-20");
      return;
    }
    
    const formattedBirthday = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    const telegramUserId = ctx.from.id.toString();
    const chatId = ctx.chat?.id?.toString() || "";
    
    try {
      const existing = await db.select().from(communityProfiles).where(eq(communityProfiles.telegramUserId, telegramUserId)).limit(1);
      
      if (existing.length > 0) {
        await db.update(communityProfiles)
          .set({ birthday: formattedBirthday, chatId, username: ctx.from.username || "", firstName: ctx.from.first_name || "" })
          .where(eq(communityProfiles.telegramUserId, telegramUserId));
      } else {
        await db.insert(communityProfiles).values({
          telegramUserId,
          chatId,
          username: ctx.from.username || "",
          firstName: ctx.from.first_name || "",
          birthday: formattedBirthday
        });
      }
      
      await ctx.reply(`Birthday saved! I'll celebrate you on ${formattedBirthday}!`);
    } catch (error) {
      console.error("Error saving birthday:", error);
      await ctx.reply("Couldn't save your birthday right now. Try again later!");
    }
  });

  // /setlocation - Set where you're from
  bot.command("setlocation", async (ctx) => {
    if (!ctx.from) return;
    
    const location = ctx.message?.text?.replace("/setlocation", "").trim();
    if (!location) {
      await ctx.reply("Usage: /setlocation [your location]\n\nExample: /setlocation California, USA\n\nI'll remember where you're from!");
      return;
    }
    
    const telegramUserId = ctx.from.id.toString();
    const chatId = ctx.chat?.id?.toString() || "";
    
    try {
      const existing = await db.select().from(communityProfiles).where(eq(communityProfiles.telegramUserId, telegramUserId)).limit(1);
      
      if (existing.length > 0) {
        await db.update(communityProfiles)
          .set({ location, chatId, username: ctx.from.username || "", firstName: ctx.from.first_name || "" })
          .where(eq(communityProfiles.telegramUserId, telegramUserId));
      } else {
        await db.insert(communityProfiles).values({
          telegramUserId,
          chatId,
          username: ctx.from.username || "",
          firstName: ctx.from.first_name || "",
          location
        });
      }
      
      await ctx.reply(`Location saved! I'll remember you're from ${location}!`);
    } catch (error) {
      console.error("Error saving location:", error);
      await ctx.reply("Couldn't save your location right now. Try again later!");
    }
  });

  // /setlikes - Set what you like
  bot.command("setlikes", async (ctx) => {
    if (!ctx.from) return;
    
    const likes = ctx.message?.text?.replace("/setlikes", "").trim();
    if (!likes) {
      await ctx.reply("Usage: /setlikes [things you like]\n\nExample: /setlikes indica strains, gaming, pizza\n\nI'll remember what you're into!");
      return;
    }
    
    const telegramUserId = ctx.from.id.toString();
    const chatId = ctx.chat?.id?.toString() || "";
    
    try {
      const existing = await db.select().from(communityProfiles).where(eq(communityProfiles.telegramUserId, telegramUserId)).limit(1);
      
      if (existing.length > 0) {
        await db.update(communityProfiles)
          .set({ likes, chatId, username: ctx.from.username || "", firstName: ctx.from.first_name || "" })
          .where(eq(communityProfiles.telegramUserId, telegramUserId));
      } else {
        await db.insert(communityProfiles).values({
          telegramUserId,
          chatId,
          username: ctx.from.username || "",
          firstName: ctx.from.first_name || "",
          likes
        });
      }
      
      await ctx.reply(`Got it! I'll remember you're into: ${likes}`);
    } catch (error) {
      console.error("Error saving likes:", error);
      await ctx.reply("Couldn't save that right now. Try again later!");
    }
  });

  // /myprofile - View your community profile
  bot.command("myprofile", async (ctx) => {
    if (!ctx.from) return;
    
    const telegramUserId = ctx.from.id.toString();
    
    try {
      const profile = await db.select().from(communityProfiles).where(eq(communityProfiles.telegramUserId, telegramUserId)).limit(1);
      
      if (profile.length === 0) {
        await ctx.reply("You don't have a profile yet!\n\nSet one up with:\n/setbirthday MM-DD\n/setlocation [where you're from]\n/setlikes [what you like]");
        return;
      }
      
      const p = profile[0];
      const name = p.username ? `@${p.username}` : p.firstName || "Community Member";
      
      let profileText = `COMMUNITY PROFILE\n\nName: ${name}`;
      if (p.location) profileText += `\nFrom: ${p.location}`;
      if (p.likes) profileText += `\nLikes: ${p.likes}`;
      if (p.birthday) profileText += `\nBirthday: ${p.birthday}`;
      
      profileText += "\n\nUpdate anytime with /setbirthday, /setlocation, /setlikes";
      
      await ctx.reply(profileText);
    } catch (error) {
      console.error("Error fetching profile:", error);
      await ctx.reply("Couldn't load your profile right now. Try again later!");
    }
  });

  // /safety - Safety reminders
  bot.command("safety", async (ctx) => {
    const safetyText = `SAFETY REMINDERS:

- Always read pinned messages
- Team NEVER DMs first
- NEVER click links unless approved & pinned by team
- Watch for crypto addresses in usernames
- Beware of marketing DMs
- Voice verify any 'proposals'

SCAM RED FLAGS:
- "Connect wallet to claim rewards"
- "Share your seed phrase"
- "Send crypto to get more back"
- "I have your video/photos"

Stay safe, fam!`;
    await ctx.reply(safetyText);
  });

  // /roast - Roast someone
  bot.command("roast", async (ctx) => {
    const text = ctx.message?.text || "";
    const parts = text.split(" ");
    const target = parts[1] || ctx.from?.first_name || "yourself";
    
    const roast = await generateRoast(target, "Dudley Bud community chat");
    await ctx.reply(roast);
  });

  // === GIVEAWAY COMMANDS (Owner Only) ===
  
  // /giveaway - Start a new giveaway (OWNER ONLY)
  bot.command("giveaway", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can start giveaways!");
      return;
    }
    
    const prize = ctx.message?.text?.replace("/giveaway", "").trim();
    if (!prize) {
      await ctx.reply("Usage: /giveaway [prize description]\n\nExample: /giveaway 1 Whitelist Spot + Exclusive NFT");
      return;
    }
    
    // Check if there's already an active giveaway
    if (activeGiveaways.has(ctx.chat.id) && activeGiveaways.get(ctx.chat.id)?.active) {
      await ctx.reply("There's already an active giveaway! Use /endgiveaway to end it first, or /pickwinner to pick a winner.");
      return;
    }
    
    // Create new giveaway
    const giveaway: Giveaway = {
      chatId: ctx.chat.id,
      prize,
      entries: new Map(),
      createdBy: ctx.from.id,
      createdAt: Date.now(),
      active: true
    };
    
    activeGiveaways.set(ctx.chat.id, giveaway);
    
    await ctx.reply(`GIVEAWAY TIME!\n\nPrize: ${prize}\n\nTo enter, type /enter\n\nGood luck everyone!`);
  });

  // /enter - Enter the active giveaway
  bot.command("enter", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const giveaway = activeGiveaways.get(ctx.chat.id);
    if (!giveaway || !giveaway.active) {
      await ctx.reply("No active giveaway right now! Stay tuned for the next one.");
      return;
    }
    
    // Check if already entered
    if (giveaway.entries.has(ctx.from.id)) {
      await ctx.reply(`${ctx.from.first_name}, you're already in! Good luck!`);
      return;
    }
    
    // Add entry
    giveaway.entries.set(ctx.from.id, {
      username: ctx.from.username || "",
      firstName: ctx.from.first_name || "Anonymous"
    });
    
    await ctx.reply(`${ctx.from.first_name} is in! Total entries: ${giveaway.entries.size}`);
  });

  // /entries - Check how many entries (anyone can use)
  bot.command("entries", async (ctx) => {
    if (!ctx.chat) return;
    
    const giveaway = activeGiveaways.get(ctx.chat.id);
    if (!giveaway || !giveaway.active) {
      await ctx.reply("No active giveaway right now!");
      return;
    }
    
    await ctx.reply(`Current giveaway: ${giveaway.prize}\n\nTotal entries: ${giveaway.entries.size}\n\nUse /enter to join!`);
  });

  // /pickwinner - Randomly pick a winner (OWNER ONLY)
  bot.command("pickwinner", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can pick winners!");
      return;
    }
    
    const giveaway = activeGiveaways.get(ctx.chat.id);
    if (!giveaway || !giveaway.active) {
      await ctx.reply("No active giveaway to pick a winner from!");
      return;
    }
    
    if (giveaway.entries.size === 0) {
      await ctx.reply("No entries yet! Can't pick a winner from an empty pool.");
      return;
    }
    
    // Random selection
    const entriesArray = Array.from(giveaway.entries.entries());
    const randomIndex = Math.floor(Math.random() * entriesArray.length);
    const [winnerId, winnerInfo] = entriesArray[randomIndex];
    
    // End the giveaway
    giveaway.active = false;
    
    const winnerMention = winnerInfo.username 
      ? `@${winnerInfo.username}` 
      : winnerInfo.firstName;
    
    await ctx.reply(`WINNER ANNOUNCEMENT!\n\nCongratulations ${winnerMention}!\n\nYou won: ${giveaway.prize}\n\nTotal entries: ${giveaway.entries.size}\n\nThanks everyone for participating!`);
  });

  // /endgiveaway - End giveaway without picking winner (OWNER ONLY)
  bot.command("endgiveaway", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can end giveaways!");
      return;
    }
    
    const giveaway = activeGiveaways.get(ctx.chat.id);
    if (!giveaway || !giveaway.active) {
      await ctx.reply("No active giveaway to end!");
      return;
    }
    
    giveaway.active = false;
    await ctx.reply(`Giveaway ended.\n\nPrize: ${giveaway.prize}\nTotal entries: ${giveaway.entries.size}\n\nNo winner was picked.`);
  });

  // === TRIVIA COMMANDS ===

  // Helper function to get or create member score
  async function getOrCreateMemberScore(telegramUserId: string, chatId: string, username: string, firstName: string) {
    const existing = await db.select().from(memberScores)
      .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatId)))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(memberScores)
        .set({ username, firstName, lastActive: new Date() })
        .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatId)));
      return existing[0];
    } else {
      const [newScore] = await db.insert(memberScores).values({
        telegramUserId,
        chatId,
        username,
        firstName,
        triviaPoints: 0,
        triviaCorrect: 0,
        triviaAttempts: 0,
        messageCount: 0,
      }).returning();
      return newScore;
    }
  }

  // /trivia - Start a trivia question
  bot.command("trivia", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") {
      await ctx.reply("Trivia works best in group chats!");
      return;
    }

    // Check if there's already an active trivia
    const existing = activeTrivias.get(ctx.chat.id);
    if (existing && Date.now() - existing.startTime < 60000) {
      await ctx.reply("There's already an active trivia question! Answer with /answer 1-4");
      return;
    }

    // Pick a random question
    const question = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
    
    // Store active trivia
    activeTrivias.set(ctx.chat.id, {
      question,
      startTime: Date.now(),
      answered: new Set(),
    });

    const categoryEmoji = question.category === 'cannabis' ? 'Cannabis' : question.category === 'crypto' ? 'Crypto' : 'Dudley Bud';
    
    let optionsText = question.options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
    
    await ctx.reply(
      `TRIVIA TIME! [${categoryEmoji}]\n\n${question.question}\n\n${optionsText}\n\nAnswer with /answer 1, /answer 2, etc.\nWorth ${question.points} points!\n\n(60 seconds to answer)`
    );

    // Auto-expire after 60 seconds
    setTimeout(async () => {
      const trivia = activeTrivias.get(ctx.chat!.id);
      if (trivia && trivia.startTime === existing?.startTime) {
        return; // Already new question
      }
      if (trivia) {
        activeTrivias.delete(ctx.chat!.id);
        try {
          await ctx.reply(`Time's up! The correct answer was: ${question.options[question.correctIndex]}`);
        } catch (e) {}
      }
    }, 60000);
  });

  // /answer - Answer the trivia question
  bot.command("answer", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const trivia = activeTrivias.get(ctx.chat.id);
    if (!trivia) {
      await ctx.reply("No active trivia! Start one with /trivia");
      return;
    }

    // Check if user already answered
    if (trivia.answered.has(ctx.from.id)) {
      await ctx.reply("You already answered this question!");
      return;
    }

    const answerText = ctx.message?.text?.replace("/answer", "").trim();
    const answerNum = parseInt(answerText || "");
    
    if (isNaN(answerNum) || answerNum < 1 || answerNum > 4) {
      await ctx.reply("Please answer with /answer 1, /answer 2, /answer 3, or /answer 4");
      return;
    }

    trivia.answered.add(ctx.from.id);
    
    const telegramUserId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "Friend";

    // Get or create member score
    const score = await getOrCreateMemberScore(telegramUserId, chatId, username, firstName);

    const isCorrect = (answerNum - 1) === trivia.question.correctIndex;
    
    if (isCorrect) {
      // Award points
      const newPoints = (score.triviaPoints || 0) + trivia.question.points;
      const newCorrect = (score.triviaCorrect || 0) + 1;
      const newAttempts = (score.triviaAttempts || 0) + 1;
      
      await db.update(memberScores)
        .set({ triviaPoints: newPoints, triviaCorrect: newCorrect, triviaAttempts: newAttempts })
        .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatId)));

      await ctx.reply(`CORRECT! ${firstName} earned ${trivia.question.points} points!\n\nYour total: ${newPoints} points`);
      
      // End this trivia since someone got it right
      activeTrivias.delete(ctx.chat.id);
    } else {
      // Wrong answer
      const newAttempts = (score.triviaAttempts || 0) + 1;
      await db.update(memberScores)
        .set({ triviaAttempts: newAttempts })
        .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatId)));

      await ctx.reply(`Wrong! ${firstName}, try again or wait for someone else to get it.`);
    }
  });

  // /myscore - Check your trivia score
  bot.command("myscore", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const telegramUserId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();
    
    const scores = await db.select().from(memberScores)
      .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatId)))
      .limit(1);

    if (scores.length === 0) {
      await ctx.reply("You haven't played trivia yet! Start with /trivia");
      return;
    }

    const score = scores[0];
    const accuracy = score.triviaAttempts && score.triviaAttempts > 0 
      ? Math.round(((score.triviaCorrect || 0) / score.triviaAttempts) * 100) 
      : 0;

    await ctx.reply(
      `Your Trivia Stats:\n\n` +
      `Points: ${score.triviaPoints || 0}\n` +
      `Correct: ${score.triviaCorrect || 0}\n` +
      `Attempts: ${score.triviaAttempts || 0}\n` +
      `Accuracy: ${accuracy}%\n` +
      `Messages: ${score.messageCount || 0}`
    );
  });

  // /leaderboard - Show top members
  bot.command("leaderboard", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const chatId = ctx.chat.id.toString();
    
    // Get top trivia scores (ordered by points descending)
    const topTrivia = await db.select().from(memberScores)
      .where(eq(memberScores.chatId, chatId))
      .orderBy(desc(memberScores.triviaPoints))
      .limit(5);
    
    // Get top by messages (separate query, ordered by message count descending)
    const topMessages = await db.select().from(memberScores)
      .where(eq(memberScores.chatId, chatId))
      .orderBy(desc(memberScores.messageCount))
      .limit(5);

    if (topTrivia.length === 0 && topMessages.length === 0) {
      await ctx.reply("No scores yet! Be the first to play /trivia or just start chatting!");
      return;
    }

    let triviaText = "TRIVIA LEADERBOARD\n\n";
    if (topTrivia.length > 0 && topTrivia[0].triviaPoints && topTrivia[0].triviaPoints > 0) {
      topTrivia.forEach((s, i) => {
        if ((s.triviaPoints || 0) > 0) {
          const medal = i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;
          const name = s.username ? `@${s.username}` : s.firstName || "Anonymous";
          triviaText += `${medal}: ${name} - ${s.triviaPoints || 0} pts\n`;
        }
      });
    } else {
      triviaText += "No trivia scores yet! Start with /trivia\n";
    }

    let activityText = "\nMOST ACTIVE\n\n";
    if (topMessages.length > 0 && topMessages[0].messageCount && topMessages[0].messageCount > 0) {
      topMessages.forEach((s, i) => {
        if ((s.messageCount || 0) > 0) {
          const medal = i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;
          const name = s.username ? `@${s.username}` : s.firstName || "Anonymous";
          activityText += `${medal}: ${name} - ${s.messageCount || 0} msgs\n`;
        }
      });
    } else {
      activityText += "No activity tracked yet!\n";
    }

    await ctx.reply(triviaText + activityText);
  });

  // === ADMIN MODERATION COMMANDS ===

  // /ban - Ban a user (admin only)
  bot.command("ban", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can ban users!");
      return;
    }
    
    // Get user from reply
    const targetUser = ctx.message?.reply_to_message?.from;
    if (!targetUser) {
      await ctx.reply("Reply to a user's message to ban them!");
      return;
    }
    
    if (targetUser.is_bot) {
      await ctx.reply("I can't ban bots!");
      return;
    }
    
    try {
      await ctx.api.banChatMember(ctx.chat.id, targetUser.id);
      await ctx.reply(`Banned ${targetUser.first_name}. They can no longer join this group.`);
    } catch (error) {
      await ctx.reply("Couldn't ban that user. Make sure I have admin permissions!");
    }
  });

  // /kick - Kick a user (admin only)
  bot.command("kick", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can kick users!");
      return;
    }
    
    const targetUser = ctx.message?.reply_to_message?.from;
    if (!targetUser) {
      await ctx.reply("Reply to a user's message to kick them!");
      return;
    }
    
    if (targetUser.is_bot) {
      await ctx.reply("I can't kick bots!");
      return;
    }
    
    try {
      // Ban then immediately unban = kick
      await ctx.api.banChatMember(ctx.chat.id, targetUser.id);
      await ctx.api.unbanChatMember(ctx.chat.id, targetUser.id);
      await ctx.reply(`Kicked ${targetUser.first_name}. They can rejoin if they have the link.`);
    } catch (error) {
      await ctx.reply("Couldn't kick that user. Make sure I have admin permissions!");
    }
  });

  // /mute - Mute a user (admin only)
  bot.command("mute", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can mute users!");
      return;
    }
    
    const targetUser = ctx.message?.reply_to_message?.from;
    if (!targetUser) {
      await ctx.reply("Reply to a user's message to mute them!");
      return;
    }
    
    if (targetUser.is_bot) {
      await ctx.reply("I can't mute bots!");
      return;
    }
    
    // Get duration from command (default 1 hour)
    const args = ctx.message?.text?.split(" ").slice(1) || [];
    let muteMinutes = 60;
    if (args[0]) {
      const parsed = parseInt(args[0]);
      if (!isNaN(parsed) && parsed > 0) muteMinutes = parsed;
    }
    
    try {
      const muteUntil = Math.floor(Date.now() / 1000) + (muteMinutes * 60);
      await ctx.api.restrictChatMember(ctx.chat.id, targetUser.id, {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false
      }, { until_date: muteUntil });
      await ctx.reply(`Muted ${targetUser.first_name} for ${muteMinutes} minutes.`);
    } catch (error) {
      await ctx.reply("Couldn't mute that user. Make sure I have admin permissions!");
    }
  });

  // /unmute - Unmute a user (admin only)
  bot.command("unmute", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can unmute users!");
      return;
    }
    
    const targetUser = ctx.message?.reply_to_message?.from;
    if (!targetUser) {
      await ctx.reply("Reply to a user's message to unmute them!");
      return;
    }
    
    try {
      await ctx.api.restrictChatMember(ctx.chat.id, targetUser.id, {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      });
      await ctx.reply(`Unmuted ${targetUser.first_name}. They can send messages again.`);
    } catch (error) {
      await ctx.reply("Couldn't unmute that user. Make sure I have admin permissions!");
    }
  });

  // /warn - Warn a user (admin only) - adds offense
  bot.command("warn", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can warn users!");
      return;
    }
    
    const targetUser = ctx.message?.reply_to_message?.from;
    if (!targetUser) {
      await ctx.reply("Reply to a user's message to warn them!");
      return;
    }
    
    if (targetUser.is_bot) {
      await ctx.reply("I can't warn bots!");
      return;
    }
    
    const reason = ctx.message?.text?.replace("/warn", "").trim() || "Breaking community rules";
    const { muteSeconds, offenseCount, notifyAdmin } = addOffense(ctx.chat.id, targetUser.id);
    
    // Apply mute
    try {
      const muteUntil = Math.floor(Date.now() / 1000) + muteSeconds;
      await ctx.api.restrictChatMember(ctx.chat.id, targetUser.id, {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false
      }, { until_date: muteUntil });
      
      await ctx.reply(`WARNING #${offenseCount} for ${targetUser.first_name}\n\nReason: ${reason}\n\nMuted for: ${formatDuration(muteSeconds)}`);
      
      // Notify admins after 2nd offense
      if (notifyAdmin) {
        await ctx.reply(`ATTENTION ADMINS: ${targetUser.first_name} has ${offenseCount} offenses. Consider taking further action.`);
      }
    } catch (error) {
      await ctx.reply(`Warning #${offenseCount} for ${targetUser.first_name}.\n\nReason: ${reason}\n\n(Note: Couldn't apply mute - check bot permissions)`);
    }
  });

  // /poll - Create a poll (admin only)
  bot.command("poll", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can create polls!");
      return;
    }
    
    const pollText = ctx.message?.text?.replace("/poll", "").trim();
    if (!pollText) {
      await ctx.reply("Usage: /poll Question? | Option 1 | Option 2 | Option 3\n\nExample: /poll What's the best strain? | Sativa | Indica | Hybrid");
      return;
    }
    
    const parts = pollText.split("|").map(p => p.trim()).filter(p => p);
    if (parts.length < 3) {
      await ctx.reply("Need at least 2 options!\n\nUsage: /poll Question? | Option 1 | Option 2");
      return;
    }
    
    const question = parts[0];
    const options = parts.slice(1);
    
    if (options.length > 10) {
      await ctx.reply("Maximum 10 options allowed!");
      return;
    }
    
    try {
      await ctx.api.sendPoll(ctx.chat.id, question, options, { is_anonymous: false });
    } catch (error) {
      await ctx.reply("Couldn't create poll. Make sure options are valid!");
    }
  });

  // /leaderboard - Show top active members
  bot.command("leaderboard", async (ctx) => {
    if (!ctx.chat) return;
    
    const topUsers = getTopUsers(ctx.chat.id, 10);
    
    if (topUsers.length === 0) {
      await ctx.reply("No activity recorded yet! Keep chatting to climb the leaderboard.");
      return;
    }
    
    const medals = ["1st", "2nd", "3rd"];
    let leaderboardText = "TOP COMMUNITY MEMBERS\n\n";
    
    topUsers.forEach((user, index) => {
      const rank = medals[index] || `${index + 1}th`;
      const name = user.username ? `@${user.username}` : user.firstName;
      leaderboardText += `${rank} - ${name} (${user.messageCount} messages)\n`;
    });
    
    leaderboardText += "\nKeep participating to climb up!";
    
    await ctx.reply(leaderboardText);
  });

  // /ask - Ask AI anything (with live crypto/NFT/cannabis data)
  bot.command("ask", async (ctx) => {
    const question = ctx.message?.text?.replace("/ask", "").trim();
    if (!question) {
      await ctx.reply("What would you like to know? Use: /ask [your question]\n\nExamples:\n- /ask what's bitcoin worth?\n- /ask cannabis brownie recipe\n- /ask does CBD help with anxiety?");
      return;
    }
    
    await ctx.reply("Thinking...");
    
    // Check query types
    const { isCrypto, tokens } = detectCryptoQuery(question);
    const { isRecipe, isMedical } = detectCannabisQuery(question);
    let liveData = "";
    let disclaimer = "";
    
    // Handle cannabis recipe queries
    if (isRecipe) {
      const recipe = getCannabisRecipe(question);
      liveData += `\n\nRECIPE:\n${recipe}`;
    }
    
    // Handle medical cannabis queries - add disclaimer
    if (isMedical) {
      disclaimer = MEDICAL_DISCLAIMER;
    }
    
    // Handle crypto queries
    if (isCrypto) {
      // Fetch live data for detected tokens
      const tokenDataPromises = tokens.slice(0, 3).map(async (t) => {
        const data = await searchToken(t);
        if (data) {
          const arrow = data.change24h >= 0 ? "+" : "";
          const priceStr = data.price >= 1 ? `$${data.price.toFixed(2)}` : `$${data.price.toFixed(6)}`;
          return `${data.name}: ${priceStr} (${arrow}${data.change24h.toFixed(1)}%)`;
        }
        return null;
      });
      
      const tokenResults = (await Promise.all(tokenDataPromises)).filter(Boolean);
      if (tokenResults.length > 0) {
        liveData += `\n\nLIVE PRICES:\n${tokenResults.join("\n")}`;
      }
      
      // Check for NFT mentions
      const nftKeywords = ["nft", "bored ape", "bayc", "azuki", "pudgy", "doodles", "cryptopunks", "mutant ape", "mayc"];
      const hasNFT = nftKeywords.some(k => question.toLowerCase().includes(k));
      if (hasNFT) {
        const nftData = await fetchNFTData(question);
        if (nftData) {
          liveData += `\n\n${nftData}`;
        }
      }
      
      // Get trending if asking about trending/hot coins
      if (question.toLowerCase().includes("trending") || question.toLowerCase().includes("hot")) {
        const trending = await fetchTrendingCoins();
        if (trending) {
          liveData += `\n\n${trending}`;
        }
      }
    }
    
    // Get AI response with context
    let context = "User asking a question about Dudley Bud";
    if (isCrypto) context = "User asking about crypto/NFT. Provide helpful market commentary.";
    if (isRecipe) context = "User asking about cannabis recipes/edibles. Be helpful and emphasize safe dosing.";
    if (isMedical) context = "User asking about medical cannabis. Provide general educational info but emphasize consulting professionals.";
    
    const aiResponse = await getAIResponse(question, context);
    const fullResponse = aiResponse + liveData + disclaimer;
    
    await ctx.reply(fullResponse);
  });

  // === NEW MEMBER HANDLER ===
  bot.on("message:new_chat_members", async (ctx) => {
    for (const member of ctx.message.new_chat_members) {
      const name = member.first_name || "friend";
      const username = member.username || "";

      const { isScam, flags } = detectScam("", username);

      if (isScam) {
        await ctx.reply(`Warning: New member @${username} has suspicious indicators:\n${flags.join("\n")}\n\nAdmins, please verify!`);
      }

      const welcome = `Welcome to Dudley Bud, ${name}!

Great to have you here! Before we get started:

- Please read the pinned messages
- Our team NEVER DMs first
- NEVER click links unless approved by admins

Got questions? Just ask! We're here to help!`;

      await ctx.reply(welcome);
    }
  });

  // === SCAM DETECTION & AI RESPONSE MIDDLEWARE ===
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    const username = ctx.from?.username;
    const userId = ctx.from?.id.toString() || "unknown";
    const chatId = ctx.chat?.id;

    // Update activity time and reset auto-engage timer
    ctx.session.lastActivityTime = Date.now();
    if (chatId && chatId < 0) { // Only for group chats (negative IDs)
      resetAutoEngageTimer(chatId);
      
      // Track this chat for scheduled posts (recipes, etc.)
      activeChats.add(chatId);
      
      // Track admin activity - update when any user messages
      if (ctx.from?.id) {
        updateAdminActivity(chatId, ctx.from.id, ctx.from.username || "", ctx.from.first_name || "");
      }
      
      // Start admin checker if not already running
      if (!adminCheckTimers.has(chatId)) {
        startAdminActivityChecker(chatId);
      }
      
      // Update leaderboard for all users
      if (ctx.from?.id) {
        updateLeaderboard(chatId, ctx.from.id, ctx.from.username || "", ctx.from.first_name || "Anonymous");
      }
      
      // SPAM DETECTION - Auto-mute spammers with escalating punishment
      if (ctx.from?.id && !ctx.from.is_bot) {
        // Check if user is admin (admins are exempt from spam detection)
        const userIsAdmin = await isAdmin(ctx);
        
        if (!userIsAdmin && isSpam(chatId, ctx.from.id, text)) {
          const { muteSeconds, offenseCount, notifyAdmin } = addOffense(chatId, ctx.from.id);
          
          try {
            // Delete the spam message
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            
            // Mute the user
            const muteUntil = Math.floor(Date.now() / 1000) + muteSeconds;
            await ctx.api.restrictChatMember(chatId, ctx.from.id, {
              can_send_messages: false,
              can_send_audios: false,
              can_send_documents: false,
              can_send_photos: false,
              can_send_videos: false,
              can_send_video_notes: false,
              can_send_voice_notes: false,
              can_send_polls: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false
            }, { until_date: muteUntil });
            
            const firstName = ctx.from.first_name || "User";
            await ctx.reply(`SPAM DETECTED!\n\n${firstName} has been muted for ${formatDuration(muteSeconds)}.\n\nThis is offense #${offenseCount}.`);
            
            // Notify admins after 2nd offense
            if (notifyAdmin) {
              await ctx.reply(`ATTENTION ADMINS: ${firstName} has ${offenseCount} spam offenses. This user may need a permanent ban.`);
            }
          } catch (error) {
            console.log("Couldn't auto-moderate spam - check bot permissions");
          }
          
          // Stop processing this spam message
          return;
        }
      }
    }

    // Scam detection
    const { isScam, flags } = detectScam(text, username);

    if (isScam) {
      const warningMessage = ctx.session.karenMode
        ? karenResponse(`SUSPICIOUS MESSAGE DETECTED!\n\nFlags:\n${flags.join("\n")}\n\nAdmins, please review!`)
        : `Suspicious message detected!\n\nFlags:\n${flags.join("\n")}\n\nAdmins, please review!`;

      await ctx.reply(warningMessage, { reply_parameters: { message_id: ctx.message.message_id } });
    }

    // Update user memory
    let userMem = ctx.session.userMemory.get(userId);
    if (!userMem) {
      userMem = { messageCount: 0, positiveScore: 0, negativeScore: 0, lastMessages: [], isRoastTarget: false };
      ctx.session.userMemory.set(userId, userMem);
    }
    userMem.messageCount++;
    userMem.lastMessages = [...userMem.lastMessages.slice(-4), text];

    // Skip if it's a command
    if (text.startsWith("/")) {
      await next();
      return;
    }

    const lowerText = text.toLowerCase();
    const firstName = ctx.from?.first_name || "friend";
    
    // Instant dad joke when someone types "joke"
    if (lowerText === "joke" || lowerText === "jokes" || lowerText.includes("tell me a joke") || lowerText.includes("got a joke")) {
      const joke = await generateDadJoke();
      const response = ctx.session.karenMode ? karenResponse(joke) : joke;
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
      return;
    }
    
    // Determine if bot should respond
    let shouldRespond = false;
    let responseContext = "";
    let useKarenAttitude = false;
    
    // KAREN MODE: Always respond with attitude when "karen" is mentioned
    if (lowerText.includes("karen")) {
      shouldRespond = true;
      useKarenAttitude = true;
      responseContext = "Someone mentioned Karen - respond with full Karen attitude!";
    }
    // Always respond when mentioned directly
    else if (lowerText.includes("@agentkarenbot")) {
      shouldRespond = true;
      responseContext = "User mentioned the bot directly";
    }
    // Always respond to questions about Dudley Bud
    else if (lowerText.includes("dudley") || lowerText.includes("bud") || lowerText.includes("nft")) {
      shouldRespond = true;
      responseContext = "User asking about Dudley Bud project";
    }
    // Respond to direct questions
    else if (text.includes("?")) {
      shouldRespond = true;
      responseContext = "User asked a question in the group";
    }
    // Respond to greetings
    else if (/^(hi|hello|hey|yo|sup|gm|good morning|good evening|what's up|whats up)/i.test(lowerText)) {
      shouldRespond = true;
      responseContext = "User greeted the chat";
    }
    // Respond to replies to the bot's messages
    else if (ctx.message.reply_to_message?.from?.is_bot) {
      shouldRespond = true;
      responseContext = "User replied to bot's message";
    }
    // Engage with longer messages (community participation)
    else if (text.length > 50 && Math.random() < 0.3) {
      shouldRespond = true;
      responseContext = "Engaging with community discussion";
    }
    // Random engagement to keep chat lively (10% chance)
    else if (Math.random() < 0.1) {
      shouldRespond = true;
      responseContext = "Random community engagement";
    }
    
    if (shouldRespond) {
      let response: string;
      
      if (useKarenAttitude) {
        // Full Karen attitude response
        response = await getAIResponse(text, `You are Karen - the ultimate Karen. Respond with FULL Karen attitude: entitled, demanding to speak to the manager, complaining, dramatic, saying things like "Excuse me?!", "I want to speak to your manager!", "This is unacceptable!", "Do you know who I am?". Be funny but fully commit to the Karen persona. User: ${firstName}`);
      } else {
        response = await getAIResponse(text, `${responseContext}. User: ${firstName}. Keep response brief and friendly.`);
      }
      
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
    }

    await next();
  });

  return bot;
}

// === SCHEDULED RECIPE POSTING ===
function postDailyRecipe() {
  if (!botInstance) return;
  
  const recipe = getRandomRecipe();
  const message = formatRecipePost(recipe);
  
  // Post to all active chats
  for (const chatId of Array.from(activeChats)) {
    botInstance.api.sendMessage(chatId, message).catch((err) => {
      console.error(`Failed to send recipe to chat ${chatId}:`, err);
      // Remove chat if we can't send to it
      if (err.description?.includes("chat not found") || err.description?.includes("bot was blocked")) {
        activeChats.delete(chatId);
      }
    });
  }
  
  console.log(`Posted daily recipe to ${activeChats.size} chats: ${recipe.name}`);
}

// Track if we've posted today to prevent duplicates
let lastRecipePostDate = "";

// Schedule recipe at 4 PM Pacific (handles PST/PDT automatically)
function startRecipeScheduler() {
  const checkAndPost = () => {
    // Get current Pacific time using Intl (handles DST automatically)
    const pacificFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    });
    
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    
    const now = new Date();
    const timeStr = pacificFormatter.format(now); // "16:00" format
    const dateStr = dateFormatter.format(now);
    const [hour, minute] = timeStr.split(":").map(Number);
    
    // Check if it's 4 PM Pacific (16:00) and we haven't posted today
    if (hour === 16 && minute === 0 && lastRecipePostDate !== dateStr) {
      lastRecipePostDate = dateStr;
      postDailyRecipe();
    }
  };
  
  // Check every minute
  setInterval(checkAndPost, 60 * 1000);
  console.log("Recipe scheduler started - will post daily at 4 PM Pacific");
}

// === BIRTHDAY CELEBRATION ===
let lastBirthdayCheckDate = "";

async function generateBirthdayCakeImage(username: string): Promise<string | null> {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A delicious colorful birthday cake with lit candles, decorated with "Happy Birthday ${username}!" written in icing. Cannabis-themed decorations like small leaf shapes made of green frosting. Cheerful party atmosphere with confetti. Photorealistic, appetizing, celebratory.`,
      n: 1,
      size: "1024x1024"
    });
    return response.data[0]?.url || null;
  } catch (error) {
    console.error("Error generating birthday cake image:", error);
    return null;
  }
}

async function checkBirthdays() {
  if (!botInstance) return;
  
  // Get today's date in MM-DD format (Pacific time)
  const pacificFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit"
  });
  
  const now = new Date();
  const parts = pacificFormatter.formatToParts(now);
  const month = parts.find(p => p.type === "month")?.value || "";
  const day = parts.find(p => p.type === "day")?.value || "";
  const todayMMDD = `${month}-${day}`;
  
  const currentYear = new Date().getFullYear();
  
  try {
    // Find all profiles with today's birthday who haven't been celebrated this year
    const birthdayProfiles = await db.select()
      .from(communityProfiles)
      .where(eq(communityProfiles.birthday, todayMMDD));
    
    for (const profile of birthdayProfiles) {
      // Skip if already celebrated this year
      if (profile.lastBirthdayYear === currentYear) continue;
      
      // Skip if no chat ID stored
      if (!profile.chatId) continue;
      
      const chatId = parseInt(profile.chatId);
      if (isNaN(chatId)) continue;
      
      const userName = profile.username ? `@${profile.username}` : profile.firstName || "our friend";
      const displayName = profile.firstName || profile.username || "friend";
      
      // Generate birthday cake image
      const cakeImageUrl = await generateBirthdayCakeImage(displayName);
      
      // Create personalized birthday message
      let birthdayMessage = `HAPPY BIRTHDAY ${userName}!\n\n`;
      birthdayMessage += `The whole Dudley Bud crew is celebrating you today!`;
      
      if (profile.location) {
        birthdayMessage += `\n\nSending birthday vibes all the way to ${profile.location}!`;
      }
      
      if (profile.likes) {
        birthdayMessage += `\n\nWe know you love ${profile.likes} - hope your day is filled with all your favorites!`;
      }
      
      birthdayMessage += `\n\nHave an amazing day! LFG!`;
      
      try {
        // Send cake image if available
        if (cakeImageUrl) {
          await botInstance.api.sendPhoto(chatId, cakeImageUrl, { caption: birthdayMessage });
        } else {
          // Fallback to text only
          await botInstance.api.sendMessage(chatId, birthdayMessage);
        }
        
        // Mark as celebrated this year
        await db.update(communityProfiles)
          .set({ lastBirthdayYear: currentYear })
          .where(eq(communityProfiles.telegramUserId, profile.telegramUserId));
        
        console.log(`Celebrated birthday for ${displayName} in chat ${chatId}`);
      } catch (err: any) {
        console.error(`Failed to send birthday to chat ${chatId}:`, err);
        if (err.description?.includes("chat not found") || err.description?.includes("bot was blocked")) {
          activeChats.delete(chatId);
        }
      }
    }
  } catch (error) {
    console.error("Error checking birthdays:", error);
  }
}

// Schedule birthday check at 9 AM Pacific
function startBirthdayScheduler() {
  const checkAndCelebrate = () => {
    const pacificFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "numeric",
      hour12: false
    });
    
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    
    const now = new Date();
    const timeStr = pacificFormatter.format(now);
    const dateStr = dateFormatter.format(now);
    const [hour, minute] = timeStr.split(":").map(Number);
    
    // Check at 9 AM Pacific (09:00)
    if (hour === 9 && minute === 0 && lastBirthdayCheckDate !== dateStr) {
      lastBirthdayCheckDate = dateStr;
      checkBirthdays();
    }
  };
  
  // Check every minute
  setInterval(checkAndCelebrate, 60 * 1000);
  console.log("Birthday scheduler started - will check daily at 9 AM Pacific");
}

// === START BOT ===
export async function startBot() {
  if (!BOT_TOKEN) {
    console.log("========================================");
    console.log("AgentKarenBot - Setup Required");
    console.log("========================================");
    console.log("");
    console.log("TELEGRAM_BOT_TOKEN is not set!");
    console.log("");
    console.log("To get your bot token:");
    console.log("1. Open Telegram and search for @BotFather");
    console.log("2. Send /newbot and follow the prompts");
    console.log("3. Copy the token and add it as a secret in Replit");
    console.log("4. Restart this workflow after adding the token");
    console.log("");
    console.log("========================================");
    process.exit(1);
  }

  const bot = createBot();

  console.log("AgentKarenBot starting...");

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  // Start the recipe scheduler
  startRecipeScheduler();
  
  // Start the birthday scheduler
  startBirthdayScheduler();

  await bot.start({
    onStart: () => {
      console.log("AgentKarenBot is running with AI capabilities!");
      console.log("Features: Smart Q&A, Market Reports, Roasts, Auto-engage, Daily Recipes, Birthday Celebrations");
    },
  });
}
