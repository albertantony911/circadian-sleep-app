/**
 * Training Strain & Dynamic Sleep Debt Engine
 * Computes cardiovascular load on a 0-21 TRIMP scale, dynamically scales tonight's
 * sleep target based on physical strain, and calculates a 3-day debt recovery plan.
 */

export interface HrZones {
  z1: number; // minutes in Zone 1 (50-60% HR max)
  z2: number; // Zone 2 (60-70%)
  z3: number; // Zone 3 (70-80%)
  z4: number; // Zone 4 (80-90%)
  z5: number; // Zone 5 (90-100%)
}

export interface DynamicSleepTarget {
  baseMinutes: number; // e.g. 480 (8h 00m)
  trainingStrainScore: number; // 0 - 21
  trainingStrainMinutes: number; // e.g. +35m
  lateWorkoutPenaltyMinutes: number; // e.g. +10m
  totalTargetMinutes: number; // e.g. 525m (8h 45m)
  recommendedBedtime: string; // e.g. "21:55"
  recommendedWakeTime: string; // e.g. "06:40"
  rationale: string;
}

export interface ThreeDayRecoveryPlan {
  cumulativeDebtMinutes: number;
  decayedDebtMinutes: number;
  dailyDebtBudget: number; // e.g. +30m per night over 3 days
  tonightBedtimeShiftMinutes: number; // e.g. -35m earlier
  safeNapOption: {
    durationMinutes: number;
    recommendedBefore: string;
    debtPaydownCreditMinutes: number;
  };
  actionAdvice: string;
}

/**
 * Calculates Cardiovascular Strain Score on a 0 - 21.0 scale
 * Uses TRIMP (Training Impulse) weighted zone duration + daily step volume load.
 */
export function calculateCardiovascularStrain(
  zones: HrZones,
  dailySteps: number = 0
): { strainScore: number; trimpUnits: number; category: "rest" | "moderate" | "high" | "very_high" } {
  // Weighted zone impulse
  const trimpUnits =
    zones.z1 * 1.0 +
    zones.z2 * 1.25 +
    zones.z3 * 1.6 +
    zones.z4 * 2.3 +
    zones.z5 * 3.2;

  // Step volume impulse (e.g. 10k steps = ~1.2 strain, 15k steps = ~2.0 strain)
  const stepImpulse = Math.min(3.0, (dailySteps / 12000) * 1.8);

  // Scaled asymptotically to 0 - 21.0 using logarithmic saturation
  const rawStrain = 21 * (1 - Math.exp(-trimpUnits / 110)) + stepImpulse;
  const strainScore = Number(Math.min(21.0, Math.max(0, rawStrain)).toFixed(1));

  let category: "rest" | "moderate" | "high" | "very_high" = "rest";
  if (strainScore >= 16.0) category = "very_high";
  else if (strainScore >= 12.0) category = "high";
  else if (strainScore >= 6.0) category = "moderate";

  return { strainScore, trimpUnits: Math.round(trimpUnits), category };
}

/**
 * Computes Dynamic Sleep Need Adjustment
 * Baseline (480 min) + Load need (+0 to +45 min) + Late workout penalty (+10 min)
 */
