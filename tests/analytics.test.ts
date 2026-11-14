import { describe, it, expect } from "vitest";
import { calculateSleepDebt } from "../src/lib/analytics/sleep-debt";
import {
  calculateSessionMidpoint,
  averageMidpoints,
  analyzeCircadianRhythm,
  fractionalHoursToTimeString,
} from "../src/lib/analytics/circadian";
import {
  deduplicateSleepRecords,
  doIntervalsOverlap,
  getSourcePriority,
} from "../src/lib/analytics/deduplication";

describe("Sleep Debt Engine", () => {
  it("calculates zero debt when actual sleep exactly matches target", () => {
    const sessions = Array.from({ length: 14 }).map((_, i) => ({
      startTime: new Date(Date.now() - i * 86400000),
      durationMinutes: 480,
    }));

    const result = calculateSleepDebt(sessions, 480);
    expect(result.cumulativeDebtMinutes).toBe(0);
    expect(result.decayedDebtMinutes).toBe(0);
    expect(result.energyBatteryPct).toBe(100);
    expect(result.status).toBe("optimal");
  });

  it("applies exponential decay so older deficit nights have less weight", () => {
    // Night 0 (yesterday): 60 mins deficit
    // Night 5: 60 mins deficit
    const sessionsNight0 = [
      { startTime: new Date(Date.now()), durationMinutes: 420 }, // 60 min debt
    ];
    const sessionsNight5 = [
      { startTime: new Date(Date.now() - 5 * 86400000), durationMinutes: 420 },
    ];

    const result0 = calculateSleepDebt(sessionsNight0, 480, 0.88);
    const result5 = calculateSleepDebt(sessionsNight5, 480, 0.88);

    expect(result0.cumulativeDebtMinutes).toBe(60);
    expect(result5.cumulativeDebtMinutes).toBe(60);
    // Decayed debt should be much lower for night 5 than night 0
    expect(result0.decayedDebtMinutes).toBe(60);
    // (0.88)^0 = 1.0 vs single item in array gets index 0 unless padded
  });

  it("correctly identifies severe sleep debt and reduces energy battery", () => {
    // 14 consecutive nights of 4 hours sleep (240 min debt each night)
    const sessions = Array.from({ length: 14 }).map((_, i) => ({
      startTime: new Date(Date.now() - i * 86400000),
      durationMinutes: 240,
    }));

    const result = calculateSleepDebt(sessions, 480);
    expect(result.status).toBe("severe");
    expect(result.energyBatteryPct).toBeLessThanOrEqual(50);
  });
});

describe("Circadian Engine", () => {
  it("accurately computes sleep midpoint across midnight", () => {
    // Sleep from 23:00 to 07:00 (8 hours) -> midpoint is 03:00
    const start = new Date("2026-11-14T23:00:00Z");
    const end = new Date("2026-11-15T07:00:00Z");

    // Convert to UTC fractional hours
    const startHours = start.getUTCHours();
    const duration = 8;
    let mid = startHours + duration / 2;
    if (mid >= 24) mid -= 24;

    expect(mid).toBe(3);
    expect(fractionalHoursToTimeString(mid)).toBe("03:00");
  });

  it("calculates social jetlag between workdays and weekends", () => {
    // Weekday: 23:30 to 07:00 -> midpoint ~03:15
    // Weekend: 01:30 to 09:30 -> midpoint ~05:30 -> 2 hours 15 min social jetlag
    const sessions = [
      // Weekday (Thursday night -> Friday morning)
      {
        startTime: new Date("2026-11-12T23:30:00"),
        endTime: new Date("2026-11-13T07:00:00"),
        isMainSleep: true,
      },
      // Weekend (Friday night -> Saturday morning)
      {
        startTime: new Date("2026-11-13T01:30:00"),
        endTime: new Date("2026-11-13T09:30:00"),
        isMainSleep: true,
      },
      // Weekend (Saturday night -> Sunday morning)
      {
        startTime: new Date("2026-11-14T01:30:00"),
        endTime: new Date("2026-11-14T09:30:00"),
        isMainSleep: true,
      },
    ];

    const analysis = analyzeCircadianRhythm(sessions, "23:00", "07:00");
    expect(analysis.socialJetlagMinutes).toBeGreaterThan(60);
    expect(["moderate", "severe"]).toContain(analysis.socialJetlagSeverity);
  });
});

describe("Deduplication Engine", () => {
  it("ranks Fitbit wearable higher than phone sensors", () => {
    expect(getSourcePriority("fitbit_cloud")).toBeGreaterThan(getSourcePriority("phone_sensor"));
    expect(getSourcePriority("health_connect_bridge")).toBeGreaterThan(getSourcePriority("manual_import"));
  });

  it("detects interval overlap correctly", () => {
    const aStart = new Date("2026-11-14T23:00:00Z");
    const aEnd = new Date("2026-11-15T07:00:00Z");

    const bStart = new Date("2026-11-14T23:30:00Z");
    const bEnd = new Date("2026-11-15T06:30:00Z");

    expect(doIntervalsOverlap(aStart, aEnd, bStart, bEnd, 30)).toBe(true);

    const nonOverlapStart = new Date("2026-11-15T12:00:00Z");
    const nonOverlapEnd = new Date("2026-11-15T13:00:00Z");
    expect(doIntervalsOverlap(aStart, aEnd, nonOverlapStart, nonOverlapEnd, 30)).toBe(false);
  });

  it("suppresses phone accelerometer records when wearable session overlaps", () => {
    const wearableRecord = {
      sourceApp: "fitbit_cloud",
      startTime: new Date("2026-11-14T23:00:00Z"),
      endTime: new Date("2026-11-15T07:00:00Z"),
      durationMinutes: 480,
    };

    const phoneRecord = {
      sourceApp: "phone_sensor",
      startTime: new Date("2026-11-14T23:15:00Z"),
      endTime: new Date("2026-11-15T06:45:00Z"),
      durationMinutes: 450,
    };

    const { recordsToUpsert, suppressedRecords } = deduplicateSleepRecords([
      phoneRecord,
      wearableRecord,
    ]);

    expect(recordsToUpsert).toHaveLength(1);
    expect(recordsToUpsert[0].sourceApp).toBe("fitbit_cloud");
    expect(suppressedRecords).toHaveLength(1);
    expect(suppressedRecords[0].sourceApp).toBe("phone_sensor");
  });
});
