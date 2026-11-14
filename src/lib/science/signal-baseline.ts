/**
 * Longitudinal Signal Processing & Normalization Engine
 * Never evaluates a metric in isolation. Normalizes against personal 30-day baselines,
 * computes rolling HRV coefficient of variation, and calculates the Sleep Regularity Index (SRI).
 */

export interface NormalizedSignal {
  value: number;
  ewma30d: number;
  zScore: number;
  mean: number;
  sd: number;
  percentileRank: number;
  status: "severely_depressed" | "depressed" | "baseline" | "elevated" | "optimal";
  deltaPct: number;
}

/**
 * 30-Day Exponentially Weighted Moving Average (EWMA)
 * Formula: EWMA_t = alpha * X_t + (1 - alpha) * EWMA_{t-1}
 * Default alpha = 0.1 (~19-day half life)
 */
export function calculateEWMA(values: number[], alpha: number = 0.1): number {
  if (values.length === 0) return 0;
  let ewma = values[0];
  for (let i = 1; i < values.length; i++) {
    ewma = alpha * values[i] + (1 - alpha) * ewma;
  }
  return Number(ewma.toFixed(2));
}

/**
 * Personal Z-score computation against rolling 30-day history
 * Z = (X - mean) / sd
 */
export function calculateZScore(
  value: number,
  history: number[]
): {
  zScore: number;
  mean: number;
  sd: number;
  status: NormalizedSignal["status"];
  deltaPct: number;
} {
  if (history.length === 0) {
    return { zScore: 0, mean: value, sd: 0, status: "baseline", deltaPct: 0 };
  }

  const sum = history.reduce((acc, v) => acc + v, 0);
  const mean = sum / history.length;

  const variance =
    history.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) /
    Math.max(1, history.length - 1);
  const sd = Math.sqrt(variance);

  const zScore = sd > 0.0001 ? Number(((value - mean) / sd).toFixed(2)) : 0;
  const deltaPct = mean !== 0 ? Number((((value - mean) / mean) * 100).toFixed(1)) : 0;

  let status: NormalizedSignal["status"] = "baseline";
  if (zScore <= -1.75) status = "severely_depressed";
  else if (zScore <= -0.75) status = "depressed";
  else if (zScore >= 1.25) status = "optimal";
  else if (zScore >= 0.75) status = "elevated";

  return {
    zScore,
    mean: Number(mean.toFixed(2)),
    sd: Number(sd.toFixed(2)),
    status,
    deltaPct,
  };
}

/**
 * Rolling 7-Day HRV Coefficient of Variation (HRV-CV)
 * CV = (Standard Deviation / Mean) * 100%
 * High CV (>12-15%) indicates autonomic volatility/instability even if weekly mean appears flat.
 */
export function calculateHrvCV7d(hrvValues7d: number[]): number {
  if (hrvValues7d.length < 2) return 0;
  const mean = hrvValues7d.reduce((a, b) => a + b, 0) / hrvValues7d.length;
  if (mean <= 0) return 0;

  const variance =
    hrvValues7d.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (hrvValues7d.length - 1);
  const sd = Math.sqrt(variance);

  return Number(((sd / mean) * 100).toFixed(2));
}

/**
 * Sleep Regularity Index (SRI, 0–100)
 * Computes the probability that an individual is in the same state (asleep vs awake)
 * at any two time points 24 hours apart across rolling daily epoch windows.
 * SRI = -100 (complete discordance) to +100 (perfect circadian lock), scaled here to 0–100.
 *
 * @param dailyIntervals Array of sleep session start and end times in fractional hours [0, 24)
 */
export function calculateSleepRegularityIndex(
  dailyIntervals: Array<{ startHour: number; endHour: number }>
): number {
  if (dailyIntervals.length < 2) return 85; // Default healthy baseline

  const epochMinutes = 15; // 15-minute sampling epochs (96 epochs per 24 hours)
  const epochsPerDay = (24 * 60) / epochMinutes;

  let totalComparisons = 0;
  let matchingEpochs = 0;

  for (let day = 0; day < dailyIntervals.length - 1; day++) {
    const today = dailyIntervals[day];
    const tomorrow = dailyIntervals[day + 1];

    for (let epoch = 0; epoch < epochsPerDay; epoch++) {
      const epochHour = (epoch * epochMinutes) / 60;

      const isAsleepToday = isHourInInterval(epochHour, today.startHour, today.endHour);
      const isAsleepTomorrow = isHourInInterval(epochHour, tomorrow.startHour, tomorrow.endHour);

      if (isAsleepToday === isAsleepTomorrow) {
        matchingEpochs++;
      }
      totalComparisons++;
    }
  }

  if (totalComparisons === 0) return 85;
  const agreementRatio = matchingEpochs / totalComparisons;
  // Scaled linear mapping from [0.5, 1.0] to [0, 100]
  const sri = Math.min(100, Math.max(0, Math.round((agreementRatio - 0.5) * 200)));
  return sri;
}

function isHourInInterval(hour: number, start: number, end: number): boolean {
  if (start <= end) {
    return hour >= start && hour < end;
  }
  // Crosses midnight (e.g. 23:00 to 07:00)
  return hour >= start || hour < end;
}

/**
 * Confidence-Weighted Wearable Signal Combiner
 * Wearable staging (Deep vs REM) is subject to sensor noise; autonomic vitals (HR, HRV)
 * have 95%+ precision. Smooths stage percentages over 7 days while keeping vitals acute.
 */
export function smoothHypnogramStages(
  stagesHistory7d: Array<{ deepMinutes: number; remMinutes: number; lightMinutes: number; awakeMinutes: number; durationMinutes: number }>
): {
  deepPct: number;
  remPct: number;
  lightPct: number;
  awakePct: number;
  smoothedQualityScore: number;
} {
  if (stagesHistory7d.length === 0) {
    return { deepPct: 18, remPct: 22, lightPct: 52, awakePct: 8, smoothedQualityScore: 85 };
  }

  let totalDeep = 0;
  let totalRem = 0;
  let totalLight = 0;
  let totalAwake = 0;
  let totalDuration = 0;

  for (const s of stagesHistory7d) {
    totalDeep += s.deepMinutes;
    totalRem += s.remMinutes;
    totalLight += s.lightMinutes;
    totalAwake += s.awakeMinutes;
    totalDuration += s.durationMinutes;
  }

  const denom = Math.max(1, totalDuration);
  const deepPct = Math.round((totalDeep / denom) * 100);
  const remPct = Math.round((totalRem / denom) * 100);
  const lightPct = Math.round((totalLight / denom) * 100);
  const awakePct = Math.round((totalAwake / denom) * 100);

  // Quality score formula: Deep (ideal 18-22%) + REM (ideal 20-25%) - excessive awake (>10%)
  const deepScore = Math.min(30, (deepPct / 20) * 30);
  const remScore = Math.min(30, (remPct / 22) * 30);
  const efficiencyScore = Math.max(0, 40 - Math.max(0, awakePct - 7) * 3);
  const smoothedQualityScore = Math.min(100, Math.round(deepScore + remScore + efficiencyScore));

  return {
    deepPct,
    remPct,
    lightPct,
    awakePct,
    smoothedQualityScore,
  };
}
