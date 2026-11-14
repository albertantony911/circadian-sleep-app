import { describe, it, expect } from "vitest";
import {
  calculateEWMA,
  calculateZScore,
  calculateHrvCV7d,
  calculateSleepRegularityIndex,
  smoothHypnogramStages,
} from "../src/lib/science/signal-baseline";
import {
  calculateCardiovascularStrain,
  calculateDynamicSleepTarget,
  calculateDecayedSleepDebtPlan,
} from "../src/lib/science/strain-sleep-debt";
import { analyzeAutonomicRecovery } from "../src/lib/science/autonomic-recovery";
import { classifyBiologicalState } from "../src/lib/science/biological-state";
import {
  generateCircadianTimeline,
  simulateProcessS,
} from "../src/lib/science/circadian-copilot";
import {
  generateAutoTags,
  computeCausalInsights,
  generateDeterministicNightEmbedding,
  cosineSimilarity,
  findSimilarNights,
} from "../src/lib/science/causal-patterns";

describe("Scientific Signal Baseline Engine", () => {
  it("calculates EWMA with exponential convergence", () => {
    const values = [50, 60, 70, 80, 90];
    const ewma = calculateEWMA(values, 0.1);
    expect(ewma).toBeGreaterThan(50);
    expect(ewma).toBeLessThan(70);
  });

  it("calculates accurate Z-score and personal deviation status", () => {
    const history = [60, 62, 64, 61, 63, 62, 65, 60, 63, 62];
    const { zScore, status } = calculateZScore(75, history);
    expect(zScore).toBeGreaterThan(2.0);
    expect(status).toBe("optimal");

    const depressed = calculateZScore(45, history);
    expect(depressed.zScore).toBeLessThan(-2.0);
    expect(depressed.status).toBe("severely_depressed");
  });

  it("calculates rolling 7-day HRV Coefficient of Variation (HRV-CV)", () => {
    const stableHrv = [65, 66, 64, 65, 67, 65, 66];
    const cvStable = calculateHrvCV7d(stableHrv);
    expect(cvStable).toBeLessThan(5.0); // Very stable autonomic tone

    const volatileHrv = [40, 85, 45, 90, 50, 80, 48];
    const cvVolatile = calculateHrvCV7d(volatileHrv);
    expect(cvVolatile).toBeGreaterThan(15.0); // High autonomic instability
  });

  it("computes Sleep Regularity Index (SRI) on rolling 7-day intervals", () => {
    const consistentWeek = [
      { startHour: 23.0, endHour: 7.0 },
      { startHour: 23.1, endHour: 7.0 },
      { startHour: 23.0, endHour: 6.9 },
      { startHour: 22.9, endHour: 7.1 },
      { startHour: 23.0, endHour: 7.0 },
    ];
    const sriConsistent = calculateSleepRegularityIndex(consistentWeek);
    expect(sriConsistent).toBeGreaterThanOrEqual(85);

    const chaoticWeek = [
      { startHour: 22.0, endHour: 6.0 },
      { startHour: 2.0, endHour: 10.0 }, // Shifted 4 hours
      { startHour: 21.0, endHour: 5.0 },
      { startHour: 3.5, endHour: 11.5 },
    ];
    const sriChaotic = calculateSleepRegularityIndex(chaoticWeek);
    expect(sriChaotic).toBeLessThan(sriConsistent);
  });

  it("smooths hypnogram stages to suppress single-night wearable staging noise", () => {
    const nights = [
      { deepMinutes: 80, remMinutes: 100, lightMinutes: 240, awakeMinutes: 30, durationMinutes: 450 },
      { deepMinutes: 75, remMinutes: 95, lightMinutes: 250, awakeMinutes: 25, durationMinutes: 445 },
    ];
    const smoothed = smoothHypnogramStages(nights);
    expect(smoothed.deepPct).toBeGreaterThanOrEqual(15);
    expect(smoothed.remPct).toBeGreaterThanOrEqual(20);
    expect(smoothed.smoothedQualityScore).toBeGreaterThan(70);
  });
});

