import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { nightEmbeddings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  generateDeterministicNightEmbedding,
  findSimilarNights,
} from "@/lib/science/causal-patterns";

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const userId = "usr_nadir_primary";
    const body = await req.json().catch(() => ({}));

    // Target conditions (e.g. ideal deep sleep night with optimal nadir)
    const targetType = body.targetType || "optimal_deep_recovery";

    // Generate target vector based on query archetype
    const targetFeature = {
      id: "target_query",
      sessionId: "target_query",
      date: new Date().toISOString().split("T")[0],
      durationMinutes: targetType === "optimal_deep_recovery" ? 495 : 460,
      deepSleepPct: targetType === "optimal_deep_recovery" ? 22 : 18,
      remSleepPct: 24,
      rhrNadirBpm: 50,
      timeToNadirMinutes: 160,
      overnightHrvMs: 78,
      hrvZScore: 1.4,
      strainScore: 11.5,
      stepsCount: 11000,
      sleepScore: 94,
      autoTags: ["morning_outdoor_activity", "high_step_day_12k+"],
    };

    const targetVector = generateDeterministicNightEmbedding(targetFeature);

    // Fetch stored embeddings
    const stored = await db
      .select()
      .from(nightEmbeddings)
      .where(eq(nightEmbeddings.userId, userId))
      .orderBy(desc(nightEmbeddings.date))
      .limit(60);

    const historyEmbeddings = stored.map((item: any) => ({
      sessionId: item.sessionId,
      date: item.date,
      summaryText: item.summaryText,
      vector: (item.embedding as number[]) || [],
    }));

    const topMatches = findSimilarNights(targetVector, historyEmbeddings, 5);

    return NextResponse.json({
      queryArchetype: targetType,
      targetVectorPreview: targetVector.slice(0, 8),
      matches: topMatches,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to search vector embeddings", detail: error.message },
      { status: 500 }
    );
  }
}
