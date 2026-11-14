export interface RawSleepRecord {
  externalId?: string;
  sourceApp: string; // e.g. "com.fitbit.FitbitMobile", "fitbit_cloud", "health_connect_bridge", "sleep_as_android_csv"
  startTime: Date | string;
  endTime: Date | string;
  durationMinutes: number;
  timeInBedMinutes?: number;
  sleepEfficiencyPct?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  remMinutes?: number;
  awakeMinutes?: number;
  sleepScore?: number;
  stages?: Array<{
    stage: "awake" | "light" | "deep" | "rem";
    startTime: Date | string;
    endTime: Date | string;
    durationSeconds: number;
  }>;
}

// Higher rank means higher precedence
const SOURCE_PRIORITY_MAP: Record<string, number> = {
  health_connect_bridge: 100,
  "com.google.android.apps.healthdata": 100,
  "com.google.android.apps.fitness": 100,
  "com.fitbit.FitbitMobile": 100,
  "com.samsung.android.shealth": 100,
  "com.sec.android.app.shealth": 100,
  "com.guavahealth.app": 100,
  garmin: 90,
  whoop: 90,
  health_connect_wearable: 90,
  fitbit_cloud: 75,
  sleep_as_android_csv: 60,
  "com.urbandroid.sleep": 60,
  phone_sensor: 30,
  manual_import: 20,
  simulated_seed: 5,
};

export function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY_MAP[source] || 50;
}

/**
 * Checks whether two time intervals overlap by at least `minOverlapMinutes`.
 */
export function doIntervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
  minOverlapMinutes: number = 30
): boolean {
  const overlapStart = Math.max(startA.getTime(), startB.getTime());
  const overlapEnd = Math.min(endA.getTime(), endB.getTime());
  const overlapMs = overlapEnd - overlapStart;
  return overlapMs >= minOverlapMinutes * 60 * 1000;
}

/**
 * Deduplicates an array of incoming sleep records against each other and existing records.
 * Resolves overlaps by prioritizing wearable sources over accelerometer/phone sources.
 */
export function deduplicateSleepRecords(
  incomingRecords: RawSleepRecord[],
  existingRecords: RawSleepRecord[] = []
): {
  recordsToUpsert: RawSleepRecord[];
  suppressedRecords: RawSleepRecord[];
} {
  const allRecords = [...incomingRecords];
  const recordsToUpsert: RawSleepRecord[] = [];
  const suppressedRecords: RawSleepRecord[] = [];

  // Sort descending by priority, then descending by duration
  allRecords.sort((a, b) => {
    const prioDiff = getSourcePriority(b.sourceApp) - getSourcePriority(a.sourceApp);
    if (prioDiff !== 0) return prioDiff;
    return b.durationMinutes - a.durationMinutes;
  });

  for (const candidate of allRecords) {
    const candidateStart = new Date(candidate.startTime);
    const candidateEnd = new Date(candidate.endTime);

    // Check against already selected records
    let isSuppressed = false;

    for (const accepted of recordsToUpsert) {
      const acceptedStart = new Date(accepted.startTime);
      const acceptedEnd = new Date(accepted.endTime);

      if (doIntervalsOverlap(candidateStart, candidateEnd, acceptedStart, acceptedEnd)) {
        // Since candidates are sorted by priority, candidate has lower or equal priority
        isSuppressed = true;
        break;
      }
    }

    if (!isSuppressed) {
      // Also check against existing stored records
      for (const existing of existingRecords) {
        const existingStart = new Date(existing.startTime);
        const existingEnd = new Date(existing.endTime);

        if (doIntervalsOverlap(candidateStart, candidateEnd, existingStart, existingEnd)) {
          const existingPriority = getSourcePriority(existing.sourceApp);
          const candidatePriority = getSourcePriority(candidate.sourceApp);

          // If existing has higher priority, candidate is suppressed
          if (existingPriority >= candidatePriority) {
            isSuppressed = true;
            break;
          }
        }
      }
    }

    if (isSuppressed) {
      suppressedRecords.push(candidate);
    } else {
      recordsToUpsert.push(candidate);
    }
  }

  return {
    recordsToUpsert,
    suppressedRecords,
  };
}
