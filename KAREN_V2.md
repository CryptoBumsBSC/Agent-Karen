# AgentKarenBot — Version 2.0
**Saved:** May 2026
**Checkpoint commit:** b24af11d95ad45714d2098b1e6b5bb2d9fc0d1b3

---

## What's in Karen v2

### Multi-Community SaaS Architecture
Karen v2 is a fully multi-tenant bot. Every group that adds the bot gets its own isolated configuration, feature set, subscription tier, admin list, and data. Nothing bleeds between communities.

### 5 Subscription Tiers
| Tier | How to set | What they get |
|---|---|---|
| TRIAL | Auto on /setup | Full access for 7 days |
| ACTIVE | /activate [chatId] | Full access — paid |
| COMPLIMENTARY | /makefree [chatId] | Full access — gifted by owner |
| FREE | /deactivate [chatId] | Basic safety only |
| BANNED | /bangroup [chatId] | Complete silence |

### 27 Toggleable Features
Organised into 4 groups. Every feature can be switched on or off per community independently.

**SAFETY FILTERS** (always free on all tiers)
- spam — Anti-Spam / Flood Control
- scam — Scam & Phishing Protection
- hate — Hate Speech Filter
- drugs — Hard Drug Detection
- dealers — Dealer Detection
- links — Link Control (New Users)
- files — Dangerous File Blocking
- newuser — New User Restrictions

**SECURITY GATES** (paid)
- captcha — CAPTCHA Verification Gate
- accountAge — New Account Age Gate
- bioScan — Profile Bio Scanning
- massMention — Mass-Mention Spam Detection
- edits — Message Edit Tracking
- impersonation — Admin Impersonation Detection
- raid — Anti-Raid Mode
- crossBan — Cross-Group Ban Propagation

**AI & PERSONALITY** (paid)
- aiChat — AI Chat Responses (GPT-4o-mini / roasts / auto-engage)
- medicalQA — Medical Cannabis Q&A Mode
- personality — Karen Personality (catchphrases / mood)
- gifs — Karen GIF Reactions
- learning — Bot Learning System
- stories — Story Generator

**COMMUNITY FEATURES** (paid)
- trust — Full Trust System
- referrals — Referral Program
- games — Games (Trivia / Puzzle / Seed Storm)
- giveaways — Giveaway System
- scheduled — Scheduled Posts

### Admin Management (Per Community)
- In-group reply-based: /addadmin · /removeadmin · /changeadmin · /listadmins
- Owner remote from DM: /setadmin · /removeadmin · /changeadmin · /listadmins [chatId] [userId]
- Bot nickname per community: /setnickname

### Global Owner Remote Control
Full management of every group from a single DM with the bot.
- /communities — list all groups
- /communityinfo [chatId] — full details
- /activate / /makefree / /deactivate / /extendtrial — tier control
- /bangroup / /leavegroup — access control
- /setadmin / /removeadmin / /changeadmin / /listadmins — admin control
- /trustset / /trustremove — trust management
- /violations — violation audit log
- /ownerhelp — full command reference

### Admin Reference Commands (New in v2)
- /help — User-facing command list (uses community bot nickname)
- /status — Live community snapshot (tier, feature counts, admin list)
- /adminhelp — Full 4-page admin reference card (any bot admin can run this)
- /settings — Grouped feature dashboard with FREE / PAID / LOCKED labels

### Upgrade Prompts (New in v2)
Free/expired communities no longer get silence. Every blocked command shows a clear upgrade card listing exactly what's locked, with contact info.

### Moderation (21 distinct systems)
Anti-spam, scam/phishing, hate speech, hard drugs, dealer detection, seed phrase protection, wallet drainer blocking, short link blocking, link control, file blocking, contract address blocking, message edit tracking, forwarded message restrictions, contact sharing restrictions, caption moderation, admin impersonation detection, anti-raid lockdown, cross-group bans, bio scanning, CAPTCHA gate, account age gate.

### Trust System
45-day eligibility gate. Score 0–100. Four trust levels. Daily/weekly caps. Owner vouching. Level 3 bypasses most moderation.

### AI & Content
GPT-4o-mini for /ask and /roast. Auto-engage on triggers. Bot learning (saves proven responses, reduces API cost). Medical cannabis Q&A with pre-cached top-100 answers. Template-based story generator (zero API cost). 73+ jokes across 4 categories.

### Games
Cannabis Trivia, Word Puzzle, Space Bud Invaders, Seed Storm (live Telegram Mini App at t.me/SeedStormBot/SeedStorm with Telegram Stars integration).

### Scheduled Posts
Daily recipe (4pm Pacific), daily quote (10am), birthday check (9am), community bud avatar rotation, winner announcements (11:55pm), referral reminders (every 6 hours), trial expiry checks (daily).

### Rare Strain Avatars
Maximum 7 ever issued globally. DALL-E 3 generated. /legendary owner-only command. Global cap enforced in database.

---

## Database Tables (v2)
- communities — per-group config, tier, nickname, admins, settings
- chatFeatureSettings — 27 feature toggle states per community
- globalBans — cross-group ban list
- characters, content_items, conversations, user_memory
- moderation_stats, member_scores, referral_codes, community_profiles
- trust_scores, banEvents, rareStrainLimits, rareStrainRecipients
- newUserMessages, violationLogs

---

## Key Files
- server/bot.ts — entire bot logic (~13,300 lines)
- shared/schema.ts — all database table definitions
- client/src/ — React web frontend
- replit.md — project overview and preferences
