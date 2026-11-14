import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  users,
  sleepSessions,
  sleepStages,
  sleepHeartRateSeries,
  dailyBiometrics,
  workoutSessions,
  nightEmbeddings,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { analyzeAutonomicRecovery } from "@/lib/science/autonomic-recovery";
import {
  calculateCardiovascularStrain,
  calculateDynamicSleepTarget,
  calculateDecayedSleepDebtPlan,
} from "@/lib/science/strain-sleep-debt";
import {
  calculateEWMA,
  calculateZScore,
  calculateHrvCV7d,
  calculateSleepRegularityIndex,
  smoothHypnogramStages,
} from "@/lib/science/signal-baseline";
import { classifyBiologicalState } from "@/lib/science/biological-state";
import { generateCircadianTimeline } from "@/lib/science/circadian-copilot";
import { computeCausalInsights, NightFeatureRecord } from "@/lib/science/causal-patterns";
import { timeToFractionalHours } from "@/lib/analytics/circadian";

export async function GET() {
  const db = await getDb();
  const userId = "usr_nadir_primary";

  // 1. Fetch user
  const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userList[0] || {
    targetSleepMinutes: 480,
    chronotype: "intermediate",
    preferredBedTime: "22:30",
    preferredWakeTime: "06:30",
  };

  // 2. Fetch recent sessions (last 45 days)
  let sessions = await db
    .select()
    .from(sleepSessions)
    .where(eq(sleepSessions.userId, userId))
    .orderBy(desc(sleepSessions.startTime))
    .limit(45);

  // Auto-seed if empty
  if (sessions.length === 0) {
    const { seedDatabase } = await import("@/lib/db/seed");
    await seedDatabase();
    sessions = await db
      .select()
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, userId))
      .orderBy(desc(sleepSessions.startTime))
      .limit(45);
  }

  // 3. Fetch latest session stages & 1-minute HR series
  let latestStages: any[] = [];
  let latestHrSeries: any[] = [];
  const latestSession = sessions[0];

  if (latestSession) {
    latestStages = await db
      .select()
      .from(sleepStages)
      .where(eq(sleepStages.sessionId, latestSession.id))
      .orderBy(sleepStages.startTime);

    latestHrSeries = await db
      .select()
      .from(sleepHeartRateSeries)
      .where(eq(sleepHeartRateSeries.sessionId, latestSession.id))
      .orderBy(sleepHeartRateSeries.recordedAt);
  }

  // 4. Fetch daily biometrics & workouts
  const biometrics = await db
    .select()
    .from(dailyBiometrics)
    .where(eq(dailyBiometrics.userId, userId))
    .orderBy(desc(dailyBiometrics.date))
    .limit(30);

  const workouts = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.startTime))
    .limit(15);

  // 5. Autonomic recovery analysis on latest session
  const autonomicAnalysis = analyzeAutonomicRecovery(
    latestHrSeries,
    latestSession.startTime,
    latestSession.endTime,
    65
  );

  // 6. Longitudinal Signal Normalization (30-day EWMA & Z-Scores)
  const hrvHistory = sessions
    .filter((s: any) => s.overnightHrvMs && s.overnightHrvMs > 0)
    .map((s: any) => s.overnightHrvMs as number);

  const todayHrv = latestSession?.overnightHrvMs || 62.0;
  const hrvZ = calculateZScore(todayHrv, hrvHistory);
  const hrvEwma = calculateEWMA(hrvHistory.slice(0, 30), 0.1);
  const hrvCv7d = calculateHrvCV7d(hrvHistory.slice(0, 7));

  // Compute Sleep Regularity Index across last 7 days
  const dailyIntervals = sessions.slice(0, 7).map((s: any) => ({
    startHour: timeToFractionalHours(new Date(s.startTime)),
    endHour: timeToFractionalHours(new Date(s.endTime)),
  }));
  const sri = calculateSleepRegularityIndex(dailyIntervals);

  // Smooth hypnogram stages over rolling 7 days
  const smoothedHypno = smoothHypnogramStages(
    sessions.slice(0, 7).map((s: any) => ({
      deepMinutes: s.deepMinutes,
      remMinutes: s.remMinutes,
      lightMinutes: s.lightMinutes,
      awakeMinutes: s.awakeMinutes,
      durationMinutes: s.durationMinutes,
    }))
  );

  // 7. Training Strain & Dynamic Sleep Target
  const todayWorkout = workouts[0];
  const priorDayStrain = todayWorkout ? todayWorkout.sessionStrainScore : 8.5;
  const isLateEveningWorkout = todayWorkout ? todayWorkout.isLateEvening : false;

  const dynamicSleepTarget = calculateDynamicSleepTarget(
    user.targetSleepMinutes,
    priorDayStrain,
    isLateEveningWorkout,
    user.preferredWakeTime
  );

  // 8. Rolling Decayed Sleep Debt & 3-Day Plan
  const recoveryPlan = calculateDecayedSleepDebtPlan(
    sessions.map((s: any) => ({
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      targetMinutes: user.targetSleepMinutes,
    })),
    user.targetSleepMinutes,
    user.preferredBedTime
  );

  // 9. Biological State Classifier & Action Plan
  const deepSleepPct = latestSession
    ? Math.round((latestSession.deepMinutes / Math.max(1, latestSession.durationMinutes)) * 100)
    : 18;

  const biologicalState = classifyBiologicalState({
    hrvZScore: hrvZ.zScore,
    hrvCv7d,
    rhrNadirPct: autonomicAnalysis.timeToNadirPct,
    hammockType: autonomicAnalysis.hammockCurveType,
    sleepDebtMinutes: recoveryPlan.decayedDebtMinutes,
    priorDayStrain,
    sri,
    deepSleepPct,
  });

  // 10. Live 24-Hour Circadian Timeline
  const actualWakeTime = latestSession ? latestSession.endTime : new Date();
  const circadianTimeline = generateCircadianTimeline(
    actualWakeTime,
    dynamicSleepTarget.recommendedBedtime,
    recoveryPlan.decayedDebtMinutes
  );

  // 11. Causal Pattern Digest
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
  const causalInsights = computeCausalInsights(featureRecords);

  // Consistency bars
  const consistencyData = sessions.slice(0, 14).map((s: any) => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    return {
      date: start.toISOString().split("T")[0],
      dayName: start.toLocaleDateString("en-US", { weekday: "short" }),
      startHours: timeToFractionalHours(start),
      endHours: timeToFractionalHours(end),
      durationHours: Number((s.durationMinutes / 60).toFixed(1)),
      sleepScore: s.sleepScore || 85,
      efficiency: s.sleepEfficiencyPct || 85,
      source: s.sourceApp,
      hammockType: s.hammockCurveType || "optimal_hammock",
    };
  });

  return NextResponse.json({
    user,
    biologicalState,
    circadianTimeline,
    dynamicSleepTarget,
    recoveryPlan,
    autonomicAnalysis,
    signalNormalization: {
      todayHrv,
      hrvZ,
      hrvEwma,
      hrvCv7d,
      sri,
      smoothedHypno,
    },
    latestSession,
    latestStages,
    latestHrSeries: latestHrSeries.slice(0, 300), // Clip for rapid JSON payload
    recentWorkouts: workouts.slice(0, 3),
    todayBiometrics: biometrics[0] || null,
    causalInsights: causalInsights.slice(0, 3),
    consistencyData,
    recentSessions: sessions.slice(0, 10),
  });
}
