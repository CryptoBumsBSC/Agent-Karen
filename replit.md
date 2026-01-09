# Dudley Bud - Web3 Cannabis Character Universe

## Overview

Dudley Bud is a Web3 creative storytelling project built on the Base blockchain. The application consists of two main components:

1. **Telegram Bot (AgentKarenBot)** - A community bot that provides project information, scam awareness education, and entertainment features
2. **React Web Application** - A frontend showcasing the character universe, safety information, and fun interactive content

The project centers around cannabis-themed characters (Dudley Bud, Blaze, Kush, Sativa, Indica) and emphasizes that NFTs are for entertainment/collecting only with no financial returns promised.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom theme configuration
- **UI Components**: shadcn/ui component library (New York style)
- **Animations**: Framer Motion for page transitions and interactions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a pages-based structure with shared components. Key pages include Home, Characters, Safety, and FunZone.

### Backend Architecture
- **Runtime**: Node.js with Express (used for health checks and API routes)
- **Bot Framework**: grammY for Telegram bot functionality
- **AI Integration**: OpenAI GPT-4o-mini for intelligent responses
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Type Safety**: Zod for runtime validation, drizzle-zod for schema integration

The server primarily runs the Telegram bot with a lightweight HTTP server for health checks.

### Bot Features (AgentKarenBot)
- **AI-Powered Q&A**: /ask command answers questions about Dudley Bud using OpenAI
- **Market Reports**: /market fetches live crypto prices (top 10 or specific token search)
- **AI Roasts**: /roast generates witty roasts for community members
- **Smart Responses**: Auto-responds when mentioned or when questions are asked
- **Scam Detection**: Monitors for suspicious messages and crypto addresses
- **Auto-Engage**: Sends friendly prompts when chat is quiet for 30+ minutes
- **Admin Tracking**: Calls out admins inactive for 24+ hours with friendly reminders
- **Daily Recipes**: Posts cannabis recipes from chef-420.com at 4 PM Pacific daily
- **On-Demand Recipe Generation**: Ask Karen for any cannabis recipe and she'll generate one with AI, complete with Karen sass and DYOR disclaimer
- **Sassy Comebacks**: When users drop one-liners or jokes (lol, haha, bruh, etc.), Karen has a 30% chance to fire back with a witty comeback
- **Karen Mode**: Toggle fun "Karen" personality mode with /karen
- **User Memory**: Tracks message history and interactions per user session
- **Rudeness Tracking**: Karen remembers rude users and adapts her responses:
  - First offense: Gentle pushback, still helpful
  - 2+ offenses: Sassy Karen side-eye, firm but fair
  - 5+ offenses: FULL Karen mode - tells them off and demands respect
  - Being nice reduces strikes and Karen acknowledges the improvement
- **Bud Avatars**: Admin-only `/budify @username` creates DALL-E 3 cartoon trading card avatars with random strain assignment (Purple Haze, Blue Dream, Orange Kush, Sour Diesel, Northern Lights), unique nicknames, and AI-generated funny comments
- **Community Bud Scheduler**: Automatically generates bud avatars for random active community members every 4-6 hours (max 4/day to control costs). First post 2 minutes after deployment, then random intervals.
- **Karen Games**: Type "karen games" to see list of available games (Space Bud Invaders / Seed Storm)
- **Karen Recipe**: Type "karen recipe" to get a random cannabis recipe from the collection

### Advanced Moderation System
- **Anti-Spam/Flood Control**:
  - Rate limiting: 5 messages per 10 seconds per user
  - Duplicate detection: Auto-blocks repeated identical messages (3+ times)
  - Silent flood control: Deletes spam without cluttering chat
- **Scam/Phishing Protection**:
  - Domain blocklist: Known scam domains auto-blocked
  - Domain allowlist: Official links always allowed
  - Risk scoring (0-100): Calculates risk based on links, phrases, account age, patterns
  - Auto-quarantine: High-risk messages (60+) auto-deleted and flagged
  - Human handoff: Medium-risk messages (40-60) flagged for mod review
- **Link Control for New Users**:
  - New members cannot post links for first 4 hours minimum (48 hours in raid mode)
  - Links are automatically deleted (not just warned)
  - Only allowed domains permitted during restriction period
  - Verified/helper+ roles exempt from link restrictions
- **Contract Address Blocking**:
  - Users with crypto contract addresses (0x...) in username/name are auto-kicked on join
  - Admins are notified when scammer accounts are blocked
- **Role & Permission System**:
  - Roles: admin > mod > helper > verified > newbie
  - Permission checks before all moderation actions
  - Admins and mods bypass all moderation checks
  - `/setrole <role>` - Set user's trust level (admin only)
- **Moderation Commands (Admin/Mod Only)**:
  - `/mute [duration] [reason]` - Mute user (reply to message). Duration: 30m, 1h, 1d. Admins are @ mentioned when users are muted
  - `/unmute` - Unmute user (reply to message)
  - `/warn [reason]` - Warn user. 3 warnings = 1 hour auto-mute
  - `/raidmode on|off` - Toggle anti-raid protections
  - `/modstats [week]` - View moderation statistics (today or week)
  - `/setrole <role>` - Set user's role (admin, mod, helper, verified, newbie)
- **Anti-Raid Mode** (`/raidmode on`):
  - New users cannot post links for 48 hours (vs 24)
  - Lower risk thresholds for auto-action (40 vs 60)
  - Stricter spam detection
  - Quick toggle for when raids are detected
- **Community Analytics**:
  - Tracks: new joins, messages blocked, spam blocked, scams blocked, links blocked, mutes, warns, flags
  - Daily and weekly stats via `/modstats`
  - Stored in `moderation_stats` table

