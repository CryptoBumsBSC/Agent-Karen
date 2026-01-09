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
  // Rudeness tracking for Karen's adaptive responses
  rudeStrikes: integer("rude_strikes").default(0),
  lastRudeDate: text("last_rude_date"),
  wasNiceAfterRude: boolean("was_nice_after_rude").default(false),
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

// Referral codes - unique invite links per user per chat
export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  inviteLink: text("invite_link").notNull(),
  code: text("code").notNull(),
  totalClicks: integer("total_clicks").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: timestamp("last_used_at"),
});

// Referrals - tracks who referred whom
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerTelegramUserId: text("referrer_telegram_user_id").notNull(),
  referredTelegramUserId: text("referred_telegram_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  joinDate: timestamp("join_date").default(sql`CURRENT_TIMESTAMP`),
  confirmedDate: timestamp("confirmed_date"),
  status: text("status").default("pending"), // pending, confirmed, invalid
});

// Moderation stats for community analytics
export const moderationStats = pgTable("moderation_stats", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  newJoins: integer("new_joins").default(0),
  messagesBlocked: integer("messages_blocked").default(0),
  spamBlocked: integer("spam_blocked").default(0),
  scamsBlocked: integer("scams_blocked").default(0),
  linksBlocked: integer("links_blocked").default(0),
  muteCount: integer("mute_count").default(0),
  warnCount: integer("warn_count").default(0),
  raidAttempts: integer("raid_attempts").default(0),
  flaggedForReview: integer("flagged_for_review").default(0),
});

// User moderation status
export const userModerationStatus = pgTable("user_moderation_status", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  role: text("role").default("newbie"), // admin, mod, helper, verified, newbie
  isMuted: boolean("is_muted").default(false),
  muteUntil: timestamp("mute_until"),
  muteReason: text("mute_reason"),
  warnCount: integer("warn_count").default(0),
  lastWarnDate: timestamp("last_warn_date"),
  riskScore: integer("risk_score").default(0),
  joinDate: timestamp("join_date").default(sql`CURRENT_TIMESTAMP`),
  isQuarantined: boolean("is_quarantined").default(false),
  quarantineReason: text("quarantine_reason"),
});

// Chat moderation settings
export const chatModerationSettings = pgTable("chat_moderation_settings", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  raidModeEnabled: boolean("raid_mode_enabled").default(false),
  raidModeEnabledAt: timestamp("raid_mode_enabled_at"),
  raidModeEnabledBy: text("raid_mode_enabled_by"),
  linkBlockingEnabled: boolean("link_blocking_enabled").default(true),
  spamThreshold: integer("spam_threshold").default(5), // messages per 10 sec
  newUserLinkRestriction: integer("new_user_link_restriction").default(4), // hours (minimum 4)
  modChannelId: text("mod_channel_id"), // where to send alerts
});

// Member scores for trivia and activity tracking
export const memberScores = pgTable("member_scores", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  triviaPoints: integer("trivia_points").default(0),
  triviaCorrect: integer("trivia_correct").default(0),
  triviaAttempts: integer("trivia_attempts").default(0),
  messageCount: integer("message_count").default(0),
  lastActive: timestamp("last_active").default(sql`CURRENT_TIMESTAMP`),
  dailyPoints: integer("daily_points").default(0),
  dailyResetDate: text("daily_reset_date"),
  weeklyPoints: integer("weekly_points").default(0),
  weeklyResetDate: text("weekly_reset_date"),
  monthlyPoints: integer("monthly_points").default(0),
  monthlyResetDate: text("monthly_reset_date"),
  // Puzzle game scores (separate from trivia)
  puzzlePoints: integer("puzzle_points").default(0),
  puzzleCorrect: integer("puzzle_correct").default(0),
  puzzleAttempts: integer("puzzle_attempts").default(0),
  puzzleDailyPoints: integer("puzzle_daily_points").default(0),
  puzzleDailyResetDate: text("puzzle_daily_reset_date"),
  puzzleWeeklyPoints: integer("puzzle_weekly_points").default(0),
  puzzleWeeklyResetDate: text("puzzle_weekly_reset_date"),
  puzzleMonthlyPoints: integer("puzzle_monthly_points").default(0),
  puzzleMonthlyResetDate: text("puzzle_monthly_reset_date"),
  // Referral scores
  referralPoints: integer("referral_points").default(0),
  referralCount: integer("referral_count").default(0),
  referralWeeklyPoints: integer("referral_weekly_points").default(0),
  referralWeeklyResetDate: text("referral_weekly_reset_date"),
  referralMonthlyPoints: integer("referral_monthly_points").default(0),
  referralMonthlyResetDate: text("referral_monthly_reset_date"),
});

// === BASE SCHEMAS ===
export const insertCharacterSchema = createInsertSchema(characters).omit({ id: true });
export const insertContentItemSchema = createInsertSchema(contentItems).omit({ id: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertUserMemorySchema = createInsertSchema(userMemory).omit({ id: true });
export const insertCommunityProfileSchema = createInsertSchema(communityProfiles).omit({ id: true, createdAt: true });
export const insertMemberScoreSchema = createInsertSchema(memberScores).omit({ id: true });
export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({ id: true, createdAt: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, joinDate: true });
export const insertModerationStatsSchema = createInsertSchema(moderationStats).omit({ id: true });
export const insertUserModerationStatusSchema = createInsertSchema(userModerationStatus).omit({ id: true });
export const insertChatModerationSettingsSchema = createInsertSchema(chatModerationSettings).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Character = typeof characters.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type UserMemory = typeof userMemory.$inferSelect;
export type CommunityProfile = typeof communityProfiles.$inferSelect;
export type MemberScore = typeof memberScores.$inferSelect;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type ModerationStats = typeof moderationStats.$inferSelect;
export type UserModerationStatus = typeof userModerationStatus.$inferSelect;
export type ChatModerationSettings = typeof chatModerationSettings.$inferSelect;

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type InsertCommunityProfile = z.infer<typeof insertCommunityProfileSchema>;

export type CharacterResponse = Character;
export type ContentItemResponse = ContentItem;

export type ContentType = 'joke' | 'fact' | 'legal' | 'scam_term' | 'project_info';
