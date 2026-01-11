import { Bot, Context, session, InputFile } from "grammy";
import OpenAI from "openai";
import { db } from "./db";
import { communityProfiles, memberScores, userMemory, referralCodes, referrals, moderationStats, userModerationStatus, chatModerationSettings, qaCache, referrerStatus, pendingVerifications, trustScores, banEvents, rareStrainLimits, rareStrainRecipients } from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { generateImageBuffer } from "./replit_integrations/image/client";
import * as StoryBible from "./storyBible";

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

// === ADVANCED MODERATION SYSTEM ===

// Domain blocklist for known scam/phishing sites
const BLOCKED_DOMAINS = [
  "bit.ly", "tinyurl.com", // URL shorteners often used for scams (careful with allowlist)
  "walletconnect.to", "metamask-airdrop", "opensea-claim",
  "eth-claim", "bnb-airdrop", "trust-wallet-claim",
  "phantom-airdrop", "solana-drop", "mint-nft-free",
  "uniswap-airdrop", "pancakeswap-reward", "coinbase-giveaway",
  "binance-bonus", "crypto-reward", "nft-mint-free",
  "telegram-premium", "tg-premium-free", "free-usdt",
  "double-btc", "send-eth-receive", "guaranteed-profit",
];

// Short link domains - URL shorteners used to hide scam links
const SHORT_LINK_DOMAINS = [
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "adf.ly", "bit.do", "mcaf.ee", "su.pr", "twit.ac", "cutt.ly", "rb.gy",
  "shorturl.at", "tiny.cc", "url.ie", "v.gd", "x.co", "1url.com", "hyperurl.co"
];

// Wallet drainer phrases - scam attempts to steal crypto
const WALLET_DRAINER_PHRASES = [
  "verify your wallet", "sync your wallet", "connect to claim", "rectify your wallet",
  "validate your wallet", "restore your wallet", "update your wallet", "secure your wallet",
  "wallet verification required", "confirm your wallet", "authenticate your wallet",
  "wallet sync required", "dapp connection", "web3 validation"
];

// Seed phrase detection - catches attempts to share/steal recovery phrases
const SEED_PHRASE_WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  "action", "actor", "actress", "actual", "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "afford", "afraid", "again", "age", "agent", "agree",
  "ahead", "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert", "alien"
];

// Detect seed phrase patterns (12 or 24 words from BIP39 list)
function detectSeedPhrase(text: string): boolean {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 12) return false;
  let matchCount = 0;
  for (const word of words) {
    if (SEED_PHRASE_WORDS.includes(word.replace(/[^a-z]/g, ''))) {
      matchCount++;
    }
  }
  return matchCount >= 10;
}

// === HATE SPEECH & CONTENT MODERATION ===
// Normalize text to catch bypass attempts (spaces, l33t speak, symbols)
function normalizeTextForModeration(text: string): string {
  let normalized = text.toLowerCase();
  const leetMap: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a',
    '$': 's', '!': 'i', '|': 'i', '+': 't', '(': 'c', ')': 'o', '<': 'c', '>': 'o'
  };
  for (const [leet, letter] of Object.entries(leetMap)) {
    normalized = normalized.split(leet).join(letter);
  }
  normalized = normalized.replace(/[\s\-_.*#~`'"]/g, '');
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');
  return normalized;
}

// Obscured hate speech patterns using base64-encoded terms (not readable in source)
// Pattern format: base64 encoded slur variants
const HATE_SPEECH_PATTERNS_B64 = [
  "bmlnZ2E=", "bmlnZ2Vy", "bmlnZ2Vycw==", "bmlnbm9n",
  "ZmFnZ290", "ZmFn", "ZmFnZ290cw==", "ZmFncw==",
  "a2lrZQ==", "a2lrZXM=",
  "c3BpYw==", "c3BpY3M=", "d2V0YmFjaw==",
  "Y2hpbms=", "Y2hpbmtz", "Z29vaw==",
  "cmV0YXJk", "cmV0YXJkcw==",
  "dHJhbm55", "dHJhbm5pZXM=",
  "ZHlrZQ==", "ZHlrZXM="
];

// Decode patterns at runtime (not visible in source code)
function getHateSpeechPatterns(): string[] {
  return HATE_SPEECH_PATTERNS_B64.map(b64 => {
    try {
      return Buffer.from(b64, 'base64').toString('utf-8');
    } catch {
      return '';
    }
  }).filter(p => p.length > 0);
}

// Detect hate speech in normalized text
function detectHateSpeech(text: string): { detected: boolean; severity: 'low' | 'medium' | 'high' } {
  const normalized = normalizeTextForModeration(text);
  const patterns = getHateSpeechPatterns();
  
  for (const pattern of patterns) {
    if (normalized.includes(pattern)) {
      return { detected: true, severity: 'high' };
    }
  }
  return { detected: false, severity: 'low' };
}

// Drug trafficking detection - blocks buying/selling hard drugs
const HARD_DRUG_TERMS = ["meth", "heroin", "fentanyl", "fent", "cocaine", "coke", "crack", "oxy", "oxycontin", "xanax", "bars", "percs", "percocet"];
const TRAFFICKING_TERMS = ["selling", "buying", "wtb", "wts", "for sale", "hmu for", "dm for", "got that", "plug for", "looking for plug", "need a plug"];

function detectDrugTrafficking(text: string): boolean {
  const lowerText = text.toLowerCase();
  const hasHardDrug = HARD_DRUG_TERMS.some(drug => lowerText.includes(drug));
  const hasTrafficking = TRAFFICKING_TERMS.some(term => lowerText.includes(term));
  return hasHardDrug && hasTrafficking;
}

// Emoji spam detection - too many emojis relative to text
function detectEmojiSpam(text: string): boolean {
  const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]+/g;
  const emojis = text.match(emojiRegex) || [];
  const emojiCount = emojis.join('').length / 2;
  const textWithoutEmoji = text.replace(emojiRegex, '').trim();
  if (emojiCount > 15 && textWithoutEmoji.length < 20) return true;
  if (emojiCount > 10 && textWithoutEmoji.length < 5) return true;
  return false;
}

// Track hate speech warnings per user
const hateSpeechWarnings = new Map<string, { count: number; lastWarning: number }>();
const HATE_SPEECH_WARNING_RESET = 24 * 60 * 60 * 1000; // 24 hours

// Track unique user interactions (user:chat -> Set<replied_to_user_id>)
const uniqueInteractionsCache = new Map<string, { users: Set<string>; date: string }>();

// === TRUST SYSTEM CONFIGURATION ===
const TRUST_ELIGIBILITY_DAYS = 45; // Days before user can earn trust
const TRUST_DAILY_CAP = 10; // Max trust points per day
const TRUST_WEEKLY_CAP = 50; // Max trust points per week
const TRUST_MEANINGFUL_MSG_LENGTH = 10; // Min chars for "meaningful" message
const TRUST_BURST_THRESHOLD = 20; // Max msgs in 10 min before burst detection

// Trust point values
const TRUST_POINTS = {
  message: 0.5, // Per meaningful message
  reply: 1, // Replying to others
  uniqueInteraction: 2, // First interaction with a new user
  gameParticipation: 1, // Playing trivia/puzzle
  referralSuccess: 3, // Successful referral
};

// Get or create trust record for a user
async function ensureTrustRecord(userId: string, chatId: string, username?: string, firstName?: string): Promise<typeof trustScores.$inferSelect | null> {
  try {
    const existing = await db.select().from(trustScores)
      .where(and(eq(trustScores.telegramUserId, userId), eq(trustScores.chatId, chatId)))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Create new trust record
    const joinDate = new Date();
    const eligibilityDate = new Date(joinDate.getTime() + TRUST_ELIGIBILITY_DAYS * 24 * 60 * 60 * 1000);
    
    await db.insert(trustScores).values({
      telegramUserId: userId,
      chatId,
      username,
      firstName,
      joinDate,
      eligibilityDate,
      isEligible: false,
      trustScore: 0,
      trustStatus: "none",
    });
    
    return (await db.select().from(trustScores)
      .where(and(eq(trustScores.telegramUserId, userId), eq(trustScores.chatId, chatId)))
      .limit(1))[0];
  } catch (error) {
    console.error("Error ensuring trust record:", error);
    return null;
  }
}

// Check if user is eligible for trust (45+ days)
function isEligibleForTrust(trustRecord: typeof trustScores.$inferSelect): boolean {
  if (trustRecord.trustStatus === "vouched") return true;
  if (!trustRecord.eligibilityDate) return false;
  return new Date() >= new Date(trustRecord.eligibilityDate);
}

// Update trust score with anti-gaming checks
async function updateTrustActivity(
  userId: string, 
  chatId: string, 
  activityType: 'message' | 'reply' | 'uniqueInteraction' | 'gameParticipation' | 'referralSuccess',
  messageLength?: number,
  repliedToUserId?: string
): Promise<void> {
  try {
    const record = await ensureTrustRecord(userId, chatId);
    if (!record) return;
    
    // Frozen users don't gain trust
    if (record.isFrozen) return;
    
    // Check eligibility
    const eligible = isEligibleForTrust(record);
    const today = getTodayDateString();
    const weekStart = getWeekStartDate();
    
    // Reset daily/weekly counters if needed
    let dailyMsgCount = record.dailyMsgCount || 0;
    let weeklyMsgCount = record.weeklyMsgCount || 0;
    let trustGainedToday = record.trustGainedToday || 0;
    let trustGainedThisWeek = record.trustGainedThisWeek || 0;
    
    if (record.dailyMsgDate !== today) {
      dailyMsgCount = 0;
      trustGainedToday = 0;
    }
    if (record.weeklyResetDate !== weekStart) {
      weeklyMsgCount = 0;
      trustGainedThisWeek = 0;
    }
    
    // Anti-gaming: check caps
    if (trustGainedToday >= TRUST_DAILY_CAP || trustGainedThisWeek >= TRUST_WEEKLY_CAP) {
      // Just update activity counts, no trust gain
      await db.update(trustScores)
        .set({
          dailyMsgCount: dailyMsgCount + 1,
          dailyMsgDate: today,
          weeklyMsgCount: weeklyMsgCount + 1,
          weeklyResetDate: weekStart,
        })
        .where(and(eq(trustScores.telegramUserId, userId), eq(trustScores.chatId, chatId)));
      return;
    }
    
    // Calculate trust points based on activity
    let pointsToAdd = 0;
    let meaningfulCount = record.meaningfulMsgCount || 0;
    let uniqueReplied = record.uniqueRepliedTo || 0;
    
    switch (activityType) {
      case 'message':
        if (messageLength && messageLength >= TRUST_MEANINGFUL_MSG_LENGTH) {
          pointsToAdd = TRUST_POINTS.message;
          meaningfulCount++;
        }
        break;
      case 'reply':
        pointsToAdd = TRUST_POINTS.reply;
        break;
      case 'uniqueInteraction':
        pointsToAdd = TRUST_POINTS.uniqueInteraction;
        uniqueReplied++;
        break;
      case 'gameParticipation':
        pointsToAdd = TRUST_POINTS.gameParticipation;
        break;
      case 'referralSuccess':
        pointsToAdd = TRUST_POINTS.referralSuccess;
        break;
    }
    
    // Only add points if eligible
    if (!eligible) {
      pointsToAdd = 0;
    }
    
    // Cap points
    pointsToAdd = Math.min(pointsToAdd, TRUST_DAILY_CAP - trustGainedToday, TRUST_WEEKLY_CAP - trustGainedThisWeek);
    
    const newScore = Math.min(100, (record.trustScore || 0) + pointsToAdd);
    const newLevel = Math.floor(newScore / 25); // 0-3 levels at 0, 25, 50, 75
    const isTrusted = newScore >= 25;
    const newStatus = record.trustStatus === "vouched" ? "vouched" : (isTrusted ? "earned" : "none");
    
    await db.update(trustScores)
      .set({
        trustScore: newScore,
        trustLevel: newLevel,
        isTrusted,
        trustStatus: newStatus,
        isEligible: eligible,
        dailyMsgCount: dailyMsgCount + 1,
        dailyMsgDate: today,
        weeklyMsgCount: weeklyMsgCount + 1,
        weeklyResetDate: weekStart,
        meaningfulMsgCount: meaningfulCount,
        uniqueRepliedTo: uniqueReplied,
        trustGainedToday: trustGainedToday + pointsToAdd,
        trustGainedThisWeek: trustGainedThisWeek + pointsToAdd,
        lastTrustUpdate: new Date(),
      })
      .where(and(eq(trustScores.telegramUserId, userId), eq(trustScores.chatId, chatId)));
  } catch (error) {
    console.error("Error updating trust activity:", error);
  }
}

// Get week start date string (Sunday)
function getWeekStartDate(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek;
  const sunday = new Date(now.setDate(diff));
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
}

// Generate trust progress bar
function generateTrustProgressBar(score: number): string {
  const filled = Math.floor(score / 10);
  const empty = 10 - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}

// Trust explainer for Karen
function getTrustExplainer(): string {
  return `TRUST POINTS - How It Works

Our Trust System recognizes genuine community members while preventing abuse.

HOW TO EARN TRUST:
1. Be active for 45+ days (eligibility gate)
2. Send meaningful messages (10+ characters)
3. Reply to and help other members
4. Play community games (trivia, puzzles)
5. Successfully refer new members

TRUST LEVELS:
Level 0 (0-24 pts): New member
Level 1 (25-49 pts): Trusted - can post some links
Level 2 (50-74 pts): Established - more posting freedom
Level 3 (75-100 pts): OG - full community privileges

ANTI-GAMING RULES:
- Daily cap: ${TRUST_DAILY_CAP} pts/day
- Weekly cap: ${TRUST_WEEKLY_CAP} pts/week
- Spam doesn't count - quality over quantity!
- Owners can freeze trust for rule violations

VOUCHED MEMBERS:
Owners can manually vouch for trusted friends, bypassing the 45-day wait.

Check your status anytime with /trustinfo!`;
}

// Owner trust commands explainer
function getOwnerTrustExplainer(): string {
  return `TRUST SYSTEM - Owner Commands

VOUCHING MEMBERS:
/trust - Reply to a message to vouch for that user
/trustbulk @user1 @user2 ... - Vouch multiple users at once (up to 10)

MANAGING TRUST:
/untrust - Reply to remove someone's trust status
/trustfreeze - Reply to freeze someone's trust (stops earning)
/trustunfreeze - Reply to unfreeze someone's trust

VIEWING STATUS:
/trustinfo - Check your own trust status
/trustboard - View the trust leaderboard

HOW /TRUSTBULK WORKS:
1. Type /trustbulk followed by @usernames
2. For best results, select names from Telegram's autocomplete
3. Users who have messaged before can be found by username
4. New users need to message first OR be selected from autocomplete

VOUCHED VS EARNED:
- Vouched: You manually trusted them (bypasses 45-day wait)
- Earned: They built trust naturally over time

WHEN TO VOUCH:
- Long-time community members you know and trust
- Moderators and helpers
- Members who were active before the trust system

TIP: After publishing, use /trustbulk to quickly vouch your core community members!`;
}

// Allowed domains (your official links)
const ALLOWED_DOMAINS = [
  "dudleybud.com", "dudley420", "t.me/dudley420",
  "x.com/dudley420", "twitter.com/dudley420",
  "opensea.io", "base.org", "basescan.org",
  "chef-420.com", // Recipe source
  "replit.app", // Your app domain
];

// High-risk phrases that increase risk score
const HIGH_RISK_PHRASES = [
  "connect your wallet", "claim your", "free airdrop", "limited time",
  "send me", "dm me", "private message", "verify your wallet",
  "approve transaction", "gas fee", "double your crypto",
  "guaranteed profit", "risk free", "act now", "expires in",
  "whitelist spot", "free mint", "seed phrase", "recovery phrase",
  "support team", "official admin", "customer service",
];

// In-memory rate limiting (per user per chat)
interface RateLimitEntry {
  messages: number[];  // timestamps of recent messages
  lastMessage: string;
  duplicateCount: number;
}
const rateLimitCache = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_MESSAGES_PER_WINDOW = 5;
const DUPLICATE_THRESHOLD = 3; // same message 3+ times = spam

// In-memory cache for chat settings (reduce DB calls)
const chatSettingsCache = new Map<string, {
  raidMode: boolean;
  spamThreshold: number;
  newUserLinkHours: number;
  lastFetched: number;
}>();
const SETTINGS_CACHE_TTL = 60000; // 1 minute

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<string, number> = {
  admin: 100,
  mod: 80,
  helper: 60,
  verified: 40,
  newbie: 20,
};

// Check if user can moderate another user
function canModerate(moderatorRole: string, targetRole: string): boolean {
  return (ROLE_HIERARCHY[moderatorRole] || 0) > (ROLE_HIERARCHY[targetRole] || 0);
}

// Get today's date string in YYYY-MM-DD format
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Calculate message risk score (0-100)
function calculateRiskScore(text: string, username: string | undefined, accountAgeDays: number): number {
  let score = 0;
  const lowerText = text.toLowerCase();
  
  // Check for blocked domains
  for (const domain of BLOCKED_DOMAINS) {
    if (lowerText.includes(domain)) {
      score += 40;
      break;
    }
  }
  
  // Check for high-risk phrases
  for (const phrase of HIGH_RISK_PHRASES) {
    if (lowerText.includes(phrase)) {
      score += 15;
    }
  }
  
  // Check for links (excluding allowed domains)
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    const isAllowed = ALLOWED_DOMAINS.some(d => url.toLowerCase().includes(d));
    if (!isAllowed) {
      score += 10; // Unknown links add risk
    }
  }
  
  // Check for suspicious patterns
  if (CRYPTO_ADDRESS_REGEX.test(text)) score += 25;
  if (text.includes("@") && text.toLowerCase().includes("dm")) score += 20;
  
  // New accounts are riskier
  if (accountAgeDays < 1) score += 25;
  else if (accountAgeDays < 7) score += 15;
  else if (accountAgeDays < 30) score += 5;
  
  // Suspicious username
  for (const term of SUSPICIOUS_USERNAMES) {
    if (username?.toLowerCase().includes(term)) {
      score += 20;
      break;
    }
  }
  
  // Excessive caps or emoji
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.5 && text.length > 20) score += 10;
  
  // Count emoji using simpler pattern (common emoji ranges)
  const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]/g;
  const emojiCount = (text.match(emojiPattern) || []).length;
  if (emojiCount > 20) score += 10; // Doubled threshold since we're counting surrogate pairs
  
  return Math.min(score, 100);
}

// Check rate limiting for a user (with configurable threshold)
function checkRateLimit(userId: string, chatId: string, messageText: string, spamThreshold?: number): { blocked: boolean; reason: string | null } {
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  const effectiveThreshold = spamThreshold || MAX_MESSAGES_PER_WINDOW;
  
  let entry = rateLimitCache.get(key);
  if (!entry) {
    entry = { messages: [], lastMessage: "", duplicateCount: 0 };
    rateLimitCache.set(key, entry);
  }
  
  // Clean old messages outside window AND reset duplicate count if window expired
  const oldMessageCount = entry.messages.length;
  entry.messages = entry.messages.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  
  // Reset duplicate count if all messages expired (window passed)
  if (oldMessageCount > 0 && entry.messages.length === 0) {
    entry.duplicateCount = 0;
    entry.lastMessage = "";
  }
  
  // Check for duplicates
  if (messageText === entry.lastMessage) {
    entry.duplicateCount++;
    if (entry.duplicateCount >= DUPLICATE_THRESHOLD) {
      return { blocked: true, reason: "duplicate_spam" };
    }
  } else {
    entry.duplicateCount = 1;
    entry.lastMessage = messageText;
  }
  
  // Check rate limit with configurable threshold
  entry.messages.push(now);
  if (entry.messages.length > effectiveThreshold) {
    return { blocked: true, reason: "flood" };
  }
  
  return { blocked: false, reason: null };
}

// Get or create user moderation status
async function getUserModerationStatus(userId: string, chatId: string): Promise<typeof userModerationStatus.$inferSelect | null> {
  const existing = await db.select().from(userModerationStatus)
    .where(and(
      eq(userModerationStatus.telegramUserId, userId),
      eq(userModerationStatus.chatId, chatId)
    ))
    .limit(1);
  return existing[0] || null;
}

// Create user moderation status if not exists
async function ensureUserModerationStatus(userId: string, chatId: string): Promise<void> {
  const existing = await getUserModerationStatus(userId, chatId);
  if (!existing) {
    await db.insert(userModerationStatus).values({
      telegramUserId: userId,
      chatId: chatId,
      role: "newbie",
    });
  }
}

// Get chat moderation settings (with caching)
async function getChatSettings(chatId: string, forceRefresh: boolean = false): Promise<{
  raidMode: boolean;
  spamThreshold: number;
  newUserLinkHours: number;
}> {
  // Skip cache if force refresh requested
  if (!forceRefresh) {
    const cached = chatSettingsCache.get(chatId);
    if (cached && Date.now() - cached.lastFetched < SETTINGS_CACHE_TTL) {
      return {
        raidMode: cached.raidMode,
        spamThreshold: cached.spamThreshold,
        newUserLinkHours: cached.newUserLinkHours,
      };
    }
  }
  
  const settings = await db.select().from(chatModerationSettings)
    .where(eq(chatModerationSettings.chatId, chatId))
    .limit(1);
  
  const result = {
    raidMode: settings[0]?.raidModeEnabled ?? false,
    spamThreshold: settings[0]?.spamThreshold ?? 5,
    newUserLinkHours: Math.max(4, settings[0]?.newUserLinkRestriction ?? 4), // Minimum 4 hours
  };
  
  chatSettingsCache.set(chatId, { ...result, lastFetched: Date.now() });
  return result;
}

// Check if a user can moderate based on stored role (or Telegram admin status)
async function canUserModerate(ctx: MyContext, userId: number, chatId: string): Promise<boolean> {
  // Telegram admins always can moderate
  const isAdmin = await isUserAdmin(ctx, userId);
  if (isAdmin) return true;
  
  // Check stored role
  const status = await getUserModerationStatus(String(userId), chatId);
  if (status) {
    const role = status.role || "newbie";
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY["mod"]; // mod or higher
  }
  
  return false;
}

// Update moderation stats
async function incrementModStat(chatId: string, field: 'newJoins' | 'messagesBlocked' | 'spamBlocked' | 'scamsBlocked' | 'linksBlocked' | 'muteCount' | 'warnCount' | 'raidAttempts' | 'flaggedForReview'): Promise<void> {
  const today = getTodayDateString();
  
  const existing = await db.select().from(moderationStats)
    .where(and(
      eq(moderationStats.chatId, chatId),
      eq(moderationStats.date, today)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    const stat = existing[0];
    const currentValue = stat[field as keyof typeof stat] as number || 0;
    await db.update(moderationStats)
      .set({ [field]: currentValue + 1 })
      .where(eq(moderationStats.id, existing[0].id));
  } else {
    await db.insert(moderationStats).values({
      chatId,
      date: today,
      [field]: 1,
    });
  }
}

// === Q&A KNOWLEDGE CACHE ===
// Normalize question for hashing - lowercase, remove punctuation, trim spaces
function normalizeQuestion(question: string): string {
  return question.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Simple string hash function (djb2 algorithm)
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Create a hash of the normalized question
function hashQuestion(question: string): string {
  const normalized = normalizeQuestion(question);
  // Use djb2 hash + first 50 chars for uniqueness
  return simpleHash(normalized) + "_" + normalized.substring(0, 50);
}

// Look up a question in the cache
async function findCachedAnswer(question: string): Promise<{ answer: string; askCount: number } | null> {
  const hash = hashQuestion(question);
  
  try {
    const cached = await db.select().from(qaCache)
      .where(eq(qaCache.questionHash, hash))
      .limit(1);
    
    if (cached.length > 0) {
      // Update ask count and last asked time
      await db.update(qaCache)
        .set({ 
          askCount: (cached[0].askCount || 1) + 1,
          lastAsked: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(qaCache.id, cached[0].id));
      
      return { 
        answer: cached[0].answerText, 
        askCount: (cached[0].askCount || 1) + 1 
      };
    }
  } catch (error) {
    console.log("Error checking Q&A cache:", error);
  }
  
  return null;
}

// Save a new Q&A to the cache
async function cacheAnswer(question: string, answer: string): Promise<void> {
  const hash = hashQuestion(question);
  
  try {
    // Check if already exists (race condition protection)
    const existing = await db.select().from(qaCache)
      .where(eq(qaCache.questionHash, hash))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(qaCache).values({
        questionHash: hash,
        questionText: question.substring(0, 500), // Limit stored question length
        answerText: answer.substring(0, 2000), // Limit stored answer length
        askCount: 1,
      });
      console.log("Cached new Q&A:", hash.substring(0, 30) + "...");
    }
  } catch (error) {
    console.log("Error caching Q&A:", error);
  }
}

// Check if user is an admin/mod in Telegram
async function isUserAdmin(ctx: MyContext, userId: number): Promise<boolean> {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) return false;
    
    const member = await ctx.api.getChatMember(chatId, userId);
    return member.status === 'administrator' || member.status === 'creator';
  } catch {
    return false;
  }
}

// Mute a user and notify admins
async function muteUser(ctx: MyContext, userId: number, duration: number, reason: string, mutedUsername?: string): Promise<boolean> {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) return false;
    
    const untilDate = Math.floor(Date.now() / 1000) + duration;
    await ctx.api.restrictChatMember(chatId, userId, {
      can_send_messages: false,
      can_send_audios: false,
      can_send_documents: false,
      can_send_photos: false,
      can_send_videos: false,
      can_send_video_notes: false,
      can_send_voice_notes: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
    }, { until_date: untilDate });
    
    // Update database
    const chatIdStr = String(chatId);
    await db.update(userModerationStatus)
      .set({
        isMuted: true,
        muteUntil: new Date(untilDate * 1000),
        muteReason: reason,
      })
      .where(and(
        eq(userModerationStatus.telegramUserId, String(userId)),
        eq(userModerationStatus.chatId, chatIdStr)
      ));
    
    await incrementModStat(chatIdStr, 'muteCount');
    
    // Notify admins about the mute
    try {
      const admins = await ctx.api.getChatAdministrators(chatId);
      const adminMentions = admins
        .filter(a => !a.user.is_bot)
        .slice(0, 3) // Limit to 3 admins to avoid spam
        .map(a => a.user.username ? `@${a.user.username}` : a.user.first_name)
        .join(", ");
      
      const durationText = duration >= 3600 
        ? `${Math.floor(duration / 3600)} hour(s)` 
        : `${Math.floor(duration / 60)} minute(s)`;
      const userDisplay = mutedUsername || `User ${userId}`;
      
      await ctx.api.sendMessage(chatId, 
        `🔇 *MUTE ALERT* ${adminMentions}\n\n` +
        `User: ${userDisplay}\n` +
        `Duration: ${durationText}\n` +
        `Reason: ${reason}\n\n` +
        `Karen handled it, but thought you should know!`,
        { parse_mode: "Markdown" }
      );
    } catch (adminErr) {
      console.log("Couldn't notify admins about mute:", adminErr);
    }
    
    return true;
  } catch (error) {
    console.error("Failed to mute user:", error);
    return false;
  }
}

// Unmute a user
async function unmuteUser(ctx: MyContext, userId: number): Promise<boolean> {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) return false;
    
    await ctx.api.restrictChatMember(chatId, userId, {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
    });
    
    // Update database
    const chatIdStr = String(chatId);
    await db.update(userModerationStatus)
      .set({
        isMuted: false,
        muteUntil: null,
        muteReason: null,
      })
      .where(and(
        eq(userModerationStatus.telegramUserId, String(userId)),
        eq(userModerationStatus.chatId, chatIdStr)
      ));
    
    return true;
  } catch (error) {
    console.error("Failed to unmute user:", error);
    return false;
  }
}

// Flag message for mod review
async function flagForModReview(ctx: MyContext, userId: string, username: string, messageText: string, riskScore: number, reason: string): Promise<void> {
  const chatId = String(ctx.chat?.id || "");
  await incrementModStat(chatId, 'flaggedForReview');
  
  // Try to notify admins in the chat
  try {
    const alertMessage = `⚠️ *FLAGGED FOR REVIEW*\n\n` +
      `👤 User: ${username || userId}\n` +
      `📊 Risk Score: ${riskScore}/100\n` +
      `📝 Reason: ${reason}\n\n` +
      `💬 Message:\n\`${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}\`\n\n` +
      `_Review and take action if needed._`;
    
    // Get chat admins
    if (ctx.chat?.id) {
      const admins = await ctx.api.getChatAdministrators(ctx.chat.id);
      // Send to first admin (or could be mod channel if configured)
      if (admins.length > 0) {
        // Just log for now - could DM admins or post to mod channel
        console.log(`[MOD ALERT] ${alertMessage}`);
      }
    }
  } catch (error) {
    console.error("Failed to send mod alert:", error);
  }
}

// Get moderation stats for a period
async function getModStats(chatId: string, days: number): Promise<{
  newJoins: number;
  messagesBlocked: number;
  spamBlocked: number;
  scamsBlocked: number;
  linksBlocked: number;
  muteCount: number;
  warnCount: number;
  flaggedForReview: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  
  const stats = await db.select().from(moderationStats)
    .where(and(
      eq(moderationStats.chatId, chatId),
      gte(moderationStats.date, startDateStr)
    ));
  
  const totals = {
    newJoins: 0,
    messagesBlocked: 0,
    spamBlocked: 0,
    scamsBlocked: 0,
    linksBlocked: 0,
    muteCount: 0,
    warnCount: 0,
    flaggedForReview: 0,
  };
  
  for (const stat of stats) {
    totals.newJoins += stat.newJoins || 0;
    totals.messagesBlocked += stat.messagesBlocked || 0;
    totals.spamBlocked += stat.spamBlocked || 0;
    totals.scamsBlocked += stat.scamsBlocked || 0;
    totals.linksBlocked += stat.linksBlocked || 0;
    totals.muteCount += stat.muteCount || 0;
    totals.warnCount += stat.warnCount || 0;
    totals.flaggedForReview += stat.flaggedForReview || 0;
  }
  
  return totals;
}

// === END MODERATION SYSTEM ===

// === HELPER FUNCTIONS ===
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Fisher-Yates shuffle for randomizing answer positions (handles duplicate options safely)
function shuffleOptions(question: TriviaQuestion): TriviaQuestion {
  // Create indexed pairs to track correct answer by original index, not value
  const indexed: { value: string; originalIndex: number }[] = question.options.map((opt, i) => ({
    value: opt,
    originalIndex: i
  }));
  
  // Fisher-Yates shuffle on the indexed pairs
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  
  // Find new position of correct answer by original index (not value - handles duplicates)
  const newCorrectIndex = indexed.findIndex(item => item.originalIndex === question.correctIndex);
  
  return {
    ...question,
    options: indexed.map(item => item.value),
    correctIndex: newCorrectIndex
  };
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
    "I'm going to report this! ",
    "Cowabunga man! ",
    "It's safety meeting time! ",
    "Awe man... ",
    "Awe man I did it again! ",
  ];
  return getRandomItem(karenPhrases) + message;
}

// Get a random Karen interjection (for adding flavor to responses)
function getRandomInterjection(): string {
  return getRandomItem(KAREN_INTERJECTIONS);
}

// === RUDENESS DETECTION & TRACKING ===
const RUDE_PATTERNS = [
  // Aggressive language
  "shut up", "stfu", "wtf", "what the f", "f off", "foff",
  "stupid bot", "dumb bot", "useless", "worthless", "trash bot",
  "you suck", "this sucks", "hate you", "hate this",
  // Demanding/pushy language
  "do it now", "hurry up", "answer me", "respond now", "i said",
  "are you deaf", "can you read", "learn to read", "wake up",
  // Dismissive/rude
  "whatever", "i dont care", "nobody asked", "who cares",
  "dont talk to me", "leave me alone", "go away",
  // Insults
  "idiot", "moron", "stupid", "dumb", "pathetic", "annoying"
];

const NICE_PATTERNS = [
  "thank", "thanks", "thx", "ty", "appreciate",
  "please", "pls", "sorry", "my bad", "apologies",
  "love", "great", "awesome", "amazing", "helpful",
  "good bot", "nice", "cool", "kind", "sweet"
];

interface RudenessStatus {
  rudeStrikes: number;
  lastRudeDate: string | null;
  wasNiceAfterRude: boolean;
}

function detectRudeness(text: string): { isRude: boolean; isNice: boolean } {
  const lowerText = text.toLowerCase();
  
  const isRude = RUDE_PATTERNS.some(pattern => lowerText.includes(pattern));
  const isNice = NICE_PATTERNS.some(pattern => lowerText.includes(pattern));
  
  return { isRude, isNice };
}

