import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  targetSleepMinutes: integer("target_sleep_minutes").default(480).notNull(),
  chronotype: text("chronotype").default("intermediate").notNull(), // 'early_bird' | 'intermediate' | 'night_owl'
  preferredWakeTime: text("preferred_wake_time").default("06:30").notNull(),
  preferredBedTime: text("preferred_bed_time").default("22:30").notNull(),
  ingestApiKey: text("ingest_api_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const oauthConnections = pgTable("oauth_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'fitbit' | 'google_health'
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncStatus: text("sync_status").default("idle").notNull(), // 'idle' | 'syncing' | 'rate_limited' | 'error'
  rateLimitResetAt: timestamp("rate_limit_reset_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  syncCursor: text("sync_cursor"),
});

export const sleepSessions = pgTable("sleep_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  sourceApp: text("source_app").notNull(), // 'fitbit_cloud' | 'health_connect_bridge' | 'sleep_as_android_csv' | 'google_takeout_json'
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  timeInBedMinutes: integer("time_in_bed_minutes").notNull(),
  sleepEfficiencyPct: integer("sleep_efficiency_pct").default(85).notNull(),
  deepMinutes: integer("deep_minutes").default(0).notNull(),
  lightMinutes: integer("light_minutes").default(0).notNull(),
  remMinutes: integer("rem_minutes").default(0).notNull(),
  awakeMinutes: integer("awake_minutes").default(0).notNull(),
  sleepScore: integer("sleep_score"),
  isMainSleep: boolean("is_main_sleep").default(true).notNull(),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sleepStages = pgTable("sleep_stages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sleepSessions.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // 'awake' | 'light' | 'deep' | 'rem'
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
});

export const syncLogs = pgTable("sync_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  recordsUpserted: integer("records_upserted").default(0).notNull(),
  recordsDeleted: integer("records_deleted").default(0).notNull(),
  statusCode: integer("status_code").default(200).notNull(),
  durationMs: integer("duration_ms").default(0).notNull(),
  errorDetail: text("error_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  oauthConnections: many(oauthConnections),
  sleepSessions: many(sleepSessions),
  syncLogs: many(syncLogs),
}));

export const sleepSessionsRelations = relations(sleepSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sleepSessions.userId],
    references: [users.id],
  }),
  stages: many(sleepStages),
}));

export const sleepStagesRelations = relations(sleepStages, ({ one }) => ({
  session: one(sleepSessions, {
    fields: [sleepStages.sessionId],
    references: [sleepSessions.id],
  }),
}));
