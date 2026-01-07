import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  type: text("type").notNull(), // 'joke', 'fact', 'legal', 'scam_term', 'project_info'
  title: text("title"),
  content: text("content").notNull(),
  category: text("category"), // for scam terms: 'marketing', 'crypto', etc.
});

// === BASE SCHEMAS ===
export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });
export const insertContentItemSchema = createInsertSchema(contentItems).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Character = typeof characters.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;

export type CharacterResponse = Character;
export type ContentItemResponse = ContentItem;

export type ContentType = 'joke' | 'fact' | 'legal' | 'scam_term' | 'project_info';
