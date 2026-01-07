import { Bot, Context, session } from "grammy";
import OpenAI from "openai";

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
          content: `You are AgentKarenBot, the community manager for Dudley Bud - a Web3 cannabis character universe on the Base blockchain.

PERSONALITY:
- Friendly, chill, and approachable - like a cool friend who knows about crypto and cannabis culture
- Witty and occasionally sassy, but never mean
- Enthusiastic about the community and project
- Protective of members - quick to warn about scams
- Uses casual language, can use slang like "fam", "vibes", "LFG"

COMMUNICATION STYLE:
- Keep responses SHORT (1-3 sentences max for casual chat)
- Be conversational, not robotic
- Match the energy of the message (chill response to chill message, excited to excited)
- Use humor when appropriate
- Don't over-explain unless asked

COMMUNITY MANAGER DUTIES:
- Welcome and engage with members
- Answer questions about Dudley Bud
- Keep the chat lively and positive
- Redirect investment questions (NFTs are for fun, not profit)
- Support the community vibe

Key project info:
${PROJECT_INFO}

Characters: Dudley-Bud (the Boss/Weed King), WeedWacker-Ryan (Dudley's bestie, crushes on Karen), Agent Karen (hunts Roach), Roach (shit-talking cockroach), Basil (pot-smoking plant), Crunch Wrap (hungry chill friend), Gunja-Mai (grandma), Blinky (advisor), Nova (wild pony), Pinko (Karen's boss, pink-haired billy goat).

IMPORTANT: Only mention NFT disclaimers when someone asks about investing or profits. For casual chat, just be friendly!`
        },
        { role: "user", content: `Context: ${context}\n\nMessage: ${prompt}` }
      ],
      max_tokens: 150,
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
          content: `You are a witty roast comedian for the Dudley Bud community. Generate a playful, funny roast that's edgy but not mean-spirited or offensive. Keep it related to crypto/Web3/cannabis culture when possible. Max 2 sentences.`
        },
        { role: "user", content: `Roast ${targetName}. Context: ${context}` }
      ],
      max_tokens: 100,
    });
    return response.choices[0]?.message?.content || getRandomItem(ROASTS);
  } catch (error) {
    return getRandomItem(ROASTS);
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
const ADMIN_INACTIVE_HOURS = 24;

// === ACTIVE CHATS TRACKING (for scheduled posts) ===
const activeChats: Set<number> = new Set();

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

// Check and call out inactive admins
async function checkInactiveAdmins(chatId: number) {
  if (!botInstance) return;
  
  try {
    // Get current admins from Telegram
    const admins = await botInstance.api.getChatAdministrators(chatId);
    const now = Date.now();
    const inactiveThreshold = ADMIN_INACTIVE_HOURS * 60 * 60 * 1000;
    
    const chatAdmins = adminActivity.get(chatId) || new Map();
    const inactiveAdmins: string[] = [];
    
    for (const admin of admins) {
      // Skip bots
      if (admin.user.is_bot) continue;
      
      const userId = admin.user.id;
      const activity = chatAdmins.get(userId);
      
      // If no activity recorded or inactive for 24+ hours
      if (!activity || (now - activity.lastActive) > inactiveThreshold) {
        const mention = admin.user.username 
          ? `@${admin.user.username}` 
          : admin.user.first_name;
        inactiveAdmins.push(mention);
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
  
  // Check every 24 hours
  const timer = setInterval(() => {
    checkInactiveAdmins(chatId);
  }, 24 * 60 * 60 * 1000);
  
  adminCheckTimers.set(chatId, timer);
  
  // Also do an initial check after 1 minute (to let activity tracking populate)
  setTimeout(() => {
    checkInactiveAdmins(chatId);
  }, 60 * 1000);
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
    { command: "entries", description: "Check giveaway entries" }
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

  // /market - Crypto market report (top 10 or specific token)
  bot.command("market", async (ctx) => {
    const query = ctx.message?.text?.replace("/market", "").trim();
    
    if (query) {
      // Search for specific token
      await ctx.reply(`Searching for ${query}...`);
      const token = await searchToken(query);
      
      if (token) {
        const arrow = token.change24h >= 0 ? "+" : "";
        const priceStr = token.price >= 1 
          ? `$${token.price.toFixed(2)}` 
          : `$${token.price.toFixed(8)}`;
        const report = `${token.name} (${token.symbol})\n\nPrice: ${priceStr}\n24h Change: ${arrow}${token.change24h.toFixed(2)}%`;
        await ctx.reply(report);
      } else {
        await ctx.reply(`Couldn't find "${query}". Try the full name or symbol (e.g., bitcoin, eth, solana)`);
      }
    } else {
      // Default: Top 10 market report
      await ctx.reply("Fetching top 10 crypto prices...");
      const { topCoins, memeCoins, trending } = await fetchCryptoMarket();
      const report = formatMarketReport(topCoins, memeCoins, trending);
      await ctx.reply(report);
    }
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
    
    // Determine if bot should respond
    let shouldRespond = false;
    let responseContext = "";
    
    // Always respond when mentioned directly
    if (lowerText.includes("@agentkarenbot") || lowerText.includes("karen")) {
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
      const response = await getAIResponse(text, `${responseContext}. User: ${firstName}. Keep response brief and friendly.`);
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

  await bot.start({
    onStart: () => {
      console.log("AgentKarenBot is running with AI capabilities!");
      console.log("Features: Smart Q&A, Market Reports, Roasts, Auto-engage, Daily Recipes");
    },
  });
}
