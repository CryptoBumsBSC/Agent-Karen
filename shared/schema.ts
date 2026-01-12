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
  // Last 7 interactions tracking
  lastInteractions: text("last_interactions"), // JSON array of last 7 requests
  interests: text("interests"), // Topics mentioned more than once
  scamStrikes: integer("scam_strikes").default(0), // Scam warning counter
  language: text("language"), // Detected user language
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
  status: text("status").default("pending"), // pending, confirmed, invalid, kicked
  // Security fields
  riskScore: integer("risk_score").default(0),
  isQuarantined: boolean("is_quarantined").default(false),
  flagReason: text("flag_reason"),
  verifiedAt: timestamp("verified_at"),
  verifyDeadline: timestamp("verify_deadline"),
});

// Referrer status - tracks referrer trustworthiness
export const referrerStatus = pgTable("referrer_status", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  failedReferrals: integer("failed_referrals").default(0),
  successfulReferrals: integer("successful_referrals").default(0),
  isSuspended: boolean("is_suspended").default(false),
  suspendedAt: timestamp("suspended_at"),
  suspendReason: text("suspend_reason"),
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

// Pending referral verifications - persisted so restarts don't strand users
export const pendingVerifications = pgTable("pending_verifications", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  referrerId: text("referrer_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  messageId: integer("message_id"),
  deadline: timestamp("deadline").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Q&A Knowledge Cache - stores learned questions and answers to reduce AI costs
export const qaCache = pgTable("qa_cache", {
  id: serial("id").primaryKey(),
  questionHash: text("question_hash").notNull(), // Normalized hash of the question
  questionText: text("question_text").notNull(), // Original question
  answerText: text("answer_text").notNull(), // AI-generated answer
  askCount: integer("ask_count").default(1), // How many times this was asked
  lastAsked: timestamp("last_asked").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Ban Events - tracks all bans, kicks, and removals for owner review
export const banEvents = pgTable("ban_events", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  telegramUserId: text("telegram_user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  actionType: text("action_type").notNull(), // ban, kick, auto_remove, mute
  reason: text("reason"),
  actorId: text("actor_id"), // who performed the action (bot or admin user id)
  actorUsername: text("actor_username"),
  executionSource: text("execution_source").default("bot"), // bot, admin, auto_moderation
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Rare Strain Limits - tracks limited edition strain avatar counts
export const rareStrainLimits = pgTable("rare_strain_limits", {
  id: serial("id").primaryKey(),
  strainName: text("strain_name").notNull().unique(),
  maxSupply: integer("max_supply").notNull(),
  usedCount: integer("used_count").default(0),
  remainingCount: integer("remaining_count").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: timestamp("last_used_at"),
});

// Rare Strain Recipients - tracks who received rare strain avatars
export const rareStrainRecipients = pgTable("rare_strain_recipients", {
  id: serial("id").primaryKey(),
  strainName: text("strain_name").notNull(),
  recipientUserId: text("recipient_user_id").notNull(),
  recipientUsername: text("recipient_username"),
  awardedBy: text("awarded_by").notNull(), // owner user id
  awardedAt: timestamp("awarded_at").default(sql`CURRENT_TIMESTAMP`),
  imageUrl: text("image_url"),
});

// Trust System - 45-day gated trust scores with anti-gaming
export const trustScores = pgTable("trust_scores", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  // Trust score and status
  trustScore: integer("trust_score").default(0), // 0-100 scale
  trustStatus: text("trust_status").default("none"), // none, vouched, earned
  isTrusted: boolean("is_trusted").default(false),
  trustLevel: integer("trust_level").default(0), // 0-3 levels for progressive perks
  // 45-day eligibility gate
  joinDate: timestamp("join_date").default(sql`CURRENT_TIMESTAMP`),
  eligibilityDate: timestamp("eligibility_date"), // 45 days after join
  isEligible: boolean("is_eligible").default(false),
  // Manual trust controls (owner only)
  vouchedBy: text("vouched_by"), // telegram user id of voucher
  vouchedAt: timestamp("vouched_at"),
  isFrozen: boolean("is_frozen").default(false),
  frozenBy: text("frozen_by"),
  frozenAt: timestamp("frozen_at"),
  frozenReason: text("frozen_reason"),
  // Anti-gaming metrics
  dailyMsgCount: integer("daily_msg_count").default(0),
  dailyMsgDate: text("daily_msg_date"), // YYYY-MM-DD
  weeklyMsgCount: integer("weekly_msg_count").default(0),
  weeklyResetDate: text("weekly_reset_date"),
  uniqueRepliedTo: integer("unique_replied_to").default(0), // diversity of interactions
  meaningfulMsgCount: integer("meaningful_msg_count").default(0), // >10 chars
  // Trust history
  lastTrustUpdate: timestamp("last_trust_update"),
  trustGainedToday: integer("trust_gained_today").default(0),
  trustGainedThisWeek: integer("trust_gained_this_week").default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// User project question cooldowns (72 hours between asks)
export const userProjectQuestions = pgTable("user_project_questions", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  lastAskedAt: timestamp("last_asked_at").default(sql`CURRENT_TIMESTAMP`),
});

// New user message tracking (for edit detection)
export const newUserMessages = pgTable("new_user_messages", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").notNull(),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username"),
  originalContent: text("original_content"),
  hasMedia: boolean("has_media").default(false),
  hasLinks: boolean("has_links").default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Violation logs for all security events
export const violationLogs = pgTable("violation_logs", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username"),
  violationType: text("violation_type").notNull(), // edit_scam, edit_link, edit_media, raid_join, burst_post, etc
  originalContent: text("original_content"),
  violatingContent: text("violating_content"),
  actionTaken: text("action_taken"), // deleted, warned, muted, kicked, banned
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
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
export const insertQaCacheSchema = createInsertSchema(qaCache).omit({ id: true, createdAt: true, lastAsked: true });
export const insertReferrerStatusSchema = createInsertSchema(referrerStatus).omit({ id: true });
export const insertPendingVerificationSchema = createInsertSchema(pendingVerifications).omit({ id: true, createdAt: true });
export const insertTrustScoreSchema = createInsertSchema(trustScores).omit({ id: true, createdAt: true });
export const insertBanEventSchema = createInsertSchema(banEvents).omit({ id: true, createdAt: true });
export const insertRareStrainLimitSchema = createInsertSchema(rareStrainLimits).omit({ id: true, createdAt: true });
export const insertRareStrainRecipientSchema = createInsertSchema(rareStrainRecipients).omit({ id: true, awardedAt: true });
export const insertUserProjectQuestionSchema = createInsertSchema(userProjectQuestions).omit({ id: true, lastAskedAt: true });
export const insertNewUserMessageSchema = createInsertSchema(newUserMessages).omit({ id: true, createdAt: true });
export const insertViolationLogSchema = createInsertSchema(violationLogs).omit({ id: true, createdAt: true });

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
export type QaCache = typeof qaCache.$inferSelect;
export type ReferrerStatus = typeof referrerStatus.$inferSelect;
export type PendingVerification = typeof pendingVerifications.$inferSelect;
export type TrustScore = typeof trustScores.$inferSelect;
export type BanEvent = typeof banEvents.$inferSelect;
export type RareStrainLimit = typeof rareStrainLimits.$inferSelect;
export type RareStrainRecipient = typeof rareStrainRecipients.$inferSelect;
export type UserProjectQuestion = typeof userProjectQuestions.$inferSelect;
export type NewUserMessage = typeof newUserMessages.$inferSelect;
export type ViolationLog = typeof violationLogs.$inferSelect;

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertUserMemory = z.infer<typeof insertUserMemorySchema>;
export type InsertCommunityProfile = z.infer<typeof insertCommunityProfileSchema>;

export type CharacterResponse = Character;
export type ContentItemResponse = ContentItem;

export type ContentType = 'joke' | 'fact' | 'legal' | 'scam_term' | 'project_info';
