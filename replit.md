# Dudley Bud - Web3 Cannabis Character Universe

## Overview
Dudley Bud is a Web3 creative storytelling project built on the Base blockchain, centered around cannabis-themed characters. The project aims to provide entertainment, community engagement, and educational content through a Telegram bot and a React web application. It emphasizes that its NFTs are for entertainment and collecting purposes only, without promises of financial returns.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, Wouter for routing, TanStack React Query for state management, and Tailwind CSS for styling, augmented by shadcn/ui components. Framer Motion handles animations, and Vite is used as the build tool. The architecture is page-based with shared components.

### Backend
The backend operates on Node.js with Express for health checks and API routes. The Telegram bot functionality is managed by grammY. OpenAI GPT-4o-mini is integrated for AI-powered responses. Drizzle ORM is used for database interactions with PostgreSQL, and Zod ensures type safety and runtime validation.

### Core Features
- **Telegram Bot (AgentKarenBot)**:
    - **AI-Powered Interactions**: Q&A, roasts, smart responses, and on-demand recipe generation using OpenAI.
    - **Community Engagement**: Auto-engagement, admin tracking, daily recipes, and sassy conversational comebacks.
    - **User Memory & Personality**: Tracks user interactions and adapts responses based on rudeness. Includes "Karen Mode" for an enhanced personality.
    - **Avatar Generation**: Admin-only feature to create DALL-E 3 bud avatars for users.
    - **Games**: Features "Karen Games" like Space Bud Invaders and Seed Storm, along with Trivia and Word Puzzle games with leaderboards.
    - **Referral Program**: Tracks user referrals with points and leaderboards, including security measures for new user verification.
    - **Scheduled Posts**: Daily and weekly scheduled posts for birthdays, quotes, recipes, community bud avatars, and winner announcements.
    - **Conversational Triggers**: Responds to various casual messages (greetings, info, games, help, characters, referral, safety, mint).
    - **Story Generator**: Template-based random story generation from Dudleyverse content (zero API cost). Triggered by "story", "tell me a story", "dudley story", or "dudleyverse" keywords.
    - **Medical Cannabis Q&A**: Integrated knowledge of THC/CBD, FDA-approved drugs, AU TGA + US FDA access systems, forms, safety warnings with research disclaimer.
    - **Top 100 Google Cannabis Q&A**: Pre-cached answers to common cannabis questions with source attribution.
    - **Persona-Aware Sass**: Recognizes story character usernames (@aussieBoomer=Dudley, @TreeFitty=WeedWacker-Ryan, @Cheyne_Hay=Pinko, @DrTrichome=Blinky) with 15% sass trigger rate.
    - **Bud Boss Recognition**: Special sassy acknowledgment for @aussieBoomer (the owner/Dudley) when he messages. Karen recognizes the boss with playful sass but acknowledges he's in charge.
    - **Ban Tracking**: `/banlist` command for owners to view ban/kick history logged to database.
    - **Owner Trust Management**: `/trustset` and `/trustremove` commands for manual trust management (owner + @TreeFitty only).
    - **Rare Strain Avatars**: Namast-Hay legendary strain system (max 7 ever) with `/legendary` owner-only command.
    - **Seed Storm Game LIVE**: Game playable at t.me/SeedStormBot/SeedStorm. Telegram Stars integration for boosts and prizes. `/seedstorm` command for full info. Keyword triggers for "seed storm" mentions. Excited promo messages with live link.
    - **NFT Status**: Coming soon (not launched yet). Bot responds with teaser messages when asked about minting.
    - **User Interaction Memory**: Tracks last 7 user requests, detects interests from repeated topics, and provides returning user context with natural references ("Last time you asked about...").
    - **Bot Learning System**: Karen learns from community feedback to improve responses over time. Features include:
        - Pattern recognition using keyword extraction and 60% similarity matching
        - Thumbs up/down feedback buttons on AI responses
        - Learned responses require 2+ positive feedback before being used
        - `/stats` command showing total interactions, learned patterns, and approval rate
        - Saves API costs by reusing proven good responses
    - **Joke Collections**: 73+ jokes across 4 categories (cannabis love puns, Halloween jokes, knock knock jokes, stoner one-liners). Random joke dropping (10% chance) adds personality to responses.