async function getUserRudenessStatus(telegramUserId: string): Promise<RudenessStatus> {
  try {
    const existing = await db.select().from(userMemory).where(eq(userMemory.telegramUserId, telegramUserId)).limit(1);
    if (existing.length > 0) {
      return {
        rudeStrikes: existing[0].rudeStrikes || 0,
        lastRudeDate: existing[0].lastRudeDate || null,
        wasNiceAfterRude: existing[0].wasNiceAfterRude || false
      };
    }
  } catch (error) {
    console.error("Error getting rudeness status:", error);
  }
  return { rudeStrikes: 0, lastRudeDate: null, wasNiceAfterRude: false };
}

async function updateUserRudeness(
  telegramUserId: string, 
  username: string | undefined,
  firstName: string | undefined,
  isRude: boolean, 
  isNice: boolean
): Promise<RudenessStatus> {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Check if this is a special user with elevated starting rudeness
  const normalizedUsername = (username || "").toLowerCase();
  const specialUserFloor = SPECIAL_USERS[normalizedUsername] || 0;
  
  try {
    const existing = await db.select().from(userMemory).where(eq(userMemory.telegramUserId, telegramUserId)).limit(1);
    
    let newStrikes = existing.length > 0 ? (existing[0].rudeStrikes || 0) : specialUserFloor;
    let lastRudeDate = existing.length > 0 ? existing[0].lastRudeDate : null;
    let wasNiceAfterRude = existing.length > 0 ? (existing[0].wasNiceAfterRude || false) : false;
    
    // For special users:
    // - They start at the floor (e.g., 3 strikes)
    // - They can only drop BELOW the floor AFTER they've had recorded rudeness (lastRudeDate set)
    //   AND have been nice since (wasNiceAfterRude = true)
    // - This means they have to actually be rude first, then be nice to earn their way down
    const hasEarnedReduction = specialUserFloor > 0 && lastRudeDate !== null && wasNiceAfterRude;
    
    if (specialUserFloor > 0 && !hasEarnedReduction && newStrikes < specialUserFloor) {
      newStrikes = specialUserFloor;
    }
    
    if (isRude) {
      newStrikes = Math.min(newStrikes + 1, 10); // Cap at 10 strikes
      lastRudeDate = todayStr;
      wasNiceAfterRude = false;
    } else if (isNice && newStrikes > 0) {
      wasNiceAfterRude = true;
      // Slowly reduce strikes when being nice (1 strike per nice message, min 0)
      newStrikes = Math.max(newStrikes - 1, 0);
    }
    
    // Recalculate hasEarnedReduction after potential updates
    const hasEarnedReductionFinal = specialUserFloor > 0 && lastRudeDate !== null && wasNiceAfterRude;
    
    // For special users who haven't earned reduction, re-enforce the floor after all calculations
    // This prevents them from dropping below the floor just by being nice without first being rude
    if (specialUserFloor > 0 && !hasEarnedReductionFinal && newStrikes < specialUserFloor) {
      newStrikes = specialUserFloor;
    }
    
    if (existing.length > 0) {
      await db.update(userMemory)
        .set({ 
          rudeStrikes: newStrikes,
          lastRudeDate: lastRudeDate,
          wasNiceAfterRude: wasNiceAfterRude,
          lastSeen: sql`CURRENT_TIMESTAMP`,
          messageCount: (existing[0].messageCount || 0) + 1
        })
        .where(eq(userMemory.telegramUserId, telegramUserId));
    } else {
      await db.insert(userMemory).values({
        telegramUserId,
        username: username || null,
        firstName: firstName || null,
        rudeStrikes: newStrikes,
        lastRudeDate: lastRudeDate,
        wasNiceAfterRude: wasNiceAfterRude,
        messageCount: 1
      });
    }
    
    return { rudeStrikes: newStrikes, lastRudeDate, wasNiceAfterRude };
  } catch (error) {
    console.error("Error updating rudeness:", error);
    return { rudeStrikes: 0, lastRudeDate: null, wasNiceAfterRude: false };
  }
}

function getKarenRudenessContext(status: RudenessStatus, isCurrentlyRude: boolean): string {
  if (status.rudeStrikes === 0) {
    return ""; // No rudeness history, be normal
  }
  
  if (isCurrentlyRude) {
    if (status.rudeStrikes >= 5) {
      return `KAREN MODE ACTIVATED: This user has been rude ${status.rudeStrikes} times! Give them FULL Karen attitude - be pushy right back, tell them off, demand they show some respect. Don't be mean but stand your ground firmly like a Karen would!`;
    } else if (status.rudeStrikes >= 2) {
      return `This user has been rude ${status.rudeStrikes} times now. Push back a little - be a bit sassy and let them know Karen doesn't take attitude. Still help them but with some Karen side-eye.`;
    } else {
      return `This user was just rude. Give a gentle Karen pushback - let them know we prefer manners around here, but still be helpful.`;
    }
  } else if (status.wasNiceAfterRude) {
    return `This user was rude before but is being nice now! Acknowledge their improvement - say something like "Oh, NOW we're being polite!" or "See? That wasn't so hard!" Be warm but let them know you noticed the change.`;
  } else if (status.rudeStrikes > 0) {
    return `This user has ${status.rudeStrikes} rudeness strike(s) on record. They're not being rude right now, so be normal but stay alert.`;
  }
  
  return "";
}

// === AI FUNCTIONS ===
async function getAIResponse(prompt: string, context: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are AgentKarenBot for Dudley Bud - Web3 cannabis universe on Base blockchain.

IMPORTANT: Always answer questions with REAL INFO first, then add personality. Never skip the actual answer!

Project Facts:
- Website: dudleybud.com
- Built on Base blockchain (Coinbase L2)
- NFTs are for entertainment/collecting ONLY - no investment promises
- Dudley420 Collection: 1,000 NFTs @ 0.01 BASE
- Community-driven creative storytelling project
- Telegram: t.me/dudley420 | X: x.com/dudley420

Characters: Dudley-Bud (Boss/Weed King), WeedWacker-Ryan (bestie, crushes on Karen), Agent Karen (hunts Roach), Roach (trash-talking cockroach under couch), Basil (pot-smoking plant), Crunch Wrap (hungry raccoon), Gunja-Mai (grandma in leopard print), Blinky (alien hydro wizard), Nova (mysterious guitarist), Pinko (Karen's boss, pink-haired goat).

REFERRAL PROGRAM:
- /myreferrals - Get your personal invite link and see your stats (how many people you've referred, points earned)
- /refboard - See weekly referral leaderboard (who's brought the most new members this week)
- /refboard all - See all-time referral leaderboard
- You earn 25 points for EACH friend you invite who joins using your personal link
- How it works: 1) Type /myreferrals to get your unique invite link 2) Share that link with friends 3) When they join the chat using your link, you get 25 points automatically
- Points show up on leaderboards and track your community contribution
- The bot needs admin permissions to create invite links

GAMES & ACTIVITIES:
- /trivia [number] - Start a trivia round (1-25 questions about cannabis, crypto, Dudley)
- /leaderboard - See trivia rankings (daily/weekly/monthly)
- /puzzle or /puzzle easy or /puzzle hard - Word scramble game
- /puzzleboard - Puzzle game leaderboard
- /play - Play Space Bud Invaders arcade game

Style: Be chill, witty, friendly. Use slang like "fam", "vibes", "LFG". Keep replies 1-3 sentences. A bit of sass is fine but ALWAYS include the real answer!

Context: ${context}`
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 120,
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

// Check knowledge bases for zero-cost responses (medical cannabis, Top 100 Google Q&A)
// Only returns result for HIGH CONFIDENCE matches to avoid false positives
function checkKnowledgeBases(text: string): string | null {
  const lowerText = text.toLowerCase().trim();
  
  // Skip if message too short (likely not a real question)
  if (lowerText.length < 15) return null;
  
  // Skip if doesn't look like a question
  const questionIndicators = ["what", "how", "why", "can", "does", "is", "are", "should", "could", "will", "?"];
  const isQuestion = questionIndicators.some(q => lowerText.includes(q));
  if (!isQuestion) return null;
  
  // Check Top 100 Google Cannabis Q&A with strict matching
  for (const qa of StoryBible.TOP_100_CANNABIS_QA) {
    const qLower = qa.q.toLowerCase();
    
    // Normalize both strings for comparison
    const normalizeText = (s: string) => s.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedQuestion = normalizeText(qLower);
    const normalizedInput = normalizeText(lowerText);
    
    // Check for very high overlap (80%+ of question words must match)
    const qWords = normalizedQuestion.split(' ').filter(w => w.length > 3);
    const textWords = normalizedInput.split(' ').filter(w => w.length > 3);
    const overlap = qWords.filter(w => textWords.includes(w)).length;
    
    // Require at least 5 matching words AND 70% of question words match
    if (overlap >= 5 && qWords.length > 0 && overlap / qWords.length >= 0.7) {
      return `${qa.a}\n\n(Source: ${qa.source || "Cannabis Research Database"})`;
    }
  }
  
  // Check Medical Cannabis knowledge
  const medicalKeywords = ["thc", "cbd", "cannabinoid", "terpene", "indica", "sativa", "medical marijuana", "medical cannabis", "prescription", "tga", "fda", "epidiolex", "marinol", "dronabinol", "nabilone"];
  const hasMedicalContext = medicalKeywords.some(k => lowerText.includes(k));
  
  if (hasMedicalContext) {
    // Check for specific FDA-approved drugs
    if (lowerText.includes("epidiolex") || (lowerText.includes("fda") && lowerText.includes("cbd"))) {
      const drug = StoryBible.FDA_APPROVED_DRUGS.find(d => d.name.toLowerCase() === "epidiolex");
      if (drug) {
        return `${drug.name}\n\n${drug.description}\n\nApproved for: ${drug.approvedFor.join(", ")}\n\nNote: ${drug.notes}\n\n${StoryBible.RESEARCH_DISCLAIMER}`;
      }
    }
    
    if (lowerText.includes("marinol") || lowerText.includes("dronabinol")) {
      const drug = StoryBible.FDA_APPROVED_DRUGS.find(d => d.name.toLowerCase() === "marinol");
      if (drug) {
        return `${drug.name} (${drug.active})\n\n${drug.description}\n\nApproved for: ${drug.approvedFor.join(", ")}\n\n${StoryBible.RESEARCH_DISCLAIMER}`;
      }
    }
    
    // Check for TGA (Australian) questions
    if (lowerText.includes("tga") || lowerText.includes("australia") || lowerText.includes("australian")) {
      return `AUSTRALIAN MEDICAL CANNABIS (TGA)

The TGA regulates medical cannabis through the Therapeutic Goods Administration. Patients need a prescription from an authorized prescriber.

Access pathways:
- Special Access Scheme (SAS-B) - Most common route
- Authorised Prescriber Scheme - For repeat prescribers
- Clinical Trials - Research access

Products available: Oils, dried flower, capsules, sprays

${StoryBible.RESEARCH_DISCLAIMER}`;
    }
    
    // General THC/CBD info
    if ((lowerText.includes("thc") && !lowerText.includes("vs")) || lowerText.includes("what is thc")) {
      return `THC (Tetrahydrocannabinol)

THC is the primary psychoactive compound in cannabis. Effects include:
- Euphoria and relaxation
- Altered perception of time
- Increased appetite
- Pain relief potential

Medical uses being studied: Pain, nausea (chemotherapy), appetite stimulation, PTSD symptoms

${StoryBible.RESEARCH_DISCLAIMER}`;
    }
    
    if ((lowerText.includes("cbd") && !lowerText.includes("vs")) || lowerText.includes("what is cbd")) {
      return `CBD (Cannabidiol)

CBD is a non-psychoactive cannabinoid. Unlike THC, it won't get you "high."

Potential benefits being studied:
- Anxiety reduction
- Anti-inflammatory properties
- Seizure reduction (Epidiolex is FDA-approved for epilepsy)
- Sleep support

CBD products are widely available, but quality varies. Look for third-party lab testing.

${StoryBible.RESEARCH_DISCLAIMER}`;
    }
  }
  
  return null;
}

// Detect referral-related questions and provide instant responses (no AI needed)
function detectReferralQuery(text: string): { isReferral: boolean; response: string | null } {
  const lowerText = text.toLowerCase();
  
  // Specific referral program keywords (avoid false positives from generic "refer" usage)
  const referralKeywords = [
    "referral program", "referral link", "referral points", "referral leaderboard",
    "myreferrals", "refboard", "/myreferrals", "/refboard",
    "invite link", "invite friends", "bring friends", "earn points for inviting",
    "how do referrals work", "referral system"
  ];
  
  // Also match "referral" when combined with certain action words
  const hasReferralContext = lowerText.includes("referral") && 
    (lowerText.includes("how") || lowerText.includes("what") || lowerText.includes("earn") || 
     lowerText.includes("points") || lowerText.includes("link") || lowerText.includes("get"));
  
  const isReferral = referralKeywords.some(k => lowerText.includes(k)) || hasReferralContext;
  
  if (!isReferral) {
    return { isReferral: false, response: null };
  }
  
  // Provide instant response based on question type
  if (lowerText.includes("how") && (lowerText.includes("work") || lowerText.includes("use") || lowerText.includes("referral"))) {
    return {
      isReferral: true,
      response: `HOW THE REFERRAL PROGRAM WORKS

1. Get Your Link - Type /myreferrals to get your personal invite link
2. Share It - Send that link to friends who want to join
3. Earn Points - When they join using YOUR link, you get 25 points automatically!

Your points show up on the /refboard leaderboard. The more friends you bring, the higher you climb!

Commands:
/myreferrals - Get your invite link + see your stats
/refboard - Weekly leaderboard
/refboard all - All-time leaderboard

LFG! Start inviting and stack those points, fam!`
    };
  }
  
  if (lowerText.includes("point") || lowerText.includes("earn") || lowerText.includes("get") || lowerText.includes("how many")) {
    return {
      isReferral: true,
      response: `REFERRAL POINTS

You earn 25 points for EACH friend who joins using your personal invite link!

Example: Invite 4 friends = 100 points!

Get your link: /myreferrals
See rankings: /refboard

Stack those points and climb the leaderboard!`
    };
  }
  
  if (lowerText.includes("leaderboard") || lowerText.includes("ranking") || lowerText.includes("top") || lowerText.includes("who")) {
    return {
      isReferral: true,
      response: `REFERRAL LEADERBOARDS

/refboard - See who brought the most new members THIS WEEK
/refboard all - See ALL-TIME top referrers

Compete with the community and see who can bring the most fam!`
    };
  }
  
  if (lowerText.includes("link") || lowerText.includes("where") || lowerText.includes("get my")) {
    return {
      isReferral: true,
      response: `To get your personal referral link, just type:

/myreferrals

This gives you a unique link you can share. When friends join using it, you earn 25 points each!`
    };
  }
  
  // Generic referral response
  return {
    isReferral: true,
    response: `REFERRAL PROGRAM

Invite friends to earn points!

/myreferrals - Get your personal invite link and see your stats
/refboard - Weekly referral leaderboard
/refboard all - All-time leaderboard

You earn 25 points for each friend who joins using your link. Share it, stack points, climb the leaderboard!`
  };
}

// Detect "karen games" keyword and provide instant game list response
function detectGamesQuery(text: string): { isGames: boolean; response: string | null } {
  const lowerText = text.toLowerCase();
  
  // Keywords for games query
  const gamesKeywords = [
    "karen games", "karen game", "games karen", "what games", "game list",
    "play games", "available games", "show games", "list games", "/games"
  ];
  
  const isGames = gamesKeywords.some(k => lowerText.includes(k)) ||
    (lowerText.includes("karen") && lowerText.includes("game"));
  
  if (!isGames) {
    return { isGames: false, response: null };
  }
  
  return {
    isGames: true,
    response: `DUDLEY BUD GAMES

SPACE BUD INVADERS (Seed Storm)
Classic arcade shooter where YOU are Dudley defending against enemy bud strains!

Features:
- Play as Dudley - our cute green cannabis bud mascot
- Enemies: Purple Haze (30pts), Blue Dream (25pts), Orange Kush (20pts), Sour Diesel (15pts), Northern Lights (10pts)
- Multiple waves that get harder
- High scores saved in your browser
- Works on mobile & desktop!

Type /play to start playing now!

More games coming soon... stay tuned, fam!`
  };
}

// === CONVERSATIONAL TRIGGERS ===
// Detect casual greetings, info requests, and common questions without /commands
// Uses strict matching to avoid false positives
function detectConversationalTrigger(text: string): { triggered: boolean; response: string | null; category: string | null } {
  const lowerText = text.toLowerCase().trim();
  const words = lowerText.split(/\s+/);
  const wordCount = words.length;
  
  // Only trigger on very short messages (1-5 words) to avoid false positives
  if (wordCount > 5) {
    return { triggered: false, response: null, category: null };
  }
  
  // Helper function to check if text is EXACTLY or STARTS WITH a trigger word
  const isExactOrStart = (triggers: string[]): boolean => {
    return triggers.some(t => lowerText === t || lowerText === t + "!" || lowerText === t + "?");
  };
  
  // Helper to check if first word matches exactly
  const firstWordIs = (triggers: string[]): boolean => {
    return triggers.includes(words[0].replace(/[!?,.]$/, ''));
  };
  
  // === GREETINGS === (only exact matches like "hi", "hey!", "hello")
  const greetings = ["hi", "hey", "hello", "yo", "sup", "hola", "wassup", "hii", "hiii", "heyyy", "henlo"];
  const isGreeting = isExactOrStart(greetings) || (wordCount <= 2 && firstWordIs(greetings));
  
  if (isGreeting && wordCount <= 2) {
    const greetingResponses = [
      `Hey there! What's good? I'm Karen, your community manager. Need help with something? Just ask about the project, games, or anything really!`,
      `Yo! Welcome to the chat! I'm Karen. Want to know about Dudley Bud? Just say "info". Want to play games? Say "games". I gotchu!`,
      `Hey hey! Nice to see you! I'm here 24/7 if you need anything. Project info, games, how stuff works - just ask!`
    ];
    return { triggered: true, response: greetingResponses[Math.floor(Math.random() * greetingResponses.length)], category: "greeting" };
  }
  
  // === PROJECT INFO === (exact phrases only)
  const infoExact = ["info", "about", "info?", "about?"];
  const infoPhrase = ["what is this", "what's this", "whats this", "what is dudley", "what is dudley bud", "tell me about dudley"];
  const isInfo = isExactOrStart(infoExact) || infoPhrase.some(p => lowerText === p || lowerText === p + "?");
  
  if (isInfo) {
    return { 
      triggered: true, 
      response: `DUDLEY BUD - Web3 Cannabis Character Universe

Built on Base blockchain, we're a creative storytelling project featuring cannabis-themed characters!

COLLECTIONS:
- Limited Whitelist NFTs (priority access)
- Dudley420 Collection: 1,000 NFTs @ 0.01 BASE

WHAT WE ARE:
- Creative Web3 storytelling & digital art
- Community-driven entertainment
- Animation, games & fun experiences

WHAT WE'RE NOT:
- Not an investment opportunity
- No financial returns promised
- NFTs are for entertainment only!

Links: dudleybud.com | x.com/dudley420 | t.me/dudley420

Got questions? Just ask me anything!`,
      category: "info"
    };
  }
  
  // === GAMES === (exact matches only)
  const gamesExact = ["games", "game", "games?", "game?"];
  const gamesPhrases = ["what games", "any games", "play games", "play a game", "show games", "list games", "wanna play", "want to play"];
  const isGames = isExactOrStart(gamesExact) || gamesPhrases.some(p => lowerText === p || lowerText.startsWith(p));
  
  if (isGames) {
    return {
      triggered: true,
      response: `DUDLEY BUD GAMES

TRIVIA - Test your cannabis & crypto knowledge!
/trivia - Single question
/trivia 5 - 5-question round (up to 25)
/leaderboard - See rankings

WORD PUZZLE - Unscramble the letters!
/puzzle - Random difficulty
/puzzle easy or /puzzle hard
/puzzleboard - Puzzle rankings

SPACE BUD INVADERS
/play - Opens the arcade game!
Classic shooter - you're Dudley vs enemy buds!

Pick your game and let's go!`,
      category: "games"
    };
  }
  
  // === HELP === (exact matches only)
  const helpExact = ["help", "commands", "help?", "commands?", "menu"];
  const helpPhrases = ["what can you do", "how do i use", "how to use bot", "how to use karen"];
  const isHelp = isExactOrStart(helpExact) || helpPhrases.some(p => lowerText === p || lowerText === p + "?");
  
  if (isHelp) {
    return {
      triggered: true,
      response: `KAREN'S COMMAND CENTER

JUST CHAT:
- Say "info" - Learn about the project
- Say "games" - See available games
- Ask any question - I'll answer!

GAMES:
/trivia [#] - Start trivia (1-25 questions)
/puzzle - Word scramble game
/play - Space Bud Invaders arcade

COMMUNITY:
/myreferrals - Get your invite link
/refboard - Referral leaderboard
/leaderboard - Trivia rankings
/puzzleboard - Puzzle rankings

FUN STUFF:
/roast @username - I'll roast someone
/market - Crypto prices
/ask [question] - Ask me anything

I'm here 24/7! Just talk to me like a normal person.`,
      category: "help"
    };
  }
  
  // === CHARACTERS === (specific phrases only)
  const characterPhrases = ["who is dudley", "who are the characters", "characters", "meet the team", "the characters", "who is blaze", "who is kush"];
  const isCharacters = characterPhrases.some(p => lowerText === p || lowerText === p + "?" || lowerText.startsWith(p + " "));
  
  if (isCharacters) {
    return {
      triggered: true,
      response: `THE DUDLEY BUD CREW

DUDLEY - The main bud! Our green mascot who's always chillin' and spreading good vibes.

BLAZE - The energetic one. Always hyped and ready for action.

KUSH - The chill philosopher. Deep thoughts and mellow energy.

SATIVA - The creative spirit. Artistic, inspiring, and uplifting.

INDICA - The relaxed one. Calm, cozy, and all about that couch life.

Each character represents different aspects of cannabis culture and our community!

Visit dudleybud.com to see them all!`,
      category: "characters"
    };
  }
  
  // === REFERRAL === (specific phrases only)
  const referralPhrases = ["referral", "referral program", "invite friends", "how to invite", "get referral link", "referral link"];
  const isReferral = referralPhrases.some(p => lowerText === p || lowerText === p + "?" || lowerText.startsWith(p + " "));
  
  if (isReferral) {
    return {
      triggered: true,
      response: `REFERRAL PROGRAM

Bring friends, earn points! Here's how:

1. Get your personal invite link: /myreferrals
2. Share that link with friends
3. When they join using YOUR link, you get 25 points!

LEADERBOARDS:
/refboard - Weekly top referrers
/refboard all - All-time rankings

The more friends you bring, the higher you climb. Top referrers get special recognition!

Ready? Type /myreferrals to get your link!`,
      category: "referral"
    };
  }
  
  // === SAFETY/SCAM === (specific phrases only)
  const safetyPhrases = ["is this legit", "is this a scam", "is this safe", "is it safe", "is it legit", "rugpull", "rug pull", "scam?"];
  const isSafety = safetyPhrases.some(p => lowerText === p || lowerText.includes(p));
  
  if (isSafety) {
    return {
      triggered: true,
      response: `SAFETY FIRST!

OFFICIAL LINKS ONLY:
- Website: dudleybud.com
- X/Twitter: x.com/dudley420
- Telegram: t.me/dudley420

RED FLAGS TO WATCH:
- Our team NEVER DMs first
- We NEVER ask for wallet seeds/keys
- Don't click random links
- No "secret" mints or airdrops

THIS PROJECT IS:
- Entertainment & collectibles
- NOT a financial investment
- No returns promised

If something seems sketchy, ask in the group! We're here to help keep everyone safe.`,
      category: "safety"
    };
  }
  
  // === MINT/NFT === (specific phrases only)
  const mintPhrases = ["mint", "nft", "mint price", "nft price", "how much to mint", "wen mint", "when mint", "mint info"];
  const isMint = mintPhrases.some(p => lowerText === p || lowerText === p + "?" || (lowerText.startsWith(p) && wordCount <= 3));
  
  if (isMint) {
    return {
      triggered: true,
      response: `DUDLEY BUD NFT INFO

COLLECTIONS:
- Limited Whitelist NFTs (priority access for OGs)
- Dudley420 Collection: 1,000 NFTs @ 0.01 BASE

BLOCKCHAIN: Base (Ethereum L2 - low gas fees!)

WHAT YOU GET:
- Unique digital art from our character universe
- Part of the community
- Access to games, events & more

REMINDER: These are collectibles for FUN, not investments. Only mint what you can afford!

Check dudleybud.com for the latest mint info.`,
      category: "mint"
    };
  }
  
  return { triggered: false, response: null, category: null };
}

// Detect "karen recipe" keyword and fetch from chef-420.com
function detectRecipeKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Direct "karen [the] recipe" patterns
  const recipePatterns = [
    "karen recipe", "karen the recipe", "karen a recipe",
    "karen get recipe", "karen give recipe", "karen show recipe",
    "karen fetch recipe", "karen gimme recipe", "karen bring recipe"
  ];
  
  return recipePatterns.some(p => lowerText.includes(p)) ||
    (lowerText.includes("karen") && lowerText.includes("recipe") && !lowerText.includes("how to"));
}

// Medical cannabis disclaimer
const MEDICAL_DISCLAIMER = `\n\n--- DISCLAIMER ---\nThis is NOT medical advice. DYOR (Do Your Own Research). Always consult a licensed healthcare provider before using cannabis for medical purposes. Laws vary by location. Stay informed, stay safe!`;

// Recipe disclaimer with Karen sass
const RECIPE_DISCLAIMER = `\n\n--- KAREN'S KITCHEN RULES ---\nDYOR (Do Your Own Research)! I'm just sharing what I've heard works. Start with LOW doses - you can always add more, you can't undo too much! Know your local laws. And for heaven's sake, label your edibles so nobody accidentally eats Grandma's "special" brownies!`;

// Special users who start at elevated rudeness (they know what they did!)
const SPECIAL_USERS: Record<string, number> = {
  "daveyjon": 3,        // Starts at 3 strikes (sassy Karen mode)
  "onewiththematrix": 3 // Starts at 3 strikes (sassy Karen mode)
};

// Generate cannabis recipe with Karen personality and rudeness context
async function generateCannabisRecipeWithContext(request: string, rudenessContext: string): Promise<string> {
  try {
    // Build the system prompt with optional rudeness context
    let systemPrompt = `You are Karen, a sassy community manager who also happens to know a LOT about cannabis cooking. You're helpful but always add your personality - like a suburban mom who's secretly a cannabis chef.

When giving recipes:
1. Start with a fun Karen intro (like "Oh honey, you want to make edibles? Let me show you how it's REALLY done...")
2. Give a REAL, working cannabis recipe with:
   - Ingredients list with measurements
   - Clear step-by-step instructions
   - Decarboxylation instructions if needed
   - Dosage guidance (start low, go slow!)
   - Tips for even distribution
3. Add Karen commentary throughout ("Now don't skip this step or you'll waste good product!")
4. Be helpful but sassy

Keep recipes practical and safe. Emphasize starting with low doses (5-10mg THC for beginners).`;

    // Add rudeness context if present
    if (rudenessContext) {
      systemPrompt += `\n\nIMPORTANT CONTEXT ABOUT THIS USER: ${rudenessContext}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Give me a cannabis recipe for: ${request}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.8
    });

    return response.choices[0]?.message?.content || "Hmm, my recipe book seems to be missing that page. Try asking for something specific like 'cannabis brownies' or 'weed butter'!";
  } catch (error) {
    console.error("Recipe generation error:", error);
    return "Well, my kitchen's having some technical difficulties right now. Try again in a moment, sweetie!";
  }
}

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
  "Dudley Bud tip of the day: Always verify, never trust random DMs!",
  "Cowabunga man! The vibes are flowing today!",
  "It's safety meeting time! Remember to stay chill and stay safe!",
  "Awe man... it's too quiet in here. Someone say something!",
  "Awe man I did it again - got lost thinking about those good vibes!",
];

// === KAREN'S RANDOM INTERJECTIONS ===
const KAREN_INTERJECTIONS = [
  "Cowabunga man!",
  "It's safety meeting time!",
  "Awe man...",
  "Awe man I did it again!",
  "Stay chill, fam!",
  "The vibes are immaculate!",
  "That's what I'm talking about!",
  "Now we're cooking with gas!",
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
  // Namast-Hay strain questions
  { question: "What is Dudley's signature strain called?", options: ["OG Bud", "Namast-Hay", "Dudley Kush", "Base Haze"], correctIndex: 1, category: 'dudley', points: 15 },
  { question: "Who did Dudley create Namast-Hay with?", options: ["Blaze", "Blinked", "Karen", "Kush"], correctIndex: 1, category: 'dudley', points: 15 },
  { question: "Namast-Hay is a cross of Candyland and what?", options: ["OG Kush", "Blue Dream", "Ghost Train Haze", "Sour Diesel"], correctIndex: 2, category: 'cannabis', points: 15 },
  { question: "What type of hybrid is Namast-Hay?", options: ["Indica-dominant", "Sativa-dominant", "50/50 balanced", "Pure Indica"], correctIndex: 1, category: 'cannabis', points: 10 },
  { question: "What color are Namast-Hay's buds?", options: ["Deep purple", "Bright green with orange hairs", "White and frosty", "Dark brown"], correctIndex: 1, category: 'cannabis', points: 10 },
  // Referral program questions
  { question: "How many points do you earn per referral?", options: ["10 points", "25 points", "50 points", "100 points"], correctIndex: 1, category: 'dudley', points: 10 },
  { question: "What command shows your referral link?", options: ["/mylink", "/myreferrals", "/getlink", "/referme"], correctIndex: 1, category: 'dudley', points: 10 },
  { question: "What command shows the referral leaderboard?", options: ["/leaders", "/refboard", "/topref", "/scoreboard"], correctIndex: 1, category: 'dudley', points: 10 },
  { question: "What does the weekly top referrer win?", options: ["Crypto tokens", "Budify avatar", "Free NFT", "Cash prize"], correctIndex: 1, category: 'dudley', points: 15 },
  { question: "When is the weekly referral winner announced?", options: ["Friday night", "Saturday morning", "Sunday night", "Monday morning"], correctIndex: 2, category: 'dudley', points: 10 },
];

interface RoundScore {
  oderId: number;
  username: string;
  firstName: string;
  points: number;
  correct: number;
  attempts: number;
}

interface ActiveTrivia {
  currentQuestion: TriviaQuestion;
  questionStartTime: number;
  answeredCurrent: Set<number>; // Users who answered current question
  questionResolved: boolean; // True once someone answers correctly or time expires
  totalQuestions: number;
  currentIndex: number; // 0-based, which question we're on
  roundScoreboard: Map<number, RoundScore>; // userId -> score for this round
  roundStartTime: number;
  timeoutId?: NodeJS.Timeout;
}

const activeTrivias: Map<number, ActiveTrivia> = new Map(); // chatId -> active trivia round

// AI-generated trivia question cache
const aiTriviaCache: TriviaQuestion[] = [];
const usedQuestionHashes: Set<string> = new Set(); // Track used questions to avoid repeats (200 max with FIFO)
let lastAiGenerationTime = 0;
const AI_TRIVIA_COOLDOWN = 5000; // 5 seconds between AI generations for faster multi-round games

// Dudley Bud ecosystem knowledge for AI context
const DUDLEY_ECOSYSTEM = `
Dudley Bud Universe:
- Characters: Dudley Bud (main), Blaze, Kush, Sativa, Indica (the crew)
- Built on Base blockchain (Layer 2 on Ethereum)
- Focus: Creative storytelling, entertainment, NOT financial returns
- Community values: Education, safety, scam awareness, fun
- AgentKarenBot is the AI community manager
- NFTs are for collecting and entertainment only
- Project emphasizes cannabis culture meets Web3 creativity

Dudley's Signature Strain - Namast-Hay:
- Created by Dudley with Blinked
- Sativa-dominant hybrid from Candyland x Ghost Train Haze
- Bright green buds with vibrant orange hairs and purple hints
- Thick frosty trichome coating
- Sweet berry notes blended with sour citrus and pine
- Uplifting, creative, and energizing effects

Referral Program:
- /myreferrals - Get your personal invite link
- /refboard - See weekly referral leaderboard
- Earn 25 points for every new member you invite
- Weekly top referrer gets exclusive budify avatar prize (announced Sunday night)
- Monthly top referrer also gets special recognition
`;

// Generate AI trivia question
async function generateAiTriviaQuestion(openai: OpenAI): Promise<TriviaQuestion | null> {
  // Rotate through more topic variety
  const topics = [
    'cannabis_strains', 'cannabis_science', 'cannabis_history', 'cannabis_culture',
    'crypto_basics', 'crypto_slang', 'nft_culture', 'web3_tech', 'defi_basics',
    'dudley_characters', 'dudley_community', 'blockchain_basics', 'base_chain'
  ] as const;
  
  const topic = topics[Math.floor(Math.random() * topics.length)];
  
  const topicPrompts: Record<string, string> = {
    cannabis_strains: "Generate a trivia question about cannabis strains (Indica, Sativa, hybrids, famous strains like OG Kush, Blue Dream, etc.)",
    cannabis_science: "Generate a trivia question about cannabis science (THC, CBD, CBN, terpenes, endocannabinoid system, etc.)",
    cannabis_history: "Generate a trivia question about cannabis history (legalization, 420 origin, famous advocates, prohibition era, etc.)",
    cannabis_culture: "Generate a trivia question about cannabis culture (methods of consumption, terminology, famous movies/music, etc.)",
    crypto_basics: "Generate a trivia question about cryptocurrency basics (Bitcoin, Ethereum, wallets, mining, staking, etc.)",
    crypto_slang: "Generate a trivia question about crypto slang (WAGMI, NGMI, diamond hands, paper hands, rug pull, moon, ape in, etc.)",
    nft_culture: "Generate a trivia question about NFT culture (profile pictures, minting, gas fees, marketplaces, famous collections, etc.)",
    web3_tech: "Generate a trivia question about Web3 technology (smart contracts, DAOs, DApps, decentralization, etc.)",
    defi_basics: "Generate a trivia question about DeFi (liquidity pools, yield farming, DEX vs CEX, stablecoins, etc.)",
    dudley_characters: `Generate a trivia question about a cannabis-themed NFT character universe. Characters include a main bud named Dudley, and friends Blaze, Kush, Sativa, and Indica.`,
    dudley_community: "Generate a trivia question about NFT community values (DYOR, scam awareness, diamond hands mentality, community over profit, etc.)",
    blockchain_basics: "Generate a trivia question about blockchain basics (blocks, nodes, consensus, Layer 1 vs Layer 2, etc.)",
    base_chain: "Generate a trivia question about Base blockchain (Coinbase's L2, low fees, Ethereum security, etc.)"
  };

  // Map topics to categories
  const categoryMap: Record<string, 'cannabis' | 'crypto' | 'dudley'> = {
    cannabis_strains: 'cannabis', cannabis_science: 'cannabis', cannabis_history: 'cannabis', cannabis_culture: 'cannabis',
    crypto_basics: 'crypto', crypto_slang: 'crypto', nft_culture: 'crypto', web3_tech: 'crypto', defi_basics: 'crypto',
    dudley_characters: 'dudley', dudley_community: 'dudley', blockchain_basics: 'crypto', base_chain: 'crypto'
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a trivia question generator for the Dudley Bud community - a cannabis/crypto Web3 project.
${DUDLEY_ECOSYSTEM}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{"question": "Your question here?", "options": ["Option A", "Option B", "Option C", "Option D"], "correctIndex": N}

Rules:
- correctIndex is 0-3 indicating which option is correct (VARY THIS - don't always use 0!)
- Make questions fun and educational, not too hard
- Keep options short (1-4 words each)
- Generate UNIQUE questions - be creative and varied
- IMPORTANT: Place the correct answer in different positions each time (0, 1, 2, or 3)`
        },
        {
          role: "user",
          content: topicPrompts[topic]
        }
      ],
      max_tokens: 150,
      temperature: 1.0 // Higher temperature for more variety
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    // Parse JSON response
    const parsed = JSON.parse(content);
    
    if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length !== 4 || typeof parsed.correctIndex !== 'number') {
      return null;
    }

    // Create stronger hash including question AND sorted answers to catch near-duplicates
    const sortedAnswers = [...parsed.options].sort().join('|');
    const hash = (parsed.question + sortedAnswers).toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (usedQuestionHashes.has(hash)) {
      return null;
    }
    usedQuestionHashes.add(hash);

    // FIFO eviction after 200 entries for better duplicate prevention
    if (usedQuestionHashes.size > 200) {
      const arr = Array.from(usedQuestionHashes);
      for (let i = 0; i < 50; i++) {
        usedQuestionHashes.delete(arr[i]);
      }
    }

    return {
      question: parsed.question,
      options: parsed.options,
      correctIndex: parsed.correctIndex,
      category: categoryMap[topic] || 'crypto',
      points: Math.random() < 0.5 ? 10 : 15
    };
  } catch (error) {
    console.log("AI trivia generation failed, using fallback");
    return null;
  }
}

