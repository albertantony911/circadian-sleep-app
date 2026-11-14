import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Global singleton to preserve connection across Next.js HMR
declare global {
  // eslint-disable-next-line no-var
  var __db_instance: any;
  // eslint-disable-next-line no-var
  var __pglite_instance: PGlite | undefined;
}

let dbInstance: any;

export async function getDb() {
  if (global.__db_instance) {
    return global.__db_instance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isPostgresUrl = databaseUrl && databaseUrl.startsWith("postgres") && !databaseUrl.includes("localhost:5432/circadian_sleep");

  if (isPostgresUrl) {
    try {
      const pool = new Pool({ connectionString: databaseUrl });
      dbInstance = drizzlePg(pool, { schema });
      global.__db_instance = dbInstance;
      return dbInstance;
    } catch (err) {
      console.warn("Failed to connect to DATABASE_URL, falling back to embedded PGlite:", err);
    }
  }

  // Local embedded fallback using PGlite
  if (!global.__pglite_instance) {
    const pgliteDataDir =
      process.env.NODE_ENV === "test"
        ? undefined
        : process.env.VERCEL
        ? "/tmp/.pglite-data"
        : "./.pglite-data";
    global.__pglite_instance = new PGlite(pgliteDataDir);
    await initSchema(global.__pglite_instance);
  }

  dbInstance = drizzlePglite(global.__pglite_instance, { schema });
  global.__db_instance = dbInstance;
  return dbInstance;
}

// Auto-initialize schema in PGlite if needed
async function initSchema(client: PGlite) {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      target_sleep_minutes INTEGER NOT NULL DEFAULT 480,
      chronotype TEXT NOT NULL DEFAULT 'intermediate',
      preferred_wake_time TEXT NOT NULL DEFAULT '06:30',
      preferred_bed_time TEXT NOT NULL DEFAULT '22:30',
      ingest_api_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS oauth_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TIMESTAMPTZ,
      scope TEXT,
      last_sync_at TIMESTAMPTZ,
      sync_status TEXT NOT NULL DEFAULT 'idle',
      rate_limit_reset_at TIMESTAMPTZ,
      last_error_message TEXT,
      sync_cursor TEXT
    );

    CREATE TABLE IF NOT EXISTS sleep_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      external_id TEXT,
      source_app TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL,
      time_in_bed_minutes INTEGER NOT NULL,
      sleep_efficiency_pct INTEGER NOT NULL DEFAULT 85,
      deep_minutes INTEGER NOT NULL DEFAULT 0,
      light_minutes INTEGER NOT NULL DEFAULT 0,
      rem_minutes INTEGER NOT NULL DEFAULT 0,
      awake_minutes INTEGER NOT NULL DEFAULT 0,
      sleep_score INTEGER,
      is_main_sleep BOOLEAN NOT NULL DEFAULT TRUE,
      rhr_nadir_bpm INTEGER,
      rhr_nadir_timestamp TIMESTAMPTZ,
      time_to_nadir_minutes INTEGER,
      rhr_stabilization_pct REAL,
      overnight_hrv_ms REAL,
      hammock_curve_type TEXT,
      sleep_regularity_index REAL,
      auto_tags JSONB,
      raw_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sleep_stages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sleep_sessions(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      duration_seconds INTEGER NOT NULL
    );

    -- Ensure extended columns exist on sleep_sessions
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS rhr_nadir_bpm INTEGER;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS rhr_nadir_timestamp TIMESTAMPTZ;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS time_to_nadir_minutes INTEGER;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS rhr_stabilization_pct REAL;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS overnight_hrv_ms REAL;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS hammock_curve_type TEXT;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS sleep_regularity_index REAL;
    ALTER TABLE sleep_sessions ADD COLUMN IF NOT EXISTS auto_tags JSONB;

    CREATE TABLE IF NOT EXISTS sleep_heart_rate_series (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sleep_sessions(id) ON DELETE CASCADE,
      recorded_at TIMESTAMPTZ NOT NULL,
      bpm INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_biometrics (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      steps_count INTEGER NOT NULL DEFAULT 0,
      active_minutes INTEGER NOT NULL DEFAULT 0,
      resting_hr INTEGER,
      overnight_hrv_rmssd REAL,
      hrv_ewma_30d REAL,
      hrv_z_score REAL,
      hrv_cv_7d REAL,
      strain_score REAL NOT NULL DEFAULT 0,
      dynamic_sleep_target_minutes INTEGER NOT NULL DEFAULT 480,
      biological_state TEXT NOT NULL DEFAULT 'aligned_baseline',
      subjective_morning_score INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      external_id TEXT UNIQUE,
      source_app TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL,
      avg_hr INTEGER,
      max_hr INTEGER,
      hr_zone_minutes JSONB,
      session_strain_score REAL NOT NULL DEFAULT 0,
      is_morning_outdoor BOOLEAN NOT NULL DEFAULT FALSE,
      is_late_evening BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS night_embeddings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES sleep_sessions(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      summary_text TEXT NOT NULL,
      embedding JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      records_upserted INTEGER NOT NULL DEFAULT 0,
      records_deleted INTEGER NOT NULL DEFAULT 0,
      status_code INTEGER NOT NULL DEFAULT 200,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error_detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO users (id, email, name, target_sleep_minutes, chronotype, preferred_wake_time, preferred_bed_time, ingest_api_key)
    VALUES ('usr_nadir_primary', 'albert@circadian.local', 'Albert (Sleep Researcher)', 480, 'intermediate', '06:30', '22:30', 'ak_live_circadian_92b8d0e74f1')
    ON CONFLICT (id) DO UPDATE SET ingest_api_key = 'ak_live_circadian_92b8d0e74f1';
  `);
}

export * from "./schema";