- **Moderation System**:
    - **Anti-Spam/Flood Control**: Rate limiting, duplicate message detection, sticker/GIF/voice/video spam detection with TTL cleanup, emoji spam detection.
    - **Scam/Phishing Protection**: Domain blocklists, risk scoring for messages, and auto-quarantine for high-risk content.
    - **Seed Phrase Detection**: Protects users from accidentally sharing BIP39 recovery phrases (12/24 word patterns).
    - **Wallet Drainer Blocking**: Detects and blocks common wallet drainer phrases ("verify wallet", "sync wallet", etc.).
    - **Short Link Blocking**: Blocks URL shorteners (bit.ly, tinyurl, t.co, goo.gl, etc.) used to hide scam links.
    - **Hate Speech Filter**: Base64-obscured slur patterns with text normalization (catches l33t speak, spaces, symbols). Progressive warning system (warn → warn → mute).
    - **Drug Trafficking Detection**: Blocks buying/selling of hard drugs while allowing cannabis culture discussion.
    - **Hard Drug Detection System**: Comprehensive detection of hard drugs (cocaine, meth, heroin, fentanyl, PCP, MDMA, GHB, ketamine) with:
        - Standalone terms (always flagged): cocaine, methamphetamine, heroin, fentanyl, oxycontin, etc.
        - Context-dependent terms (only flagged with suspicious context): coke, molly, meth, etc.
        - Multi-word phrases: "crystal meth", "crack cocaine", "angel dust", etc.
        - Drug emoji detection with suspicious context
        - Progressive warning system (warn → warn → 1hr mute)
        - **Exemptions**: Admins, owners, and fully trusted members (trust level 3 or vouched) bypass detection
        - Name/username check on new member joins (Note: Telegram API doesn't expose user bio in join events - only name/username can be checked)
    - **Dealer Detection System**: Auto-ban for dealer signals in bio/username/messages:
        - Dealer phrases: "the plug", "fully active", "menu available", "fast drop", "no feds", "taking orders", etc.
        - Dealer emojis: plug, phone, gas pump, parachute, package, money bag, rocket, fire, snowflake, pill, etc.
        - Multiple dealer emojis together = instant ban
        - Single dealer emoji + suspicious context (dm, active, menu, delivery) = instant ban
        - **Exemptions**: Admins, owners, and fully trusted members bypass detection
    - **Link Control**: Restrictions on new users posting links, with allowlists for official domains.
    - **Media Caption Moderation**: Scans photo/video/document captions for scam content and links.
    - **Message Edit Tracking**: Monitors when new users (< 24 hours OR < 5 messages) edit their messages. Catches attempts to sneak scam/spam/links by editing innocent messages.
    - **Violation Logging**: All security violations logged to database with @username, type, content, and action taken. `/violations` owner-only command to view logs.
    - **Forwarded Message Restrictions**: New users (< 24 hours) cannot forward messages.
    - **Contact Sharing Restrictions**: New users (< 48 hours) cannot share contacts (prevents support impersonation).
    - **Dangerous File Blocking**: Blocks executables (.exe, .bat, .scr, .apk, etc.) with admin alerts.
    - **Contract Address Blocking**: Auto-kicks users with crypto contract addresses in their names.
    - **Role & Permission System**: Granular control over user actions and moderation commands.
    - **Anti-Raid Mode**: Stricter moderation settings for raid scenarios.
    - **Community Analytics**: Tracks various moderation statistics.
    - **Safety-First Explainers**: Karen explains why messages are deleted in friendly, educational language.
- **Trust System**:
    - **45-Day Eligibility Gate**: Users must be in the community for 45 days before earning trust.
    - **Trust Score (0-100)**: Earned through meaningful messages, replies, game participation, and successful referrals.
    - **Trust Levels (0-3)**: Progressive perks at 0, 25, 50, 75 points.
    - **Vouched vs Earned**: Owners can manually vouch for trusted members (bypasses 45-day gate).
    - **Anti-Gaming Protection**: Daily cap (10 pts), weekly cap (50 pts), meaningful message requirements (10+ chars).
    - **Trust Commands**: `/trustinfo`, `/trustpoints`, `/trustboard`, `/trust`, `/untrust`, `/trustfreeze`, `/trustunfreeze`, `/trustbulk`, `/trusthelp` (owner guide).
- **Web Application**: Showcases character universe, safety information, and interactive content.

### Database
PostgreSQL is used as the primary database, with Drizzle ORM managing schemas and migrations. Key tables include `characters`, `content_items`, `conversations`, `user_memory`, `moderation_stats`, `member_scores`, `referral_codes`, `community_profiles`, `trust_scores`, `banEvents` (ban/kick history), `rareStrainLimits` (global strain caps), `rareStrainRecipients` (legendary avatar recipients), `newUserMessages` (message tracking for edit detection), and `violationLogs` (security violation audit trail).

### API
A RESTful API, defined in `shared/routes.ts`, provides endpoints for character and content retrieval.

### Shared Code
A `shared/` directory contains common code like database schema definitions (`schema.ts`) and API route definitions (`routes.ts`) for both frontend and backend.

## External Dependencies

### Database
- PostgreSQL (via `pg` driver)

### Third-Party Services
- Telegram Bot API (via grammY library)
- OpenAI API (for GPT-4o-mini and DALL-E 3)

### Key NPM Packages
- **UI**: Radix UI, Lucide icons, class-variance-authority
- **Data**: @tanstack/react-query, drizzle-orm, zod
- **Bot**: grammy
- **Session**: connect-pg-simple