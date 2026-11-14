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
    // Store in project's local .pglite directory, /tmp on Vercel serverless, or memory in tests
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
  `);
}

export * from "./schema";
