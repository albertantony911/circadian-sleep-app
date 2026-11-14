import { getDb } from "./index";
import { users, oauthConnections, sleepSessions, sleepStages, syncLogs } from "./schema";

export async function seedDatabase() {
  console.log("🌱 Seeding 30 days of realistic circadian & sleep data...");
  const db = await getDb();

  const userId = "usr_nadir_primary";
  const userEmail = "albert@circadian.local";

  // 1. Seed or Upsert Primary User
  await db.insert(users).values({
    id: userId,
    email: userEmail,
    name: "Albert (Sleep Researcher)",
    targetSleepMinutes: 480, // 8 hours
    chronotype: "intermediate",
    preferredBedTime: "22:30",
    preferredWakeTime: "06:30",
    ingestApiKey: "ak_live_circadian_92b8d0e74f1",
  }).onConflictDoNothing();

  // 2. Seed OAuth Connections
  await db.insert(oauthConnections).values([
    {
      id: "oauth_fitbit_primary",
      userId,
      provider: "fitbit",
      accessToken: "fitbit_mock_access_token_xyz987",
      refreshToken: "fitbit_mock_refresh_token_abc123",
      expiresAt: new Date(Date.now() + 28800000), // 8 hours in future
      scope: "sleep profile heartrate",
      lastSyncAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      syncStatus: "idle",
      syncCursor: "cursor_fitbit_v2_20261114",
    },
    {
      id: "oauth_google_health_primary",
      userId,
      provider: "google_health",
      accessToken: "google_mock_access_token_456def",
      refreshToken: "google_mock_refresh_token_789ghi",
      expiresAt: new Date(Date.now() + 3600000),
      scope: "https://www.googleapis.com/auth/fitness.sleep.read",
      lastSyncAt: new Date(Date.now() - 3600000 * 12),
      syncStatus: "idle",
      syncCursor: "cursor_gh_v1_20261113",
    },
  ]).onConflictDoNothing();

  // 3. Clear existing sessions for idempotent clean re-seeding
  await db.delete(sleepStages);
  await db.delete(sleepSessions);
  await db.delete(syncLogs);

  // 4. Generate 30 days of realistic sleep sessions
  const now = new Date();

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const targetDate = new Date(now.getTime() - dayOffset * 86400000);
    const dayOfWeek = targetDate.getDay(); // 0 Sun, 5 Fri, 6 Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Bedtime: ~23:15 on weekdays (±25m), ~00:45 on weekends (±40m)
    const baseHour = isWeekend ? 0 : 23;
    const baseMin = isWeekend ? 45 : 15;
    const jitterMin = Math.floor(Math.sin(dayOffset * 1.5) * 20);

    const startTime = new Date(targetDate);
    startTime.setHours(baseHour, baseMin + jitterMin, 0, 0);
    // If baseHour is 0 (past midnight), move to next day
    if (baseHour === 0) {
      startTime.setDate(startTime.getDate() + 1);
    }

    // Target duration ~ 7h 15m to 8h 15m
    const durationMinutes = isWeekend
      ? 460 + Math.floor(Math.sin(dayOffset) * 25) // ~7h40m
      : 440 + Math.floor(Math.cos(dayOffset) * 30); // ~7h20m

    const timeInBedMinutes = durationMinutes + 25; // 25 mins awake/falling asleep
    const endTime = new Date(startTime.getTime() + timeInBedMinutes * 60000);

    // Sleep stages distribution
    // Deep: 15-22%, REM: 20-25%, Light: 50-55%, Awake: 5-8%
    const deepMinutes = Math.round(durationMinutes * (0.18 + Math.sin(dayOffset) * 0.03));
    const remMinutes = Math.round(durationMinutes * (0.22 + Math.cos(dayOffset) * 0.02));
    const awakeMinutes = timeInBedMinutes - durationMinutes;
    const lightMinutes = durationMinutes - deepMinutes - remMinutes;
    const sleepEfficiencyPct = Math.round((durationMinutes / timeInBedMinutes) * 100);
    const sleepScore = Math.min(96, Math.max(72, Math.round(sleepEfficiencyPct * 0.7 + (deepMinutes / 90) * 15 + (remMinutes / 100) * 15)));

    const sessionId = `sess_${targetDate.toISOString().split("T")[0].replace(/-/g, "")}`;
    const sourceApp = dayOffset % 5 === 0 ? "health_connect_bridge" : "fitbit_cloud";

    await db.insert(sleepSessions).values({
      id: sessionId,
      userId,
      externalId: `ext_${sessionId}`,
      sourceApp,
      startTime,
      endTime,
      durationMinutes,
      timeInBedMinutes,
      sleepEfficiencyPct,
      deepMinutes,
      lightMinutes,
      remMinutes,
      awakeMinutes,
      sleepScore,
      isMainSleep: true,
      rawPayload: { simulated: true, algorithm: "nadir_hypno_v1" },
    });

    // Generate realistic ultradian micro-stages (~90m cycles)
    let currentStageStart = new Date(startTime);
    const stageDefs: Array<"awake" | "light" | "deep" | "rem"> = [
      "awake", "light", "deep", "light", "rem",
      "light", "deep", "light", "rem",
      "light", "deep", "light", "rem",
      "light", "rem", "awake",
    ];

    let stageIdx = 0;
    while (currentStageStart.getTime() < endTime.getTime()) {
      const stage = stageDefs[stageIdx % stageDefs.length];
      stageIdx++;

      // Stage durations: deep ~25-45m early, rem ~20-40m late, light ~20-30m, awake ~5-15m
      let stageMins = 25;
      if (stage === "awake") stageMins = 5 + Math.floor(Math.random() * 8);
      else if (stage === "deep") stageMins = 20 + Math.floor(Math.random() * 20);
      else if (stage === "rem") stageMins = 20 + Math.floor(Math.random() * 18);
      else stageMins = 20 + Math.floor(Math.random() * 15);

      let currentStageEnd = new Date(currentStageStart.getTime() + stageMins * 60000);
      if (currentStageEnd.getTime() > endTime.getTime()) {
        currentStageEnd = new Date(endTime);
      }

      const durationSec = Math.round((currentStageEnd.getTime() - currentStageStart.getTime()) / 1000);
      if (durationSec > 0) {
        await db.insert(sleepStages).values({
          id: `stg_${sessionId}_${stageIdx}`,
          sessionId,
          stage,
          startTime: currentStageStart,
          endTime: currentStageEnd,
          durationSeconds: durationSec,
        });
      }

      currentStageStart = currentStageEnd;
    }
  }

  // 5. Seed Sync Logs (Simulated Ingestion History)
  const syncSources = ["fitbit_cloud", "health_connect_bridge", "manual_sync_trigger"];
  for (let i = 0; i < 12; i++) {
    const logDate = new Date(now.getTime() - i * 14400000); // every 4 hours
    const source = syncSources[i % syncSources.length];
    const isError = i === 7; // simulated occasional 429 rate limit backoff
    await db.insert(syncLogs).values({
      id: `log_sync_${i}`,
      userId,
      source,
      recordsUpserted: isError ? 0 : Math.floor(Math.random() * 3) + 1,
      recordsDeleted: 0,
      statusCode: isError ? 429 : 200,
      durationMs: isError ? 85 : 420 + Math.floor(Math.random() * 250),
      errorDetail: isError ? "Fitbit API 429: Too Many Requests (Rate limit reset in 3600s)" : null,
      createdAt: logDate,
    });
  }

  console.log("✅ Seed completed successfully! 30 sleep sessions, 400+ stages, and 12 sync logs created.");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