describe("Training Strain & Dynamic Sleep Debt Engine", () => {
  it("calculates TRIMP cardiovascular strain on a 0-21.0 scale", () => {
    const restZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    const rest = calculateCardiovascularStrain(restZones, 3000);
    expect(rest.strainScore).toBeLessThan(5.0);
    expect(rest.category).toBe("rest");

    const highZones = { z1: 15, z2: 20, z3: 30, z4: 25, z5: 10 };
    const high = calculateCardiovascularStrain(highZones, 14000);
    expect(high.strainScore).toBeGreaterThan(12.0);
    expect(high.strainScore).toBeLessThanOrEqual(21.0);
  });

  it("dynamically increases sleep need for high cardiovascular strain and late workout", () => {
    const normal = calculateDynamicSleepTarget(480, 4.0, false);
    expect(normal.totalTargetMinutes).toBe(480);

    const highStrain = calculateDynamicSleepTarget(480, 14.5, false);
    expect(highStrain.totalTargetMinutes).toBe(515); // +35m for high strain

    const lateWorkout = calculateDynamicSleepTarget(480, 14.5, true);
    expect(lateWorkout.totalTargetMinutes).toBe(525); // +35m strain + 10m late penalty
  });

  it("applies exponential decay to rolling 14-day sleep debt and creates 3-day recovery plan", () => {
    const history = [
      { startTime: new Date(), durationMinutes: 420 }, // 60m deficit today
      { startTime: new Date(Date.now() - 86400000 * 2), durationMinutes: 400 }, // 80m deficit 2 days ago
    ];
    const plan = calculateDecayedSleepDebtPlan(history, 480, "22:30");
    expect(plan.cumulativeDebtMinutes).toBe(140);
    expect(plan.decayedDebtMinutes).toBeLessThan(140);
    expect(plan.dailyDebtBudget).toBeGreaterThan(0);
    expect(plan.safeNapOption.durationMinutes).toBe(20);
  });
});

describe("Autonomic Recovery & RHR Nadir Engine", () => {
  it("detects RHR Nadir with 15-minute rolling window smoothing", () => {
    const startTime = new Date("2026-11-14T23:00:00Z");
    const endTime = new Date("2026-11-15T07:00:00Z");
    const samples: Array<{ recordedAt: Date; bpm: number }> = [];

    // Synthesize optimal hammock (min HR around 02:00)
    for (let m = 0; m < 480; m += 2) {
      const sampleTime = new Date(startTime.getTime() + m * 60000);
      const progress = m / 480;
      const bpm = Math.round(52 + Math.pow(progress - 0.38, 2) * 50);
      samples.push({ recordedAt: sampleTime, bpm });
    }

    const analysis = analyzeAutonomicRecovery(samples, startTime, endTime, 68);
    expect(analysis.rhrNadirBpm).toBeLessThanOrEqual(54);
    expect(analysis.hammockCurveType).toBe("optimal_hammock");
    expect(analysis.isRestorative).toBe(true);
    expect(analysis.timeToNadirPct).toBeGreaterThanOrEqual(30);
    expect(analysis.timeToNadirPct).toBeLessThanOrEqual(48);
  });

  it("flags delayed nadir when RHR stays high during the first half of sleep", () => {
    const startTime = new Date("2026-11-14T23:00:00Z");
    const endTime = new Date("2026-11-15T07:00:00Z");
    const samples: Array<{ recordedAt: Date; bpm: number }> = [];

    // Synthesize late nadir (min HR at 80% of sleep)
    for (let m = 0; m < 480; m += 2) {
      const sampleTime = new Date(startTime.getTime() + m * 60000);
      const progress = m / 480;
      const bpm = Math.round(52 + Math.pow(progress - 0.8, 2) * 50);
      samples.push({ recordedAt: sampleTime, bpm });
    }

    const analysis = analyzeAutonomicRecovery(samples, startTime, endTime, 68);
    expect(analysis.hammockCurveType).toBe("late_nadir_delayed");
    expect(analysis.isRestorative).toBe(false);
  });
});

describe("Biological State Classifier Engine", () => {
  it("classifies Supercompensation when high strain is matched by positive HRV and early nadir", () => {
    const verdict = classifyBiologicalState({
      hrvZScore: 0.8,
      hrvCv7d: 8.5,
      rhrNadirPct: 40,
      hammockType: "optimal_hammock",
      sleepDebtMinutes: 20,
      priorDayStrain: 14.5,
      sri: 92,
      deepSleepPct: 20,
    });
    expect(verdict.state).toBe("supercompensation");
    expect(verdict.readinessScore).toBeGreaterThanOrEqual(90);
    expect(verdict.recoveryChecklist).toHaveLength(3);
  });

  it("classifies Autonomic Strain when nocturnal HR is flat or HRV drops severely", () => {
    const verdict = classifyBiologicalState({
      hrvZScore: -1.8,
      hrvCv7d: 18.0,
      rhrNadirPct: 50,
      hammockType: "elevated_flat",
      sleepDebtMinutes: 45,
      priorDayStrain: 15.0,
      sri: 80,
      deepSleepPct: 12,
    });
    expect(verdict.state).toBe("autonomic_strain");
    expect(verdict.readinessScore).toBeLessThan(50);
    expect(verdict.recoveryChecklist[0].category).toBe("training");
  });

  it("classifies Metabolic Carryover on delayed nadir", () => {
    const verdict = classifyBiologicalState({
      hrvZScore: -0.6,
      hrvCv7d: 11.0,
      rhrNadirPct: 75,
      hammockType: "late_nadir_delayed",
      sleepDebtMinutes: 30,
      priorDayStrain: 11.0,
      sri: 85,
      deepSleepPct: 15,
    });
    expect(verdict.state).toBe("metabolic_carryover");
    expect(verdict.recoveryChecklist[0].category).toBe("nutrition");
  });
});

