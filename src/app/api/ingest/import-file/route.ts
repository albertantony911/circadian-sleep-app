import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sleepSessions, sleepStages, syncLogs } from "@/lib/db/schema";
import { deduplicateSleepRecords } from "@/lib/analytics/deduplication";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const db = await getDb();
  const userId = "usr_nadir_primary";

  try {
    const { records, format } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "No records found in payload" }, { status: 400 });
    }

    // Get existing sessions to deduplicate
    const existingSessions = await db
      .select()
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, userId));

    const { recordsToUpsert, suppressedRecords } = deduplicateSleepRecords(
      records,
      existingSessions.map((s: any) => ({
        externalId: s.externalId,
        sourceApp: s.sourceApp,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
      }))
    );

    // Upsert accepted records
    for (const record of recordsToUpsert) {
      const sessionId = `imp_${record.externalId || Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const start = new Date(record.startTime);
      const end = new Date(record.endTime);
      const timeInBed = record.timeInBedMinutes || record.durationMinutes;

      await db
        .insert(sleepSessions)
        .values({
          id: sessionId,
          userId,
          externalId: record.externalId,
          sourceApp: record.sourceApp || format || "manual_import",
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
        .onConflictDoNothing();
    }

    const durationMs = Date.now() - startTime;

    await db.insert(syncLogs).values({
      id: `log_imp_${Date.now()}`,
      userId,
      source: format || "file_importer",
      recordsUpserted: recordsToUpsert.length,
      recordsDeleted: 0,
      statusCode: 200,
      durationMs,
      errorDetail: suppressedRecords.length > 0 ? `Suppressed ${suppressedRecords.length} duplicate records` : null,
    });

    return NextResponse.json({
      success: true,
      upserted: recordsToUpsert.length,
      suppressed: suppressedRecords.length,
      durationMs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
