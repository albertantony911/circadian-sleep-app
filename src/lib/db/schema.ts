import { pgTable, text, integer, boolean, timestamp, jsonb, real, customType } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Vector custom type supporting 768 dimensions (for pgvector & fallback)
const vector768 = customType<{ data: number[] }>({
  dataType() {
    return "vector(768)";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): number[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        if (value.startsWith("[") && value.endsWith("]")) {
          return JSON.parse(value);
        }
      } catch {
        return value.replace(/[\[\]]/g, "").split(",").map(Number);
      }
    }
    return [];
  },
});

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
  // Autonomic & Regularity Signal Processing fields
  rhrNadirBpm: integer("rhr_nadir_bpm"),
  rhrNadirTimestamp: timestamp("rhr_nadir_timestamp", { withTimezone: true }),
  timeToNadirMinutes: integer("time_to_nadir_minutes"),
  rhrStabilizationPct: real("rhr_stabilization_pct"),
  overnightHrvMs: real("overnight_hrv_ms"),
  hammockCurveType: text("hammock_curve_type"), // 'optimal_hammock' | 'downward_slope' | 'late_nadir_delayed' | 'elevated_flat'
  sleepRegularityIndex: real("sleep_regularity_index"), // 0 - 100
  autoTags: jsonb("auto_tags").$type<string[]>(), // e.g. ['late_evening_workout', 'high_step_day_12k+']
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

export const sleepHeartRateSeries = pgTable("sleep_heart_rate_series", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sleepSessions.id, { onDelete: "cascade" }),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  bpm: integer("bpm").notNull(),
});

export const dailyBiometrics = pgTable("daily_biometrics", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  stepsCount: integer("steps_count").default(0).notNull(),
  activeMinutes: integer("active_minutes").default(0).notNull(),
  restingHr: integer("resting_hr"),
  overnightHrvRmssd: real("overnight_hrv_rmssd"),
  hrvEwma30d: real("hrv_ewma_30d"),
  hrvZScore: real("hrv_z_score"),
  hrvCv7d: real("hrv_cv_7d"),
  strainScore: real("strain_score").default(0).notNull(), // 0 - 21
  dynamicSleepTargetMinutes: integer("dynamic_sleep_target_minutes").default(480).notNull(),
  biologicalState: text("biological_state").default("aligned_baseline").notNull(), // 'supercompensation' | 'pure_sleep_debt' | 'metabolic_carryover' | 'autonomic_strain' | 'aligned_baseline'
  subjectiveMorningScore: integer("subjective_morning_score"), // 1 - 5
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workoutSessions = pgTable("workout_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  externalId: text("external_id").unique(),
  sourceApp: text("source_app").notNull(),
  activityType: text("activity_type").notNull(), // 'cycling' | 'running' | 'strength_training' | 'stair_climbing' | 'walking' | 'other'
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  avgHr: integer("avg_hr"),
  maxHr: integer("max_hr"),
  hrZoneMinutes: jsonb("hr_zone_minutes").$type<{ z1: number; z2: number; z3: number; z4: number; z5: number }>(),
  sessionStrainScore: real("session_strain_score").default(0).notNull(),
  isMorningOutdoor: boolean("is_morning_outdoor").default(false).notNull(),
  isLateEvening: boolean("is_late_evening").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const nightEmbeddings = pgTable("night_embeddings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().references(() => sleepSessions.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  summaryText: text("summary_text").notNull(),
  embedding: jsonb("embedding").$type<number[]>().notNull(), // 768 float array
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
  dailyBiometrics: many(dailyBiometrics),
  workoutSessions: many(workoutSessions),
  nightEmbeddings: many(nightEmbeddings),
  syncLogs: many(syncLogs),
}));

export const sleepSessionsRelations = relations(sleepSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sleepSessions.userId],
    references: [users.id],
  }),
  stages: many(sleepStages),
  heartRateSeries: many(sleepHeartRateSeries),
  embedding: one(nightEmbeddings, {
    fields: [sleepSessions.id],
    references: [nightEmbeddings.sessionId],
  }),
}));

export const sleepStagesRelations = relations(sleepStages, ({ one }) => ({
  session: one(sleepSessions, {
    fields: [sleepStages.sessionId],
    references: [sleepSessions.id],
  }),
}));

export const sleepHeartRateSeriesRelations = relations(sleepHeartRateSeries, ({ one }) => ({
  session: one(sleepSessions, {
    fields: [sleepHeartRateSeries.sessionId],
    references: [sleepSessions.id],
  }),
}));

export const dailyBiometricsRelations = relations(dailyBiometrics, ({ one }) => ({
  user: one(users, {
    fields: [dailyBiometrics.userId],
    references: [users.id],
  }),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one }) => ({
  user: one(users, {
    fields: [workoutSessions.userId],
    references: [users.id],
  }),
}));

export const nightEmbeddingsRelations = relations(nightEmbeddings, ({ one }) => ({
  user: one(users, {
    fields: [nightEmbeddings.userId],
    references: [users.id],
  }),
  session: one(sleepSessions, {
    fields: [nightEmbeddings.sessionId],
    references: [sleepSessions.id],
  }),
}));
