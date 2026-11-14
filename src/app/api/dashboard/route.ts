import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, sleepSessions, sleepStages, oauthConnections } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { calculateSleepDebt } from "@/lib/analytics/sleep-debt";
import { analyzeCircadianRhythm, timeToFractionalHours } from "@/lib/analytics/circadian";

export async function GET() {
  const db = await getDb();
  const userId = "usr_nadir_primary";

  // Check if background delta sync is needed (e.g., user waking up at any time)
  try {
    const connections = await db
      .select()
      .from(oauthConnections)
      .where(eq(oauthConnections.userId, userId));

    const googleConn = connections.find((c: any) => c.provider === "google_health");
    if (googleConn && googleConn.accessToken && (!googleConn.lastSyncAt || Date.now() - new Date(googleConn.lastSyncAt).getTime() > 10800000)) {
      // Last synced > 3 hours ago: trigger auto-sync in background
      import("@/lib/sync/google-health")
        .then(({ syncGoogleHealthSessions }) => syncGoogleHealthSessions(userId))
        .catch(console.error);
    }
  } catch (err) {
    // Non-blocking
  }

  // Fetch user
  const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userList[0] || {
    targetSleepMinutes: 480,
    chronotype: "intermediate",
    preferredBedTime: "22:30",
    preferredWakeTime: "06:30",
  };

  // Fetch recent sessions (last 30 days)
  let sessions = await db
    .select()
    .from(sleepSessions)
    .where(eq(sleepSessions.userId, userId))
    .orderBy(desc(sleepSessions.startTime))
    .limit(30);

  // Auto-seed demo dataset if empty (e.g. freshly deployed on Vercel)
  if (sessions.length === 0) {
    const { seedDatabase } = await import("@/lib/db/seed");
    await seedDatabase();
    sessions = await db
      .select()
      .from(sleepSessions)
      .where(eq(sleepSessions.userId, userId))
      .orderBy(desc(sleepSessions.startTime))
      .limit(30);
  }

  // Fetch latest session stages
  let latestStages: any[] = [];
  if (sessions.length > 0) {
    const latestSession = sessions[0];
    latestStages = await db
      .select()
      .from(sleepStages)
      .where(eq(sleepStages.sessionId, latestSession.id))
      .orderBy(sleepStages.startTime);
  }

  // 1. Compute Sleep Debt
  const sleepDebt = calculateSleepDebt(
    sessions.map((s: any) => ({
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
    })),
    user.targetSleepMinutes
  );

  // 2. Compute Circadian Rhythm & Social Jetlag
  const circadian = analyzeCircadianRhythm(
    sessions.map((s: any) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      isMainSleep: s.isMainSleep,
    })),
    user.preferredBedTime,
    user.preferredWakeTime,
    user.chronotype as any
  );

  // 3. Format consistency timeline data (for 7-day and 30-day consistency bars)
  const consistencyData = sessions.slice(0, 14).map((s: any) => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const startHours = timeToFractionalHours(start);
    const endHours = timeToFractionalHours(end);

    return {
      date: start.toISOString().split("T")[0],
      dayName: start.toLocaleDateString("en-US", { weekday: "short" }),
      startHours: parseFloat(startHours.toFixed(2)),
      endHours: parseFloat(endHours.toFixed(2)),
      durationHours: parseFloat((s.durationMinutes / 60).toFixed(1)),
      sleepScore: s.sleepScore,
      efficiency: s.sleepEfficiencyPct,
      source: s.sourceApp,
    };
  }).reverse();

  return NextResponse.json({
    user: {
      targetSleepMinutes: user.targetSleepMinutes,
      chronotype: user.chronotype,
      preferredBedTime: user.preferredBedTime,
      preferredWakeTime: user.preferredWakeTime,
    },
    latestSession: sessions[0] || null,
    latestStages,
    sleepDebt,
    circadian,
    consistencyData,
    recentSessions: sessions.slice(0, 7),
  });
}
