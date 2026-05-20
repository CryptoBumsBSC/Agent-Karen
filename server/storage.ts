import { db } from "./db";
import {
  characters, contentItems,
  communities, chatFeatureSettings,
  type InsertCharacter, type InsertContentItem,
  type Character, type ContentItem,
  type Community, type ChatFeatureSettings,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getCharacters(): Promise<Character[]>;
  createCharacter(char: InsertCharacter): Promise<Character>;

  getContentItems(type?: string): Promise<ContentItem[]>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;

  getCommunities(): Promise<Community[]>;
  getCommunityById(chatId: string): Promise<Community | null>;
  updateCommunityStatus(chatId: string, status: string, extra?: Record<string, unknown>): Promise<Community | null>;
  getCommunityFeatures(chatId: string): Promise<ChatFeatureSettings | null>;
}

export class DatabaseStorage implements IStorage {
  async getCharacters(): Promise<Character[]> {
    return await db.select().from(characters);
  }

  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const [character] = await db.insert(characters).values(insertCharacter).returning();
    return character;
  }

  async getContentItems(type?: string): Promise<ContentItem[]> {
    if (type) {
      return await db.select().from(contentItems).where(eq(contentItems.type, type));
    }
    return await db.select().from(contentItems);
  }

  async createContentItem(insertItem: InsertContentItem): Promise<ContentItem> {
    const [item] = await db.insert(contentItems).values(insertItem).returning();
    return item;
  }

  async getCommunities(): Promise<Community[]> {
    return await db.select().from(communities).orderBy(communities.createdAt);
  }

  async getCommunityById(chatId: string): Promise<Community | null> {
    const [row] = await db.select().from(communities).where(eq(communities.chatId, chatId)).limit(1);
    return row ?? null;
  }

  async updateCommunityStatus(
    chatId: string,
    status: string,
    extra: Record<string, unknown> = {}
  ): Promise<Community | null> {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      ...extra,
    };
    const [updated] = await db
      .update(communities)
      .set(updates as any)
      .where(eq(communities.chatId, chatId))
      .returning();
    return updated ?? null;
  }

  async getCommunityFeatures(chatId: string): Promise<ChatFeatureSettings | null> {
    const [row] = await db
      .select()
      .from(chatFeatureSettings)
      .where(eq(chatFeatureSettings.chatId, chatId));
    return row ?? null;
  }
}

export const storage = new DatabaseStorage();
