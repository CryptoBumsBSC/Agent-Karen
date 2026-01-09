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
- **Moderation System**:
    - **Anti-Spam/Flood Control**: Rate limiting, duplicate message detection, sticker/GIF/voice/video spam detection with TTL cleanup.
    - **Scam/Phishing Protection**: Domain blocklists, risk scoring for messages, and auto-quarantine for high-risk content.
    - **Link Control**: Restrictions on new users posting links, with allowlists for official domains.
    - **Media Caption Moderation**: Scans photo/video/document captions for scam content and links.
    - **Forwarded Message Restrictions**: New users (< 24 hours) cannot forward messages.
    - **Contact Sharing Restrictions**: New users (< 48 hours) cannot share contacts (prevents support impersonation).
    - **Dangerous File Blocking**: Blocks executables (.exe, .bat, .scr, .apk, etc.) with admin alerts.
    - **Contract Address Blocking**: Auto-kicks users with crypto contract addresses in their names.
    - **Role & Permission System**: Granular control over user actions and moderation commands.
    - **Anti-Raid Mode**: Stricter moderation settings for raid scenarios.
    - **Community Analytics**: Tracks various moderation statistics.
- **Web Application**: Showcases character universe, safety information, and interactive content.

### Database
PostgreSQL is used as the primary database, with Drizzle ORM managing schemas and migrations. Key tables include `characters`, `content_items`, `conversations`, `user_memory`, `moderation_stats`, `member_scores`, `referral_codes`, and `community_profiles`.

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