### Trivia System
- **Multi-Question Rounds**: `/trivia 5` starts 5-question round (1-25 questions supported)
- **AI-Generated Questions**: Uses GPT-4o-mini with 13 topic categories (cannabis strains/science/history, crypto basics/slang, DeFi, Dudley characters, etc.)
- **Leaderboards**: `/leaderboard` shows daily rankings + weekly/monthly top winners
- **Score Tracking**: Daily, weekly, monthly points with automatic period resets
- **Duplicate Prevention**: Hash tracking for 100 questions to avoid repeats

### Word Puzzle Game
- **Commands**: `/puzzle`, `/puzzle easy`, `/puzzle hard` to start, `/guess WORD` to answer
- **Difficulty Levels**: 
  - Easy: 4-5 letter words, 60 seconds, 5 points
  - Hard: 6-8 letter cannabis/crypto words, 30 seconds, 15 points
- **Separate Leaderboard**: `/puzzleboard` shows puzzle-only rankings (daily/weekly/monthly)
- **Word Lists**: 50 easy words, 50+ hard words (cannabis strains, crypto terms)
- **One Guess Per Round**: Users get one attempt per puzzle

### Referral Program
- **Commands**: `/myreferrals` gets your personal invite link and stats, `/refboard` shows leaderboard
- **Tracking**: Bot creates unique invite links per user, tracks when new members join via those links
- **Points**: 25 points per confirmed referral
- **Leaderboards**: Weekly and All-time rankings (`/refboard` or `/refboard all`)
- **Database**: Uses `referral_codes` and `referrals` tables, scores stored in `memberScores`
- **Detection**: Uses Telegram's chat_member updates to detect invite link usage
- **AI Knowledge**: Bot can explain referral program via `/ask` or when mentioned - instant responses for referral questions (no AI cost)
- **Winner Prizes**: Top weekly referrer (announced Sunday 11:55 PM Pacific) and top monthly referrer (announced last day of month 11:55 PM Pacific) automatically receive exclusive budify avatar rewards

### Daily Scheduled Posts
- **Birthday Check**: 9 AM Pacific - Celebrates member birthdays with AI-generated cake images
- **Quote of the Day**: 10 AM Pacific - Motivational/cannabis quotes (50 in rotation)
- **Daily Recipe**: 4 PM Pacific - Cannabis recipes from chef-420.com
- **Community Bud**: Every 20-28 hours - Random active member gets an AI-generated bud avatar (1/day to control costs)
- **Winner Announcements**: 11:55 PM Pacific - Announces top scorers before resets with AI-generated images and Karen's sassy congratulations
  - Daily: Every night at 11:55 PM Pacific
  - Weekly: Sunday nights at 11:55 PM Pacific (before Monday reset)
  - Monthly: Last day of month at 11:55 PM Pacific (before 1st reset)
  - Covers both Trivia and Puzzle games separately

### Space Bud Invaders Game (READY TO PUBLISH)
**Status**: Complete, needs Republish to go live
**File Location**: `client/public/game.html`
**Bot Command**: `/play` - Opens game in Telegram browser

**Game Features**:
- Classic Space Invaders style gameplay
- Player is "Dudley" - a cute green cannabis bud with eyes
- Enemy buds are different strains with colors and point values:
  - Purple Haze (purple) - 30 pts
  - Blue Dream (blue) - 25 pts
  - Orange Kush (orange) - 20 pts
  - Sour Diesel (yellow) - 15 pts
  - Northern Lights (teal) - 10 pts
- Seed-shaped bullets with glow effects
- Multiple waves that get progressively harder
- High score saved locally in browser
- Touch controls for mobile, keyboard for desktop

**How it works**:
1. User types `/play` in Telegram chat
2. Bot shows message with "PLAY NOW" button
3. Button opens game at: https://dudley-bud-web3-universe-dankprof.replit.app/game.html
4. Game runs in Telegram's built-in browser

**To finish setup**: Click Republish to push game live

### Database Design
Main tables:
- **characters**: Stores character information (name, description, role, imageUrl)
- **content_items**: Stores various content types (jokes, facts, legal info, scam terms, project info)
- **conversations**: AI chat conversation tracking
- **messages**: Individual messages within conversations
- **user_memory**: Per-user interaction tracking for the bot
- **moderation_stats**: Daily moderation analytics (joins, blocks, mutes, warns, flags)
- **user_moderation_status**: Per-user moderation state (role, mute status, warn count, risk score)
- **chat_moderation_settings**: Per-chat settings (raid mode, link restrictions, thresholds)

Schema is defined in `shared/schema.ts` and shared between frontend and backend.

### API Structure
RESTful endpoints defined in `shared/routes.ts`:
- `GET /api/characters` - Retrieve all characters
- `GET /api/content` - Retrieve content items with optional type filter

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Database schema and type definitions
- `routes.ts` - API route definitions with Zod validation

## External Dependencies

### Database
- **PostgreSQL** via `pg` driver
- Connection through `DATABASE_URL` environment variable
- Migrations managed by Drizzle Kit (`drizzle-kit push`)

### Third-Party Services
- **Telegram Bot API** - Bot functionality via grammY library
- Requires `TELEGRAM_BOT_TOKEN` environment variable

### Key NPM Packages
- **UI**: Radix UI primitives, Lucide icons, class-variance-authority
- **Data**: @tanstack/react-query, drizzle-orm, zod
- **Bot**: grammy (Telegram bot framework)
- **Session**: connect-pg-simple for PostgreSQL session storage