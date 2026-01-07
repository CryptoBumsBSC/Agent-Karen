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
- **Karen Mode**: Toggle fun "Karen" personality mode with /karen
- **User Memory**: Tracks message history and interactions per user session
- **Bud Avatars**: Admin-only `/budify @username` creates DALL-E 3 cartoon trading card avatars with random strain assignment (Purple Haze, Blue Dream, Orange Kush, Sour Diesel, Northern Lights), unique nicknames, and AI-generated funny comments

### Trivia System
- **Multi-Question Rounds**: `/trivia 5` starts 5-question round (1-25 questions supported)
- **AI-Generated Questions**: Uses GPT-4o-mini with 13 topic categories (cannabis strains/science/history, crypto basics/slang, DeFi, Dudley characters, etc.)
- **Leaderboards**: `/leaderboard` shows daily rankings + weekly/monthly top winners
- **Score Tracking**: Daily, weekly, monthly points with automatic period resets
- **Duplicate Prevention**: Hash tracking for 100 questions to avoid repeats

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