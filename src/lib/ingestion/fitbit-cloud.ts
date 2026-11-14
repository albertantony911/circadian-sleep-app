/**
 * Scoped Ingestion & Rate-Limit-Safe Cloud Fetchers
 * Scopes intraday heart rate strictly to sleep start/end timestamps to minimize API quota usage.
 */

import { HrZones, calculateCardiovascularStrain } from "@/lib/science/strain-sleep-debt";

export interface FitbitActivityItem {
  logId: number;
  activityName: string;
  activityTypeId: number;
  startTime: string;
  duration: number; // ms
  averageHeartRate?: number;
  heartRateZones?: Array<{
    name: string;
    min: number;
    max: number;
    minutes: number;
  }>;
}

export interface ScopedHeartRateSample {
  time: string;
  value: number;
}

/**
 * Maps Fitbit activity name to normalized activity type
 */
export function normalizeActivityType(name: string): "cycling" | "running" | "strength_training" | "stair_climbing" | "walking" | "other" {
  const lower = name.toLowerCase();
  if (lower.includes("bike") || lower.includes("cycl")) return "cycling";
  if (lower.includes("run") || lower.includes("treadmill")) return "running";
  if (lower.includes("weight") || lower.includes("strength") || lower.includes("circuit")) return "strength_training";
  if (lower.includes("stair") || lower.includes("elliptical")) return "stair_climbing";
  if (lower.includes("walk") || lower.includes("hike")) return "walking";
  return "other";
}

/**
 * Extracts HR zone minutes from Fitbit activity response
 */
export function extractHrZones(rawZones?: Array<{ name: string; minutes: number }>): HrZones {
  const zones: HrZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  if (!rawZones) return zones;

  for (const z of rawZones) {
    const name = z.name.toLowerCase();
    if (name.includes("out of range") || name.includes("zone 1")) zones.z1 += z.minutes;
    else if (name.includes("fat burn") || name.includes("zone 2")) zones.z2 += z.minutes;
    else if (name.includes("cardio") || name.includes("zone 3")) zones.z3 += z.minutes;
    else if (name.includes("peak") || name.includes("zone 4")) zones.z4 += z.minutes;
    else if (name.includes("zone 5")) zones.z5 += z.minutes;
  }

  return zones;
}

/**
 * Filters 1-minute intraday heart rate series strictly to the sleep session window
 */
export function clipIntradayHeartRateToSleepWindow(
  intradaySamples: Array<{ time: string; value: number }>,
  dateStr: string,
  sleepStart: Date,
  sleepEnd: Date
): Array<{ recordedAt: Date; bpm: number }> {
  const startMs = sleepStart.getTime();
  const endMs = sleepEnd.getTime();
  const clipped: Array<{ recordedAt: Date; bpm: number }> = [];

  for (const sample of intradaySamples) {
    // sample.time is "HH:mm:ss"
    const sampleDateTime = new Date(`${dateStr}T${sample.time}Z`);
    const sampleMs = sampleDateTime.getTime();

    if (sampleMs >= startMs && sampleMs <= endMs) {
      clipped.push({
        recordedAt: sampleDateTime,
        bpm: sample.value,
      });
    }
  }

  return clipped;
}
