import { db } from "./db";
import { characters, contentItems, type InsertCharacter, type InsertContentItem, type Character, type ContentItem } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getCharacters(): Promise<Character[]>;
  createCharacter(char: InsertCharacter): Promise<Character>;
  
  getContentItems(type?: string): Promise<ContentItem[]>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
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
}

export const storage = new DatabaseStorage();
