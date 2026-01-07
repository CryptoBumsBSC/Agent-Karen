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
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Type Safety**: Zod for runtime validation, drizzle-zod for schema integration

The server primarily runs the Telegram bot with a lightweight HTTP server for health checks.

### Database Design
Two main tables:
- **characters**: Stores character information (name, description, role, imageUrl)
- **content_items**: Stores various content types (jokes, facts, legal info, scam terms, project info)

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