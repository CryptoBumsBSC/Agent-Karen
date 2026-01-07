import { z } from 'zod';
import { characters, contentItems, insertCharacterSchema, insertContentItemSchema } from './schema';

export const api = {
  characters: {
    list: {
      method: 'GET' as const,
      path: '/api/characters',
      responses: {
        200: z.array(z.custom<typeof characters.$inferSelect>()),
      },
    },
  },
  content: {
    list: {
      method: 'GET' as const,
      path: '/api/content',
      input: z.object({
        type: z.string().optional(), // Filter by type (joke, fact, etc.)
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof contentItems.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