export function calculateDynamicSleepTarget(
  baseTargetMinutes: number,
  strainScore: number,
  isLateEveningWorkout: boolean,
  preferredWakeTime: string = "06:30"
): DynamicSleepTarget {
  let trainingStrainMinutes = 0;
  let loadDescription = "Light/rest day load";

  if (strainScore >= 16.0) {
    trainingStrainMinutes = 45;
    loadDescription = "Very high endurance + resistance training load";
  } else if (strainScore >= 12.0) {
    trainingStrainMinutes = 35;
    loadDescription = "High cardio & interval/stair-climbing load";
  } else if (strainScore >= 6.0) {
    trainingStrainMinutes = 20;
    loadDescription = "Moderate aerobic & active step volume";
  }

  const lateWorkoutPenaltyMinutes = isLateEveningWorkout ? 10 : 0;
  const totalTargetMinutes = baseTargetMinutes + trainingStrainMinutes + lateWorkoutPenaltyMinutes;

  // Compute recommended bedtime based on preferred wake time
  const [wakeH, wakeM] = preferredWakeTime.split(":").map(Number);
  const wakeTotalMin = wakeH * 60 + wakeM;
  let bedTotalMin = wakeTotalMin - totalTargetMinutes;
  if (bedTotalMin < 0) bedTotalMin += 24 * 60;

  const bedH = Math.floor(bedTotalMin / 60);
  const bedM = bedTotalMin % 60;
  const recommendedBedtime = `${bedH.toString().padStart(2, "0")}:${bedM.toString().padStart(2, "0")}`;

  const rationale = isLateEveningWorkout
    ? `Cardiovascular strain (${strainScore}/21) + late workout require +${trainingStrainMinutes + lateWorkoutPenaltyMinutes}m extra sleep opportunity to repair muscle and clear cortisol.`
    : `Cardiovascular strain (${strainScore}/21) requires +${trainingStrainMinutes}m additional rest over your ${Math.floor(baseTargetMinutes / 60)}h baseline.`;

  return {
    baseMinutes: baseTargetMinutes,
    trainingStrainScore: strainScore,
    trainingStrainMinutes,
    lateWorkoutPenaltyMinutes,
    totalTargetMinutes,
    recommendedBedtime,
    recommendedWakeTime: preferredWakeTime,
    rationale,
  };
}

/**
 * Calculates 14-Day Rolling Decayed Sleep Debt & Generates 3-Day Actionable Paydown Plan
 */
export function calculateDecayedSleepDebtPlan(
  recentSessions: Array<{ startTime: Date | string; durationMinutes: number; targetMinutes?: number }>,
  baseTargetMinutes: number,
  targetBedtime: string = "22:30"
): ThreeDayRecoveryPlan {
  const DECAY_FACTOR = 0.88; // Half-life of ~5.4 days
  let cumulativeDebtMinutes = 0;
  let decayedDebtMinutes = 0;

  const now = Date.now();

  for (let i = 0; i < Math.min(14, recentSessions.length); i++) {
    const s = recentSessions[i];
    const sessionDate = new Date(s.startTime);
    const dayOffset = Math.max(0, Math.floor((now - sessionDate.getTime()) / 86400000));
    const target = s.targetMinutes || baseTargetMinutes;
    const deficit = Math.max(-60, target - s.durationMinutes); // Cap surplus at 60m per night

    cumulativeDebtMinutes += deficit;
    decayedDebtMinutes += deficit * Math.pow(DECAY_FACTOR, dayOffset);
  }

  cumulativeDebtMinutes = Math.max(0, Math.round(cumulativeDebtMinutes));
  decayedDebtMinutes = Math.max(0, Math.round(decayedDebtMinutes));

  // 3-Day Recovery distribution
  const dailyDebtBudget = Math.min(45, Math.ceil(decayedDebtMinutes / 3));

  // Shift bedtime earlier
  const [bedH, bedM] = targetBedtime.split(":").map(Number);
  let shiftedTotalMin = bedH * 60 + bedM - dailyDebtBudget;
  if (shiftedTotalMin < 0) shiftedTotalMin += 24 * 60;
  const shiftH = Math.floor(shiftedTotalMin / 60);
  const shiftM = shiftedTotalMin % 60;
  const shiftedBedtime = `${shiftH.toString().padStart(2, "0")}:${shiftM.toString().padStart(2, "0")}`;

  const safeNapOption = {
    durationMinutes: 20,
    recommendedBefore: "14:15",
    debtPaydownCreditMinutes: 20,
  };

  const actionAdvice =
    decayedDebtMinutes > 60
      ? `You have ${Math.floor(decayedDebtMinutes / 60)}h ${decayedDebtMinutes % 60}m of rolling sleep debt. Pay it down with +${dailyDebtBudget}m tonight (wind-down at ${shiftedBedtime}) or a 20m power nap before 14:15.`
      : "Sleep debt is within optimal recovery bounds (<60m). Maintain regular circadian schedule.";

  return {
    cumulativeDebtMinutes,
    decayedDebtMinutes,
    dailyDebtBudget,
    tonightBedtimeShiftMinutes: dailyDebtBudget,
    safeNapOption,
    actionAdvice,
  };
}