describe("Live Circadian Co-Pilot & Process S Simulator", () => {
  it("generates 24-hour milestones anchored to actual wake time", () => {
    const wakeTime = new Date("2026-11-14T07:00:00Z");
    const milestones = generateCircadianTimeline(wakeTime, "23:00", 25);
    expect(milestones.length).toBe(7);

    const lightAnchor = milestones.find((m) => m.id === "mile_light_anchor");
    expect(lightAnchor).toBeDefined();
    expect(lightAnchor?.isCritical).toBe(true);

    const caffeineCutoff = milestones.find((m) => m.id === "mile_caffeine_cutoff");
    expect(caffeineCutoff).toBeDefined();
  });

  it("simulates Process S homeostatic pressure build-up and nap clearance", () => {
    const noNap = simulateProcessS(6.5, 22.5);
    const finalSampleNoNap = noNap.curve[noNap.curve.length - 1];
    expect(finalSampleNoNap.processS).toBeGreaterThan(0.55);

    // Power nap at 13:30 (1:30 PM) is safe
    const withSafeNap = simulateProcessS(6.5, 22.5, {
      type: "power_nap_20m",
      napStartHour: 13.5,
    });
    expect(withSafeNap.isSafe).toBe(true);
    expect(withSafeNap.adenosineClearedPct).toBeGreaterThan(10);

    // Late full cycle nap at 18:00 causes bedtime interference
    const withLateNap = simulateProcessS(6.5, 22.5, {
      type: "full_cycle_90m",
      napStartHour: 18.0,
    });
    expect(withLateNap.isSafe).toBe(false);
    expect(withLateNap.bedtimeInterferenceWarning).toContain("too close to bedtime");
  });
});

describe("Causal Pattern Digest & Vector Similarity Engine", () => {
  it("auto-tags nights based on daily behavioural flags", () => {
    const tags = generateAutoTags({
      workoutEndedWithin3hOfBed: true,
      workoutStartedWithin2hOfWake: false,
      dailySteps: 13500,
      dailyStrain: 14.2,
      isWeekendMidpointShift: true,
    });
    expect(tags).toContain("late_evening_workout");
    expect(tags).toContain("high_step_day_12k+");
    expect(tags).toContain("high_strain_day");
    expect(tags).toContain("weekend_social_jetlag");
  });

  it("generates unit-normalized 768-dimensional vector embeddings", () => {
    const record = {
      id: "night_test_1",
      sessionId: "night_test_1",
      date: "2026-11-14",
      durationMinutes: 480,
      deepSleepPct: 20,
      remSleepPct: 22,
      rhrNadirBpm: 52,
      timeToNadirMinutes: 180,
      overnightHrvMs: 65,
      hrvZScore: 0.5,
      strainScore: 10.0,
      stepsCount: 11000,
      sleepScore: 88,
      autoTags: ["morning_outdoor_activity"],
    };

    const vector = generateDeterministicNightEmbedding(record);
    expect(vector).toHaveLength(768);

    // L2 norm must be ~1.0
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 3);
  });

  it("calculates cosine similarity and ranks matching historical nights", () => {
    const vecA = [1, 0, 0, 0];
    const vecB = [1, 0, 0, 0];
    const vecC = [0, 1, 0, 0];

    expect(cosineSimilarity(vecA, vecB)).toBe(1.0);
    expect(cosineSimilarity(vecA, vecC)).toBe(0.0);

    const history = [
      { sessionId: "s1", date: "2026-11-10", summaryText: "Identical night", vector: [1, 0, 0, 0] },
      { sessionId: "s2", date: "2026-11-11", summaryText: "Different night", vector: [0, 1, 0, 0] },
    ];
    const matches = findSimilarNights([1, 0, 0, 0], history, 2);
    expect(matches[0].sessionId).toBe("s1");
    expect(matches[0].similarity).toBe(1.0);
  });
});
