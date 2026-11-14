export interface SleepDebtResult {
  cumulativeDebtMinutes: number;
  cumulativeDebtHours: number;
  decayedDebtMinutes: number;
  decayedDebtHours: number;
  energyBatteryPct: number;
  status: "surplus" | "optimal" | "mild" | "moderate" | "severe";
  statusLabel: string;
  advice: string;
  dailyDebts: Array<{
    date: string;
    actualMinutes: number;
    targetMinutes: number;
    deltaMinutes: number;
    weight: number;
  }>;
}

/**
 * Calculates rolling 14-day sleep debt with exponential decay for older nights.
 * @param sessions Array of sleep sessions (sorted descending by start date, up to 14 days)
 * @param targetMinutes Target sleep per night (default 480 mins / 8 hours)
 * @param decayFactor Decay factor per day (default 0.88)
 */
export function calculateSleepDebt(
  sessions: Array<{ startTime: Date | string; durationMinutes: number }>,
  targetMinutes: number = 480,
  decayFactor: number = 0.88
): SleepDebtResult {
  const dailyDebts: SleepDebtResult["dailyDebts"] = [];
  let totalRawDebtMinutes = 0;
  let decayedDebtMinutes = 0;

  // Take the most recent 14 nights
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  ).slice(0, 14);

  sortedSessions.forEach((session, dayIndex) => {
    const actualMinutes = session.durationMinutes;
    const delta = targetMinutes - actualMinutes; // Positive means deficit/debt, negative means surplus
    const weight = Math.pow(decayFactor, dayIndex);

    totalRawDebtMinutes += delta;
    decayedDebtMinutes += delta * weight;

    const dateStr = new Date(session.startTime).toISOString().split("T")[0];
    dailyDebts.push({
      date: dateStr,
      actualMinutes,
      targetMinutes,
      deltaMinutes: delta,
      weight: parseFloat(weight.toFixed(3)),
    });
  });

  const cumulativeDebtHours = parseFloat((totalRawDebtMinutes / 60).toFixed(1));
  const decayedDebtHours = parseFloat((decayedDebtMinutes / 60).toFixed(1));

  // Compute 0-100% Energy Battery
  // Baseline 100%, depleted by ~7.5% per hour of decayed sleep debt
  let energyBattery = 100 - decayedDebtHours * 7.5;
  energyBattery = Math.max(10, Math.min(100, Math.round(energyBattery)));

  // Status mapping
  let status: SleepDebtResult["status"] = "optimal";
  let statusLabel = "Optimal Sleep Balance";
  let advice = "Your sleep balance is primed. Keep your regular wake schedule.";

  if (decayedDebtHours <= -1) {
    status = "surplus";
    statusLabel = "Sleep Surplus / Banked";
    advice = "You have banked restorative sleep. Expect peak daytime focus.";
  } else if (decayedDebtHours <= 1.5) {
    status = "optimal";
    statusLabel = "Well Rested";
    advice = "Low sleep debt. Your natural circadian alertness is strong.";
  } else if (decayedDebtHours <= 4.0) {
    status = "mild";
    statusLabel = "Mild Sleep Debt";
    advice = "Minor deficit. Aim for 30 minutes extra sleep tonight to recover.";
  } else if (decayedDebtHours <= 7.0) {
    status = "moderate";
    statusLabel = "Moderate Sleep Debt";
    advice = "Noticeable deficit. Prioritize winding down early without caffeine late in the day.";
  } else {
    status = "severe";
    statusLabel = "Severe Sleep Deficit";
    advice = "Critical sleep debt accumulating. Restrict screen exposure and take a 20-min afternoon power nap.";
  }

  return {
    cumulativeDebtMinutes: Math.round(totalRawDebtMinutes),
    cumulativeDebtHours,
    decayedDebtMinutes: Math.round(decayedDebtMinutes),
    decayedDebtHours,
    energyBatteryPct: energyBattery,
    status,
    statusLabel,
    advice,
    dailyDebts,
  };
}
