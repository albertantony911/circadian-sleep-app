import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { dailyBiometrics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const userId = "usr_nadir_primary";
    const body = await req.json();

    const score = Number(body.score);
    if (isNaN(score) || score < 1 || score > 5) {
      return NextResponse.json(
        { error: "Invalid score: must be an integer between 1 (Groggy) and 5 (Sharp)" },
        { status: 400 }
      );
    }

    const todayDate = body.date || new Date().toISOString().split("T")[0];

    // Check if biometric record exists for today
    const existing = await db
      .select()
      .from(dailyBiometrics)
      .where(and(eq(dailyBiometrics.userId, userId), eq(dailyBiometrics.date, todayDate)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(dailyBiometrics)
        .set({ subjectiveMorningScore: score })
        .where(eq(dailyBiometrics.id, existing[0].id));
    } else {
      await db.insert(dailyBiometrics).values({
        id: `bio_${userId}_${todayDate}`,
        userId,
        date: todayDate,
        subjectiveMorningScore: score,
        stepsCount: 0,
        activeMinutes: 0,
        dynamicSleepTargetMinutes: 480,
        biologicalState: "aligned_baseline",
      });
    }

    return NextResponse.json({
      success: true,
      score,
      date: todayDate,
      message: `Morning calibration score ${score}/5 saved.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to record morning calibration score", detail: error.message },
      { status: 500 }
    );
  }
}
