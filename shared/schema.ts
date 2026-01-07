import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === TABLE DEFINITIONS ===
export const characters = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  role: text("role").notNull(),
  imageUrl: text("image_url"),
});

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  category: text("category"),
});

// Chat tables for AI integration
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// User memory for bot personality adaptation
export const userMemory = pgTable("user_memory", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  messageCount: integer("message_count").default(0),
  positiveInteractions: integer("positive_interactions").default(0),
  negativeInteractions: integer("negative_interactions").default(0),
  lastSeen: timestamp("last_seen").default(sql`CURRENT_TIMESTAMP`),
  notes: text("notes"),
  isRoastTarget: boolean("is_roast_target").default(false),
});

// Community profiles for remembering member details
export const communityProfiles = pgTable("community_profiles", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull().unique(),
  chatId: text("chat_id"),
  username: text("username"),
  firstName: text("first_name"),
  location: text("location"),
  likes: text("likes"),
  birthday: text("birthday"),
  lastBirthdayYear: integer("last_birthday_year"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// === BASE SCHEMAS ===
export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });
export const insertContentItemSchema = createInsertSchema(contentItems).omit({ id: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertUserMemorySchema = createInsertSchema(userMemory).omit({ id: true });
export const insertCommunityProfileSchema = createInsertSchema(communityProfiles).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Character = typeof characters.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type UserMemory = typeof userMemory.$inferSelect;
export type CommunityProfile = typeof communityProfiles.$inferSelect;

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type InsertCommunityProfile = z.infer<typeof insertCommunityProfileSchema>;

export type CharacterResponse = Character;
export type ContentItemResponse = ContentItem;

export type ContentType = 'joke' | 'fact' | 'legal' | 'scam_term' | 'project_info';
