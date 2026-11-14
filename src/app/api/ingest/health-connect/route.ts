import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users, sleepSessions, sleepStages, syncLogs } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { deduplicateSleepRecords } from "@/lib/analytics/deduplication";

// Zod schema for Health Connect delta changes payload
const stageSchema = z.object({
  stage: z.enum(["awake", "light", "deep", "rem"]),
  startTime: z.string(),
  endTime: z.string(),
  durationSeconds: z.number().nonnegative(),
});

const sessionSchema = z.object({
  externalId: z.string(),
  sourceApp: z.string().default("health_connect_bridge"),
  startTime: z.string(),
  endTime: z.string(),
  durationMinutes: z.number().positive(),
  timeInBedMinutes: z.number().optional(),
  sleepEfficiencyPct: z.number().min(0).max(100).optional(),
  deepMinutes: z.number().default(0),
  lightMinutes: z.number().default(0),
  remMinutes: z.number().default(0),
  awakeMinutes: z.number().default(0),
  sleepScore: z.number().min(0).max(100).optional(),
  isMainSleep: z.boolean().default(true),
  stages: z.array(stageSchema).optional(),
});

const deltaPayloadSchema = z.object({
  changesToken: z.string().optional(),
  nextChangesToken: z.string().optional(),
  upsertedRecords: z.array(sessionSchema).default([]),
  deletedRecordIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const db = await getDb();

  // 1. Authenticate Bearer API Key
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const apiKey = authHeader.replace("Bearer ", "").trim();

  const userList = await db.select().from(users).where(eq(users.ingestApiKey, apiKey)).limit(1);
  if (userList.length === 0) {
    return NextResponse.json(
      { error: "Forbidden: Invalid ingest API key" },
      { status: 403 }
    );
  }

  const user = userList[0];

  // 2. Parse and validate payload
  try {
    const rawBody = await req.json();
    const parsed = deltaPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { upsertedRecords, deletedRecordIds } = parsed.data;

    // 3. Process deletions first
    if (deletedRecordIds.length > 0) {
      await db
        .delete(sleepSessions)
        .where(inArray(sleepSessions.externalId, deletedRecordIds));
    }

    // 4. Fetch recent sessions for deduplication
    const existingSessions = await db
      .select()
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, user.id));

    // 5. Run conflict resolution & deduplication engine
    const { recordsToUpsert, suppressedRecords } = deduplicateSleepRecords(
      upsertedRecords,
      existingSessions.map((s: any) => ({
        externalId: s.externalId,
        sourceApp: s.sourceApp,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
      }))
    );

    // 6. Upsert accepted records and their micro-stages
    for (const record of recordsToUpsert) {
      const sessionId = `hc_${record.externalId || Date.now()}`;
      const start = new Date(record.startTime);
      const end = new Date(record.endTime);
      const timeInBed = record.timeInBedMinutes || record.durationMinutes;

      // Upsert parent session
      await db
        .insert(sleepSessions)
        .values({
          id: sessionId,
          userId: user.id,
          externalId: record.externalId,
          sourceApp: record.sourceApp,
          startTime: start,
          endTime: end,
          durationMinutes: record.durationMinutes,
          timeInBedMinutes: timeInBed,
          sleepEfficiencyPct: record.sleepEfficiencyPct || 85,
          deepMinutes: record.deepMinutes || 0,
          lightMinutes: record.lightMinutes || 0,
          remMinutes: record.remMinutes || 0,
          awakeMinutes: record.awakeMinutes || 0,
          sleepScore: record.sleepScore || 80,
          isMainSleep: true,
          rawPayload: record,
        })
        .onConflictDoUpdate({
          target: sleepSessions.id,
          set: {
            durationMinutes: record.durationMinutes,
            timeInBedMinutes: timeInBed,
            deepMinutes: record.deepMinutes || 0,
            lightMinutes: record.lightMinutes || 0,
            remMinutes: record.remMinutes || 0,
            awakeMinutes: record.awakeMinutes || 0,
          },
        });

      // Insert stages if provided
      if (record.stages && record.stages.length > 0) {
        // Delete previous stages for this session
        await db.delete(sleepStages).where(eq(sleepStages.sessionId, sessionId));

        for (let i = 0; i < record.stages.length; i++) {
          const stg = record.stages[i];
          await db.insert(sleepStages).values({
            id: `stg_${sessionId}_${i}`,
            sessionId,
            stage: stg.stage,
            startTime: new Date(stg.startTime),
            endTime: new Date(stg.endTime),
            durationSeconds: stg.durationSeconds,
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // 7. Append audit sync log
    await db.insert(syncLogs).values({
      id: `log_hc_${Date.now()}`,
      userId: user.id,
      source: "health_connect_bridge",
      recordsUpserted: recordsToUpsert.length,
      recordsDeleted: deletedRecordIds.length,
      statusCode: 200,
      durationMs,
      errorDetail: suppressedRecords.length > 0 ? `Suppressed ${suppressedRecords.length} duplicate/lower-priority records` : null,
    });

    return NextResponse.json({
      success: true,
      upserted: recordsToUpsert.length,
      suppressed: suppressedRecords.length,
      deleted: deletedRecordIds.length,
      durationMs,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await db.insert(syncLogs).values({
      id: `log_err_${Date.now()}`,
      userId: user.id,
      source: "health_connect_bridge",
      recordsUpserted: 0,
      recordsDeleted: 0,
      statusCode: 500,
      durationMs,
      errorDetail: error.message,
    });

    return NextResponse.json(
      { error: "Ingestion failed", detail: error.message },
      { status: 500 }
    );
  }
}