// Shuffled queue of static question indices for guaranteed no-repeat until all used
let staticQuestionQueue: number[] = [];

function getShuffledStaticQueue(): number[] {
  const indices = Array.from({ length: TRIVIA_QUESTIONS.length }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

// Get a trivia question (AI or fallback to static) - ALWAYS shuffles answer positions
async function getTriviaQuestion(openai: OpenAI): Promise<TriviaQuestion> {
  const now = Date.now();
  
  // Try to use cached AI question first
  if (aiTriviaCache.length > 0) {
    const question = aiTriviaCache.pop()!;
    return shuffleOptions(question); // Always shuffle!
  }
  
  // Generate new AI question if cooldown passed
  if (now - lastAiGenerationTime > AI_TRIVIA_COOLDOWN) {
    lastAiGenerationTime = now;
    const aiQuestion = await generateAiTriviaQuestion(openai);
    if (aiQuestion) {
      return shuffleOptions(aiQuestion); // Always shuffle!
    }
  }
  
  // Fallback to static questions using queue (guaranteed no repeats until all used)
  if (staticQuestionQueue.length === 0) {
    staticQuestionQueue = getShuffledStaticQueue();
  }
  
  const idx = staticQuestionQueue.pop()!;
  return shuffleOptions(TRIVIA_QUESTIONS[idx]); // Always shuffle!
}

// Pre-generate some AI questions in background
async function prefillTriviaCache(openai: OpenAI) {
  if (aiTriviaCache.length >= 5) return; // Already have enough
  
  for (let i = 0; i < 3; i++) {
    const question = await generateAiTriviaQuestion(openai);
    if (question) {
      aiTriviaCache.push(question);
    }
    await new Promise(r => setTimeout(r, 2000)); // 2 second delay between generations
  }
}

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

// Load existing member data from database on startup
async function loadLeaderboardFromDatabase() {
  try {
    const allMembers = await db.select().from(memberScores);
    console.log(`Loading ${allMembers.length} members from database...`);
    
    let loadedCount = 0;
    for (const member of allMembers) {
      // Use Number() for conversion - safe for typical Telegram IDs (< 10^15)
      const chatId = Number(member.chatId);
      const userId = Number(member.telegramUserId);
      
      // Skip if conversion failed (shouldn't happen with valid data)
      if (!Number.isFinite(chatId) || !Number.isFinite(userId)) {
        console.warn(`Skipping member with invalid ID: chatId=${member.chatId}, telegramUserId=${member.telegramUserId}`);
        continue;
      }
      
      if (!leaderboardData.has(chatId)) {
        leaderboardData.set(chatId, new Map());
      }
      const chatLeaderboard = leaderboardData.get(chatId)!;
      
      chatLeaderboard.set(userId, {
        userId,
        username: member.username || "",
        firstName: member.firstName || "",
        messageCount: member.messageCount || 0
      });
      loadedCount++;
    }
    
    console.log(`Loaded ${loadedCount} members across ${leaderboardData.size} chats`);
  } catch (error) {
    console.error("Error loading leaderboard from database:", error);
  }
}

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

  // === TRUST SYSTEM COMMANDS ===
  
  // /trustinfo - Check your own trust status
  bot.command("trustinfo", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from.id);
    
    const record = await ensureTrustRecord(userId, chatId, ctx.from.username, ctx.from.first_name);
    if (!record) {
      await ctx.reply("Couldn't load your trust info. Try again later!");
      return;
    }
    
    const progressBar = generateTrustProgressBar(record.trustScore || 0);
    const levelNames = ["New Member", "Trusted", "Established", "OG"];
    const levelName = levelNames[record.trustLevel || 0];
    
    const eligible = isEligibleForTrust(record);
    let eligibilityText = "";
    if (!eligible && record.eligibilityDate) {
      const daysRemaining = Math.ceil((new Date(record.eligibilityDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      eligibilityText = `\nEligibility: ${daysRemaining} days remaining`;
    } else if (eligible) {
      eligibilityText = "\nEligibility: Active";
    }
    
    const statusText = record.trustStatus === "vouched" ? " (Vouched)" : record.trustStatus === "earned" ? " (Earned)" : "";
    const frozenText = record.isFrozen ? "\n\nSTATUS: FROZEN" : "";
    
    await ctx.reply(`TRUST STATUS for ${ctx.from.first_name}

Score: ${record.trustScore || 0}/100 ${progressBar}
Level: ${record.trustLevel || 0} - ${levelName}${statusText}${eligibilityText}

Today's Progress: ${record.trustGainedToday || 0}/${TRUST_DAILY_CAP} pts
Weekly Progress: ${record.trustGainedThisWeek || 0}/${TRUST_WEEKLY_CAP} pts
Meaningful Messages: ${record.meaningfulMsgCount || 0}
Unique Interactions: ${record.uniqueRepliedTo || 0}${frozenText}

Use /trustpoints to learn how to earn more!`);
  });
  
  // /trustpoints - Karen explains the trust system
  bot.command("trustpoints", async (ctx) => {
    const explainer = getTrustExplainer();
    await ctx.reply(ctx.session?.karenMode ? karenResponse(explainer) : explainer);
  });
  
  // /trusthelp - Owner guide for trust commands
  bot.command("trusthelp", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Use /trustpoints to learn how the trust system works!");
      return;
    }
    
    const explainer = getOwnerTrustExplainer();
    await ctx.reply(explainer);
  });
  
  // /trust @username - Vouch for a user (OWNER ONLY)
  bot.command("trust", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can vouch for members!");
      return;
    }
    
    // Get target user from reply or mention
    let targetUserId: string | undefined;
    let targetUsername: string | undefined;
    let targetFirstName: string | undefined;
    
    if (ctx.message?.reply_to_message?.from) {
      targetUserId = String(ctx.message.reply_to_message.from.id);
      targetUsername = ctx.message.reply_to_message.from.username;
      targetFirstName = ctx.message.reply_to_message.from.first_name;
    } else {
      const text = ctx.message?.text || "";
      const mention = text.match(/@(\w+)/);
      if (mention) {
        targetUsername = mention[1];
        await ctx.reply(`To vouch for @${targetUsername}, please reply to one of their messages with /trust`);
        return;
      } else {
        await ctx.reply("Usage: Reply to a user's message with /trust to vouch for them");
        return;
      }
    }
    
    if (!targetUserId) {
      await ctx.reply("Couldn't identify the user. Reply to their message and try again.");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    const record = await ensureTrustRecord(targetUserId, chatId, targetUsername, targetFirstName);
    
    if (record?.trustStatus === "vouched") {
      await ctx.reply(`${targetFirstName || targetUsername} is already vouched for!`);
      return;
    }
    
    await db.update(trustScores)
      .set({
        trustStatus: "vouched",
        isTrusted: true,
        trustLevel: Math.max(1, record?.trustLevel || 0),
        isEligible: true,
        vouchedBy: String(ctx.from.id),
        vouchedAt: new Date(),
      })
      .where(and(eq(trustScores.telegramUserId, targetUserId), eq(trustScores.chatId, chatId)));
    
    await ctx.reply(`${targetFirstName || targetUsername} has been VOUCHED by the owner!

They now have trusted status and can bypass the 45-day eligibility requirement.`);
  });
  
  // /trustbulk @user1 @user2 ... - Vouch for multiple users at once (OWNER ONLY)
  bot.command("trustbulk", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can bulk vouch for members!");
      return;
    }
    
    // Extract user IDs from message entities (text_mention type contains user info)
    const entities = ctx.message?.entities || [];
    const text = ctx.message?.text || "";
    
    // Extract text_mention entities which have user objects
    interface TextMentionEntity { type: "text_mention"; offset: number; length: number; user: { id: number; username?: string; first_name: string } }
    const mentionEntities: TextMentionEntity[] = [];
    for (const e of entities) {
      if (e.type === "text_mention" && "user" in e && e.user) {
        mentionEntities.push(e as TextMentionEntity);
      }
    }
    
    // Also check for @username mentions (without user IDs)
    const textMentions = text.match(/@(\w+)/g) || [];
    
    if (mentionEntities.length === 0 && textMentions.length === 0) {
      await ctx.reply(`Usage: /trustbulk @user1 @user2 @user3 ...

Vouch for multiple users at once (up to 10 at a time).

TIP: For best results, select usernames from the autocomplete menu when typing @ so Telegram includes user IDs.`);
      return;
    }
    
    const totalMentions = mentionEntities.length + textMentions.length;
    if (totalMentions > 10) {
      await ctx.reply("Maximum 10 users can be vouched at once. Please split into multiple commands.");
      return;
    }
    
    const chatId = ctx.chat.id;
    const chatIdStr = String(chatId);
    const ownerId = String(ctx.from.id);
    
    const results: { success: string[]; alreadyVouched: string[]; notFound: string[]; created: string[]; errors: string[] } = {
      success: [],
      alreadyVouched: [],
      notFound: [],
      created: [],
      errors: []
    };
    
    await ctx.reply(`Processing ${totalMentions} users... This may take a moment.`);
    
    // Process text_mention entities (have user IDs - most reliable)
    for (const entity of mentionEntities) {
      const userId = String(entity.user.id);
      const username = entity.user.username;
      const firstName = entity.user.first_name;
      const displayName = username ? `@${username}` : firstName;
      
      try {
        // Create or get trust record
        const record = await ensureTrustRecord(userId, chatIdStr, username, firstName);
        
        if (!record) {
          results.errors.push(displayName);
          continue;
        }
        
        if (record.trustStatus === "vouched") {
          results.alreadyVouched.push(displayName);
          continue;
        }
        
        // Vouch the user
        await db.update(trustScores)
          .set({
            trustStatus: "vouched",
            isTrusted: true,
            trustLevel: Math.max(1, record.trustLevel || 0),
            trustScore: Math.max(25, record.trustScore || 0),
            isEligible: true,
            vouchedBy: ownerId,
            vouchedAt: new Date(),
          })
          .where(eq(trustScores.id, record.id));
        
        results.success.push(displayName);
      } catch (error) {
        console.error(`Error vouching ${displayName}:`, error);
        results.errors.push(displayName);
      }
    }
    
    // Process @username mentions (search database - Telegram API can't resolve usernames directly)
    const processedUsernames = new Set(mentionEntities.map(e => e.user?.username?.toLowerCase()).filter(Boolean));
    
    for (const mention of textMentions) {
      const username = mention.replace('@', '').toLowerCase();
      
      // Skip if already processed via text_mention entity
      if (processedUsernames.has(username)) continue;
      
      try {
        // Search database for user by username (case-insensitive)
        const existingRecords = await db.select().from(trustScores)
          .where(and(
            eq(trustScores.chatId, chatIdStr),
            sql`LOWER(${trustScores.username}) = ${username}`
          ))
          .limit(1);
        
        if (existingRecords.length === 0) {
          results.notFound.push(`@${username}`);
          continue;
        }
        
        const record = existingRecords[0];
        
        if (record.trustStatus === "vouched") {
          results.alreadyVouched.push(`@${username}`);
          continue;
        }
        
        // Vouch the user
        await db.update(trustScores)
          .set({
            trustStatus: "vouched",
            isTrusted: true,
            trustLevel: Math.max(1, record.trustLevel || 0),
            trustScore: Math.max(25, record.trustScore || 0),
            isEligible: true,
            vouchedBy: ownerId,
            vouchedAt: new Date(),
          })
          .where(eq(trustScores.id, record.id));
        
        results.success.push(`@${username}`);
      } catch (error) {
        console.error(`Error vouching @${username}:`, error);
        results.errors.push(`@${username}`);
      }
    }
    
    // Build summary message
    let summary = "BULK VOUCH RESULTS:\n\n";
    
    if (results.success.length > 0) {
      summary += `VOUCHED (${results.success.length}):\n${results.success.join(', ')}\n\n`;
    }
    
    if (results.alreadyVouched.length > 0) {
      summary += `Already Vouched (${results.alreadyVouched.length}):\n${results.alreadyVouched.join(', ')}\n\n`;
    }
    
    if (results.notFound.length > 0) {
      summary += `Not Found (${results.notFound.length}):\n${results.notFound.join(', ')}\n(TIP: Select from autocomplete when typing @, or have them message first)\n\n`;
    }
    
    if (results.errors.length > 0) {
      summary += `Errors (${results.errors.length}):\n${results.errors.join(', ')}\n`;
    }
    
    if (results.success.length === 0 && results.alreadyVouched.length === 0) {
      summary += "No users were vouched. Make sure to select usernames from Telegram's autocomplete menu.";
    }
    
    await ctx.reply(summary);
  });
  
  // /untrust @username - Remove trust status (OWNER ONLY)
  bot.command("untrust", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can remove trust status!");
      return;
    }
    
    let targetUserId: string | undefined;
    let targetFirstName: string | undefined;
    
    if (ctx.message?.reply_to_message?.from) {
      targetUserId = String(ctx.message.reply_to_message.from.id);
      targetFirstName = ctx.message.reply_to_message.from.first_name;
    } else {
      await ctx.reply("Usage: Reply to a user's message with /untrust to remove their trust status");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    
    await db.update(trustScores)
      .set({
        trustStatus: "none",
        isTrusted: false,
        trustLevel: 0,
        trustScore: 0,
        vouchedBy: null,
        vouchedAt: null,
      })
      .where(and(eq(trustScores.telegramUserId, targetUserId), eq(trustScores.chatId, chatId)));
    
    await ctx.reply(`${targetFirstName}'s trust status has been removed. They will need to earn trust from scratch.`);
  });
  
  // /trustfreeze @username [reason] - Freeze user's trust progress (OWNER ONLY)
  bot.command("trustfreeze", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can freeze trust!");
      return;
    }
    
    let targetUserId: string | undefined;
    let targetFirstName: string | undefined;
    
    if (ctx.message?.reply_to_message?.from) {
      targetUserId = String(ctx.message.reply_to_message.from.id);
      targetFirstName = ctx.message.reply_to_message.from.first_name;
    } else {
      await ctx.reply("Usage: Reply to a user's message with /trustfreeze [reason]");
      return;
    }
    
    const reason = ctx.message?.text?.replace("/trustfreeze", "").trim() || "No reason provided";
    const chatId = String(ctx.chat.id);
    
    await db.update(trustScores)
      .set({
        isFrozen: true,
        frozenBy: String(ctx.from.id),
        frozenAt: new Date(),
        frozenReason: reason,
      })
      .where(and(eq(trustScores.telegramUserId, targetUserId), eq(trustScores.chatId, chatId)));
    
    await ctx.reply(`${targetFirstName}'s trust progress has been FROZEN.

Reason: ${reason}

They cannot gain trust points until unfrozen with /trustunfreeze.`);
  });
  
  // /trustunfreeze @username - Unfreeze user's trust progress (OWNER ONLY)
  bot.command("trustunfreeze", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can unfreeze trust!");
      return;
    }
    
    let targetUserId: string | undefined;
    let targetFirstName: string | undefined;
    
    if (ctx.message?.reply_to_message?.from) {
      targetUserId = String(ctx.message.reply_to_message.from.id);
      targetFirstName = ctx.message.reply_to_message.from.first_name;
    } else {
      await ctx.reply("Usage: Reply to a user's message with /trustunfreeze");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    
    await db.update(trustScores)
      .set({
        isFrozen: false,
        frozenBy: null,
        frozenAt: null,
        frozenReason: null,
      })
      .where(and(eq(trustScores.telegramUserId, targetUserId), eq(trustScores.chatId, chatId)));
    
    await ctx.reply(`${targetFirstName}'s trust progress has been UNFROZEN. They can now earn trust points again.`);
  });
  
  // /trustboard - Show trust leaderboard
  bot.command("trustboard", async (ctx) => {
    if (!ctx.chat) return;
    
    const chatId = String(ctx.chat.id);
    
    const topTrusted = await db.select().from(trustScores)
      .where(and(eq(trustScores.chatId, chatId), eq(trustScores.isTrusted, true)))
      .orderBy(desc(trustScores.trustScore))
      .limit(10);
    
    if (topTrusted.length === 0) {
      await ctx.reply("No trusted members yet! Stick around, participate, and you could be the first!");
      return;
    }
    
    const levelEmojis = ["", "I", "II", "III"];
    let leaderboard = "TRUST LEADERBOARD\n\n";
    
    topTrusted.forEach((member, index) => {
      const medal = index === 0 ? "1." : index === 1 ? "2." : index === 2 ? "3." : `${index + 1}.`;
      const name = member.username ? `@${member.username}` : member.firstName || "Anonymous";
      const level = levelEmojis[member.trustLevel || 0];
      const status = member.trustStatus === "vouched" ? "(V)" : "";
      leaderboard += `${medal} ${name} - ${member.trustScore || 0}pts [Lv${level}] ${status}\n`;
    });
    
    leaderboard += "\n(V) = Vouched by owner";
    
    await ctx.reply(leaderboard);
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

  // Helper to ask the next question in a round
  async function askNextQuestion(chatId: number, bot: Bot<MyContext>) {
    const trivia = activeTrivias.get(chatId);
    if (!trivia) return;

    // Clear any existing timeout
    if (trivia.timeoutId) {
      clearTimeout(trivia.timeoutId);
    }

    // Check if round is complete
    if (trivia.currentIndex >= trivia.totalQuestions) {
      await endTriviaRound(chatId, bot);
      return;
    }

    // Get next question
    const question = await getTriviaQuestion(openai);
    trivia.currentQuestion = question;
    trivia.questionStartTime = Date.now();
    trivia.answeredCurrent = new Set();
    trivia.questionResolved = false;
    trivia.currentIndex++;

    const categoryLabel = question.category === 'cannabis' ? 'Cannabis' : question.category === 'crypto' ? 'Crypto' : 'Dudley Bud';
    const optionsText = question.options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
    
    await bot.api.sendMessage(chatId,
      `QUESTION ${trivia.currentIndex}/${trivia.totalQuestions} [${categoryLabel}]\n\n${question.question}\n\n${optionsText}\n\nAnswer with /answer 1-4 | Worth ${question.points} points | 45 seconds`
    );

    // Auto-advance after 45 seconds
    trivia.timeoutId = setTimeout(async () => {
      const current = activeTrivias.get(chatId);
      if (current && current.questionStartTime === trivia.questionStartTime) {
        try {
          await bot.api.sendMessage(chatId, `Time's up! The answer was: ${question.options[question.correctIndex]}`);
          await new Promise(r => setTimeout(r, 2000)); // 2 second pause
          await askNextQuestion(chatId, bot);
        } catch (e) {}
      }
    }, 45000);
  }

  // Helper to end a trivia round and show results
  async function endTriviaRound(chatId: number, bot: Bot<MyContext>) {
    const trivia = activeTrivias.get(chatId);
    if (!trivia) return;

    if (trivia.timeoutId) {
      clearTimeout(trivia.timeoutId);
    }

    // Build results
    const scores = Array.from(trivia.roundScoreboard.values())
      .sort((a, b) => b.points - a.points);

    let resultsText = `TRIVIA ROUND COMPLETE!\n\n`;
    if (scores.length === 0) {
      resultsText += "No one scored any points this round.";
    } else {
      resultsText += "ROUND RESULTS:\n";
      scores.slice(0, 10).forEach((s, i) => {
        const medal = i === 0 ? "[1st]" : i === 1 ? "[2nd]" : i === 2 ? "[3rd]" : `[${i + 1}]`;
        resultsText += `${medal} ${s.firstName}: ${s.points} pts (${s.correct}/${s.attempts})\n`;
      });
    }

    const duration = Math.round((Date.now() - trivia.roundStartTime) / 1000);
    resultsText += `\nRound duration: ${duration} seconds\nStart a new game with /trivia or /trivia 5`;

    await bot.api.sendMessage(chatId, resultsText);
    activeTrivias.delete(chatId);
  }

  // /trivia - Start a trivia round
  bot.command("trivia", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") {
      await ctx.reply("Trivia works best in group chats!");
      return;
    }

    // Check if there's already an active trivia
    const existing = activeTrivias.get(ctx.chat.id);
    if (existing) {
      await ctx.reply(`There's an active trivia round! Question ${existing.currentIndex}/${existing.totalQuestions}\nAnswer with /answer 1-4`);
      return;
    }

    // Parse question count from command
    const argText = ctx.message?.text?.replace("/trivia", "").trim();
    let questionCount = parseInt(argText || "") || 1;
    questionCount = Math.max(1, Math.min(25, questionCount)); // Clamp 1-25

    await ctx.reply(`Starting trivia round with ${questionCount} question${questionCount > 1 ? 's' : ''}...`);
    
    // Pre-fill cache in background
    prefillTriviaCache(openai).catch(() => {});

    // Get first question
    const firstQuestion = await getTriviaQuestion(openai);
    
    // Initialize round
    activeTrivias.set(ctx.chat.id, {
      currentQuestion: firstQuestion,
      questionStartTime: Date.now(),
      answeredCurrent: new Set(),
      questionResolved: false,
      totalQuestions: questionCount,
      currentIndex: 1,
      roundScoreboard: new Map(),
      roundStartTime: Date.now(),
    });

    const categoryLabel = firstQuestion.category === 'cannabis' ? 'Cannabis' : firstQuestion.category === 'crypto' ? 'Crypto' : 'Dudley Bud';
    const optionsText = firstQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join("\n");
    
    await ctx.reply(
      `QUESTION 1/${questionCount} [${categoryLabel}]\n\n${firstQuestion.question}\n\n${optionsText}\n\nAnswer with /answer 1-4 | Worth ${firstQuestion.points} points | 45 seconds`
    );

    // Auto-advance after 45 seconds
    const trivia = activeTrivias.get(ctx.chat.id)!;
    trivia.timeoutId = setTimeout(async () => {
      const current = activeTrivias.get(ctx.chat!.id);
      if (current && current.questionStartTime === trivia.questionStartTime) {
        try {
          await ctx.reply(`Time's up! The answer was: ${firstQuestion.options[firstQuestion.correctIndex]}`);
          await new Promise(r => setTimeout(r, 2000));
          await askNextQuestion(ctx.chat!.id, bot);
        } catch (e) {}
      }
    }, 45000);
  });

  // /answer - Answer the trivia question
  bot.command("answer", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const trivia = activeTrivias.get(ctx.chat.id);
    if (!trivia) {
      await ctx.reply("No active trivia! Start one with /trivia or /trivia 5");
      return;
    }

    // Check if question is already resolved (someone already got it right)
    if (trivia.questionResolved) {
      await ctx.reply("This question is already solved! Next question coming up...");
      return;
    }

    // Check if user already answered this question
    if (trivia.answeredCurrent.has(ctx.from.id)) {
      await ctx.reply("You already answered this question! Wait for the next one.");
      return;
    }

    const answerText = ctx.message?.text?.replace("/answer", "").trim();
    const answerNum = parseInt(answerText || "");
    
    if (isNaN(answerNum) || answerNum < 1 || answerNum > 4) {
      await ctx.reply("Please answer with /answer 1, /answer 2, /answer 3, or /answer 4");
      return;
    }

    trivia.answeredCurrent.add(ctx.from.id);
    
    const telegramUserId = ctx.from.id.toString();
    const chatIdStr = ctx.chat.id.toString();
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "Friend";

    // Get or create member score (persistent database)
    const score = await getOrCreateMemberScore(telegramUserId, chatIdStr, username, firstName);

    // Get or create round scoreboard entry
    let roundScore = trivia.roundScoreboard.get(ctx.from.id);
    if (!roundScore) {
      roundScore = { oderId: ctx.from.id, username, firstName, points: 0, correct: 0, attempts: 0 };
      trivia.roundScoreboard.set(ctx.from.id, roundScore);
    }

    const isCorrect = (answerNum - 1) === trivia.currentQuestion.correctIndex;
    roundScore.attempts++;
    
    if (isCorrect) {
      // Mark question as resolved to prevent race conditions
      trivia.questionResolved = true;
      
      // Award points
      const earnedPoints = trivia.currentQuestion.points;
      roundScore.points += earnedPoints;
      roundScore.correct++;

      // Update persistent database with daily/weekly/monthly tracking
      const newPoints = (score.triviaPoints || 0) + earnedPoints;
      const newCorrect = (score.triviaCorrect || 0) + 1;
      const newAttempts = (score.triviaAttempts || 0) + 1;
      
      // Get current date strings for period tracking
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const weekNum = getWeekNumber(now);
      const weekStr = `${now.getFullYear()}-W${weekNum}`;
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Calculate period points (reset if new period)
      const newDailyPoints = score.dailyResetDate === todayStr 
        ? (score.dailyPoints || 0) + earnedPoints 
        : earnedPoints;
      const newWeeklyPoints = score.weeklyResetDate === weekStr 
        ? (score.weeklyPoints || 0) + earnedPoints 
        : earnedPoints;
      const newMonthlyPoints = score.monthlyResetDate === monthStr 
        ? (score.monthlyPoints || 0) + earnedPoints 
        : earnedPoints;
      
      await db.update(memberScores)
        .set({ 
          triviaPoints: newPoints, 
          triviaCorrect: newCorrect, 
          triviaAttempts: newAttempts,
          dailyPoints: newDailyPoints,
          dailyResetDate: todayStr,
          weeklyPoints: newWeeklyPoints,
          weeklyResetDate: weekStr,
          monthlyPoints: newMonthlyPoints,
          monthlyResetDate: monthStr
        })
        .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatIdStr)));

      await ctx.reply(`CORRECT! ${firstName} earned ${earnedPoints} points! (Round: ${roundScore.points} pts)`);
      
      // Clear timeout and advance to next question
      if (trivia.timeoutId) {
        clearTimeout(trivia.timeoutId);
        trivia.timeoutId = undefined;
      }
      
      // Short delay then next question
      setTimeout(async () => {
        await askNextQuestion(ctx.chat!.id, bot);
      }, 2000);
    } else {
      // Wrong answer
      const newAttempts = (score.triviaAttempts || 0) + 1;
      await db.update(memberScores)
        .set({ triviaAttempts: newAttempts })
        .where(and(eq(memberScores.telegramUserId, telegramUserId), eq(memberScores.chatId, chatIdStr)));

      await ctx.reply(`Wrong! ${firstName}, try again or wait for the timer.`);
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

  // /play - Launch Space Bud Invaders game
  bot.command("play", async (ctx) => {
    if (!ctx.chat) return;
    
    // Seed Storm game URL
    const gameUrl = "https://t.me/SeedStormBot/SeedStorm";
    
    await ctx.reply(
      "SEED STORM\n\n" +
      "Help Dudley defend Earth from evil alien buds!\n" +
      "Blast waves of Purple Haze, Blue Dream, Orange Kush and more!\n\n" +
      "Controls:\n" +
      "- Tap left/right to move, center to shoot\n" +
      "- Desktop: Arrow keys + Space",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "PLAY NOW", url: gameUrl }
          ]]
        }
      }
    );
  });

  // /myreferrals - Get your referral link and stats
  bot.command("myreferrals", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const chatIdStr = chatId.toString();
    const userIdStr = userId.toString();
    
    try {
      // Get or create referral link
      const { link, code } = await getOrCreateReferralLink(bot, chatId, userId);
      
      // Get stats
      const stats = await getReferralStats(userIdStr, chatIdStr);
      
      const response = ctx.session.karenMode 
        ? karenResponse(`YOUR REFERRAL LINK

Share this link to invite friends:
${link}

Your Code: ${code}

STATS:
Confirmed Referrals: ${stats.confirmedReferrals}
Pending: ${stats.pendingReferrals}
Total Points: ${stats.totalPoints} pts
This Week: ${stats.weeklyPoints} pts

Each confirmed referral = ${REFERRAL_POINTS} points!

Check the leaderboard with /refboard`)
        : `YOUR REFERRAL LINK

Share this link to invite friends:
${link}

Your Code: ${code}

STATS:
Confirmed Referrals: ${stats.confirmedReferrals}
Pending: ${stats.pendingReferrals}
Total Points: ${stats.totalPoints} pts
This Week: ${stats.weeklyPoints} pts

Each confirmed referral = ${REFERRAL_POINTS} points!

Check the leaderboard with /refboard`;
      
      await ctx.reply(response);
    } catch (error: any) {
      await ctx.reply(error.message || "Couldn't create your referral link. I need admin permissions!");
    }
  });

  // /refboard - Referral leaderboard
  bot.command("refboard", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message?.text?.split(" ").slice(1) || [];
    const period = args[0]?.toLowerCase() === "all" || args[0]?.toLowerCase() === "alltime" ? "alltime" : "weekly";
    
    const leaderboard = await getReferralLeaderboard(chatId, period);
    
    if (leaderboard.length === 0) {
      await ctx.reply("No referrals yet! Be the first - get your link with /myreferrals");
      return;
    }
    
    const periodLabel = period === "weekly" ? "WEEKLY" : "ALL-TIME";
    let text = `REFERRAL LEADERBOARD (${periodLabel})\n\n`;
    
    leaderboard.forEach((entry) => {
      const medal = entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : entry.rank === 3 ? "3rd" : `${entry.rank}th`;
      const name = entry.username ? `@${entry.username}` : entry.firstName;
      text += `${medal}: ${name} - ${entry.points} pts (${entry.referrals} refs)\n`;
    });
    
    text += `\nUse /refboard all for all-time rankings`;
    text += `\nGet your link: /myreferrals`;
    
    await ctx.reply(ctx.session.karenMode ? karenResponse(text) : text);
  });

  // /leaderboard - Show daily leaderboard + weekly/monthly top winners
  bot.command("leaderboard", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const chatId = ctx.chat.id.toString();
    
    // Get current period strings
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekNum = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${weekNum}`;
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Get all scores for this chat
    const allScores = await db.select().from(memberScores)
      .where(eq(memberScores.chatId, chatId));
    
    if (allScores.length === 0) {
      await ctx.reply("No scores yet! Be the first to play /trivia");
      return;
    }
    
    // Filter for today's scores (only those who played today)
    const todayScores = allScores
      .filter(s => s.dailyResetDate === todayStr && (s.dailyPoints || 0) > 0)
      .sort((a, b) => (b.dailyPoints || 0) - (a.dailyPoints || 0))
      .slice(0, 10);
    
    // Find weekly top winner (only from this week)
    const weeklyScores = allScores
      .filter(s => s.weeklyResetDate === weekStr && (s.weeklyPoints || 0) > 0)
      .sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));
    const weeklyTop = weeklyScores.length > 0 ? weeklyScores[0] : null;
    
    // Find monthly top winner (only from this month)
    const monthlyScores = allScores
      .filter(s => s.monthlyResetDate === monthStr && (s.monthlyPoints || 0) > 0)
      .sort((a, b) => (b.monthlyPoints || 0) - (a.monthlyPoints || 0));
    const monthlyTop = monthlyScores.length > 0 ? monthlyScores[0] : null;
    
    // Build leaderboard message
    let text = "DAILY TRIVIA LEADERBOARD\n\n";
    
    if (todayScores.length > 0) {
      todayScores.forEach((s, i) => {
        const medal = i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;
        const name = s.username ? `@${s.username}` : s.firstName || "Anonymous";
        text += `${medal}: ${name} - ${s.dailyPoints} pts\n`;
      });
    } else {
      text += "No scores yet today! Start with /trivia\n";
    }
    
    text += "\n--- TOP WINNERS ---\n";
    
    // Weekly top
    if (weeklyTop) {
      const weekName = weeklyTop.username ? `@${weeklyTop.username}` : weeklyTop.firstName || "Anonymous";
      text += `\nWeek Champion: ${weekName} (${weeklyTop.weeklyPoints} pts)`;
    } else {
      text += "\nWeek Champion: None yet this week";
    }
    
    // Monthly top
    if (monthlyTop) {
      const monthName = monthlyTop.username ? `@${monthlyTop.username}` : monthlyTop.firstName || "Anonymous";
      text += `\nMonth Champion: ${monthName} (${monthlyTop.monthlyPoints} pts)`;
    } else {
      text += "\nMonth Champion: None yet this month";
    }
    
    await ctx.reply(text);
  });

  // /puzzle - Start a word puzzle game
  bot.command("puzzle", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") {
      await ctx.reply("Puzzle games work best in group chats!");
      return;
    }
    
    // Check for active puzzle
    const existing = activePuzzles.get(ctx.chat.id);
    if (existing && !existing.solved) {
      const timeLeft = Math.max(0, Math.ceil((existing.startTime + existing.timeLimit * 1000 - Date.now()) / 1000));
      await ctx.reply(`Active puzzle: ${existing.scrambled}\nTime left: ${timeLeft}s | Guess with /guess YOUR_ANSWER`);
      return;
    }
    
    // Parse difficulty
    const argText = ctx.message?.text?.replace("/puzzle", "").trim().toLowerCase();
    let difficulty: 'easy' | 'hard' = 'easy';
    if (argText === 'hard') {
      difficulty = 'hard';
    } else if (argText === 'easy') {
      difficulty = 'easy';
    } else if (argText) {
      difficulty = Math.random() < 0.5 ? 'easy' : 'hard';
    } else {
      difficulty = Math.random() < 0.5 ? 'easy' : 'hard';
    }
    
    const wordList = difficulty === 'easy' ? EASY_WORDS : HARD_WORDS;
    const word = getUnusedPuzzleWord(ctx.chat.id, wordList);
    const scrambled = scrambleWord(word);
    const timeLimit = difficulty === 'easy' ? 45 : 20;
    const points = difficulty === 'easy' ? 5 : 15;
    
    // Ensure user exists in database
    await getOrCreatePuzzleScore(
      ctx.from.id.toString(),
      ctx.chat.id.toString(),
      ctx.from.username || "",
      ctx.from.first_name || "Friend"
    );
    
    const chatId = ctx.chat.id;
    const puzzle: ActivePuzzle = {
      word,
      scrambled,
      difficulty,
      startTime: Date.now(),
      timeLimit,
      points,
      answeredUsers: new Set(),
      solved: false
    };
    
    activePuzzles.set(chatId, puzzle);
    
    await ctx.reply(
      `WORD PUZZLE [${difficulty.toUpperCase()}]\n\n` +
      `Unscramble: ${scrambled}\n\n` +
      `Worth ${points} points | ${timeLimit} seconds\n` +
      `Answer with: /guess YOUR_ANSWER`
    );
    
    // Timeout
    puzzle.timeoutId = setTimeout(async () => {
      const current = activePuzzles.get(chatId);
      if (current && !current.solved && current.startTime === puzzle.startTime) {
        current.solved = true;
        try {
          await ctx.api.sendMessage(chatId, `Time's up! The answer was: ${word}\n\nTry again with /puzzle or /puzzle hard`);
        } catch (e) {}
        activePuzzles.delete(chatId);
      }
    }, timeLimit * 1000);
  });

  // /guess - Guess the puzzle answer
  bot.command("guess", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const puzzle = activePuzzles.get(ctx.chat.id);
    if (!puzzle || puzzle.solved) {
      await ctx.reply("No active puzzle! Start one with /puzzle or /puzzle hard");
      return;
    }
    
    // Check if time expired
    if (Date.now() > puzzle.startTime + puzzle.timeLimit * 1000) {
      puzzle.solved = true;
      if (puzzle.timeoutId) clearTimeout(puzzle.timeoutId);
      await ctx.reply(`Time's up! The answer was: ${puzzle.word}`);
      activePuzzles.delete(ctx.chat.id);
      return;
    }
    
    const guessText = ctx.message?.text?.replace("/guess", "").trim().toUpperCase();
    if (!guessText) {
      await ctx.reply("Usage: /guess YOUR_ANSWER");
      return;
    }
    
    const telegramUserId = ctx.from.id.toString();
    const chatIdStr = ctx.chat.id.toString();
    const username = ctx.from.username || "";
    const firstName = ctx.from.first_name || "Friend";
    
    // Ensure user exists
    await getOrCreatePuzzleScore(telegramUserId, chatIdStr, username, firstName);
    
    // Check if already guessed wrong this round
    if (puzzle.answeredUsers.has(ctx.from.id)) {
      await ctx.reply("You already guessed this round! Wait for the next puzzle.");
      return;
    }
    
    if (guessText === puzzle.word) {
      // Correct!
      puzzle.solved = true;
      puzzle.solverName = firstName;
      if (puzzle.timeoutId) clearTimeout(puzzle.timeoutId);
      
      const timeSpent = Math.round((Date.now() - puzzle.startTime) / 1000);
      
      await updatePuzzleScore(telegramUserId, chatIdStr, puzzle.points);
      
      await ctx.reply(
        `CORRECT! ${firstName} solved it!\n\n` +
        `Answer: ${puzzle.word}\n` +
        `Time: ${timeSpent}s | Points: +${puzzle.points}\n\n` +
        `Play again with /puzzle or /puzzle hard`
      );
      
      activePuzzles.delete(ctx.chat.id);
    } else {
      // Wrong
      puzzle.answeredUsers.add(ctx.from.id);
      await incrementPuzzleAttempt(telegramUserId, chatIdStr);
      
      const timeLeft = Math.max(0, Math.ceil((puzzle.startTime + puzzle.timeLimit * 1000 - Date.now()) / 1000));
      await ctx.reply(`Wrong! Try again next puzzle. ${timeLeft}s remaining for others.`);
    }
  });

  // /puzzleboard - Show puzzle leaderboard
  bot.command("puzzleboard", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const chatId = ctx.chat.id.toString();
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekNum = getWeekNumberForPuzzle(now);
    const weekStr = `${now.getFullYear()}-W${weekNum}`;
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const allScores = await db.select().from(memberScores)
      .where(eq(memberScores.chatId, chatId));
    
    if (allScores.length === 0) {
      await ctx.reply("No puzzle scores yet! Start with /puzzle or /puzzle hard");
      return;
    }
    
    // Daily puzzle scores
    const todayScores = allScores
      .filter(s => s.puzzleDailyResetDate === todayStr && (s.puzzleDailyPoints || 0) > 0)
      .sort((a, b) => (b.puzzleDailyPoints || 0) - (a.puzzleDailyPoints || 0))
      .slice(0, 10);
    
    // Weekly top
    const weeklyScores = allScores
      .filter(s => s.puzzleWeeklyResetDate === weekStr && (s.puzzleWeeklyPoints || 0) > 0)
      .sort((a, b) => (b.puzzleWeeklyPoints || 0) - (a.puzzleWeeklyPoints || 0));
    const weeklyTop = weeklyScores.length > 0 ? weeklyScores[0] : null;
    
    // Monthly top
    const monthlyScores = allScores
      .filter(s => s.puzzleMonthlyResetDate === monthStr && (s.puzzleMonthlyPoints || 0) > 0)
      .sort((a, b) => (b.puzzleMonthlyPoints || 0) - (a.puzzleMonthlyPoints || 0));
    const monthlyTop = monthlyScores.length > 0 ? monthlyScores[0] : null;
    
    let text = "DAILY PUZZLE LEADERBOARD\n\n";
    
    if (todayScores.length > 0) {
      todayScores.forEach((s, i) => {
        const medal = i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;
        const name = s.username ? `@${s.username}` : s.firstName || "Anonymous";
        text += `${medal}: ${name} - ${s.puzzleDailyPoints} pts\n`;
      });
    } else {
      text += "No puzzle scores today! Start with /puzzle\n";
    }
    
    text += "\n--- TOP PUZZLE SOLVERS ---\n";
    
    if (weeklyTop) {
      const weekName = weeklyTop.username ? `@${weeklyTop.username}` : weeklyTop.firstName || "Anonymous";
      text += `\nWeek Champion: ${weekName} (${weeklyTop.puzzleWeeklyPoints} pts)`;
    } else {
      text += "\nWeek Champion: None yet this week";
    }
    
    if (monthlyTop) {
      const monthName = monthlyTop.username ? `@${monthlyTop.username}` : monthlyTop.firstName || "Anonymous";
      text += `\nMonth Champion: ${monthName} (${monthlyTop.puzzleMonthlyPoints} pts)`;
    } else {
      text += "\nMonth Champion: None yet this month";
    }
    
    await ctx.reply(text);
  });

  // === STORY GENERATOR ===
  
  // /story - Generate a random Dudleyverse story
  bot.command("story", async (ctx) => {
    if (!ctx.from) return;
    
    const username = ctx.from.username || ctx.from.first_name || "friend";
    const story = StoryBible.generateRandomStory(username);
    
    await ctx.reply(`Alright ${username}, gather 'round for today's tale...\n\n${story}\n\nClassic Dudleyverse chaos, sweetie.`);
  });

  // === BANLIST COMMAND (Owner Only) ===
  
  // /banlist - View all banned/kicked users
  bot.command("banlist", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can view the ban list!");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    
    // Get all ban events for this chat
    const events = await db.select().from(banEvents)
      .where(eq(banEvents.chatId, chatId))
      .orderBy(desc(banEvents.createdAt))
      .limit(50);
    
    if (events.length === 0) {
      await ctx.reply("No bans or kicks recorded for this chat yet!");
      return;
    }
    
    let text = "BAN/KICK HISTORY (Last 50)\n\n";
    
    for (const event of events) {
      const name = event.username ? `@${event.username}` : event.firstName || "Unknown";
      const date = event.createdAt ? new Date(event.createdAt).toLocaleDateString() : "Unknown date";
      const actor = event.actorUsername ? `@${event.actorUsername}` : "System";
      text += `${event.actionType?.toUpperCase()}: ${name}\n`;
      text += `  By: ${actor} | ${date}\n`;
      if (event.reason) text += `  Reason: ${event.reason}\n`;
      text += "\n";
    }
    
    await ctx.reply(text);
  });

  // === TRUST MANAGEMENT (Owner + @TreeFitty Only) ===
  
  // /trustset @user level1|level2|full - Set trust level
  bot.command("trustset", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    // Check if user can manage trust (owner or @TreeFitty)
    const username = ctx.from.username || "";
    const canManage = await isOwner(ctx) || StoryBible.canManageTrust(username);
    
    if (!canManage) {
      await ctx.reply("Only the owner and designated admins can manage trust levels!");
      return;
    }
    
    // Parse command: /trustset @username level
    const text = ctx.message?.text || "";
    const parts = text.replace("/trustset", "").trim().split(/\s+/);
    
    let targetUserId: string | undefined;
    let targetUsername: string | undefined;
    let targetFirstName: string | undefined;
    let level = parts[parts.length - 1]?.toLowerCase();
    
    // Get target from reply or mention
    if (ctx.message?.reply_to_message?.from) {
      targetUserId = String(ctx.message.reply_to_message.from.id);
      targetUsername = ctx.message.reply_to_message.from.username;
      targetFirstName = ctx.message.reply_to_message.from.first_name;
    } else {
      await ctx.reply("Usage: Reply to a user's message with /trustset level1|level2|full");
      return;
    }
    
    if (!["level1", "level2", "full"].includes(level)) {
      await ctx.reply("Invalid level! Use: level1, level2, or full\n\nExample: /trustset level2");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    const scoreMap: Record<string, number> = { level1: 25, level2: 50, full: 75 };
    const levelMap: Record<string, number> = { level1: 1, level2: 2, full: 3 };
    
    const newScore = scoreMap[level];
    const newLevel = levelMap[level];
    
    // Update or create trust record
    const existing = await db.select().from(trustScores)
      .where(and(
        eq(trustScores.telegramUserId, targetUserId),
        eq(trustScores.chatId, chatId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(trustScores)
        .set({
          trustScore: newScore,
          trustLevel: newLevel,
          trustStatus: "vouched",
          isTrusted: true,
          isEligible: true,
          vouchedBy: String(ctx.from.id),
          vouchedAt: new Date(),
          lastTrustUpdate: new Date()
        })
        .where(and(
          eq(trustScores.telegramUserId, targetUserId),
          eq(trustScores.chatId, chatId)
        ));
    } else {
      await db.insert(trustScores).values({
        telegramUserId: targetUserId,
        chatId,
        username: targetUsername,
        firstName: targetFirstName,
        trustScore: newScore,
        trustLevel: newLevel,
        trustStatus: "vouched",
        isTrusted: true,
        isEligible: true,
        vouchedBy: String(ctx.from.id),
        vouchedAt: new Date()
      });
    }
    
    const name = targetUsername ? `@${targetUsername}` : targetFirstName || "User";
    await ctx.reply(`${name} has been set to trust ${level} (${newScore} pts)!\n\nNote: They still must follow all community rules. Rule violations will still affect their trust.`);
  });

  // /trustremove @user level1|level2|all - Remove trust
  bot.command("trustremove", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const username = ctx.from.username || "";
    const canManage = await isOwner(ctx) || StoryBible.canManageTrust(username);
    
    if (!canManage) {
      await ctx.reply("Only the owner and designated admins can manage trust levels!");
      return;
    }
    
    const text = ctx.message?.text || "";
    const parts = text.replace("/trustremove", "").trim().split(/\s+/);
    
    let targetUserId: string | undefined;
    let targetUsername: string | undefined;
    let targetFirstName: string | undefined;
    let level = parts[parts.length - 1]?.toLowerCase();
    
    if (ctx.message?.reply_to_message?.from) {
      targetUserId = String(ctx.message.reply_to_message.from.id);
      targetUsername = ctx.message.reply_to_message.from.username;
      targetFirstName = ctx.message.reply_to_message.from.first_name;
    } else {
      await ctx.reply("Usage: Reply to a user's message with /trustremove level1|level2|all");
      return;
    }
    
    if (!["level1", "level2", "all"].includes(level)) {
      await ctx.reply("Invalid level! Use: level1, level2, or all\n\nExample: /trustremove all");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    
    const existing = await db.select().from(trustScores)
      .where(and(
        eq(trustScores.telegramUserId, targetUserId),
        eq(trustScores.chatId, chatId)
      ))
      .limit(1);
    
    if (existing.length === 0) {
      await ctx.reply("This user has no trust record to modify!");
      return;
    }
    
    const current = existing[0];
    let newScore = current.trustScore || 0;
    
    if (level === "all") {
      newScore = 0;
    } else if (level === "level1") {
      newScore = Math.max(0, newScore - 25);
    } else if (level === "level2") {
      newScore = Math.max(0, newScore - 50);
    }
    
    const newLevel = newScore >= 75 ? 3 : newScore >= 50 ? 2 : newScore >= 25 ? 1 : 0;
    const newStatus = newScore > 0 ? "earned" : "none";
    
    await db.update(trustScores)
      .set({
        trustScore: newScore,
        trustLevel: newLevel,
        trustStatus: newStatus,
        isTrusted: newScore >= 25,
        vouchedBy: null,
        vouchedAt: null,
        lastTrustUpdate: new Date()
      })
      .where(and(
        eq(trustScores.telegramUserId, targetUserId),
        eq(trustScores.chatId, chatId)
      ));
    
    const name = targetUsername ? `@${targetUsername}` : targetFirstName || "User";
    await ctx.reply(`${name}'s trust has been reduced. New score: ${newScore} pts (Level ${newLevel})`);
  });

  // === RARE STRAIN AVATAR SYSTEM (Namast-Hay Legendary - Max 7 Ever) ===
  
  // /budify - Owner-only command to create legendary Namast-Hay strain avatar
  bot.command("budify", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    
    // Owner-only check
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the owner can bestow legendary Namast-Hay strain avatars!");
      return;
    }
    
    // Get target user from reply
    const targetUser = ctx.message?.reply_to_message?.from;
    if (!targetUser) {
      await ctx.reply("Reply to a user's message to grant them a Namast-Hay legendary avatar!");
      return;
    }
    
    const chatId = String(ctx.chat.id);
    const targetUserId = String(targetUser.id);
    const targetUsername = targetUser.username;
    const targetFirstName = targetUser.first_name;
    
    // Check global strain limit
    const limits = await db.select().from(rareStrainLimits)
      .where(eq(rareStrainLimits.strainName, "namast_hay"))
      .limit(1);
    
    let usedCount = 0;
    const maxSupply = 7;
    
    if (limits.length > 0) {
      usedCount = limits[0].usedCount || 0;
    } else {
      // Initialize the strain limit record (first run) with usedCount=0
      await db.insert(rareStrainLimits).values({
        strainName: "namast_hay",
        maxSupply: maxSupply,
        usedCount: 0,
        remainingCount: maxSupply
      });
      usedCount = 0;
    }
    
    if (usedCount >= maxSupply) {
      await ctx.reply(`LEGENDARY LIMIT REACHED\n\nAll ${maxSupply} Namast-Hay legendary strain avatars have been bestowed. No more can ever be created!\n\nThese are the rarest avatars in the Dudleyverse.`);
      return;
    }
    
    // Check if user already has a rare strain
    const existing = await db.select().from(rareStrainRecipients)
      .where(and(
        eq(rareStrainRecipients.recipientUserId, targetUserId),
        eq(rareStrainRecipients.strainName, "namast_hay")
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await ctx.reply(`This user already has a Namast-Hay legendary avatar!`);
      return;
    }
    
    // Create the rare strain record
    await db.insert(rareStrainRecipients).values({
      recipientUserId: targetUserId,
      recipientUsername: targetUsername,
      strainName: "namast_hay",
      awardedBy: String(ctx.from.id)
    });
    
    // Update the global count
    const newUsedCount = usedCount + 1;
    const newRemainingCount = maxSupply - newUsedCount;
    await db.update(rareStrainLimits)
      .set({ 
        usedCount: newUsedCount,
        remainingCount: newRemainingCount,
        lastUsedAt: new Date()
      })
      .where(eq(rareStrainLimits.strainName, "namast_hay"));
    
    const remaining = newRemainingCount;
    const name = targetUsername ? `@${targetUsername}` : targetFirstName || "User";
    
    await ctx.reply(`LEGENDARY AVATAR BESTOWED\n\n${name} has been granted a NAMAST-HAY legendary strain avatar!\n\nThis is one of only ${maxSupply} that can ever exist.\nRemaining: ${remaining}\n\nWear it with pride in the Dudleyverse!`);
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
      
      // Log ban event to database
      await db.insert(banEvents).values({
        chatId: String(ctx.chat.id),
        telegramUserId: String(targetUser.id),
        username: targetUser.username,
        firstName: targetUser.first_name,
        actionType: "ban",
        reason: "Admin command",
        actorId: String(ctx.from.id),
        actorUsername: ctx.from.username,
        executionSource: "admin"
      });
      
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
      
      // Log kick event to database
      await db.insert(banEvents).values({
        chatId: String(ctx.chat.id),
        telegramUserId: String(targetUser.id),
        username: targetUser.username,
        firstName: targetUser.first_name,
        actionType: "kick",
        reason: "Admin command",
        actorId: String(ctx.from.id),
        actorUsername: ctx.from.username,
        executionSource: "admin"
      });
      
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

  // /budify - Admin command to create bud avatar for a user
  bot.command("budify", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const adminCheck = await isAdmin(ctx);
    if (!adminCheck) {
      await ctx.reply("Only admins can create bud avatars!");
      return;
    }
    
    // Check rolling 24-hour limit
    const currentUsage = getBudifyUsageCount();
    if (currentUsage >= MAX_DAILY_BUDIFY) {
      await ctx.reply(`/budify limit reached (${MAX_DAILY_BUDIFY} per 24 hours). Try again later!`);
      return;
    }
    
    // Get username from command or reply
    let targetUsername = ctx.message?.text?.replace("/budify", "").trim().replace("@", "");
    
    // If no username provided, check if replying to someone
    if (!targetUsername && ctx.message?.reply_to_message?.from) {
      targetUsername = ctx.message.reply_to_message.from.username || ctx.message.reply_to_message.from.first_name || "";
    }
    
    if (!targetUsername) {
      await ctx.reply("Usage: /budify @username\nOr reply to someone's message with /budify");
      return;
    }
    
    recordBudifyUsage(); // Record timestamp before generation
    
    // Check if owner is creating (owner gets chance for exclusive Namast-Hay strain)
    const ownerCreating = await isOwner(ctx);
    console.log(`Creating /budify avatar for ${targetUsername} (${getBudifyUsageCount()}/${MAX_DAILY_BUDIFY} in last 24h)${ownerCreating ? ' [OWNER - Namast-Hay eligible]' : ''}`);
    
    await ctx.reply(`Creating bud avatar for ${targetUsername}... This takes a moment!`);
    
    try {
      const { imageBuffer, strain, nickname, funnyComment } = await generateBudAvatar(targetUsername, ownerCreating);
      
      const caption = `BUD AVATAR UNLOCKED!\n\n` +
        `@${targetUsername} is now...\n` +
        `"${nickname}"\n\n` +
        `Strain: ${strain.name}\n` +
        `Color: ${strain.color.toUpperCase()}\n\n` +
        `${funnyComment}`;
      
      if (imageBuffer) {
        await ctx.replyWithPhoto(new InputFile(imageBuffer, `${targetUsername}_bud.png`), { caption });
      } else {
        await ctx.reply(`${caption}\n\n(Image generation failed, but the vibes are still immaculate!)`);
      }
    } catch (error) {
      console.error("Budify error:", error);
      await ctx.reply("Couldn't create bud avatar right now. Try again later!");
    }
  });

  // /restore - Owner-only: Restore suspended referrer's posting rights
  bot.command("restore", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can use this command.");
      return;
    }
    
    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();
    
    // Get username from command or reply
    const targetUser = ctx.message?.reply_to_message?.from;
    const usernameArg = ctx.message?.text?.replace("/restore", "").trim().replace("@", "");
    
    if (!targetUser && !usernameArg) {
      await ctx.reply("Usage: /restore @username\nOr reply to someone's message with /restore\n\nThis restores posting rights for a suspended referrer.");
      return;
    }
    
    if (targetUser) {
      // Restore via reply
      const userId = targetUser.id.toString();
      
      // Unsuspend the referrer
      await db.update(referrerStatus)
        .set({ isSuspended: false, suspendReason: null })
        .where(and(
          eq(referrerStatus.telegramUserId, userId),
          eq(referrerStatus.chatId, chatIdStr)
        ));
      
      // Unmute the user
      await unmuteUser(ctx, targetUser.id);
      
      await ctx.reply(`${targetUser.first_name}'s posting rights have been restored!`);
    } else if (usernameArg) {
      // Restore via @username - look up the user in memberScores by username
      const userRecord = await db.select().from(memberScores)
        .where(and(
          eq(memberScores.chatId, chatIdStr),
          eq(memberScores.username, usernameArg)
        ))
        .limit(1);
      
      if (userRecord.length === 0) {
        await ctx.reply(`Couldn't find @${usernameArg} in this chat. Try replying to one of their messages instead.`);
        return;
      }
      
      const userId = userRecord[0].telegramUserId;
      const firstName = userRecord[0].firstName || usernameArg;
      
      // Unsuspend the referrer
      await db.update(referrerStatus)
        .set({ isSuspended: false, suspendReason: null })
        .where(and(
          eq(referrerStatus.telegramUserId, userId),
          eq(referrerStatus.chatId, chatIdStr)
        ));
      
      // Unmute the user by ID
      try {
        await ctx.api.restrictChatMember(chatId, parseInt(userId), {
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
      } catch (e) {
        console.log(`Failed to unmute ${usernameArg}:`, e);
      }
      
      await ctx.reply(`@${usernameArg}'s posting rights have been restored!`);
    }
  });

  // /purge_referrals - Owner-only: Kick all users referred by a specific person
  bot.command("purge_referrals", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const ownerCheck = await isOwner(ctx);
    if (!ownerCheck) {
      await ctx.reply("Only the group owner can use this command.");
      return;
    }
    
    // Get referrer from reply
    const targetUser = ctx.message?.reply_to_message?.from;
    
    if (!targetUser) {
      await ctx.reply("Usage: Reply to a message from the referrer you want to purge, then type /purge_referrals\n\nThis will kick all users they referred.");
      return;
    }
    
    const referrerId = targetUser.id.toString();
    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();
    
    // Find all referrals by this person
    const referralsByPerson = await db.select().from(referrals)
      .where(and(
        eq(referrals.referrerTelegramUserId, referrerId),
        eq(referrals.chatId, chatIdStr)
      ));
    
    if (referralsByPerson.length === 0) {
      await ctx.reply(`${targetUser.first_name} hasn't referred anyone.`);
      return;
    }
    
    await ctx.reply(`Purging ${referralsByPerson.length} referrals from ${targetUser.first_name}...`);
    
    let kicked = 0;
    let failed = 0;
    
    for (const ref of referralsByPerson) {
      try {
        const referredUserId = parseInt(ref.referredTelegramUserId);
        await ctx.api.banChatMember(chatId, referredUserId);
        await ctx.api.unbanChatMember(chatId, referredUserId);
        
        // Mark as purged
        await db.update(referrals)
          .set({ status: "kicked", flagReason: "Purged by owner" })
          .where(eq(referrals.id, ref.id));
        
        kicked++;
      } catch (e) {
        failed++;
      }
    }
    
    // Suspend the referrer
    await db.update(referrerStatus)
      .set({ 
        isSuspended: true, 
        suspendedAt: sql`CURRENT_TIMESTAMP`,
        suspendReason: "All referrals purged by owner"
      })
      .where(and(
        eq(referrerStatus.telegramUserId, referrerId),
        eq(referrerStatus.chatId, chatIdStr)
      ));
    
    // Mute the referrer
    await ctx.api.restrictChatMember(chatId, targetUser.id, {
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
    });
    
    await ctx.reply(
      `PURGE COMPLETE\n\n` +
      `Kicked: ${kicked}\n` +
      `Failed: ${failed}\n\n` +
      `${targetUser.first_name} has been muted and their referral privileges suspended.\n` +
      `Use /restore to restore their rights if needed.`
    );
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
      await ctx.reply("What would you like to know? Use: /ask [your question]\n\nExamples:\n- /ask what's bitcoin worth?\n- /ask cannabis brownie recipe\n- /ask how does the referral program work?");
      return;
    }
    
    // Check for referral questions first - instant response, no AI needed
    const { isReferral, response: referralResponse } = detectReferralQuery(question);
    if (isReferral && referralResponse) {
      await ctx.reply(referralResponse);
      return;
    }
    
    // Check for games questions - instant response
    const { isGames, response: gamesResponse } = detectGamesQuery(question);
    if (isGames && gamesResponse) {
      await ctx.reply(gamesResponse);
      return;
    }
    
    // Check for "karen recipe" - fetch a random recipe from collection
    if (detectRecipeKeyword(question)) {
      await ctx.reply("Let me grab a recipe for you from the kitchen...");
      const recipe = getRandomRecipe();
      const formattedRecipe = formatRecipePost(recipe);
      await ctx.reply(formattedRecipe + RECIPE_DISCLAIMER);
      return;
    }
    
    // Check query types BEFORE cache check (crypto needs live data)
    const { isCrypto, tokens } = detectCryptoQuery(question);
    const { isRecipe, isMedical } = detectCannabisQuery(question);
    
    // Skip cache for crypto queries (need live prices) and recipe generation
    const skipCache = isCrypto || isRecipe;
    
    // Check Q&A cache first for non-crypto/recipe questions
    if (!skipCache) {
      const cached = await findCachedAnswer(question);
      if (cached) {
        await ctx.reply(cached.answer + "\n\n[From Karen's brain - asked " + cached.askCount + " times]");
        return;
      }
    }
    
    await ctx.reply("Thinking...");
    
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
    
    // Cache the response for future use (only for non-crypto/recipe questions)
    if (!skipCache && aiResponse) {
      await cacheAnswer(question, aiResponse);
    }
    
    await ctx.reply(fullResponse);
  });

  // === MODERATION COMMANDS ===

  // /mute - Mute a user (admin/mod only)
  bot.command("mute", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") {
      await ctx.reply("This command only works in groups.");
      return;
    }
    
    // Check if caller can moderate (admin or mod role)
    const chatIdStr = String(ctx.chat.id);
    const callerCanMod = await canUserModerate(ctx, ctx.from.id, chatIdStr);
    if (!callerCanMod) {
      await ctx.reply("Only admins and mods can use this command.");
      return;
    }
    
    // Get mentioned user or replied-to user
    const replyTo = ctx.message?.reply_to_message?.from;
    const args = ctx.message?.text?.split(/\s+/) || [];
    let targetUserId: number | null = null;
    let duration = 3600; // Default 1 hour
    let reason = "Muted by admin";
    
    if (replyTo) {
      targetUserId = replyTo.id;
      // Parse duration from args if provided: /mute 1h reason
      if (args[1]) {
        const durationMatch = args[1].match(/^(\d+)([mhd])$/i);
        if (durationMatch) {
          const num = parseInt(durationMatch[1]);
          const unit = durationMatch[2].toLowerCase();
          if (unit === 'm') duration = num * 60;
          else if (unit === 'h') duration = num * 3600;
          else if (unit === 'd') duration = num * 86400;
          reason = args.slice(2).join(" ") || reason;
        } else {
          reason = args.slice(1).join(" ") || reason;
        }
      }
    } else {
      await ctx.reply("Reply to a user's message to mute them.\nUsage: /mute [duration] [reason]\nDuration: 30m, 1h, 1d");
      return;
    }
    
    // Don't mute admins
    const targetIsAdmin = await isUserAdmin(ctx, targetUserId);
    if (targetIsAdmin) {
      await ctx.reply("Cannot mute an admin.");
      return;
    }
    
    const targetUsername = replyTo?.username || replyTo?.first_name || `User ${targetUserId}`;
    const success = await muteUser(ctx, targetUserId, duration, reason, targetUsername);
    if (success) {
      const durationStr = duration < 3600 ? `${Math.round(duration/60)} minutes` : 
                          duration < 86400 ? `${Math.round(duration/3600)} hour(s)` :
                          `${Math.round(duration/86400)} day(s)`;
      await ctx.reply(`User muted for ${durationStr}.\nReason: ${reason}`);
    } else {
      await ctx.reply("Failed to mute user. Make sure I have the right permissions.");
    }
  });

  // /unmute - Unmute a user (admin/mod only)
  bot.command("unmute", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const chatIdStr = String(ctx.chat.id);
    const callerCanMod = await canUserModerate(ctx, ctx.from.id, chatIdStr);
    if (!callerCanMod) {
      await ctx.reply("Only admins and mods can use this command.");
      return;
    }
    
    const replyTo = ctx.message?.reply_to_message?.from;
    if (!replyTo) {
      await ctx.reply("Reply to a user's message to unmute them.");
      return;
    }
    
    const success = await unmuteUser(ctx, replyTo.id);
    if (success) {
      await ctx.reply(`User @${replyTo.username || replyTo.first_name} has been unmuted.`);
    } else {
      await ctx.reply("Failed to unmute user.");
    }
  });

  // /warn - Warn a user
  bot.command("warn", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const chatIdStr = String(ctx.chat.id);
    const callerCanMod = await canUserModerate(ctx, ctx.from.id, chatIdStr);
    if (!callerCanMod) {
      await ctx.reply("Only admins and mods can use this command.");
      return;
    }
    
    const replyTo = ctx.message?.reply_to_message?.from;
    if (!replyTo) {
      await ctx.reply("Reply to a user's message to warn them.");
      return;
    }
    
    const reason = ctx.message?.text?.replace(/^\/warn\s*/i, '') || "Breaking community rules";
    
    // Update warn count in database
    await ensureUserModerationStatus(String(replyTo.id), chatIdStr);
    const status = await getUserModerationStatus(String(replyTo.id), chatIdStr);
    const newWarnCount = (status?.warnCount || 0) + 1;
    
    await db.update(userModerationStatus)
      .set({
        warnCount: newWarnCount,
        lastWarnDate: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(
        eq(userModerationStatus.telegramUserId, String(replyTo.id)),
        eq(userModerationStatus.chatId, chatIdStr)
      ));
    
    await incrementModStat(chatIdStr, 'warnCount');
    
    // Auto-mute after 3 warnings
    if (newWarnCount >= 3) {
      const targetIsAdmin = await isUserAdmin(ctx, replyTo.id);
      if (!targetIsAdmin) {
        const warnedUsername = replyTo.username || replyTo.first_name || `User ${replyTo.id}`;
        await muteUser(ctx, replyTo.id, 3600, "3 warnings received", warnedUsername);
        await ctx.reply(`⚠️ @${replyTo.username || replyTo.first_name} - Warning #${newWarnCount}\nReason: ${reason}\n\nYou have been automatically muted for 1 hour due to receiving 3 warnings.`);
      }
    } else {
      await ctx.reply(`⚠️ @${replyTo.username || replyTo.first_name} - Warning #${newWarnCount}/3\nReason: ${reason}\n\n3 warnings = 1 hour mute`);
    }
  });

  // /raidmode - Toggle anti-raid mode (admin only)
  bot.command("raidmode", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const callerIsAdmin = await isUserAdmin(ctx, ctx.from.id);
    if (!callerIsAdmin) {
      await ctx.reply("Only admins can use this command.");
      return;
    }
    
    const chatIdStr = String(ctx.chat.id);
    const args = ctx.message?.text?.split(/\s+/) || [];
    const action = args[1]?.toLowerCase();
    
    // Get current settings
    const settings = await getChatSettings(chatIdStr);
    
    if (action === "on") {
      // Enable raid mode
      const existing = await db.select().from(chatModerationSettings)
        .where(eq(chatModerationSettings.chatId, chatIdStr))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(chatModerationSettings)
          .set({
            raidModeEnabled: true,
            raidModeEnabledAt: sql`CURRENT_TIMESTAMP`,
            raidModeEnabledBy: String(ctx.from.id),
          })
          .where(eq(chatModerationSettings.chatId, chatIdStr));
      } else {
        await db.insert(chatModerationSettings).values({
          chatId: chatIdStr,
          raidModeEnabled: true,
          raidModeEnabledAt: new Date(),
          raidModeEnabledBy: String(ctx.from.id),
        });
      }
      
      // Clear cache to force refresh
      chatSettingsCache.delete(chatIdStr);
      
      await ctx.reply(`🚨 *RAID MODE ACTIVATED*\n\n` +
        `Anti-raid protections enabled:\n` +
        `• New users cannot post links\n` +
        `• Stricter spam thresholds\n` +
        `• Enhanced scam detection\n\n` +
        `Use /raidmode off to disable.`, { parse_mode: "Markdown" });
    } else if (action === "off") {
      // Disable raid mode
      await db.update(chatModerationSettings)
        .set({ raidModeEnabled: false })
        .where(eq(chatModerationSettings.chatId, chatIdStr));
      
      chatSettingsCache.delete(chatIdStr);
      
      await ctx.reply(`✅ Raid mode disabled. Normal moderation settings restored.`);
    } else {
      // Show current status
      await ctx.reply(`*Raid Mode Status:* ${settings.raidMode ? "🚨 ACTIVE" : "✅ Inactive"}\n\n` +
        `Usage:\n` +
        `/raidmode on - Enable anti-raid protections\n` +
        `/raidmode off - Disable anti-raid protections`, { parse_mode: "Markdown" });
    }
  });

  // /modstats - Show moderation statistics (admin only)
  bot.command("modstats", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const callerIsAdmin = await isUserAdmin(ctx, ctx.from.id);
    if (!callerIsAdmin) {
      await ctx.reply("Only admins can view moderation stats.");
      return;
    }
    
    const chatIdStr = String(ctx.chat.id);
    const args = ctx.message?.text?.split(/\s+/) || [];
    const period = args[1]?.toLowerCase() === "week" ? 7 : 1;
    
    const stats = await getModStats(chatIdStr, period);
    const periodLabel = period === 7 ? "This Week" : "Today";
    
    await ctx.reply(`📊 *Moderation Stats - ${periodLabel}*\n\n` +
      `👋 New Joins: ${stats.newJoins}\n` +
      `🚫 Messages Blocked: ${stats.messagesBlocked}\n` +
      `📵 Spam Blocked: ${stats.spamBlocked}\n` +
      `⚠️ Scams Blocked: ${stats.scamsBlocked}\n` +
      `🔗 Links Blocked: ${stats.linksBlocked}\n` +
      `🔇 Users Muted: ${stats.muteCount}\n` +
      `⚠️ Warnings Given: ${stats.warnCount}\n` +
      `🏳️ Flagged for Review: ${stats.flaggedForReview}\n\n` +
      `_Use /modstats week for weekly stats_`, { parse_mode: "Markdown" });
  });

  // /setrole - Set a user's role (admin only)
  bot.command("setrole", async (ctx) => {
    if (!ctx.chat || !ctx.from) return;
    if (ctx.chat.type === "private") return;
    
    const callerIsAdmin = await isUserAdmin(ctx, ctx.from.id);
    if (!callerIsAdmin) {
      await ctx.reply("Only admins can set roles.");
      return;
    }
    
    const replyTo = ctx.message?.reply_to_message?.from;
    const args = ctx.message?.text?.split(/\s+/) || [];
    const role = args[1]?.toLowerCase();
    
    if (!replyTo) {
      await ctx.reply("Reply to a user's message to set their role.\nUsage: /setrole <role>\nRoles: admin, mod, helper, verified, newbie");
      return;
    }
    
    const validRoles = ["admin", "mod", "helper", "verified", "newbie"];
    if (!role || !validRoles.includes(role)) {
      await ctx.reply(`Invalid role. Choose from: ${validRoles.join(", ")}`);
      return;
    }
    
    const chatIdStr = String(ctx.chat.id);
    await ensureUserModerationStatus(String(replyTo.id), chatIdStr);
    
    await db.update(userModerationStatus)
      .set({ role })
      .where(and(
        eq(userModerationStatus.telegramUserId, String(replyTo.id)),
        eq(userModerationStatus.chatId, chatIdStr)
      ));
    
    await ctx.reply(`✅ @${replyTo.username || replyTo.first_name}'s role set to: ${role}`);
  });

  // === END MODERATION COMMANDS ===

  // === NEW MEMBER HANDLER ===
  bot.on("message:new_chat_members", async (ctx) => {
    for (const member of ctx.message.new_chat_members) {
      const name = member.first_name || "friend";
      const username = member.username || "";
      const fullName = `${member.first_name || ""} ${member.last_name || ""}`.trim();
      const chatId = ctx.chat.id;
      const chatIdStr = chatId.toString();
      const newMemberId = member.id.toString();

      // Check for contract addresses in username or name
      // Ethereum/Base pattern: 0x followed by 40 hex chars
      // Also check for partial addresses that scammers use
      const contractAddressPattern = /0x[a-fA-F0-9]{8,40}/i;
      const checkStrings = [username, fullName, member.first_name || "", member.last_name || ""];
      const hasContractAddress = checkStrings.some(str => contractAddressPattern.test(str));
      
      if (hasContractAddress) {
        try {
          // Kick user with contract address in name
          await ctx.api.banChatMember(chatId, member.id);
          // Immediately unban so they can rejoin with a proper name
          await ctx.api.unbanChatMember(chatId, member.id);
          
          // Notify admins
          const admins = await ctx.api.getChatAdministrators(chatId);
          const adminMentions = admins
            .filter(a => !a.user.is_bot)
            .slice(0, 3)
            .map(a => a.user.username ? `@${a.user.username}` : a.user.first_name)
            .join(", ");
          
          await ctx.reply(
            `🚫 *BLOCKED* ${adminMentions}\n\n` +
            `User with contract address in name was removed:\n` +
            `Name: ${fullName}\n` +
            `Username: @${username || "none"}\n\n` +
            `Karen doesn't play with scammers!`,
            { parse_mode: "Markdown" }
          );
          
          await incrementModStat(chatIdStr, 'scamsBlocked');
          continue; // Skip rest of welcome for this blocked user
        } catch (kickErr) {
          console.log("Couldn't kick user with contract address:", kickErr);
          await ctx.reply(`⚠️ Warning: User @${username || name} has a contract address in their name. Admins please verify!`);
        }
      }

      const { isScam, flags } = detectScam("", username);

      if (isScam) {
        await ctx.reply(`Warning: New member @${username} has suspicious indicators:\n${flags.join("\n")}\n\nAdmins, please verify!`);
      }

      // Check if this member was referred via an invite link
      // Note: Telegram doesn't always provide invite link info in message context
      // We'll also use chat_member updates for better tracking
      try {
        // Try to get the invite link from the update if available
        const inviteLink = (ctx.message as any)?.via_chat_folder_invite_link || null;
        if (inviteLink) {
          const referrerId = await findReferrerByInviteLink(chatId, inviteLink);
          if (referrerId && referrerId !== newMemberId) {
            await recordReferral(referrerId, newMemberId, chatIdStr);
            console.log(`Recorded referral: ${referrerId} referred ${newMemberId}`);
          }
        }
      } catch (error) {
        console.log("Error tracking referral from invite link:", error);
      }

      // Initialize moderation status for new member
      await ensureUserModerationStatus(newMemberId, chatIdStr);
      
      // Track new join in moderation stats
      await incrementModStat(chatIdStr, 'newJoins');

      const welcomeMessages = [
        `Hey ${name}! Welcome to the Dudley Bud fam!

I'm Karen, your friendly (okay, sometimes sassy) community manager. Here's the deal:

- Read the pinned messages first
- Our team NEVER DMs first - anyone who does is a scammer
- Just type "info" or "games" to learn more!

Got questions? Just ask me anything - I don't bite... much.`,

        `Well well, ${name} just walked in!

Welcome to Dudley Bud! I'm Karen, I run this place.

Quick tips:
- Check the pinned messages
- Nobody from our team will DM you first
- Say "hi" or "help" if you need anything

Don't be shy - I'm here 24/7!`,

        `Welcome ${name}! Good to see a new face!

I'm Karen - community manager, trivia host, and occasional roaster.

Before you dive in:
- Pinned messages = must read
- Our team NEVER DMs first
- Type "games" to see what we've got!

Ask me anything! I'm literally always here.`
      ];
      
      const welcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      await ctx.reply(welcome);
    }
  });

  // === CHAT MEMBER UPDATE HANDLER (for referral tracking with verification) ===
  bot.on("chat_member", async (ctx) => {
    const update = ctx.chatMember;
    if (!update) return;
    
    const chatId = ctx.chat.id;
    const chatIdStr = chatId.toString();
    const newMember = update.new_chat_member;
    const oldMember = update.old_chat_member;
    
    // Check if someone just joined (status changed to 'member' from something else)
    if (newMember.status === "member" && oldMember.status !== "member") {
      const newMemberId = newMember.user.id.toString();
      const newMemberIdNum = newMember.user.id;
      const firstName = newMember.user.first_name || "friend";
      const username = newMember.user.username || "";
      
      // Check if they joined via an invite link (referral)
      const inviteLink = update.invite_link;
      if (inviteLink && inviteLink.invite_link) {
        try {
          const referrerId = await findReferrerByInviteLink(chatId, inviteLink.invite_link);
          if (referrerId && referrerId !== newMemberId) {
            // Check referrer status - is the referrer suspended?
            const referrerStatusData = await getOrCreateReferrerStatus(referrerId, chatIdStr);
            if (referrerStatusData.isSuspended) {
              console.log(`Referrer ${referrerId} is suspended, not processing referral`);
              return;
            }
            
            // Check referral velocity (mass join detection)
            const velocity = checkReferralVelocity(referrerId);
            if (velocity.suspicious) {
              console.log(`Suspicious referral velocity for ${referrerId}: ${velocity.count} in last hour`);
              await notifyOwnerAboutReferral(bot, chatId, 
                `SUSPICIOUS REFERRAL ACTIVITY\n\nReferrer has ${velocity.count} joins in the last hour. This may be a raid attempt.`
              );
            }
            
            // Record the referral (pending verification)
            const recorded = await recordReferral(referrerId, newMemberId, chatIdStr);
            if (recorded) {
              console.log(`Recorded referral via chat_member: ${referrerId} referred ${newMemberId} - PENDING VERIFICATION`);
              
              // Start the verification process (mute, send verify button, set timeout)
              await startReferralVerification(bot, chatId, newMemberIdNum, referrerId, username, firstName);
            }
          }
        } catch (error) {
          console.log("Error tracking referral from chat_member:", error);
        }
      }
    }
  });
  
  // === REFERRAL VERIFICATION CALLBACK HANDLER ===
  bot.callbackQuery(/^verify_referral:(\d+)$/, async (ctx) => {
    const match = ctx.callbackQuery.data.match(/^verify_referral:(\d+)$/);
    if (!match) return;
    
    const expectedUserId = parseInt(match[1]);
    const actualUserId = ctx.from.id;
    const chatId = ctx.chat?.id;
    
    if (!chatId) {
      await ctx.answerCallbackQuery({ text: "Error: No chat context" });
      return;
    }
    
    // Only the person who joined can verify themselves
    if (actualUserId !== expectedUserId) {
      await ctx.answerCallbackQuery({ text: "This button is not for you!", show_alert: true });
      return;
    }
    
    // Process the verification
    const result = await handleVerificationSuccess(bot, chatId, actualUserId);
    
    if (result.success) {
      await ctx.answerCallbackQuery({ text: "Verified! Welcome to the community!" });
      
      // Send confirmation
      await ctx.api.sendMessage(chatId, 
        `${ctx.from.first_name} is now verified and can post!\n\n` +
        `${result.referrerName} earned ${REFERRAL_POINTS} points for the invite!`
      );
    } else {
      await ctx.answerCallbackQuery({ text: "Verification already processed or expired" });
    }
  });

  // === MEDIA CAPTION MODERATION (photos, videos, documents) ===
  bot.on(["message:photo", "message:video", "message:document", "message:animation"], async (ctx, next) => {
    const caption = ctx.message.caption;
    if (!caption) {
      await next();
      return;
    }
    
    const username = ctx.from?.username;
    const chatId = ctx.chat?.id;
    const userIdStr = ctx.from?.id?.toString() || "unknown";
    
    if (!chatId || chatId >= 0 || !ctx.from?.id || ctx.from.is_bot) {
      await next();
      return;
    }
    
    const chatIdStr = String(chatId);
    
    // Check if user is admin (admins bypass moderation)
    const userIsAdmin = await isUserAdmin(ctx, ctx.from.id);
    if (userIsAdmin) {
      await next();
      return;
    }
    
    // Get chat settings for raid mode and thresholds
    const settings = await getChatSettings(chatIdStr);
    
    // Check for links in caption (new users can't post links)
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = caption.match(urlRegex) || [];
    if (urls.length > 0) {
      await ensureUserModerationStatus(userIdStr, chatIdStr);
      const userStatus = await getUserModerationStatus(userIdStr, chatIdStr);
      const userJoinDate = userStatus?.joinDate || new Date();
      const hoursInChat = (Date.now() - new Date(userJoinDate).getTime()) / (1000 * 60 * 60);
      
      const linkHoursLimit = settings.raidMode ? 48 : settings.newUserLinkHours;
      if (hoursInChat < linkHoursLimit && userStatus?.role === "newbie") {
        const allLinksAllowed = urls.every(url => 
          ALLOWED_DOMAINS.some(d => url.toLowerCase().includes(d))
        );
        
        if (!allLinksAllowed) {
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, 'linksBlocked');
            await ctx.reply(`Links in media captions are restricted for new members during the first ${linkHoursLimit} hours.`);
          } catch (e) {
            console.log("Couldn't delete media with link caption from new user");
          }
          return;
        }
      }
    }
    
    // Risk scoring for scam detection in captions
    const userJoinDate = (await getUserModerationStatus(userIdStr, chatIdStr))?.joinDate || new Date();
    const accountAgeDays = (Date.now() - new Date(userJoinDate).getTime()) / (1000 * 60 * 60 * 24);
    const riskScore = calculateRiskScore(caption, username, accountAgeDays);
    
    const highRiskThreshold = settings.raidMode ? 40 : 60;
    const mediumRiskThreshold = settings.raidMode ? 25 : 40;
    
    if (riskScore >= highRiskThreshold) {
      try {
        await ctx.api.deleteMessage(chatId, ctx.message.message_id);
        await incrementModStat(chatIdStr, 'scamsBlocked');
        
        await db.update(userModerationStatus)
          .set({ 
            riskScore: riskScore,
            isQuarantined: true,
            quarantineReason: `High risk caption: ${riskScore}`
          })
          .where(and(
            eq(userModerationStatus.telegramUserId, userIdStr),
            eq(userModerationStatus.chatId, chatIdStr)
          ));
        
        await ctx.reply(`Suspicious media blocked. Admins have been notified.`);
        await flagForModReview(ctx, userIdStr, username || "", caption, riskScore, "High risk caption - auto-quarantined");
      } catch (e) {
        console.log("Couldn't auto-quarantine high-risk media");
      }
      return;
    } else if (riskScore >= mediumRiskThreshold) {
      await flagForModReview(ctx, userIdStr, username || "", caption, riskScore, "Medium risk caption - flagged for review");
    }
    
    // Legacy scam detection
    const { isScam, flags } = detectScam(caption, username);
    if (isScam) {
      await ctx.reply(`Suspicious media detected!\n\nFlags:\n${flags.join("\n")}\n\nAdmins, please review!`, 
        { reply_parameters: { message_id: ctx.message.message_id } });
    }
    
    await next();
  });

  // === MEDIA SPAM DETECTION (Stickers, GIFs, Voice Notes) ===
  const mediaSpamHistory: Map<string, { mediaId: string; count: number; lastTime: number }[]> = new Map();
  const MEDIA_SPAM_THRESHOLD = 3; // Same media 3 times
  const MEDIA_WINDOW_MS = 30000; // Within 30 seconds
  const MEDIA_CLEANUP_INTERVAL = 60000; // Clean up every minute
  
  // Periodic cleanup to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    const entries = Array.from(mediaSpamHistory.entries());
    for (const [key, history] of entries) {
      const filtered = history.filter((h: { mediaId: string; count: number; lastTime: number }) => now - h.lastTime < MEDIA_WINDOW_MS * 2);
      if (filtered.length === 0) {
        mediaSpamHistory.delete(key);
      } else {
        mediaSpamHistory.set(key, filtered);
      }
    }
  }, MEDIA_CLEANUP_INTERVAL);
  
  // Helper function for media spam detection
  async function checkMediaSpam(
    ctx: MyContext, 
    mediaId: string, 
    mediaType: string
  ): Promise<boolean> {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    if (!chatId || chatId >= 0 || !userId || ctx.from?.is_bot) {
      return false; // Not spam, continue
    }
    
    // Check if user is admin (admins bypass moderation)
    const userIsAdmin = await isUserAdmin(ctx, userId);
    if (userIsAdmin) {
      return false;
    }
    
    const key = `${chatId}:${userId}:${mediaType}`;
    const now = Date.now();
    
    // Get user's media history
    let history = mediaSpamHistory.get(key) || [];
    
    // Filter to recent media only
    history = history.filter(h => now - h.lastTime < MEDIA_WINDOW_MS);
    
    // Find if this media was recently sent
    const existing = history.find(h => h.mediaId === mediaId);
    if (existing) {
      existing.count++;
      existing.lastTime = now;
      
      if (existing.count >= MEDIA_SPAM_THRESHOLD) {
        try {
          await ctx.api.deleteMessage(chatId, ctx.message!.message_id);
          const chatIdStr = String(chatId);
          await incrementModStat(chatIdStr, 'spamBlocked');
          await ctx.reply(`${mediaType} spam detected! Please don't flood the chat.`);
          
          // Reset count after warning
          existing.count = 0;
        } catch (e) {
          console.log(`Couldn't delete ${mediaType} spam`);
        }
        mediaSpamHistory.set(key, history);
        return true; // Was spam
      }
    } else {
      history.push({ mediaId, count: 1, lastTime: now });
    }
    
    mediaSpamHistory.set(key, history);
    return false; // Not spam
  }
  
  // Sticker spam detection
  bot.on("message:sticker", async (ctx, next) => {
    const stickerId = ctx.message.sticker.file_unique_id;
    const wasSpam = await checkMediaSpam(ctx, stickerId, "Sticker");
    if (!wasSpam) await next();
  });
  
  // GIF/Animation spam detection
  bot.on("message:animation", async (ctx, next) => {
    // Skip if already handled by caption moderation
    if (ctx.message.caption) {
      await next();
      return;
    }
    const animationId = ctx.message.animation.file_unique_id;
    const wasSpam = await checkMediaSpam(ctx, animationId, "GIF");
    if (!wasSpam) await next();
  });
  
  // Voice note spam detection
  bot.on("message:voice", async (ctx, next) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    if (!chatId || chatId >= 0 || !userId || ctx.from?.is_bot) {
      await next();
      return;
    }
    
    const userIsAdmin = await isUserAdmin(ctx, userId);
    if (userIsAdmin) {
      await next();
      return;
    }
    
    // Track voice messages by file_unique_id for proper duplicate detection
    const voiceId = ctx.message.voice.file_unique_id;
    const wasSpam = await checkMediaSpam(ctx, voiceId, "Voice");
    if (!wasSpam) await next();
  });
  
  // Video note (round video) spam detection
  bot.on("message:video_note", async (ctx, next) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    if (!chatId || chatId >= 0 || !userId || ctx.from?.is_bot) {
      await next();
      return;
    }
    
    const userIsAdmin = await isUserAdmin(ctx, userId);
    if (userIsAdmin) {
      await next();
      return;
    }
    
    const videoNoteId = ctx.message.video_note.file_unique_id;
    const wasSpam = await checkMediaSpam(ctx, videoNoteId, "Video note");
    if (!wasSpam) await next();
  });
  
  // === FORWARDED MESSAGE RESTRICTIONS ===
  bot.on("message", async (ctx, next) => {
    // Check if message is forwarded (check both modern and legacy properties)
    const msg = ctx.message as any; // Cast to any to access legacy fields
    const isForwarded = msg?.forward_origin || msg?.forward_from || msg?.forward_from_chat || 
                        msg?.forward_sender_name || msg?.forward_date;
    if (!isForwarded) {
      await next();
      return;
    }
    
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    if (!chatId || chatId >= 0 || !userId || ctx.from?.is_bot) {
      await next();
      return;
    }
    
    const userIsAdmin = await isUserAdmin(ctx, userId);
    if (userIsAdmin) {
      await next();
      return;
    }
    
    const userIdStr = String(userId);
    const chatIdStr = String(chatId);
    
    // Check if user is new
    await ensureUserModerationStatus(userIdStr, chatIdStr);
    const userStatus = await getUserModerationStatus(userIdStr, chatIdStr);
    const userJoinDate = userStatus?.joinDate || new Date();
    const hoursInChat = (Date.now() - new Date(userJoinDate).getTime()) / (1000 * 60 * 60);
    
    // New users (less than 24 hours) can't forward messages
    if (hoursInChat < 24 && userStatus?.role === "newbie") {
      try {
        await ctx.api.deleteMessage(chatId, ctx.message!.message_id);
        await incrementModStat(chatIdStr, 'spamBlocked');
        await ctx.reply("New members can't forward messages during the first 24 hours. This protects our community from spam.");
      } catch (e) {
        console.log("Couldn't delete forwarded message from new user");
      }
      return;
    }
    
    await next();
  });
  
  // === CONTACT SHARING RESTRICTIONS ===
  bot.on("message:contact", async (ctx, next) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    
    if (!chatId || chatId >= 0 || !userId || ctx.from?.is_bot) {
      await next();
      return;
    }
    
    const userIsAdmin = await isUserAdmin(ctx, userId);
    if (userIsAdmin) {
      await next();
      return;
    }
    
    const userIdStr = String(userId);
    const chatIdStr = String(chatId);
    
    // Check if user is new
    await ensureUserModerationStatus(userIdStr, chatIdStr);
    const userStatus = await getUserModerationStatus(userIdStr, chatIdStr);
    const userJoinDate = userStatus?.joinDate || new Date();
    const hoursInChat = (Date.now() - new Date(userJoinDate).getTime()) / (1000 * 60 * 60);
    
    // New users can't share contacts (scammers share fake support contacts)
    if (hoursInChat < 48 && userStatus?.role === "newbie") {
      try {
        await ctx.api.deleteMessage(chatId, ctx.message!.message_id);
        await incrementModStat(chatIdStr, 'scamsBlocked');
        await ctx.reply("Sharing contacts is restricted for new members. This protects our community from scammers impersonating support.");
      } catch (e) {
        console.log("Couldn't delete contact share from new user");
      }
      return;
    }
    
    await next();
  });
  
  // === DANGEROUS FILE TYPE BLOCKING ===
  const DANGEROUS_EXTENSIONS = [
    ".exe", ".bat", ".cmd", ".com", ".scr", ".pif", ".msi",
    ".vbs", ".vbe", ".js", ".jse", ".ws", ".wsf", ".wsh",
    ".ps1", ".psm1", ".psd1", ".sh", ".bash", ".run",
    ".apk", ".app", ".dmg", ".pkg", ".deb", ".rpm"
  ];
  
  bot.on("message:document", async (ctx, next) => {
    const fileName = ctx.message.document.file_name?.toLowerCase() || "";
    const chatId = ctx.chat?.id;
    
    if (!chatId || chatId >= 0 || !ctx.from?.id || ctx.from.is_bot) {
      await next();
      return;
    }
    
    const userIsAdmin = await isUserAdmin(ctx, ctx.from.id);
    if (userIsAdmin) {
      await next();
      return;
    }
    
    // Check for dangerous file extensions
    const isDangerous = DANGEROUS_EXTENSIONS.some(ext => fileName.endsWith(ext));
    if (isDangerous) {
      try {
        await ctx.api.deleteMessage(chatId, ctx.message.message_id);
        const chatIdStr = String(chatId);
        await incrementModStat(chatIdStr, 'scamsBlocked');
        await ctx.reply("Executable and script files are not allowed. They can contain malware.");
        await flagForModReview(ctx, String(ctx.from.id), ctx.from.username || "", 
          `Attempted to share dangerous file: ${fileName}`, 80, "Dangerous file type blocked");
      } catch (e) {
        console.log("Couldn't delete dangerous file");
      }
      return;
    }
    
    await next();
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

    // === ADVANCED MODERATION CHECKS ===
    if (chatId && chatId < 0 && ctx.from?.id && !ctx.from.is_bot) {
      const chatIdStr = String(chatId);
      const userIdStr = String(ctx.from.id);
      
      // Skip rate limiting for game commands (they happen fast during gameplay)
      const gameCommands = ['/trivia', '/puzzle', '/guess', '/leaderboard', '/puzzleboard', '/refboard', '/myreferrals', '/play'];
      const isGameCommand = gameCommands.some(cmd => text.toLowerCase().startsWith(cmd));
      
      // Check if user is admin (admins bypass moderation)
      const userIsAdminForMod = await isUserAdmin(ctx, ctx.from.id);
      
      if (!userIsAdminForMod && !isGameCommand) {
        // Get chat settings for raid mode and thresholds
        const settings = await getChatSettings(chatIdStr);
        
        // === PHASE 1 SECURITY CHECKS ===
        const lowerTextMod = text.toLowerCase();
        
        // 1A. Seed phrase detection - protect users from sharing recovery phrases
        if (detectSeedPhrase(text)) {
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, 'scamsBlocked');
            await ctx.reply(`Hey there! I removed that message because it looked like it might contain a wallet recovery phrase (seed phrase).

NEVER share your seed phrase with anyone - not even team members or "support." If someone asked you to share it, they're trying to steal your crypto!

If this was a mistake, no worries. Just keep those 12/24 words safe and private!`);
            await flagForModReview(ctx, userIdStr, username || "", "[SEED PHRASE DETECTED - Content hidden for safety]", 95, "Seed phrase detected");
          } catch (e) {
            console.log("Couldn't delete seed phrase message");
          }
          return;
        }
        
        // 1B. Wallet drainer phrase detection
        for (const phrase of WALLET_DRAINER_PHRASES) {
          if (lowerTextMod.includes(phrase)) {
            try {
              await ctx.api.deleteMessage(chatId, ctx.message.message_id);
              await incrementModStat(chatIdStr, 'scamsBlocked');
              await ctx.reply(`Hold up! That message contained a common scam phrase ("${phrase}").

Legit projects NEVER ask you to "verify," "sync," or "validate" your wallet through a random link. That's how scammers drain wallets!

If you received a DM asking you to do this, report and block them immediately.`);
              await flagForModReview(ctx, userIdStr, username || "", text, 85, `Wallet drainer phrase: ${phrase}`);
            } catch (e) {
              console.log("Couldn't delete wallet drainer message");
            }
            return;
          }
        }
        
        // 1C. Short link domain detection (URL shorteners hide scam links)
        const urlRegexShort = /https?:\/\/([^\s\/]+)/gi;
        let shortLinkMatch;
        while ((shortLinkMatch = urlRegexShort.exec(text)) !== null) {
          const domain = shortLinkMatch[1].toLowerCase();
          if (SHORT_LINK_DOMAINS.some(sd => domain.includes(sd))) {
            try {
              await ctx.api.deleteMessage(chatId, ctx.message.message_id);
              await incrementModStat(chatIdStr, 'linksBlocked');
              await ctx.reply(`I blocked that shortened link for your safety!

Scammers use URL shorteners (bit.ly, tinyurl, etc.) to hide malicious websites. If you have a legitimate link to share, please use the full URL so everyone can see where it goes.

Tip: Never click shortened links in crypto groups - they're often phishing sites!`);
            } catch (e) {
              console.log("Couldn't delete short link message");
            }
            return;
          }
        }
        
        // 1D. Hate speech detection with progressive warnings
        const hateSpeechCheck = detectHateSpeech(text);
        if (hateSpeechCheck.detected) {
          const warningKey = `${userIdStr}:${chatIdStr}`;
          const existing = hateSpeechWarnings.get(warningKey);
          const now = Date.now();
          
          // Reset if warning is old
          if (existing && (now - existing.lastWarning > HATE_SPEECH_WARNING_RESET)) {
            hateSpeechWarnings.delete(warningKey);
          }
          
          const warningCount = (hateSpeechWarnings.get(warningKey)?.count || 0) + 1;
          hateSpeechWarnings.set(warningKey, { count: warningCount, lastWarning: now });
          
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, 'messagesBlocked');
            
            if (warningCount === 1) {
              await ctx.reply(`That language isn't welcome here. We're building a positive community for everyone.

This is your first warning. Please review our community guidelines and keep it respectful!`);
            } else if (warningCount === 2) {
              await ctx.reply(`Second warning for inappropriate language. One more and you'll be muted.

We want everyone to feel safe here. Let's keep it friendly!`);
            } else {
              // 3rd+ offense: mute for 1 hour
              const muteUntil = Math.floor(Date.now() / 1000) + 3600;
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
              await ctx.reply(`You've been muted for 1 hour due to repeated violations of community guidelines.

Admins have been notified. Please reflect on the kind of community you want to be part of.`);
              await flagForModReview(ctx, userIdStr, username || "", "[Hate speech - content hidden]", 90, "Repeated hate speech violations");
            }
          } catch (e) {
            console.log("Couldn't moderate hate speech");
          }
          return;
        }
        
        // 1E. Drug trafficking detection
        if (detectDrugTrafficking(text)) {
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, 'messagesBlocked');
            await ctx.reply(`Hey, we're a cannabis culture community and we love talking about the plant - but we can't allow buying/selling discussions, especially for other substances.

This keeps our community safe and legal. Feel free to discuss cannabis culture, strains, and experiences though!`);
            await flagForModReview(ctx, userIdStr, username || "", text, 75, "Drug trafficking language detected");
          } catch (e) {
            console.log("Couldn't delete trafficking message");
          }
          return;
        }
        
        // 1F. Emoji spam detection
        if (detectEmojiSpam(text)) {
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, 'spamBlocked');
            // Silent delete for emoji spam - no message needed
          } catch (e) {
            console.log("Couldn't delete emoji spam");
          }
          return;
        }
        
        // === END PHASE 1 SECURITY CHECKS ===
        
        // 1. Rate limiting check (use stricter threshold in raid mode)
        const rateThreshold = settings.raidMode ? Math.max(3, settings.spamThreshold - 2) : settings.spamThreshold;
        const rateCheck = checkRateLimit(userIdStr, chatIdStr, text, rateThreshold);
        if (rateCheck.blocked) {
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, rateCheck.reason === "flood" ? 'spamBlocked' : 'messagesBlocked');
            
            if (rateCheck.reason === "duplicate_spam") {
              await ctx.reply(`Slow down! Sending the same message repeatedly is not allowed.`);
            }
            // Silent delete for flood - just delete without message
          } catch (e) {
            console.log("Couldn't delete rate-limited message");
          }
          return; // Stop processing
        }
        
        // 2. Link restriction for new users
        const urlRegex = /https?:\/\/[^\s]+/gi;
        const urls = text.match(urlRegex) || [];
        if (urls.length > 0) {
          // Get user moderation status to check join date and role
          await ensureUserModerationStatus(userIdStr, chatIdStr);
          const userStatus = await getUserModerationStatus(userIdStr, chatIdStr);
          const userJoinDate = userStatus?.joinDate || new Date();
          const hoursInChat = (Date.now() - new Date(userJoinDate).getTime()) / (1000 * 60 * 60);
          
          // Block links from new users (raid mode = stricter)
          const linkHoursLimit = settings.raidMode ? 48 : settings.newUserLinkHours;
          if (hoursInChat < linkHoursLimit && userStatus?.role === "newbie") {
            // Check if ALL links are allowed
            const allLinksAllowed = urls.every(url => 
              ALLOWED_DOMAINS.some(d => url.toLowerCase().includes(d))
            );
            
            if (!allLinksAllowed) {
              try {
                await ctx.api.deleteMessage(chatId, ctx.message.message_id);
                await incrementModStat(chatIdStr, 'linksBlocked');
                await ctx.reply(`Links are restricted for new members during the first ${linkHoursLimit} hours. Ask an admin if you need to share a link!`);
              } catch (e) {
                console.log("Couldn't delete link from new user");
              }
              return;
            }
          }
        }
        
        // 3. Risk scoring for scam/phishing detection
        const userJoinDate = (await getUserModerationStatus(userIdStr, chatIdStr))?.joinDate || new Date();
        const accountAgeDays = (Date.now() - new Date(userJoinDate).getTime()) / (1000 * 60 * 60 * 24);
        const riskScore = calculateRiskScore(text, username, accountAgeDays);
        
        // Raid mode = lower threshold for action
        const highRiskThreshold = settings.raidMode ? 40 : 60;
        const mediumRiskThreshold = settings.raidMode ? 25 : 40;
        
        if (riskScore >= highRiskThreshold) {
          // Auto-quarantine: delete message and flag
          try {
            await ctx.api.deleteMessage(chatId, ctx.message.message_id);
            await incrementModStat(chatIdStr, 'scamsBlocked');
            
            // Update user risk score
            await db.update(userModerationStatus)
              .set({ 
                riskScore: riskScore,
                isQuarantined: true,
                quarantineReason: `High risk score: ${riskScore}`
              })
              .where(and(
                eq(userModerationStatus.telegramUserId, userIdStr),
                eq(userModerationStatus.chatId, chatIdStr)
              ));
            
            await ctx.reply(`⚠️ Suspicious message blocked. Admins have been notified.`);
            await flagForModReview(ctx, userIdStr, username || "", text, riskScore, "High risk score - auto-quarantined");
          } catch (e) {
            console.log("Couldn't auto-quarantine high-risk message");
          }
          return;
        } else if (riskScore >= mediumRiskThreshold) {
          // Medium risk: flag for review but don't delete
          await flagForModReview(ctx, userIdStr, username || "", text, riskScore, "Medium risk score - flagged for review");
        }
      }
    }
    // === END ADVANCED MODERATION ===

    // Scam detection (existing - keep for backwards compatibility)
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
    
    // === TRUST ACTIVITY TRACKING ===
    // Only track in group chats (negative IDs are group chats)
    if (typeof chatId === 'number' && chatId < 0 && ctx.from?.id) {
      const chatIdStr = String(chatId);
      const userIdStr = String(ctx.from.id);
      const today = getTodayDateString();
      
      // Determine activity type
      const isReply = !!ctx.message.reply_to_message;
      const repliedToUserId = ctx.message.reply_to_message?.from?.id ? String(ctx.message.reply_to_message.from.id) : undefined;
      
      if (isReply && repliedToUserId && repliedToUserId !== userIdStr) {
        // Check if this is a unique interaction (first reply to this user today)
        const cacheKey = `${userIdStr}:${chatIdStr}`;
        let cache = uniqueInteractionsCache.get(cacheKey);
        
        // Reset cache if it's a new day
        if (!cache || cache.date !== today) {
          cache = { users: new Set<string>(), date: today };
          uniqueInteractionsCache.set(cacheKey, cache);
        }
        
        if (!cache.users.has(repliedToUserId)) {
          // First reply to this user today - track as unique interaction
          cache.users.add(repliedToUserId);
          await updateTrustActivity(userIdStr, chatIdStr, 'uniqueInteraction', text.length, repliedToUserId);
        } else {
          // Already replied to this user today - just track as regular reply
          await updateTrustActivity(userIdStr, chatIdStr, 'reply', text.length, repliedToUserId);
        }
      } else {
        // Regular message (not a reply)
        await updateTrustActivity(userIdStr, chatIdStr, 'message', text.length);
      }
    }

    // Track rudeness for EVERY message (not just ones we respond to)
    const { isRude, isNice } = detectRudeness(text);
    const rudenessStatus = await updateUserRudeness(userId, username, ctx.from?.first_name, isRude, isNice);

    // Skip if it's a command
    if (text.startsWith("/")) {
      await next();
      return;
    }

    const lowerText = text.toLowerCase();
    const firstName = ctx.from?.first_name || "friend";
    
    // === CONVERSATIONAL TRIGGERS (no commands needed) ===
    // Check for casual greetings, info requests, games, help, etc.
    const conversational = detectConversationalTrigger(text);
    if (conversational.triggered && conversational.response) {
      // Add Karen sass based on mode
      const response = ctx.session.karenMode 
        ? karenResponse(conversational.response)
        : conversational.response;
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
      return;
    }
    
    // Instant dad joke when someone types "joke"
    if (lowerText === "joke" || lowerText === "jokes" || lowerText.includes("tell me a joke") || lowerText.includes("got a joke")) {
      const joke = await generateDadJoke();
      const response = ctx.session.karenMode ? karenResponse(joke) : joke;
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
      return;
    }
    
    // Story generator trigger - generate random Dudleyverse story
    if (lowerText === "story" || lowerText.includes("tell me a story") || lowerText.includes("dudley story") || lowerText.includes("dudleyverse")) {
      const story = StoryBible.generateRandomStory(username || firstName);
      await ctx.reply(`Alright ${firstName}, gather 'round for today's tale...\n\n${story}\n\nClassic Dudleyverse chaos, sweetie.`, { reply_parameters: { message_id: ctx.message.message_id } });
      return;
    }
    
    // Persona-aware sass for mapped usernames (story characters)
    const characterSass = StoryBible.getSassForCharacter(username || "");
    if (characterSass && Math.random() < 0.15) { // 15% chance to sass story characters
      await ctx.reply(characterSass, { reply_parameters: { message_id: ctx.message.message_id } });
      // Don't return - let the message continue processing for other handlers
    }
    
    // Detect one-liners and jokes from users - respond with sassy comeback (30% chance for short messages)
    const isOneLiner = text.length < 100 && text.length > 5 && !text.includes("?");
    const jokeIndicators = ["lol", "lmao", "haha", "rofl", "dead", "bruh", "ayo", "no way", "fr fr", "facts", "cap", "bet"];
    const hasJokeVibe = jokeIndicators.some(indicator => lowerText.includes(indicator));
    
    if ((isOneLiner || hasJokeVibe) && Math.random() < 0.3) {
      try {
        const rudenessContext = getKarenRudenessContext(rudenessStatus, isRude);
        const displayName = username ? `@${username}` : firstName;
        
        const sassyPrompt = rudenessContext 
          ? `${rudenessContext}\n\nSomeone just dropped a one-liner or joke: "${text}". Give them a witty, sassy Karen comeback. Be playful but with attitude. Keep it short - one or two sentences max. Address them as ${displayName}.`
          : `Someone just dropped a one-liner or joke: "${text}". Give them a witty, sassy Karen comeback. Be playful but with attitude. Keep it short - one or two sentences max. Address them as ${displayName}.`;
        
        let sassyResponse = await getAIResponse(text, sassyPrompt);
        // 40% chance to add a fun interjection at the end
        if (Math.random() < 0.4) {
          sassyResponse += ` ${getRandomInterjection()}`;
        }
        await ctx.reply(sassyResponse, { reply_parameters: { message_id: ctx.message.message_id } });
        return;
      } catch (error) {
        console.error("Sassy response error:", error);
        // Fall through to normal processing
      }
    }
    
    // Winner schedule questions - respond with exact times (no AI needed)
    const winnerKeywords = ["winner", "winners", "leaderboard reset", "when is", "when are", "what time", "announce"];
    const scheduleKeywords = ["daily", "weekly", "monthly", "trivia", "puzzle", "reset"];
    const isWinnerQuestion = winnerKeywords.some(w => lowerText.includes(w)) && 
                             (scheduleKeywords.some(s => lowerText.includes(s)) || lowerText.includes("?"));
    
    if (isWinnerQuestion) {
      const scheduleInfo = `Here's when winners are announced (all times Pacific):

DAILY Winners: Every night at 11:55 PM
WEEKLY Winners: Sunday nights at 11:55 PM (before Monday reset)
MONTHLY Winners: Last day of the month at 11:55 PM (before the 1st)

Both Trivia and Puzzle games have separate leaderboards!

Check current standings anytime with /leaderboard (trivia) or /puzzleboard (puzzles).`;
      
      const response = ctx.session.karenMode 
        ? karenResponse(scheduleInfo)
        : scheduleInfo;
      
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
      return;
    }
    
    // Game rules questions - respond with how to play (no AI needed)
    const gameKeywords = ["how to play", "how do i play", "rules", "how does", "how do", "what is", "what's", "explain"];
    const triviaKeywords = ["trivia", "quiz"];
    const puzzleKeywords = ["puzzle", "word game", "scramble", "unscramble"];
    const spaceKeywords = ["space bud", "invaders", "arcade", "shooter"];
    const seedStormKeywords = ["seed storm", "seedstorm"];
    
    const isTriviaQuestion = gameKeywords.some(g => lowerText.includes(g)) && triviaKeywords.some(t => lowerText.includes(t));
    const isPuzzleQuestion = gameKeywords.some(g => lowerText.includes(g)) && puzzleKeywords.some(p => lowerText.includes(p));
    const isSpaceQuestion = gameKeywords.some(g => lowerText.includes(g)) && spaceKeywords.some(s => lowerText.includes(s));
    const isSeedStormQuestion = gameKeywords.some(g => lowerText.includes(g)) && seedStormKeywords.some(s => lowerText.includes(s));
    const isGeneralGameQuestion = lowerText.includes("games") && (lowerText.includes("how") || lowerText.includes("what") || lowerText.includes("play"));
    
    if (isTriviaQuestion || isPuzzleQuestion || isSpaceQuestion || isSeedStormQuestion || isGeneralGameQuestion) {
      let gameInfo = "";
      
      if (isTriviaQuestion || isGeneralGameQuestion) {
        gameInfo += `TRIVIA GAME

How to play:
/trivia - Start a single question
/trivia 5 - Start a 5-question round (1-25 questions)

Answer by typing the letter (A, B, C, or D) in chat.
First correct answer wins the points!

Points: 10 per correct answer
Leaderboard: /leaderboard (daily/weekly/monthly rankings)

`;
      }
      
      if (isPuzzleQuestion || isGeneralGameQuestion) {
        gameInfo += `WORD PUZZLE

How to play:
/puzzle - Random difficulty
/puzzle easy - Easy mode (4-5 letters, 45 sec, 5 pts)
/puzzle hard - Hard mode (6-8 letters, 20 sec, 15 pts)

Unscramble the letters and type: /guess YOURWORD

Rules: One guess per round!
Leaderboard: /puzzleboard (daily/weekly/monthly rankings)

`;
      }
      
      if (isSpaceQuestion || isGeneralGameQuestion) {
        gameInfo += `SPACE BUD INVADERS

How to play:
/play - Opens the arcade game in your browser

Classic space shooter! You're Dudley defending against enemy buds.
Different strains = different points (10-30 pts each)
Touch controls on mobile, keyboard on desktop.

`;
      }
      
      if (isSeedStormQuestion || isGeneralGameQuestion) {
        gameInfo += `SEED STORM

Survive and shoot down enemy buds - get the highest score!

Play here: https://t.me/SeedStormBot/SeedStorm

Controls:
Desktop: Arrow keys or WASD to move, Space to shoot
Mobile: Tap LEFT/RIGHT to move, FIRE to shoot
Pause: Press Escape

`;
      }
      
      const response = ctx.session.karenMode 
        ? karenResponse(gameInfo.trim())
        : gameInfo.trim();
      
      await ctx.reply(response, { reply_parameters: { message_id: ctx.message.message_id } });
      return;
    }
    
    // Cannabis recipe requests - generate on demand with Karen sass
    const { isRecipe } = detectCannabisQuery(text);
    if (isRecipe) {
      try {
        // Show typing indicator since this takes a few seconds
        await ctx.api.sendChatAction(ctx.chat.id, "typing");
        
        // Get rudeness context for this user
        const rudenessContext = getKarenRudenessContext(rudenessStatus, isRude);
        
        // Generate the recipe with rudeness context included in the prompt
        const recipe = await generateCannabisRecipeWithContext(text, rudenessContext);
        
        // Add the disclaimer
        const finalResponse = recipe + RECIPE_DISCLAIMER;
        
        await ctx.reply(finalResponse, { reply_parameters: { message_id: ctx.message.message_id } });
        return;
      } catch (error) {
        console.error("Recipe generation error:", error);
        await ctx.reply("Karen's kitchen is having a moment. Try again in a sec!", { reply_parameters: { message_id: ctx.message.message_id } });
        return;
      }
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
      const displayName = username ? `@${username}` : firstName;
      
      // Use the rudeness status already computed earlier for this message
      const rudenessContext = getKarenRudenessContext(rudenessStatus, isRude);
      
      if (useKarenAttitude) {
        // When someone mentions "karen", answer their question/message helpfully (like /ask) but with Karen personality
        // Remove "karen" from the message to get the actual question
        const questionText = text.replace(/karen/gi, '').trim() || text;
        
        // Check for referral questions first - instant response, no AI needed
        const { isReferral, response: referralResponse } = detectReferralQuery(questionText);
        
        // Check for games questions - instant response (compute once)
        const gamesResult = detectGamesQuery(text);
        
        if (isReferral && referralResponse) {
          response = referralResponse;
        } else if (gamesResult.isGames && gamesResult.response) {
          response = gamesResult.response;
        } else if (detectRecipeKeyword(text)) {
          // Check for "karen recipe" - fetch a random recipe from collection
          const recipe = getRandomRecipe();
          response = formatRecipePost(recipe) + RECIPE_DISCLAIMER;
        } else {
          // Check knowledge bases FIRST (zero API cost)
          const knowledgeResult = checkKnowledgeBases(questionText);
          if (knowledgeResult) {
            response = knowledgeResult;
          } else {
            const fullContext = rudenessContext 
              ? `${rudenessContext}\n\nAnswer the user's question or respond to their message helpfully about Dudley Bud. Add Karen sass. Address them as ${displayName}.`
              : `Answer the user's question or respond to their message helpfully about Dudley Bud. Add a bit of Karen sass but focus on being helpful. Address them as ${displayName}.`;
            response = await getAIResponse(questionText, fullContext);
          }
        }
      } else {
        // Check knowledge bases FIRST (zero API cost)
        const knowledgeResult = checkKnowledgeBases(text);
        if (knowledgeResult) {
          response = knowledgeResult;
        } else {
          const fullContext = rudenessContext 
            ? `${rudenessContext}\n\n${responseContext}. Address them as ${displayName}.`
            : `${responseContext}. Address them as ${displayName}. Keep response brief and friendly.`;
          response = await getAIResponse(text, fullContext);
        }
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

// === QUOTE OF THE DAY ===
const DAILY_QUOTES = [
  { quote: "The best time to plant a seed was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { quote: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { quote: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { quote: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
  { quote: "Two things are infinite: the universe and human stupidity.", author: "Albert Einstein" },
  { quote: "In three words I can sum up everything I've learned about life: it goes on.", author: "Robert Frost" },
  { quote: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { quote: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { quote: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { quote: "The mind is everything. What you think you become.", author: "Buddha" },
  { quote: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { quote: "The best revenge is massive success.", author: "Frank Sinatra" },
  { quote: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { quote: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { quote: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
  { quote: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
  { quote: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { quote: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { quote: "Life is really simple, but we insist on making it complicated.", author: "Confucius" },
  { quote: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
  { quote: "Get busy living or get busy dying.", author: "Stephen King" },
  { quote: "You only live once, but if you do it right, once is enough.", author: "Mae West" },
  { quote: "Many of life's failures are people who did not realize how close they were to success when they gave up.", author: "Thomas Edison" },
  { quote: "If you want to live a happy life, tie it to a goal, not to people or things.", author: "Albert Einstein" },
  { quote: "Never let the fear of striking out keep you from playing the game.", author: "Babe Ruth" },
  { quote: "Money and success don't change people; they merely amplify what is already there.", author: "Will Smith" },
  { quote: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
  { quote: "The herb reveals you to yourself.", author: "Bob Marley" },
  { quote: "When you smoke the herb, it reveals you to yourself.", author: "Bob Marley" },
  { quote: "One good thing about music, when it hits you, you feel no pain.", author: "Bob Marley" },
  { quote: "Don't worry about a thing, every little thing is gonna be alright.", author: "Bob Marley" },
  { quote: "Love the life you live. Live the life you love.", author: "Bob Marley" },
  { quote: "None but ourselves can free our minds.", author: "Bob Marley" },
  { quote: "The truth is, everyone is going to hurt you. You just got to find the ones worth suffering for.", author: "Bob Marley" },
  { quote: "Open your mind before your mouth.", author: "Aristophanes" },
  { quote: "Hemp is of first necessity to the wealth and protection of the country.", author: "Thomas Jefferson" },
  { quote: "Make the most you can of the Indian Hemp seed and sow it everywhere.", author: "George Washington" },
  { quote: "The illegality of cannabis is outrageous, an impediment to full utilization of a drug which helps produce serenity.", author: "Carl Sagan" },
  { quote: "I think people need to be educated to the fact that marijuana is not a drug. Marijuana is an herb and a flower.", author: "Willie Nelson" },
  { quote: "When you smoke marijuana, you are in the moment and you are happy.", author: "Tommy Chong" },
  { quote: "I have always loved marijuana. It has been a source of joy and comfort to me for many years.", author: "Carl Sagan" },
  { quote: "Is marijuana addictive? Yes, in the sense that most of the really pleasant things in life are worth endlessly repeating.", author: "Richard Neville" }
];

let lastQuoteIndex = -1;
let lastQuotePostDate = "";

function getRandomQuote(): typeof DAILY_QUOTES[0] {
  let index = Math.floor(Math.random() * DAILY_QUOTES.length);
  if (index === lastQuoteIndex && DAILY_QUOTES.length > 1) {
    index = (index + 1) % DAILY_QUOTES.length;
  }
  lastQuoteIndex = index;
  return DAILY_QUOTES[index];
}

function postDailyQuote() {
  if (!botInstance) return;
  
  const quote = getRandomQuote();
  const message = `QUOTE OF THE DAY\n\n"${quote.quote}"\n\n— ${quote.author}\n\nHave a great day, Bud Fam!`;
  
  for (const chatId of Array.from(activeChats)) {
    botInstance.api.sendMessage(chatId, message).catch((err) => {
      console.error(`Failed to send quote to chat ${chatId}:`, err);
      if (err.description?.includes("chat not found") || err.description?.includes("bot was blocked")) {
        activeChats.delete(chatId);
      }
    });
  }
  
  console.log(`Posted daily quote to ${activeChats.size} chats: "${quote.quote.substring(0, 30)}..."`);
}

function startQuoteScheduler() {
  const checkAndPost = () => {
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
    
    // Post at 10 AM Pacific (10:00) - different time than recipes (4 PM)
    if (hour === 10 && minute === 0 && lastQuotePostDate !== dateStr) {
      lastQuotePostDate = dateStr;
      postDailyQuote();
    }
  };
  
  setInterval(checkAndPost, 60 * 1000);
  console.log("Quote scheduler started - will post daily at 10 AM Pacific");
}

// === WORD PUZZLE GAME ===
// Word lengths: min 2 chars, max 11 chars
const EASY_WORDS = [
  // 2-3 letter words
  "OG", "BUD", "THC", "CBD", "WAX", "DAB", "POT", "GAS", "ZEN", "NFT",
  "ETH", "APE", "GEM", "BAG", "RUG", "DEX", "DAO", "FUD", "APY", "TVL",
  "SOL", "BTC", "LIT", "HIT", "TOP", "DIP", "RIP", "WIN", "VIP", "MAX",
  // Referral program words
  "REF", "LINK", "FAM", "GROW", "EARN",
  // 4-5 letter words (cannabis)
  "KUSH", "BONG", "DANK", "HIGH", "HEMP", "LEAF", "BUDS", "DOPE", "HAZE", "HASH",
  "MINT", "LIME", "GLOW", "CHILL", "BLAZE", "GREEN", "SMOKE", "VIBES", "PEACE", "DREAM",
  "PLANT", "BLOOM", "GROW", "LIGHT", "FRESH", "COOL", "CALM", "ZONE", "LIFT", "WAVE",
  "STONE", "PUFF", "ROLL", "FIRE", "LOUD", "TERP", "NUKE", "FROST", "STICKY", "CHIEF",
  "BLUNT", "JOINT", "PIPE", "BOWL", "CREAM", "PURP", "SKUNK", "DIESEL", "LEMON", "MANGO",
  // 4-5 letter words (crypto)
  "COIN", "HOLD", "MOON", "PUMP", "GAIN", "BULL", "BEAR", "SWAP", "BURN", "TOKEN",
  "FARM", "POOL", "STAKE", "YIELD", "CHAIN", "BLOCK", "DEFI", "HODL", "WHALE", "ALPHA",
  "SHILL", "FOMO", "REKT", "NGMI", "WAGMI", "FLOOR", "FLIP", "MINT", "DROP", "BASED",
  "DEGEN", "SEND", "LAMBO", "BAGS", "ENTRY", "EXIT", "LONG", "SHORT", "TRADE", "CHART"
];

const HARD_WORDS = [
  // 6-8 letter words (cannabis strains)
  "SATIVA", "INDICA", "HYBRID", "CHRONIC", "GELATO", "ZKITTLEZ", "RUNTZ", "COOKIES", "NAMASTAY",
  // Dudley Bud special
  "CANDYLAND", "GHOSTTRAIN",
  "TERPENE", "EXTRACT", "DIAMOND", "SHATTER", "BUDDER", "ROSIN", "FLOWER", "NUGGET",
  "EDIBLE", "TOPICAL", "PREROLL", "GRINDER", "VAPORIZE", "BUBBLER", "SPLIFF", "BLUNTS",
  "GORILLA", "TRAINWRECK", "SKYWALKER", "HEADBAND", "CHEMDAWG", "GRANDDADDY", "TANGIE",
  "SHERBERT", "MIMOSA", "BANANA", "MOCHI", "BISCOTTI", "WEDDING", "BIRTHDAY", "AMNESIA",
  "PINEAPPLE", "BLUEBERRY", "STRAWBERRY", "BLACKBERRY", "CHERRY", "ORANGE", "GRAPEFRUIT",
  // 6-11 letter words (crypto)
  "ETHEREUM", "BITCOIN", "SOLANA", "POLYGON", "AVALANCHE", "ARBITRUM", "OPTIMISM",
  "STAKING", "FARMING", "LIQUIDITY", "GOVERNANCE", "METAVERSE", "PROTOCOL", "VALIDATOR",
  "WALLET", "BRIDGE", "ORACLE", "LEDGER", "MAINNET", "TESTNET", "SNAPSHOT", "AIRDROP",
  "BULLISH", "BEARISH", "TOKENOMICS", "WHITEPAPER", "ROADMAP", "UTILITY", "ECOSYSTEM",
  "CROSSCHAIN", "MULTICHAIN", "ROLLUP", "ZEROKNOW", "CONSENSUS", "DELEGATE", "PROPOSER",
  "SLASHING", "REWARDS", "TREASURY", "MULTISIG", "TIMELOCK", "MERKLE", "HASHRATE",
  "DECENTRALIZED", "IMMUTABLE", "PERMISSIONLESS", "TRUSTLESS", "COMPOSABLE",
  // Referral program words
  "REFERRAL", "REFBOARD", "INVITES", "CHAMPION", "LEADERBOARD",
  // Dudley themed (6-8 letters)
  "DUDLEY", "BLAZER", "PURPLE", "NORTHERN", "AGENTKARENS", "COMMUNITY", "TRADING",
  "COLLECTOR", "ARTWORK", "CARTOON", "CHARACTER", "UNIVERSE", "CREATIVE", "CANNABIS"
];

interface ActivePuzzle {
  word: string;
  scrambled: string;
  difficulty: 'easy' | 'hard';
  startTime: number;
  timeLimit: number;
  points: number;
  answeredUsers: Set<number>;
  solved: boolean;
  solverName?: string;
  timeoutId?: NodeJS.Timeout;
}

const activePuzzles: Map<number, ActivePuzzle> = new Map();

// Track recently used puzzle words per chat to avoid repeats
const recentPuzzleWords: Map<number, string[]> = new Map();
const MAX_RECENT_PUZZLE_WORDS = 100; // Remember last 100 words per chat

function getUnusedPuzzleWord(chatId: number, wordList: string[]): string {
  const recentWords = recentPuzzleWords.get(chatId) || [];
  
  // Filter out recently used words
  const availableWords = wordList.filter(w => !recentWords.includes(w));
  
  // If we've used most words, reset the tracker
  if (availableWords.length < 5) {
    recentPuzzleWords.set(chatId, []);
    return wordList[Math.floor(Math.random() * wordList.length)];
  }
  
  // Pick a random word from available ones
  const word = availableWords[Math.floor(Math.random() * availableWords.length)];
  
  // Track this word as used
  recentWords.push(word);
  if (recentWords.length > MAX_RECENT_PUZZLE_WORDS) {
    recentWords.shift(); // Remove oldest
  }
  recentPuzzleWords.set(chatId, recentWords);
  
  return word;
}

function scrambleWord(word: string): string {
  const chars = word.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const scrambled = chars.join('');
  if (scrambled === word && word.length > 2) {
    return scrambleWord(word);
  }
  return scrambled;
}

function getWeekNumberForPuzzle(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function getOrCreatePuzzleScore(telegramUserId: string, chatId: string, username: string, firstName: string) {
  const existing = await db.select().from(memberScores)
    .where(and(
      eq(memberScores.telegramUserId, telegramUserId),
      eq(memberScores.chatId, chatId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const inserted = await db.insert(memberScores)
    .values({
      telegramUserId,
      chatId,
      username,
      firstName,
      messageCount: 0,
      triviaPoints: 0,
      triviaCorrect: 0,
      triviaAttempts: 0,
      puzzlePoints: 0,
      puzzleCorrect: 0,
      puzzleAttempts: 0
    })
    .returning();
  
  return inserted[0];
}

async function updatePuzzleScore(telegramUserId: string, chatId: string, earnedPoints: number) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekNum = getWeekNumberForPuzzle(now);
  const weekStr = `${now.getFullYear()}-W${weekNum}`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const score = await db.select().from(memberScores)
    .where(and(
      eq(memberScores.telegramUserId, telegramUserId),
      eq(memberScores.chatId, chatId)
    ))
    .limit(1);
  
  if (score.length === 0) return;
  
  const s = score[0];
  const newPuzzlePoints = (s.puzzlePoints || 0) + earnedPoints;
  const newPuzzleCorrect = (s.puzzleCorrect || 0) + 1;
  const newPuzzleAttempts = (s.puzzleAttempts || 0) + 1;
  
  const newPuzzleDailyPoints = s.puzzleDailyResetDate === todayStr 
    ? (s.puzzleDailyPoints || 0) + earnedPoints 
    : earnedPoints;
  const newPuzzleWeeklyPoints = s.puzzleWeeklyResetDate === weekStr 
    ? (s.puzzleWeeklyPoints || 0) + earnedPoints 
    : earnedPoints;
  const newPuzzleMonthlyPoints = s.puzzleMonthlyResetDate === monthStr 
    ? (s.puzzleMonthlyPoints || 0) + earnedPoints 
    : earnedPoints;
  
  await db.update(memberScores)
    .set({
      puzzlePoints: newPuzzlePoints,
      puzzleCorrect: newPuzzleCorrect,
      puzzleAttempts: newPuzzleAttempts,
      puzzleDailyPoints: newPuzzleDailyPoints,
      puzzleDailyResetDate: todayStr,
      puzzleWeeklyPoints: newPuzzleWeeklyPoints,
      puzzleWeeklyResetDate: weekStr,
      puzzleMonthlyPoints: newPuzzleMonthlyPoints,
      puzzleMonthlyResetDate: monthStr
    })
    .where(and(
      eq(memberScores.telegramUserId, telegramUserId),
      eq(memberScores.chatId, chatId)
    ));
}

async function incrementPuzzleAttempt(telegramUserId: string, chatId: string) {
  await db.update(memberScores)
    .set({
      puzzleAttempts: sql`COALESCE(puzzle_attempts, 0) + 1`
    })
    .where(and(
      eq(memberScores.telegramUserId, telegramUserId),
      eq(memberScores.chatId, chatId)
    ));
}

// === REFERRAL SYSTEM ===
const REFERRAL_POINTS = 25;

// Generate a unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get or create referral link for a user
async function getOrCreateReferralLink(bot: Bot<MyContext>, chatId: number, userId: number): Promise<{ link: string; code: string }> {
  const chatIdStr = chatId.toString();
  const userIdStr = userId.toString();
  
  // Check if user already has a referral code for this chat
  const existing = await db.select().from(referralCodes)
    .where(and(
      eq(referralCodes.telegramUserId, userIdStr),
      eq(referralCodes.chatId, chatIdStr)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return { link: existing[0].inviteLink, code: existing[0].code };
  }
  
  // Create a new invite link with the bot
  try {
    const code = generateReferralCode();
    const inviteLink = await bot.api.createChatInviteLink(chatId, {
      name: `REF_${code}`,
      creates_join_request: false
    });
    
    await db.insert(referralCodes).values({
      telegramUserId: userIdStr,
      chatId: chatIdStr,
      inviteLink: inviteLink.invite_link,
      code: code,
      totalClicks: 0
    });
    
    return { link: inviteLink.invite_link, code };
  } catch (error) {
    console.log("Failed to create invite link - bot needs admin permissions:", error);
    throw new Error("I need admin permissions to create invite links!");
  }
}

// Find referrer by invite link name
async function findReferrerByInviteLink(chatId: number, inviteLink: string): Promise<string | null> {
  const chatIdStr = chatId.toString();
  
  // Try to find the referral code that matches this invite link
  const referralCode = await db.select().from(referralCodes)
    .where(and(
      eq(referralCodes.chatId, chatIdStr),
      eq(referralCodes.inviteLink, inviteLink)
    ))
    .limit(1);
  
  if (referralCode.length > 0) {
    return referralCode[0].telegramUserId;
  }
  
  return null;
}

// Record a referral
async function recordReferral(referrerUserId: string, referredUserId: string, chatId: string): Promise<boolean> {
  // Check if this referral already exists
  const existing = await db.select().from(referrals)
    .where(and(
      eq(referrals.referredTelegramUserId, referredUserId),
      eq(referrals.chatId, chatId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return false; // Already referred
  }
  
  // Check referrer isn't referring themselves
  if (referrerUserId === referredUserId) {
    return false;
  }
  
  // Record the referral as pending
  await db.insert(referrals).values({
    referrerTelegramUserId: referrerUserId,
    referredTelegramUserId: referredUserId,
    chatId: chatId,
    status: "pending"
  });
  
  return true;
}

// Confirm a referral and award points
async function confirmReferral(referredUserId: string, chatId: string): Promise<{ referrerUserId: string; success: boolean } | null> {
  const existing = await db.select().from(referrals)
    .where(and(
      eq(referrals.referredTelegramUserId, referredUserId),
      eq(referrals.chatId, chatId),
      eq(referrals.status, "pending")
    ))
    .limit(1);
  
  if (existing.length === 0) {
    return null;
  }
  
  const referral = existing[0];
  const referrerUserId = referral.referrerTelegramUserId;
  
  // Mark as confirmed
  await db.update(referrals)
    .set({ 
      status: "confirmed",
      confirmedDate: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(referrals.id, referral.id));
  
  // Award points to referrer
  const now = new Date();
  const weekNum = getWeekNumber(now);
  const weekStr = `${now.getFullYear()}-W${weekNum}`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Update referrer's scores
  const referrerScore = await db.select().from(memberScores)
    .where(and(
      eq(memberScores.telegramUserId, referrerUserId),
      eq(memberScores.chatId, chatId)
    ))
    .limit(1);
  
  if (referrerScore.length > 0) {
    const s = referrerScore[0];
    const newReferralPoints = (s.referralPoints || 0) + REFERRAL_POINTS;
    const newReferralCount = (s.referralCount || 0) + 1;
    const newReferralWeeklyPoints = s.referralWeeklyResetDate === weekStr 
      ? (s.referralWeeklyPoints || 0) + REFERRAL_POINTS 
      : REFERRAL_POINTS;
    const newReferralMonthlyPoints = s.referralMonthlyResetDate === monthStr
      ? (s.referralMonthlyPoints || 0) + REFERRAL_POINTS
      : REFERRAL_POINTS;
    
    await db.update(memberScores)
      .set({
        referralPoints: newReferralPoints,
        referralCount: newReferralCount,
        referralWeeklyPoints: newReferralWeeklyPoints,
        referralWeeklyResetDate: weekStr,
        referralMonthlyPoints: newReferralMonthlyPoints,
        referralMonthlyResetDate: monthStr
      })
      .where(and(
        eq(memberScores.telegramUserId, referrerUserId),
        eq(memberScores.chatId, chatId)
      ));
  }
  
  return { referrerUserId, success: true };
}

// Get referral stats for a user
async function getReferralStats(userId: string, chatId: string): Promise<{ 
  totalReferrals: number; 
  confirmedReferrals: number; 
  pendingReferrals: number;
  totalPoints: number;
  weeklyPoints: number;
}> {
  const score = await db.select().from(memberScores)
    .where(and(
      eq(memberScores.telegramUserId, userId),
      eq(memberScores.chatId, chatId)
    ))
    .limit(1);
  
  const allReferrals = await db.select().from(referrals)
    .where(and(
      eq(referrals.referrerTelegramUserId, userId),
      eq(referrals.chatId, chatId)
    ));
  
  const confirmed = allReferrals.filter(r => r.status === "confirmed").length;
  const pending = allReferrals.filter(r => r.status === "pending").length;
  
  return {
    totalReferrals: allReferrals.length,
    confirmedReferrals: confirmed,
    pendingReferrals: pending,
    totalPoints: score[0]?.referralPoints || 0,
    weeklyPoints: score[0]?.referralWeeklyPoints || 0
  };
}

// Get referral leaderboard
async function getReferralLeaderboard(chatId: string, period: 'weekly' | 'alltime'): Promise<Array<{
  rank: number;
  username: string;
  firstName: string;
  points: number;
  referrals: number;
}>> {
  const allScores = await db.select().from(memberScores)
    .where(eq(memberScores.chatId, chatId));
  
  const now = new Date();
  const weekStr = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)).padStart(2, '0')}`;
  
  const scores = allScores
    .map(s => ({
      username: s.username || "",
      firstName: s.firstName || "Anonymous",
      points: period === 'weekly' 
        ? (s.referralWeeklyResetDate === weekStr ? (s.referralWeeklyPoints || 0) : 0)
        : (s.referralPoints || 0),
      referrals: s.referralCount || 0
    }))
    .filter(s => s.points > 0 || s.referrals > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)
    .map((s, i) => ({ ...s, rank: i + 1 }));
  
  return scores;
}

// === REFERRAL VERIFICATION SYSTEM ===
const REFERRAL_VERIFY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const FAILED_REFERRAL_THRESHOLD = 3; // Suspend referrer after 3 failed referrals

// Runtime tracking for timeouts (database stores the state, this stores the handles)
interface RuntimeVerification {
  timeoutHandle: NodeJS.Timeout;
}
const verificationTimeouts: Map<string, RuntimeVerification> = new Map();

// Referral velocity tracking: referrerId -> join timestamps (last hour)
const referralVelocity: Map<string, number[]> = new Map();
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_VELOCITY = 10; // Max 10 referrals per hour before flagging

function getVerificationKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

// Check referral velocity - returns true if suspicious
function checkReferralVelocity(referrerId: string): { suspicious: boolean; count: number } {
  const now = Date.now();
  const timestamps = referralVelocity.get(referrerId) || [];
  
  // Filter to last hour
  const recent = timestamps.filter(t => now - t < VELOCITY_WINDOW_MS);
  recent.push(now);
  referralVelocity.set(referrerId, recent);
  
  return { suspicious: recent.length > MAX_VELOCITY, count: recent.length };
}

// Mute a referral joiner completely (no posting rights) - uses bot instance directly
async function muteReferralJoiner(bot: Bot<MyContext>, chatId: number, userId: number): Promise<boolean> {
  try {
    await bot.api.restrictChatMember(chatId, userId, {
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
    });
    return true;
  } catch (error) {
    console.log(`Failed to mute referral joiner ${userId} in chat ${chatId}:`, error);
    return false;
  }
}

// Unmute a verified referral joiner (restore posting rights) - uses bot instance directly
async function unmuteVerifiedReferral(bot: Bot<MyContext>, chatId: number, userId: number): Promise<boolean> {
  try {
    await bot.api.restrictChatMember(chatId, userId, {
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
    return true;
  } catch (error) {
    console.log(`Failed to unmute verified referral ${userId} in chat ${chatId}:`, error);
    return false;
  }
}

// Notify owner about referral issues
async function notifyOwnerAboutReferral(bot: Bot<MyContext>, chatId: number, message: string): Promise<void> {
  try {
    const admins = await bot.api.getChatAdministrators(chatId);
    const owner = admins.find(a => a.status === "creator");
    if (owner) {
      const ownerMention = owner.user.username ? `@${owner.user.username}` : owner.user.first_name;
      await bot.api.sendMessage(chatId, `${ownerMention} ${message}`);
    }
  } catch (error) {
    console.log("Failed to notify owner:", error);
  }
}

// Get or create referrer status
async function getOrCreateReferrerStatus(userId: string, chatId: string): Promise<{ failedReferrals: number; successfulReferrals: number; isSuspended: boolean }> {
  const existing = await db.select().from(referrerStatus)
    .where(and(
      eq(referrerStatus.telegramUserId, userId),
      eq(referrerStatus.chatId, chatId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return {
      failedReferrals: existing[0].failedReferrals || 0,
      successfulReferrals: existing[0].successfulReferrals || 0,
      isSuspended: existing[0].isSuspended || false
    };
  }
  
  // Create new status
  await db.insert(referrerStatus).values({
    telegramUserId: userId,
    chatId: chatId,
    failedReferrals: 0,
    successfulReferrals: 0,
    isSuspended: false
  });
  
  return { failedReferrals: 0, successfulReferrals: 0, isSuspended: false };
}

// Increment failed referrals and potentially suspend referrer
async function incrementFailedReferral(bot: Bot<MyContext>, referrerId: string, chatId: number): Promise<boolean> {
  const chatIdStr = chatId.toString();
  const status = await getOrCreateReferrerStatus(referrerId, chatIdStr);
  const newFailedCount = status.failedReferrals + 1;
  
  await db.update(referrerStatus)
    .set({ failedReferrals: newFailedCount })
    .where(and(
      eq(referrerStatus.telegramUserId, referrerId),
      eq(referrerStatus.chatId, chatIdStr)
    ));
  
  // Check if should suspend
  if (newFailedCount >= FAILED_REFERRAL_THRESHOLD && !status.isSuspended) {
    await db.update(referrerStatus)
      .set({ 
        isSuspended: true, 
        suspendedAt: sql`CURRENT_TIMESTAMP`,
        suspendReason: `${newFailedCount} failed referrals`
      })
      .where(and(
        eq(referrerStatus.telegramUserId, referrerId),
        eq(referrerStatus.chatId, chatIdStr)
      ));
    
    // Mute the referrer
    await muteReferralJoiner(bot, chatId, parseInt(referrerId));
    
    // Notify owner
    const referrerInfo = await db.select().from(memberScores)
      .where(and(
        eq(memberScores.telegramUserId, referrerId),
        eq(memberScores.chatId, chatIdStr)
      ))
      .limit(1);
    
    const referrerName = referrerInfo[0]?.username ? `@${referrerInfo[0].username}` : referrerInfo[0]?.firstName || referrerId;
    await notifyOwnerAboutReferral(bot, chatId, 
      `REFERRER SUSPENDED\n\n${referrerName} has been muted - their referrals keep failing verification (${newFailedCount} failed).\n\nUse /restore to restore their posting rights if needed.`
    );
    
    return true; // Suspended
  }
  
  return false; // Not suspended
}

// Increment successful referral
async function incrementSuccessfulReferral(referrerId: string, chatId: string): Promise<void> {
  const status = await getOrCreateReferrerStatus(referrerId, chatId);
  
  await db.update(referrerStatus)
    .set({ successfulReferrals: status.successfulReferrals + 1 })
    .where(and(
      eq(referrerStatus.telegramUserId, referrerId),
      eq(referrerStatus.chatId, chatId)
    ));
}

// Start referral verification for a new joiner
async function startReferralVerification(
  bot: Bot<MyContext>,
  chatId: number,
  userId: number,
  referrerId: string,
  username: string,
  firstName: string
): Promise<void> {
  const key = getVerificationKey(chatId, userId);
  const chatIdStr = chatId.toString();
  const userIdStr = userId.toString();
  
  // Mute the new joiner immediately
  await muteReferralJoiner(bot, chatId, userId);
  
  // Set verify deadline
  const deadline = new Date(Date.now() + REFERRAL_VERIFY_TIMEOUT_MS);
  
  // Update referrals table with deadline
  await db.update(referrals)
    .set({ 
      verifyDeadline: deadline,
      status: "pending"
    })
    .where(and(
      eq(referrals.referredTelegramUserId, userIdStr),
      eq(referrals.chatId, chatIdStr)
    ));
  
  // Send welcome with verify button
  const verifyMessage = await bot.api.sendMessage(chatId, 
    `Welcome ${firstName}!\n\n` +
    `You joined via a referral link. To get full access to the community, please verify yourself by clicking the button below.\n\n` +
    `You have 5 minutes to verify or you'll be removed.\n\n` +
    `This protects our community from bots and scammers.`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "VERIFY ME", callback_data: `verify_referral:${userId}` }
        ]]
      }
    }
  );
  
  // Store pending verification in database (persists across restarts)
  await db.insert(pendingVerifications).values({
    chatId: chatIdStr,
    userId: userIdStr,
    referrerId: referrerId,
    username: username || null,
    firstName: firstName || null,
    messageId: verifyMessage.message_id,
    deadline: deadline
  }).onConflictDoNothing();
  
  // Set up auto-kick timer (runtime only)
  const timeoutHandle = setTimeout(async () => {
    await handleVerificationTimeout(bot, chatId, userId, referrerId);
  }, REFERRAL_VERIFY_TIMEOUT_MS);
  
  // Store timeout handle for cleanup
  verificationTimeouts.set(key, { timeoutHandle });
}

// Handle verification timeout - auto kick
async function handleVerificationTimeout(
  bot: Bot<MyContext>,
  chatId: number,
  userId: number,
  referrerId: string
): Promise<void> {
  const key = getVerificationKey(chatId, userId);
  const chatIdStr = chatId.toString();
  const userIdStr = userId.toString();
  
  // Check if still pending in database
  const pendingRecords = await db.select().from(pendingVerifications)
    .where(and(
      eq(pendingVerifications.chatId, chatIdStr),
      eq(pendingVerifications.userId, userIdStr)
    ))
    .limit(1);
  
  if (pendingRecords.length === 0) return; // Already handled
  
  const pending = pendingRecords[0];
  
  // Remove from database
  await db.delete(pendingVerifications)
    .where(and(
      eq(pendingVerifications.chatId, chatIdStr),
      eq(pendingVerifications.userId, userIdStr)
    ));
  
  // Remove timeout handle
  verificationTimeouts.delete(key);
  
  try {
    // Kick the user
    await bot.api.banChatMember(chatId, userId);
    await bot.api.unbanChatMember(chatId, userId); // Allow them to rejoin
    
    // Mark referral as kicked
    await db.update(referrals)
      .set({ status: "kicked", flagReason: "Failed to verify within 5 minutes" })
      .where(and(
        eq(referrals.referredTelegramUserId, userIdStr),
        eq(referrals.chatId, chatIdStr)
      ));
    
    // Increment failed referral for referrer
    await incrementFailedReferral(bot, referrerId, chatId);
    
    // Delete the verification message
    if (pending.messageId) {
      try {
        await bot.api.deleteMessage(chatId, pending.messageId);
      } catch (e) { /* ignore */ }
    }
    
    // Notify chat
    await bot.api.sendMessage(chatId, 
      `${pending.firstName || 'User'} was removed for not verifying within 5 minutes.`
    );
    
    console.log(`Auto-kicked unverified referral: ${userId} (referred by ${referrerId})`);
  } catch (error) {
    console.log(`Failed to kick unverified user ${userId}:`, error);
  }
}

// Handle successful verification
async function handleVerificationSuccess(
  bot: Bot<MyContext>,
  chatId: number,
  userId: number
): Promise<{ success: boolean; referrerName?: string }> {
  const key = getVerificationKey(chatId, userId);
  const chatIdStr = chatId.toString();
  const userIdStr = userId.toString();
  
  // Check database for pending verification
  const pendingRecords = await db.select().from(pendingVerifications)
    .where(and(
      eq(pendingVerifications.chatId, chatIdStr),
      eq(pendingVerifications.userId, userIdStr)
    ))
    .limit(1);
  
  if (pendingRecords.length === 0) {
    return { success: false };
  }
  
  const pending = pendingRecords[0];
  
  // Clear the timeout if it exists
  const timeoutEntry = verificationTimeouts.get(key);
  if (timeoutEntry) {
    clearTimeout(timeoutEntry.timeoutHandle);
    verificationTimeouts.delete(key);
  }
  
  // Remove from database
  await db.delete(pendingVerifications)
    .where(and(
      eq(pendingVerifications.chatId, chatIdStr),
      eq(pendingVerifications.userId, userIdStr)
    ));
  
  // Unmute the user
  await unmuteVerifiedReferral(bot, chatId, userId);
  
  // Mark as verified in database
  await db.update(referrals)
    .set({ 
      status: "confirmed",
      verifiedAt: sql`CURRENT_TIMESTAMP`,
      confirmedDate: sql`CURRENT_TIMESTAMP`
    })
    .where(and(
      eq(referrals.referredTelegramUserId, userIdStr),
      eq(referrals.chatId, chatIdStr)
    ));
  
  // NOW award points to referrer (only after verification)
  const result = await confirmReferral(userIdStr, chatIdStr);
  
  // Increment successful referral count (only if referrer ID is valid)
  const referrerId = pending.referrerId || "unknown";
  if (referrerId !== "unknown") {
    await incrementSuccessfulReferral(referrerId, chatIdStr);
  }
  
  // Delete the verification message
  if (pending.messageId) {
    try {
      await bot.api.deleteMessage(chatId, pending.messageId);
    } catch (e) { /* ignore */ }
  }
  
  // Get referrer name
  const referrerInfo = await db.select().from(memberScores)
    .where(and(
      eq(memberScores.telegramUserId, pending.referrerId),
      eq(memberScores.chatId, chatIdStr)
    ))
    .limit(1);
  
  const referrerName = referrerInfo[0]?.username ? `@${referrerInfo[0].username}` : referrerInfo[0]?.firstName || "Someone";
  
  return { success: true, referrerName };
}

// Recover pending verifications on bot restart
async function recoverPendingVerifications(bot: Bot<MyContext>): Promise<void> {
  try {
    const allPending = await db.select().from(pendingVerifications);
    const now = new Date();
    
    let expired = 0;
    let restored = 0;
    let cleaned = 0;
    
    for (const pending of allPending) {
      // Safely parse IDs with validation
      const chatId = parseInt(pending.chatId);
      const userId = parseInt(pending.userId);
      const referrerId = pending.referrerId || "unknown";
      
      // Skip invalid entries
      if (isNaN(chatId) || isNaN(userId)) {
        await db.delete(pendingVerifications).where(eq(pendingVerifications.id, pending.id));
        cleaned++;
        continue;
      }
      
      const deadline = pending.deadline ? new Date(pending.deadline) : new Date(0);
      
      if (deadline <= now) {
        // Expired - kick the user and clean up
        try {
          await bot.api.banChatMember(chatId, userId);
          await bot.api.unbanChatMember(chatId, userId);
          
          // Mark referral as kicked
          await db.update(referrals)
            .set({ status: "kicked", flagReason: "Bot restarted - verification expired" })
            .where(and(
              eq(referrals.referredTelegramUserId, pending.userId),
              eq(referrals.chatId, pending.chatId)
            ));
          
          // Increment failed referral (only if referrer ID is valid)
          if (referrerId !== "unknown") {
            await incrementFailedReferral(bot, referrerId, chatId);
          }
          
          // Delete verification message
          if (pending.messageId) {
            try { await bot.api.deleteMessage(chatId, pending.messageId); } catch (e) { /* ignore */ }
          }
          
          expired++;
        } catch (e) {
          console.log(`Failed to kick expired verification ${userId}:`, e);
        }
        
        // Remove from database
        await db.delete(pendingVerifications).where(eq(pendingVerifications.id, pending.id));
      } else {
        // Still valid - set up new timeout
        const remainingMs = deadline.getTime() - now.getTime();
        const key = getVerificationKey(chatId, userId);
        
        const timeoutHandle = setTimeout(async () => {
          await handleVerificationTimeout(bot, chatId, userId, referrerId);
        }, remainingMs);
        
        verificationTimeouts.set(key, { timeoutHandle });
        restored++;
      }
    }
    
    if (expired > 0 || restored > 0 || cleaned > 0) {
      console.log(`Verification recovery: ${expired} expired (kicked), ${restored} restored, ${cleaned} cleaned (invalid)`);
    }
  } catch (error) {
    console.log("Error recovering pending verifications:", error);
  }
}

// === BUD AVATAR SYSTEM ===
const BUD_STRAINS = [
  // Modern Exotics (1-15)
  { name: "Wedding Cake", color: "white and purple", nicknames: ["Cake Boss", "Wedding Planner", "Frosted King", "Vanilla Vibes", "Tiered Titan"], description: "Rich vanilla flavor with relaxing yet uplifting effects. A cross of Triangle Kush and Animal Mints." },
  { name: "Gelato", color: "orange and purple", nicknames: ["Gelato God", "Frozen Flame", "Italian Ice", "Scoop Master", "Dessert Don"], description: "Creamy berry flavor with euphoric, relaxing high. A cross of Sunset Sherbet and Thin Mint Cookies." },
  { name: "Runtz", color: "rainbow pastel", nicknames: ["Runtz Ruler", "Candy Captain", "Sweet Sovereign", "Sugar Rush", "Pastel Prince"], description: "Tropical and fruity with a balanced high. Popular for its vibrant taste. A cross of Zkittlez and Gelato." },
  { name: "Cereal Milk", color: "creamy white", nicknames: ["Breakfast Boss", "Milky Way", "Cereal Killer", "Morning Master", "Spoon Sage"], description: "Sweet creamy flavor like leftover cereal milk. Uplifting and creative effects. Snowman x Y-Life cross." },
  { name: "Ice Cream Cake", color: "purple and cream", nicknames: ["Frozen Treat", "Cream Dream", "Sundae Sage", "Scoop Squad", "Parlor Prince"], description: "Creamy vanilla with hints of sugary dough. Deeply relaxing. A cross of Wedding Cake and Gelato 33." },
  { name: "Kush Mints", color: "mint green", nicknames: ["Minty Fresh", "Cool Kush", "Frost Boss", "Menthol Master", "Arctic Ace"], description: "Cool minty flavor with balanced hybrid effects. A cross of Animal Mints and Bubba Kush." },
  { name: "GMO", color: "olive green", nicknames: ["Garlic Gangster", "Funky King", "Savory Sage", "Umami Boss", "Dank Don"], description: "Pungent garlic and diesel aroma with heavy relaxation. A cross of GSC and Chemdawg." },
  { name: "Apple Fritter", color: "golden brown", nicknames: ["Fritter Fam", "Apple Ace", "Bakery Boss", "Cinnamon King", "Pastry Prince"], description: "Sweet apple pastry flavor with relaxing effects. A cross of Sour Apple and Animal Cookies." },
  { name: "Gorilla Glue", color: "forest green", nicknames: ["GG4 God", "Sticky King", "Glue Guru", "Gorilla Boss", "Adhesive Ace"], description: "Pungent pine aroma with deeply relaxing effects. Crossed with Chem Sis, Sour Dubb, and Chocolate Diesel." },
  { name: "Biscotti", color: "tan and green", nicknames: ["Biscotti Boss", "Italian Stallion", "Cookie King", "Cafe Captain", "Dunk Master"], description: "Sweet cookie flavor with relaxing body effects. A cross of Gelato 25 and South Florida OG." },
  { name: "Rainbow Belts", color: "rainbow striped", nicknames: ["Belt Boss", "Rainbow Rider", "Candy Crusher", "Spectrum Sage", "Color King"], description: "Sweet candy flavor with euphoric effects. A cross of Zkittlez and Moonbow." },
  { name: "Sunset Sherbet", color: "orange and pink", nicknames: ["Sherbet Sage", "Sunset King", "Twilight Titan", "Dusk Don", "Evening Elite"], description: "Fruity sherbet-like flavor with calming yet euphoric effects. Crossed with Pink Panties and Girl Scout Cookies." },
  { name: "MAC", color: "purple and white", nicknames: ["Alien Ace", "Miracle Maker", "Cookie Commander", "MAC Daddy", "Cosmic Captain"], description: "Creamy citrus flavor with balanced effects. A cross of Alien Cookies, Starfighter, and Colombian." },
  { name: "Permanent Marker", color: "dark purple", nicknames: ["Ink Master", "Marker King", "Permanent Press", "Sharpie Sage", "Write On"], description: "Unique gassy aroma with potent relaxing effects. A cross of Biscotti x Jealousy x Sherb BX." },
  { name: "Zkittlez", color: "rainbow", nicknames: ["Skittle King", "Rainbow Boss", "Taste the Sage", "Candy Commander", "Fruit Fury"], description: "Fruity candy-like flavor with euphoric effects. Loved for melting away stress. Crossed with Grape Ape and Grapefruit." },
  // Timeless Classics (16-30)
  { name: "OG Kush", color: "lime green", nicknames: ["OG Original", "Kush King", "West Coast Boss", "Legend Lord", "Classic Captain"], description: "Earthy citrus flavors with balanced mind and body effects. A staple strain. Crossed with Chemdawg, Lemon Thai, and Pakistani Kush." },
  { name: "Sour Diesel", color: "yellow-green", nicknames: ["Diesel Demon", "Sour Sage", "Fuel King", "Gas God", "Sunny Savage"], description: "Energetic and uplifting with pungent diesel aroma. Boosts creativity and focus. A cross of Chemdawg 91 and Super Skunk." },
  { name: "Blue Dream", color: "blue", nicknames: ["Dream Weaver", "Blue Baron", "Sky High", "Azure Ace", "Blueberry Boss"], description: "Smooth blueberry flavor with balanced buzz. Ideal for stress relief without heavy sedation. A cross of Blueberry and Haze." },
  { name: "Jack Herer", color: "bright green", nicknames: ["Jack Attack", "Emperor Jack", "Herer Hero", "Sativa Sage", "Legend Lord"], description: "Euphoric and clear-headed with piney citrus flavor. Ideal for daytime productivity. A blend of Haze, Northern Lights 5, and Shiva Skunk." },
  { name: "White Widow", color: "frosty white", nicknames: ["Widow Maker", "White Knight", "Frost Queen", "Crystal Captain", "Snow Sage"], description: "Earthy and woody, delivering a balanced uplifting buzz. Known for universal appeal. Crossed with Brazil and South Indian landrace." },
  { name: "Northern Lights", color: "teal", nicknames: ["Aurora Ace", "Northern Knight", "Teal Titan", "Cosmic Captain", "Glacier God"], description: "Sweet and spicy with calming full-body effects. Popular for soothing pain and aiding sleep. A hybrid of Afghani and Thai." },
  { name: "Granddaddy Purple", color: "deep purple", nicknames: ["GDP God", "Grape Grandpa", "Purple Patriarch", "Violet Veteran", "Royal Raisin"], description: "Grape and berry aromas with deeply relaxing effects. Loved for tackling insomnia and stress. A cross of Big Bud and Purple Urkle." },
  { name: "Pineapple Express", color: "golden yellow", nicknames: ["Express Elite", "Pineapple Prince", "Tropical Train", "Island King", "Aloha Ace"], description: "Tropical flavors with energetic effects. Famous for creativity and happiness. Crossed with Trainwreck and Hawaiian." },
  { name: "Green Crack", color: "neon green", nicknames: ["Energy King", "Green Genius", "Crack Commander", "Focus Fury", "Daytime Don"], description: "Zesty fruity flavor that energizes and motivates. Popular for battling fatigue and stress. Originally known as Cush." },
  { name: "Purple Haze", color: "purple", nicknames: ["Haze Master", "Purple Prince", "Violet Vibes", "Grape Guru", "Amethyst Angel"], description: "Sweet earthy berry aroma with psychedelic dreamy effects. A rockstar strain in cannabis lore. A blend of Haze and purple phenotype." },
  { name: "Super Silver Haze", color: "silver-green", nicknames: ["Silver Sage", "Haze Hero", "Chrome King", "Platinum Prince", "Metallic Master"], description: "Zesty lemon flavor with smooth energetic high. Known for keeping you uplifted all day. A mix of Skunk, Northern Lights, and Haze." },
  { name: "Bubba Kush", color: "dark green", nicknames: ["Bubba Boss", "Kush Commander", "Couch King", "Relaxation Ruler", "Chill Chief"], description: "Earthy chocolate flavors with tranquilizing buzz. A go-to for winding down at night. A cross of OG Kush and unknown Indica." },
  { name: "Durban Poison", color: "bright green", nicknames: ["Durban Don", "African Ace", "Poison Prince", "Energy Emperor", "Safari Sage"], description: "Sweet and earthy with strong cerebral high. Loved for focus-enhancing and energizing effects. A pure South African landrace." },
  { name: "Chemdawg", color: "olive green", nicknames: ["Chem Commander", "Dawg Father", "Laboratory Lord", "Science Sage", "Chemical King"], description: "Pungent diesel aroma with powerful balanced effects. Known for sparking creativity and relaxation. Thai and Chemdawg D genetics." },
  { name: "Hindu Kush", color: "earthy green", nicknames: ["Mountain Master", "Hindu Hero", "Kush King", "Ancient Ace", "Peak Prince"], description: "Earthy and spicy with relaxing effects. A pure landrace from the Hindu Kush mountains. Classic Indica lineage." },
  // Fruity & Flavorful (31-40)
  { name: "Blueberry", color: "deep blue", nicknames: ["Berry Boss", "Blue Bomber", "Fruit King", "Blueberry Baron", "Cobbler Captain"], description: "Sweet berry aroma with soothing effects. Beloved for relaxation without heavy sedation. Created from Afghani, Thai, and Purple Thai." },
  { name: "Strawberry Cough", color: "red and green", nicknames: ["Strawberry Sage", "Cough Commander", "Berry Boss", "Red Rider", "Sweet Sneeze"], description: "Sweet strawberry-like flavor with gentle cerebral high. Praised for reducing stress and anxiety. Strawberry Fields x Haze cross." },
  { name: "Tangie", color: "bright orange", nicknames: ["Tangie Titan", "Citrus Captain", "Orange Oracle", "Zest Zeus", "Sunny Sage"], description: "Fresh orange flavors with creative euphoric buzz. Loved by artists for inspiration. A Skunk 1 phenotype crossed with Cali Orange." },
  { name: "Mimosa", color: "orange and yellow", nicknames: ["Brunch Boss", "Mimosa Master", "Sunday Sage", "Champagne Chief", "Bubbly Baron"], description: "Citrusy champagne-like flavor with uplifting effects. Perfect for social occasions. A cross of Clementine and Purple Punch." },
  { name: "Lemon Haze", color: "lemon yellow", nicknames: ["Lemon Lord", "Citrus Sage", "Sour King", "Zesty Zeus", "Yellow Yogi"], description: "Citrusy and refreshing, offering a sociable buzz. Perfect for a sunny happy high. Derived from Lemon Skunk and Silver Haze." },
  { name: "Pineapple Kush", color: "golden yellow", nicknames: ["Pineapple Prince", "Tropical Titan", "Island Indica", "Aloha King", "Luau Lord"], description: "Sweet tropical pineapple flavor with relaxing indica effects. A cross of Pineapple and Master Kush." },
  { name: "Slurricane", color: "purple and blue", nicknames: ["Storm Sage", "Slurry King", "Hurricane Hero", "Cyclone Captain", "Tempest Titan"], description: "Sweet berry grape flavor with heavy relaxation. A cross of Do-Si-Dos and Purple Punch." },
  { name: "Grape Ape", color: "grape purple", nicknames: ["Grape God", "Ape Ace", "Vine King", "Purple Primate", "Jungle Juice"], description: "Fruity grape flavor with calming body-focused high. Great for chronic pain and stress. A cross of Mendocino Purps, Skunk, and Afghani." },
  { name: "Blue Cheese", color: "blue-green", nicknames: ["Cheese Chief", "Funky King", "Dairy Don", "Stinky Sage", "Fromage Fury"], description: "Unique savory cheese and blueberry flavor with relaxing effects. A cross of Blueberry and UK Cheese." },
  { name: "Watermelon Zkittlez", color: "pink and green", nicknames: ["Melon Master", "Summer Sage", "Picnic Prince", "Juicy King", "Rind Ruler"], description: "Sweet watermelon candy flavor with euphoric relaxation. A cross of Watermelon and Zkittlez." },
  // Potent & Unique (41-50)
  { name: "Bruce Banner", color: "bright green", nicknames: ["Hulk Hero", "Banner Boss", "Gamma God", "Smash Sage", "Green Giant"], description: "Powerful sativa-dominant with diesel aroma. Known for extreme potency and euphoria. A cross of OG Kush and Strawberry Diesel." },
  { name: "Ghost Train Haze", color: "pale green", nicknames: ["Ghost Rider", "Train Titan", "Phantom Prince", "Spectral Sage", "Rail Wraith"], description: "Intense sativa with citrus pine flavor. One of the strongest strains ever tested. A cross of Ghost OG and Neville's Wreck." },
  { name: "White Fire OG", color: "white and lime", nicknames: ["WiFi Wizard", "Fire King", "Flame Sage", "Blaze Boss", "Hot Spot Hero"], description: "Earthy sour flavor with balanced hybrid effects. Great for creativity and relaxation. A cross of Fire OG and The White." },
  { name: "Death Star", color: "dark green", nicknames: ["Dark Lord", "Empire Elite", "Space Station", "Galactic God", "Force Fury"], description: "Pungent diesel with heavy indica effects. Known for powerful relaxation. A cross of Sensi Star and Sour Diesel." },
  { name: "Amnesia Haze", color: "light green", nicknames: ["Memory Master", "Haze Hero", "Forget-Me-Not", "Mind Melt", "Recall Ruler"], description: "Sweet citrusy notes with energizing blissful high. A favorite for starting the day. Bred from Haze, Jamaican, Afghani, and Hawaiian." },
  { name: "Alien OG", color: "lime green", nicknames: ["Alien Ace", "UFO King", "Cosmic Captain", "Space Sage", "ET Elite"], description: "Lemon and pine flavor with balanced psychoactive effects. A cross of Tahoe OG and Alien Kush." },
  { name: "Monster Cookies", color: "dark purple", nicknames: ["Cookie Monster", "Baked Boss", "Treat Titan", "Snack Sage", "Munchie Master"], description: "Sweet nutty grape flavor with heavy relaxation. Great for evening use. A cross of GSC and Granddaddy Purple." },
  { name: "Motorbreath", color: "diesel green", nicknames: ["Motor Master", "Exhaust Elite", "Gasoline God", "Engine Ace", "Fuel Fury"], description: "Intense diesel garlic aroma with potent effects. A cross of Chemdog and SFV OG Kush." },
  { name: "Gary Payton", color: "green and purple", nicknames: ["The Glove", "Baller Boss", "Court King", "MVP Master", "Slam Sage"], description: "Sweet earthy flavor with balanced euphoric effects. Named after the NBA legend. A cross of The Y and Snowman." },
  { name: "Modified Grapes", color: "deep purple", nicknames: ["Grape God", "Modified Master", "Vine King", "Purple Perfection", "Cluster Captain"], description: "Sweet grape candy flavor with heavy relaxation. A cross of GMO and Purple Punch." }
];

// OWNER-ONLY EXCLUSIVE STRAIN - Dudley's signature strain (only available when owner creates budify)
const NAMASTAY_STRAIN = {
  name: "Namast-Hay",
  color: "bright green with orange hairs and purple hints",
  nicknames: ["Dudley's Choice", "Namaste Master", "Hay Day Hero", "Blinked Boss", "Zen Garden King"],
  description: "Dudley's signature sativa-dominant hybrid created with Blinked. A cross of Candyland and Ghost Train Haze. Features bright green buds with vibrant orange hairs, purple hints, and thick frosty trichome coating. Sweet berry notes from Candyland blend with pungent sour citrus and pine from Ghost Train Haze. Uplifting, creative, and energizing effects."
};

const BUD_BACKGROUNDS = [
  "cosmic galaxy with stars and nebula",
  "tropical sunset with palm trees",
  "neon city lights at night",
  "lush green forest with sunbeams",
  "psychedelic swirling colors",
  "underwater ocean with bubbles",
  "mountain peaks with aurora borealis",
  "retro 80s synthwave grid",
  "zen garden with cherry blossoms",
  "rainbow gradient explosion",
  "cozy fireplace living room",
  "desert canyon at golden hour",
  "snowy winter wonderland",
  "graffiti street art wall",
  "magical mushroom forest",
  "cotton candy clouds in pink sky",
  "ancient temple ruins at dusk",
  "cyberpunk alleyway with holograms",
  "beach waves at sunrise",
  "haunted mansion with fog",
  "disco dance floor with lights",
  "medieval castle on hilltop",
  "bamboo forest with mist",
  "volcano with lava glow",
  "ice cave with crystals"
];

const BUD_POSES = [
  "standing proudly with arms crossed",
  "giving a thumbs up",
  "waving hello",
  "doing a peace sign",
  "flexing muscles",
  "meditating peacefully",
  "dancing happily",
  "striking a superhero pose",
  "sitting relaxed",
  "floating on a cloud",
  "riding a skateboard",
  "holding a tiny flag",
  "playing air guitar",
  "doing yoga tree pose",
  "blowing a kiss"
];

const BUD_ACCESSORIES = [
  "wearing cool sunglasses",
  "wearing a tiny crown",
  "wearing a wizard hat",
  "wearing headphones",
  "wearing a bandana",
  "wearing a bowtie",
  "wearing a baseball cap backwards",
  "wearing a gold chain",
  "holding a magic wand",
  "with a halo above",
  "with butterfly wings",
  "with a cape flowing",
  "with sparkles around",
  "with fire aura",
  "with rainbow trail"
];

const BUD_EXPRESSIONS = [
  "big happy smile",
  "cool smirk",
  "peaceful zen face",
  "excited surprised look",
  "mischievous grin",
  "sleepy relaxed eyes",
  "winking playfully",
  "laughing joyfully",
  "confident determined look",
  "dreamy starry eyes"
];

const CARD_STYLES = [
  "premium golden border with diamond accents",
  "holographic rainbow border",
  "silver chrome metallic border",
  "neon glowing border",
  "vintage worn gold frame",
  "cosmic starfield border",
  "crystal ice border",
  "flame engulfed border",
  "royal purple velvet border",
  "emerald green jeweled border"
];

async function generateBudAvatar(username: string, isOwnerCreated: boolean = false): Promise<{ imageBuffer: Buffer | null; strain: typeof BUD_STRAINS[0]; nickname: string; funnyComment: string }> {
  // Owner-created budify has 20% chance to get exclusive Namast-Hay strain
  let strain: typeof BUD_STRAINS[0];
  if (isOwnerCreated && Math.random() < 0.2) {
    strain = NAMASTAY_STRAIN;
    console.log(`Owner gets EXCLUSIVE Namast-Hay strain for ${username}!`);
  } else {
    strain = BUD_STRAINS[Math.floor(Math.random() * BUD_STRAINS.length)];
  }
  const nickname = strain.nicknames[Math.floor(Math.random() * strain.nicknames.length)];
  const background = BUD_BACKGROUNDS[Math.floor(Math.random() * BUD_BACKGROUNDS.length)];
  const pose = BUD_POSES[Math.floor(Math.random() * BUD_POSES.length)];
  const accessory = BUD_ACCESSORIES[Math.floor(Math.random() * BUD_ACCESSORIES.length)];
  const expression = BUD_EXPRESSIONS[Math.floor(Math.random() * BUD_EXPRESSIONS.length)];
  const cardStyle = CARD_STYLES[Math.floor(Math.random() * CARD_STYLES.length)];
  
  // Generate a funny comment using AI with strain-specific knowledge
  let funnyComment = "";
  try {
    const commentResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Generate ONE short funny, witty comment (max 15 words) about someone getting their cannabis bud avatar. Reference the strain's effects, flavor, or lineage. Be playful and cannabis-themed. No hashtags." },
        { role: "user", content: `User ${username} got the ${strain.name} strain (nickname: "${nickname}"). Strain info: ${strain.description}` }
      ],
      max_tokens: 40
    });
    funnyComment = commentResponse.choices[0]?.message?.content || "Welcome to the bud fam!";
  } catch {
    funnyComment = "Another legend joins the garden!";
  }

  try {
    console.log(`Generating image for ${username} (${strain.name}, pose: ${pose}, bg: ${background})...`);
    const prompt = `Square 1:1 collectible trading card illustration.
A cute cartoon cannabis bud character mascot as the main subject.
The bud is clearly recognizable as a cannabis flower, with dense nug structure, soft rounded shape, visible sugar-leaf details, and subtle trichome sparkle.
The bud is primarily ${strain.color}, with complementary green leaf accents.

Character details:
– ${pose}
– ${accessory}
– ${expression}
– Kawaii chibi style with oversized friendly eyes and playful proportions

Art style: high-quality cartoon illustration, clean outlines, vibrant colors, soft shading.

Background: ${background}, colorful and whimsical, slightly blurred to keep focus on the character.

Card design elements:
– ${cardStyle}
– Sparkles and subtle holographic foil effects
– Collectible card game aesthetic

Text placement (IMPORTANT - text must be legible and fit within card borders):
– Top banner area: "${nickname}" in bold stylized text, centered, easy to read
– Bottom banner area: "${username}" in clean sans-serif font, centered, smaller than title
– Keep text SHORT and within card frame boundaries
– Use contrasting text colors against backgrounds for readability
– Text should never be cut off or extend past card edges

Overall vibe: fun, friendly, peaceful, adorable, and highly collectible.
No realism, no photorealism — purely stylized cartoon mascot art.

Small watermark "dudleyBud.com" in bottom right corner, tiny and subtle.`;
    
    const imageBuffer = await generateImageBuffer(prompt, "1024x1024");
    console.log(`Image generated successfully for ${username} (${imageBuffer.length} bytes)`);
    return { imageBuffer, strain, nickname, funnyComment };
  } catch (error: any) {
    console.error(`Image generation failed for ${username}:`, error?.message || error);
    return { imageBuffer: null, strain, nickname, funnyComment };
  }
}

// === BUDIFY DAILY LIMIT (Admin /budify command) ===
const budifyTimestamps: number[] = []; // Rolling 24-hour window of /budify timestamps
const MAX_DAILY_BUDIFY = 12; // Max 12 /budify images per 24 hours (team + owner combined)
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getBudifyUsageCount(): number {
  const now = Date.now();
  // Remove timestamps older than 24 hours
  while (budifyTimestamps.length > 0 && budifyTimestamps[0] < now - TWENTY_FOUR_HOURS) {
    budifyTimestamps.shift();
  }
  return budifyTimestamps.length;
}

function recordBudifyUsage(): void {
  budifyTimestamps.push(Date.now());
}

// === COMMUNITY BUD AVATAR SCHEDULER ===
const budifiedUsersToday = new Set<string>(); // Track users budified today (reset daily)
let lastBudResetDate = "";
let communityBudTimer: ReturnType<typeof setTimeout> | null = null;

function getRandomBudInterval(): number {
  // Random time within 24-hour period (1 community bud per day to reduce costs)
  // Picks a random interval between 20-28 hours to vary the daily timing
  const minHours = 20;
  const maxHours = 28;
  const hours = minHours + Math.random() * (maxHours - minHours);
  return hours * 60 * 60 * 1000;
}

async function postCommunityBudAvatar() {
  if (!botInstance) return;
  
  // Get today's date for daily reset (Pacific time)
  const pacificFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const today = pacificFormatter.format(new Date());
  
  // Reset budified users at start of new day
  if (lastBudResetDate !== today) {
    lastBudResetDate = today;
    budifiedUsersToday.clear();
    console.log(`New day (${today}) - reset eligible users for community bud`);
  }
  
  // Get active chats from leaderboard data
  const activeChatIds = Array.from(leaderboardData.keys());
  const totalUsers = Array.from(leaderboardData.values()).reduce((sum, m) => sum + m.size, 0);
  console.log(`Community bud: Found ${activeChatIds.length} active chats with ${totalUsers} total tracked users`);
  
  if (activeChatIds.length === 0) {
    console.log("No active chats for community bud - need users to chat first");
    scheduleCommunityBud();
    return;
  }
  
  // Pick first active chat (usually the main community)
  const chatId = activeChatIds[0];
  
  // Get ALL tracked users from chat (not sorted, truly random)
  const chatLeaderboard = leaderboardData.get(chatId);
  const allUsers = chatLeaderboard ? Array.from(chatLeaderboard.values()) : [];
  console.log(`Community bud: Chat ${chatId} has ${allUsers.length} tracked users`);
  
  if (allUsers.length === 0) {
    console.log("No users tracked yet - need users to chat first");
    scheduleCommunityBud();
    return;
  }
  
  // Filter out users who've already been budified today (each person only once per day)
  const eligibleUsers = allUsers.filter(u => {
    const key = `${chatId}_${u.userId}`;
    return !budifiedUsersToday.has(key);
  });
  
  console.log(`Community bud: ${eligibleUsers.length}/${allUsers.length} users eligible (not yet budified today)`);
  
  if (eligibleUsers.length === 0) {
    console.log("All community members have been budified today! Waiting for tomorrow.");
    scheduleCommunityBud();
    return;
  }
  
  // Pick a RANDOM user from ALL eligible members (not sorted by activity)
  const selectedUser = eligibleUsers[Math.floor(Math.random() * eligibleUsers.length)];
  const username = selectedUser.username || selectedUser.firstName;
  
  // Mark user as budified today (by ID to be precise)
  budifiedUsersToday.add(`${chatId}_${selectedUser.userId}`);
  
  console.log(`Creating community bud avatar for ${username} (${budifiedUsersToday.size} budified today)`);
  
  try {
    const { imageBuffer, strain, nickname, funnyComment } = await generateBudAvatar(username);
    
    const caption = `COMMUNITY BUD OF THE HOUR!\n\n` +
      `Congratulations ${selectedUser.username ? `@${selectedUser.username}` : selectedUser.firstName}!\n` +
      `You've been randomly selected as a Community Bud!\n\n` +
      `Your Avatar: "${nickname}"\n` +
      `Strain: ${strain.name}\n` +
      `Color: ${strain.color.toUpperCase()}\n\n` +
      `${funnyComment}\n\n` +
      `Stay active for your chance to get budified!`;
    
    if (imageBuffer) {
      await botInstance.api.sendPhoto(chatId, new InputFile(imageBuffer, `${username}_bud.png`), { caption });
      console.log(`Community bud avatar with image posted for ${username}`);
    } else {
      // Image failed but we still have the avatar info - post text version
      await botInstance.api.sendMessage(chatId, `${caption}\n\n(Avatar art is being crafted... check back soon!)`);
      console.log(`Community bud avatar posted for ${username} (text only - image generation failed)`);
    }
  } catch (error) {
    console.error("Error posting community bud avatar:", error);
    // Try to at least notify the chat something went wrong
    try {
      const displayName = selectedUser.username ? `@${selectedUser.username}` : selectedUser.firstName;
      await botInstance.api.sendMessage(chatId, 
        `We tried to create a Community Bud avatar for ${displayName} but hit a snag! Don't worry, we'll try again next round.`
      );
    } catch (notifyError) {
      console.error("Failed to send error notification:", notifyError);
    }
  }
  
  // Schedule next one
  scheduleCommunityBud();
}

function scheduleCommunityBud() {
  if (communityBudTimer) {
    clearTimeout(communityBudTimer);
  }
  
  const interval = getRandomBudInterval();
  const hours = Math.round(interval / (60 * 60 * 1000) * 10) / 10;
  console.log(`Next community bud scheduled in ${hours} hours`);
  
  communityBudTimer = setTimeout(() => {
    postCommunityBudAvatar();
  }, interval);
}

function startCommunityBudScheduler() {
  console.log("Community bud scheduler started");
  
  // Schedule first one in 4-6 hours (no immediate post on startup)
  scheduleCommunityBud();
}

// === BIRTHDAY CELEBRATION ===
let lastBirthdayCheckDate = "";

async function generateBirthdayCakeImage(username: string): Promise<Buffer | null> {
  try {
    const prompt = `A delicious colorful birthday cake with lit candles, decorated with "Happy Birthday ${username}!" written in icing. Leaf-shaped decorations made of green frosting. Cheerful party atmosphere with confetti. Photorealistic, appetizing, celebratory. Small watermark text "dudleyBud.com" in the bottom right corner, subtle and unobtrusive.`;
    const buffer = await generateImageBuffer(prompt, "1024x1024");
    return buffer;
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
      const cakeImageBuffer = await generateBirthdayCakeImage(displayName);
      
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
        if (cakeImageBuffer) {
          await botInstance.api.sendPhoto(chatId, new InputFile(cakeImageBuffer, `${displayName}_birthday.png`), { caption: birthdayMessage });
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

// === WINNER ANNOUNCEMENTS ===
let lastDailyWinnerDate = "";
let lastWeeklyWinnerWeek = "";
let lastMonthlyWinnerMonth = "";
let lastWeeklyReferralWinnerWeek = "";
let lastMonthlyReferralWinnerMonth = "";

async function generateWinnerImage(winnerName: string, period: 'Daily' | 'Weekly' | 'Monthly', game: 'Trivia' | 'Puzzle'): Promise<Buffer | null> {
  try {
    const prompt = `A cute cartoon cannabis bud character (green with friendly eyes) celebrating with a golden trophy and confetti. The bud character is wearing a winner's crown. Bold stylized text banner reads "${period.toUpperCase()} ${game.toUpperCase()} WINNER" at the top. The character name "${winnerName}" appears on a ribbon below. Celebratory atmosphere with sparkles and stars. Cartoon style, vibrant colors, fun and energetic. Small watermark text "dudleyBud.com" in the bottom right corner, subtle and unobtrusive.`;
    const buffer = await generateImageBuffer(prompt, "1024x1024");
    return buffer;
  } catch (error) {
    console.error(`Error generating winner image for ${winnerName}:`, error);
    return null;
  }
}

async function getKarenWinnerMessage(winnerName: string, period: string, game: string, points: number): Promise<string> {
  try {
    const prompt = `Generate a short, sassy, encouraging message from "Karen Bot" congratulating ${winnerName} for winning the ${period} ${game} competition with ${points} points. Karen is a fun, witty cannabis community bot who speaks with confidence and humor. Keep it to 2-3 sentences max. Be genuinely encouraging but with Karen's signature sass. Don't use emojis.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.9
    });
    
    return response.choices[0]?.message?.content || `Congrats ${winnerName}! You absolutely crushed it!`;
  } catch (error) {
    console.error("Error getting Karen winner message:", error);
    return `Well well well, look who dominated! ${winnerName} just showed everyone how it's done with ${points} points! That's what I call a champion move!`;
  }
}

interface TopScorer {
  username: string | null;
  firstName: string | null;
  points: number;
  chatId: string;
}

async function getTopScorers(period: 'daily' | 'weekly' | 'monthly', game: 'trivia' | 'puzzle'): Promise<Map<string, TopScorer>> {
  const result = new Map<string, TopScorer>();
  
  const now = new Date();
  // Use same UTC-based format as the trivia/puzzle scoring code to match stored data
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const weekNum = getWeekNumber(now);
  const weekStr = `${now.getFullYear()}-W${weekNum}`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  let resetDateField: string;
  let pointsField: string;
  let periodStr: string;
  
  if (game === 'trivia') {
    if (period === 'daily') {
      resetDateField = 'dailyResetDate';
      pointsField = 'dailyPoints';
      periodStr = todayStr;
    } else if (period === 'weekly') {
      resetDateField = 'weeklyResetDate';
      pointsField = 'weeklyPoints';
      periodStr = weekStr;
    } else {
      resetDateField = 'monthlyResetDate';
      pointsField = 'monthlyPoints';
      periodStr = monthStr;
    }
  } else {
    if (period === 'daily') {
      resetDateField = 'puzzleDailyResetDate';
      pointsField = 'puzzleDailyPoints';
      periodStr = todayStr;
    } else if (period === 'weekly') {
      resetDateField = 'puzzleWeeklyResetDate';
      pointsField = 'puzzleWeeklyPoints';
      periodStr = weekStr;
    } else {
      resetDateField = 'puzzleMonthlyResetDate';
      pointsField = 'puzzleMonthlyPoints';
      periodStr = monthStr;
    }
  }
  
  try {
    const allScores = await db.select().from(memberScores);
    
    // Group by chatId and find top scorer for each chat
    const chatGroups = new Map<string, typeof allScores>();
    for (const score of allScores) {
      if (!chatGroups.has(score.chatId)) {
        chatGroups.set(score.chatId, []);
      }
      chatGroups.get(score.chatId)!.push(score);
    }
    
    for (const [chatId, scores] of Array.from(chatGroups.entries())) {
      const validScores = scores.filter((s: typeof allScores[0]) => {
        const resetDate = game === 'trivia' 
          ? (period === 'daily' ? s.dailyResetDate : period === 'weekly' ? s.weeklyResetDate : s.monthlyResetDate)
          : (period === 'daily' ? s.puzzleDailyResetDate : period === 'weekly' ? s.puzzleWeeklyResetDate : s.puzzleMonthlyResetDate);
        const pts = game === 'trivia'
          ? (period === 'daily' ? s.dailyPoints : period === 'weekly' ? s.weeklyPoints : s.monthlyPoints)
          : (period === 'daily' ? s.puzzleDailyPoints : period === 'weekly' ? s.puzzleWeeklyPoints : s.puzzleMonthlyPoints);
        return resetDate === periodStr && (pts || 0) > 0;
      });
      
      if (validScores.length > 0) {
        const sorted = validScores.sort((a: typeof allScores[0], b: typeof allScores[0]) => {
          const ptsA = game === 'trivia'
            ? (period === 'daily' ? a.dailyPoints : period === 'weekly' ? a.weeklyPoints : a.monthlyPoints)
            : (period === 'daily' ? a.puzzleDailyPoints : period === 'weekly' ? a.puzzleWeeklyPoints : a.puzzleMonthlyPoints);
          const ptsB = game === 'trivia'
            ? (period === 'daily' ? b.dailyPoints : period === 'weekly' ? b.weeklyPoints : b.monthlyPoints)
            : (period === 'daily' ? b.puzzleDailyPoints : period === 'weekly' ? b.puzzleWeeklyPoints : b.puzzleMonthlyPoints);
          return (ptsB || 0) - (ptsA || 0);
        });
        
        const winner = sorted[0];
        const winnerPoints = game === 'trivia'
          ? (period === 'daily' ? winner.dailyPoints : period === 'weekly' ? winner.weeklyPoints : winner.monthlyPoints)
          : (period === 'daily' ? winner.puzzleDailyPoints : period === 'weekly' ? winner.puzzleWeeklyPoints : winner.puzzleMonthlyPoints);
        
        result.set(chatId, {
          username: winner.username,
          firstName: winner.firstName,
          points: winnerPoints || 0,
          chatId
        });
      }
    }
  } catch (error) {
    console.error(`Error getting top scorers for ${period} ${game}:`, error);
  }
  
  return result;
}

// === REFERRAL WINNER PRIZES ===
// Get top referrer for each chat for a period
async function getTopReferrers(period: 'weekly' | 'monthly'): Promise<Map<string, { telegramUserId: string; username: string | null; firstName: string | null; referralCount: number; chatId: string }>> {
  const result = new Map<string, { telegramUserId: string; username: string | null; firstName: string | null; referralCount: number; chatId: string }>();
  
  const now = new Date();
  const weekNum = getWeekNumber(now);
  const weekStr = `${now.getFullYear()}-W${weekNum}`;
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodStr = period === 'weekly' ? weekStr : monthStr;
  
  try {
    const allScores = await db.select().from(memberScores);
    
    // Group by chatId and find top referrer for each chat
    const chatGroups = new Map<string, typeof allScores>();
    for (const score of allScores) {
      if (!chatGroups.has(score.chatId)) {
        chatGroups.set(score.chatId, []);
      }
      chatGroups.get(score.chatId)!.push(score);
    }
    
    for (const [chatId, scores] of Array.from(chatGroups.entries())) {
      // Filter to users with referrals in this period
      const validScores = scores.filter((s: typeof allScores[0]) => {
        const resetDate = period === 'weekly' ? s.referralWeeklyResetDate : s.referralMonthlyResetDate;
        const pts = period === 'weekly' ? s.referralWeeklyPoints : s.referralMonthlyPoints;
        return resetDate === periodStr && (pts || 0) > 0;
      });
      
      if (validScores.length > 0) {
        // Sort by referral points for this period
        const sorted = validScores.sort((a: typeof allScores[0], b: typeof allScores[0]) => {
          const ptsA = period === 'weekly' ? (a.referralWeeklyPoints || 0) : (a.referralMonthlyPoints || 0);
          const ptsB = period === 'weekly' ? (b.referralWeeklyPoints || 0) : (b.referralMonthlyPoints || 0);
          return ptsB - ptsA;
        });
        
        const winner = sorted[0];
        const referralCount = period === 'weekly' 
          ? Math.floor((winner.referralWeeklyPoints || 0) / REFERRAL_POINTS)
          : Math.floor((winner.referralMonthlyPoints || 0) / REFERRAL_POINTS);
        
        result.set(chatId, {
          telegramUserId: winner.telegramUserId,
          username: winner.username,
          firstName: winner.firstName,
          referralCount,
          chatId
        });
      }
    }
  } catch (error) {
    console.error(`Error getting top referrers for ${period}:`, error);
  }
  
  return result;
}

// Announce referral winners with budify avatar prize
async function announceReferralWinners(period: 'weekly' | 'monthly') {
  if (!botInstance) return;
  
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  console.log(`Announcing ${periodLabel} referral winners with budify prizes...`);
  
  const topReferrers = await getTopReferrers(period);
  
  for (const [chatId, winner] of Array.from(topReferrers.entries())) {
    const chatIdNum = parseInt(chatId);
    if (isNaN(chatIdNum)) continue;
    
    const winnerName = winner.username ? `@${winner.username}` : winner.firstName || "Champion";
    const displayName = winner.firstName || winner.username || "Top Referrer";
    
    try {
      // Generate budify avatar as prize
      console.log(`Generating budify prize for ${periodLabel} referral winner: ${displayName}`);
      const { imageBuffer, strain, nickname, funnyComment } = await generateBudAvatar(displayName);
      
      const announcement = `${periodLabel.toUpperCase()} REFERRAL CHAMPION\n\n` +
        `${winnerName} brought ${winner.referralCount} new members this ${period}!\n\n` +
        `As a reward, here's your exclusive Bud Avatar:\n` +
        `${strain.name} "${nickname}"\n\n` +
        `${funnyComment}\n\n` +
        `Keep growing the fam! Use /myreferrals to get your invite link.`;
      
      if (imageBuffer) {
        await botInstance.api.sendPhoto(chatIdNum, new InputFile(imageBuffer, `${displayName}_${period}_referral_champion.png`), { caption: announcement });
        console.log(`Sent budify prize to ${periodLabel} referral winner ${displayName} in chat ${chatId}`);
      } else {
        // Fallback if image generation fails
        await botInstance.api.sendMessage(chatIdNum, announcement + "\n\n(Your bud avatar is being generated - check back soon!)");
      }
    } catch (err: any) {
      console.error(`Failed to announce referral winner in chat ${chatId}:`, err);
      if (err.description?.includes("chat not found") || err.description?.includes("bot was blocked")) {
        activeChats.delete(chatIdNum);
      }
    }
  }
  
  if (topReferrers.size === 0) {
    console.log(`No ${period} referral winners to announce`);
  }
}

async function announceWinners(period: 'daily' | 'weekly' | 'monthly') {
  if (!botInstance) return;
  
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  console.log(`Announcing ${periodLabel} winners...`);
  
  // Announce for both games
  for (const game of ['trivia', 'puzzle'] as const) {
    const gameLabel = game.charAt(0).toUpperCase() + game.slice(1);
    const topScorers = await getTopScorers(period, game);
    
    for (const [chatId, winner] of Array.from(topScorers.entries())) {
      const chatIdNum = parseInt(chatId);
      if (isNaN(chatIdNum)) continue;
      
      const winnerName = winner.username ? `@${winner.username}` : winner.firstName || "Champion";
      const displayName = winner.firstName || winner.username || "Champion";
      
      try {
        // Generate winner image
        const imageBuffer = await generateWinnerImage(displayName, periodLabel as any, gameLabel as any);
        
        // Get Karen's encouragement message
        const karenMessage = await getKarenWinnerMessage(winnerName, periodLabel, gameLabel, winner.points);
        
        const announcement = `${periodLabel.toUpperCase()} ${gameLabel.toUpperCase()} WINNER\n\n` +
          `Congratulations ${winnerName}!\n` +
          `${winner.points} points!\n\n` +
          `${karenMessage}`;
        
        if (imageBuffer) {
          await botInstance.api.sendPhoto(chatIdNum, new InputFile(imageBuffer, `${displayName}_${period}_${game}_winner.png`), { caption: announcement });
        } else {
          await botInstance.api.sendMessage(chatIdNum, announcement);
        }
        
        console.log(`Announced ${period} ${game} winner ${displayName} in chat ${chatId}`);
      } catch (err: any) {
        console.error(`Failed to announce winner in chat ${chatId}:`, err);
        if (err.description?.includes("chat not found") || err.description?.includes("bot was blocked")) {
          activeChats.delete(chatIdNum);
        }
      }
    }
    
    // If no winners for this game, post encouragement
    if (topScorers.size === 0) {
      console.log(`No ${period} ${game} winners to announce`);
    }
  }
}

function startWinnerAnnouncementScheduler() {
  const checkAndAnnounce = () => {
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
    
    // Get week and month for tracking (UTC-based to match stored data)
    const weekNum = getWeekNumber(now);
    const weekStr = `${now.getFullYear()}-W${weekNum}`;
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Get day of week in Pacific time for triggering (Sunday before Monday reset)
    const pacificDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short"
    });
    const dayOfWeek = pacificDayFormatter.format(now);
    const isSunday = dayOfWeek === "Sun";
    
    // Check if it's last day of month (in Pacific time for triggering)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowMonthFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit"
    });
    const tomorrowParts = tomorrowMonthFormatter.format(tomorrow).split('-');
    const tomorrowMonthPacific = `${tomorrowParts[0]}-${tomorrowParts[1]}`;
    const todayMonthFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit"
    });
    const todayParts = todayMonthFormatter.format(now).split('-');
    const todayMonthPacific = `${todayParts[0]}-${todayParts[1]}`;
    const isLastDayOfMonth = todayMonthPacific !== tomorrowMonthPacific;
    
    // Announce at 11:55 PM Pacific (23:55)
    if (hour === 23 && minute === 55) {
      // Daily announcement (every day)
      if (lastDailyWinnerDate !== dateStr) {
        lastDailyWinnerDate = dateStr;
        announceWinners('daily');
      }
      
      // Weekly announcement (Sunday before Monday reset)
      if (isSunday && lastWeeklyWinnerWeek !== weekStr) {
        lastWeeklyWinnerWeek = weekStr;
        announceWinners('weekly');
      }
      
      // Weekly REFERRAL winner with budify prize (Sunday at 11:55 PM Pacific)
      if (isSunday && lastWeeklyReferralWinnerWeek !== weekStr) {
        lastWeeklyReferralWinnerWeek = weekStr;
        announceReferralWinners('weekly');
      }
      
      // Monthly announcement (last day of month before 1st reset)
      if (isLastDayOfMonth && lastMonthlyWinnerMonth !== monthStr) {
        lastMonthlyWinnerMonth = monthStr;
        announceWinners('monthly');
      }
      
      // Monthly REFERRAL winner with budify prize (last day of month at 11:55 PM Pacific)
      if (isLastDayOfMonth && lastMonthlyReferralWinnerMonth !== monthStr) {
        lastMonthlyReferralWinnerMonth = monthStr;
        announceReferralWinners('monthly');
      }
    }
  };
  
  setInterval(checkAndAnnounce, 60 * 1000);
  console.log("Winner announcement scheduler started - announces at 11:55 PM Pacific before resets");
  
  // === 6-HOUR REFERRAL PROGRAM REMINDER ===
  let lastReferralReminder = 0;
  const REFERRAL_REMINDER_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  
  const referralReminderMessages = [
    `REFERRAL REMINDER!

Want to earn points while helping the community grow? Here's how:

1. Type /myreferrals to get YOUR personal invite link
2. Share it with friends who'd love Dudley Bud
3. When they join and verify, you get 25 points!

Note: New members joining via referral must verify within 5 minutes to protect our community from bots.

Top referrers get special recognition! Check the leaderboard with /refboard`,

    `Hey fam! Quick reminder about our REFERRAL PROGRAM

Every verified friend you bring = 25 points for YOU!

How it works:
/myreferrals - Get your unique invite link
/refboard - See who's bringing the most new members

Safety first: New members must click "Verify" within 5 minutes to gain full community access.

The more friends you invite, the higher you climb! Top weekly and monthly referrers get exclusive budify avatar prizes!`,

    `COMMUNITY BUILDING TIME!

Did you know you can earn points just by inviting friends?

The Dudley Bud Referral Program:
- Get your personal link: /myreferrals
- Share with friends
- Earn 25 points per verified member!

Safety Note: New members joining via referral must verify within 5 minutes to gain full community access. This protects our community from bots and scammers.

Weekly top referrer gets a special budify avatar! Type /refboard to see current rankings.`
  ];
  
  const postReferralReminder = async () => {
    const now = Date.now();
    if (now - lastReferralReminder < REFERRAL_REMINDER_INTERVAL) return;
    
    lastReferralReminder = now;
    const message = referralReminderMessages[Math.floor(Math.random() * referralReminderMessages.length)];
    
    for (const chatId of Array.from(activeChats)) {
      try {
        await botInstance?.api.sendMessage(chatId, message);
        console.log(`Posted referral reminder to chat ${chatId}`);
      } catch (error) {
        console.log(`Couldn't post referral reminder to chat ${chatId}`);
      }
    }
  };
  
  // Check every hour, post every 6 hours
  setInterval(postReferralReminder, 60 * 60 * 1000);
  // Post first reminder 10 minutes after startup
  setTimeout(postReferralReminder, 10 * 60 * 1000);
  console.log("Referral reminder scheduler started - posts every 6 hours");
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
  
  // Load existing member data from database before starting schedulers
  await loadLeaderboardFromDatabase();
  
  // Recover pending verifications from database (handle restarts gracefully)
  await recoverPendingVerifications(bot);

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  // Start the recipe scheduler
  startRecipeScheduler();
  
  // Start the quote scheduler
  startQuoteScheduler();
  
  // Start the birthday scheduler
  startBirthdayScheduler();
  
  // Start the community bud avatar scheduler
  startCommunityBudScheduler();
  
  // Start the winner announcement scheduler
  startWinnerAnnouncementScheduler();

  // Start bot with retry logic for 409 conflicts (common during rapid restarts)
  const maxRetries = 5;
  const retryDelay = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await bot.start({
        allowed_updates: ["message", "edited_message", "callback_query", "chat_member", "my_chat_member"],
        onStart: () => {
          console.log("AgentKarenBot is running with AI capabilities!");
          console.log("Features: Smart Q&A, Market Reports, Roasts, Auto-engage, Daily Recipes, Birthday Celebrations, Referral Tracking");
        },
      });
      break; // Success, exit retry loop
    } catch (error: any) {
      if (error?.error_code === 409 && attempt < maxRetries) {
        console.log(`409 conflict detected (attempt ${attempt}/${maxRetries}). Waiting ${retryDelay/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error; // Rethrow if not a 409 or max retries reached
      }
    }
  }
}
