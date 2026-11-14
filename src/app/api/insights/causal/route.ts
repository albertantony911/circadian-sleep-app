import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sleepSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeCausalInsights, NightFeatureRecord } from "@/lib/science/causal-patterns";

export async function GET() {
  try {
    const db = await getDb();
    const userId = "usr_nadir_primary";

    const sessions = await db
      .select()
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, userId))
      .orderBy(desc(sleepSessions.startTime))
      .limit(60);

    const featureRecords: NightFeatureRecord[] = sessions.map((s: any) => ({
      id: s.id,
      sessionId: s.id,
      date: new Date(s.startTime).toISOString().split("T")[0],
      durationMinutes: s.durationMinutes,
      deepSleepPct: Math.round((s.deepMinutes / Math.max(1, s.durationMinutes)) * 100),
      remSleepPct: Math.round((s.remMinutes / Math.max(1, s.durationMinutes)) * 100),
      rhrNadirBpm: s.rhrNadirBpm || 55,
      timeToNadirMinutes: s.timeToNadirMinutes || 180,
      overnightHrvMs: s.overnightHrvMs || 62,
      hrvZScore: 0.2,
      strainScore: 9.0,
      stepsCount: 9500,
      sleepScore: s.sleepScore || 85,
      autoTags: s.autoTags || [],
    }));

    const insights = computeCausalInsights(featureRecords);

    return NextResponse.json({
      totalNightsAnalyzed: sessions.length,
      insights,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to generate causal insights", detail: error.message },
      { status: 500 }
    );
  }
}
