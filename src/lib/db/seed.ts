import { getDb } from "./index";
import {
  users,
  oauthConnections,
  sleepSessions,
  sleepStages,
  sleepHeartRateSeries,
  dailyBiometrics,
  workoutSessions,
  nightEmbeddings,
  syncLogs,
} from "./schema";
import { generateDeterministicNightEmbedding } from "@/lib/science/causal-patterns";
import { generateAutoTags } from "@/lib/science/causal-patterns";
import { calculateCardiovascularStrain } from "@/lib/science/strain-sleep-debt";

export async function seedDatabase() {
  console.log("🌱 Seeding 45 days of clinical circadian, autonomic & sleep intelligence data...");
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

  // 2. Clear existing records for idempotent clean re-seeding
  await db.delete(nightEmbeddings);
  await db.delete(sleepHeartRateSeries);
  await db.delete(sleepStages);
  await db.delete(sleepSessions);
  await db.delete(workoutSessions);
  await db.delete(dailyBiometrics);
  await db.delete(syncLogs);

  // 3. Generate 45 days of realistic data
  const now = new Date();
  const daytimeRhrBaseline = 65;

  for (let dayOffset = 44; dayOffset >= 0; dayOffset--) {
    const targetDate = new Date(now.getTime() - dayOffset * 86400000);
    const dateStr = targetDate.toISOString().split("T")[0];
    const dayOfWeek = targetDate.getDay(); // 0 Sun, 6 Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Bedtime: ~23:00 on weekdays, ~00:30 on weekends
    const baseHour = isWeekend ? 0 : 23;
    const baseMin = isWeekend ? 30 : 0;
    const jitterMin = Math.floor(Math.sin(dayOffset * 1.7) * 20);

    const startTime = new Date(targetDate);
    startTime.setHours(baseHour, baseMin + jitterMin, 0, 0);
    if (baseHour === 0) startTime.setDate(startTime.getDate() + 1);

    // Duration: 7h 15m to 8h 15m
    const durationMinutes = isWeekend
      ? 470 + Math.floor(Math.sin(dayOffset) * 25)
      : 450 + Math.floor(Math.cos(dayOffset) * 30);
    const timeInBedMinutes = durationMinutes + 25;
    const endTime = new Date(startTime.getTime() + timeInBedMinutes * 60000);

    // Physiological stage breakdown
    const deepMinutes = Math.round(durationMinutes * (0.19 + Math.sin(dayOffset * 0.8) * 0.03));
    const remMinutes = Math.round(durationMinutes * (0.22 + Math.cos(dayOffset * 0.9) * 0.02));
    const awakeMinutes = timeInBedMinutes - durationMinutes;
    const lightMinutes = durationMinutes - deepMinutes - remMinutes;
    const sleepEfficiencyPct = Math.round((durationMinutes / timeInBedMinutes) * 100);

    // Create Workout for this day
    const hasWorkout = dayOffset % 2 === 0 || dayOffset % 5 === 0;
    let workoutStrain = 4.0;
    let isLateEveningWorkout = false;
    let isMorningOutdoor = false;
    const workoutId = `wo_seed_${dateStr}`;

    if (hasWorkout) {
      const isLate = dayOffset % 6 === 0; // Every 6 days: late evening workout
      isLateEveningWorkout = isLate;
      isMorningOutdoor = !isLate && dayOffset % 3 === 0;

      const woStart = new Date(targetDate);
      if (isLate) {
        woStart.setHours(20, 15, 0, 0); // 8:15 PM (close to bed)
      } else if (isMorningOutdoor) {
        woStart.setHours(7, 30, 0, 0); // 7:30 AM
      } else {
        woStart.setHours(17, 0, 0, 0); // 5:00 PM
      }

      const woDuration = 45 + (dayOffset % 30);
      const woEnd = new Date(woStart.getTime() + woDuration * 60000);
      const activityType = dayOffset % 4 === 0 ? "cycling" : dayOffset % 4 === 1 ? "running" : "strength_training";

      const zones = {
        z1: 10,
        z2: 15,
        z3: Math.round(woDuration * 0.3),
        z4: Math.round(woDuration * 0.2),
        z5: Math.round(woDuration * 0.1),
      };
      const { strainScore } = calculateCardiovascularStrain(zones, 10500);
      workoutStrain = strainScore;

      await db.insert(workoutSessions).values({
        id: workoutId,
        userId,
        externalId: workoutId,
        sourceApp: "fitbit_cloud",
        activityType,
        startTime: woStart,
        endTime: woEnd,
        durationMinutes: woDuration,
        avgHr: 142,
        maxHr: 176,
        hrZoneMinutes: zones,
        sessionStrainScore: strainScore,
        isMorningOutdoor,
        isLateEvening: isLateEveningWorkout,
      });
    }

    // Determine Hammock curve archetype for this night
    let hammockType: "optimal_hammock" | "late_nadir_delayed" | "downward_slope" | "elevated_flat" = "optimal_hammock";
    let nadirPct = 0.38; // 38% into sleep
    let nadirBpm = 52 + (dayOffset % 5);

    if (isLateEveningWorkout) {
      hammockType = "late_nadir_delayed";
      nadirPct = 0.72; // Nadir delayed to 72% of sleep
      nadirBpm = 58;
    } else if (dayOffset % 9 === 0) {
      hammockType = "downward_slope";
      nadirPct = 0.60;
      nadirBpm = 56;
    } else if (dayOffset % 14 === 0) {
      hammockType = "elevated_flat";
      nadirPct = 0.50;
      nadirBpm = 63; // Minimal dip
    }

    const timeToNadirMinutes = Math.round(durationMinutes * nadirPct);
    const rhrNadirTimestamp = new Date(startTime.getTime() + timeToNadirMinutes * 60000);
    const rhrDipPct = Number((((daytimeRhrBaseline - nadirBpm) / daytimeRhrBaseline) * 100).toFixed(1));
    const overnightHrvMs = Math.round(
      hammockType === "elevated_flat" ? 42 : hammockType === "late_nadir_delayed" ? 54 : 68 + Math.sin(dayOffset) * 8
    );

    const autoTags = generateAutoTags({
      workoutEndedWithin3hOfBed: isLateEveningWorkout,
      workoutStartedWithin2hOfWake: isMorningOutdoor,
      dailySteps: 9000 + (dayOffset * 150) % 6000,
      dailyStrain: workoutStrain,
      isWeekendMidpointShift: isWeekend,
    });

    const sessionId = `sess_${dateStr.replace(/-/g, "")}`;
    const sleepScore = Math.min(97, Math.max(68, Math.round(sleepEfficiencyPct * 0.7 + (deepMinutes / 90) * 15 + (remMinutes / 100) * 15)));

    // Insert Sleep Session
    await db.insert(sleepSessions).values({
      id: sessionId,
      userId,
      externalId: `ext_${sessionId}`,
      sourceApp: dayOffset < 5 ? "health_connect_bridge" : "fitbit_cloud",
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
      rhrNadirBpm: nadirBpm,
      rhrNadirTimestamp,
      timeToNadirMinutes,
      rhrStabilizationPct: rhrDipPct,
      overnightHrvMs,
      hammockCurveType: hammockType,
      sleepRegularityIndex: 88,
      autoTags,
      rawPayload: { algorithm: "nadir_clinical_v2" },
    });

    // Insert Sleep Stages
    const stageDefs = [
      { stage: "awake", duration: 15 * 60 },
      { stage: "light", duration: Math.round(lightMinutes * 0.4) * 60 },
      { stage: "deep", duration: deepMinutes * 60 },
      { stage: "light", duration: Math.round(lightMinutes * 0.3) * 60 },
      { stage: "rem", duration: remMinutes * 60 },
      { stage: "light", duration: Math.round(lightMinutes * 0.3) * 60 },
      { stage: "awake", duration: 10 * 60 },
    ];
    let cursorTime = new Date(startTime);
    for (let stgIdx = 0; stgIdx < stageDefs.length; stgIdx++) {
      const def = stageDefs[stgIdx];
      const stgEnd = new Date(cursorTime.getTime() + def.duration * 1000);
      await db.insert(sleepStages).values({
        id: `stg_${sessionId}_${stgIdx}`,
        sessionId,
        stage: def.stage,
        startTime: cursorTime,
        endTime: stgEnd,
        durationSeconds: def.duration,
      });
      cursorTime = stgEnd;
    }

    // Insert 1-Minute Intraday Heart Rate Series for latest 3 sessions
    if (dayOffset < 3) {
      const totalSampleCount = Math.min(360, Math.round(durationMinutes));
      for (let m = 0; m < totalSampleCount; m += 2) {
        const sampleTime = new Date(startTime.getTime() + m * 60000);
        // Shape HR according to hammock archetype
        const progress = m / totalSampleCount;
        let sampleBpm = nadirBpm;
        if (hammockType === "optimal_hammock") {
          sampleBpm = Math.round(nadirBpm + Math.pow(progress - 0.4, 2) * 45 + Math.sin(m * 0.2) * 2);
        } else if (hammockType === "late_nadir_delayed") {
          sampleBpm = Math.round(nadirBpm + (1 - progress) * 16 + Math.cos(m * 0.15) * 2);
        } else {
          sampleBpm = Math.round(nadirBpm + (1 - progress * 0.6) * 12 + Math.sin(m * 0.1) * 2);
        }

        await db.insert(sleepHeartRateSeries).values({
          id: `hr_${sessionId}_${m}`,
          sessionId,
          recordedAt: sampleTime,
          bpm: Math.min(95, Math.max(45, sampleBpm)),
        });
      }
    }

    // Insert Daily Biometrics
    const steps = 8500 + Math.round(Math.sin(dayOffset * 0.5) * 3500);
    const morningScore = (dayOffset % 5) + 1; // 1 to 5
    const bioState =
      hammockType === "elevated_flat"
        ? "autonomic_strain"
        : isLateEveningWorkout
        ? "metabolic_carryover"
        : workoutStrain > 14
        ? "supercompensation"
        : "aligned_baseline";

    await db.insert(dailyBiometrics).values({
      id: `bio_${userId}_${dateStr}`,
      userId,
      date: dateStr,
      stepsCount: steps,
      activeMinutes: Math.round(steps / 100),
      restingHr: nadirBpm + 8,
      overnightHrvRmssd: overnightHrvMs,
      hrvEwma30d: 65.0,
      hrvZScore: Number(((overnightHrvMs - 65) / 10).toFixed(2)),
      hrvCv7d: 9.8,
      strainScore: workoutStrain,
      dynamicSleepTargetMinutes: 480 + (workoutStrain > 12 ? 35 : 0) + (isLateEveningWorkout ? 10 : 0),
      biologicalState: bioState,
      subjectiveMorningScore: morningScore,
    });

    // Insert 768-d Vector Embedding for night
    const featureRecord = {
      id: sessionId,
      sessionId,
      date: dateStr,
      durationMinutes,
      deepSleepPct: Math.round((deepMinutes / durationMinutes) * 100),
      remSleepPct: Math.round((remMinutes / durationMinutes) * 100),
      rhrNadirBpm: nadirBpm,
      timeToNadirMinutes,
      overnightHrvMs,
      hrvZScore: Number(((overnightHrvMs - 65) / 10).toFixed(2)),
      strainScore: workoutStrain,
      stepsCount: steps,
      sleepScore,
      subjectiveMorningScore: morningScore,
      autoTags,
    };
    const embeddingVector = generateDeterministicNightEmbedding(featureRecord);

    const summaryText = `${dateStr}: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m sleep with ${Math.round((deepMinutes / durationMinutes) * 100)}% Deep, ${nadirBpm} bpm Nadir (${hammockType}). Preceded by ${workoutStrain.toFixed(1)} strain (${autoTags.join(", ")}). Morning calibration: ${morningScore}/5.`;

    await db.insert(nightEmbeddings).values({
      id: `emb_${sessionId}`,
      userId,
      sessionId,
      date: dateStr,
      summaryText,
      embedding: embeddingVector,
    });
  }

  console.log("✓ Successfully seeded 45 days of multi-stage sleep, 1-min HR series, workouts, daily biometrics, and night embeddings!");
}

if (process.argv[1] && process.argv[1].includes("seed")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
