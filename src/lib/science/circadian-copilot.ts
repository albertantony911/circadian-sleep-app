/**
 * Live 24-Hour Circadian Co-Pilot & Borbély Process S Simulator
 * Models homeostatic sleep pressure S(t) and circadian alertness C(t).
 * Generates an actionable daily 24-hour biological timeline recalculating
 * milestones from today's actual wake-up timestamp.
 */

export interface BiologicalMilestone {
  id: string;
  name: string;
  shortLabel: string;
  timeWindow: string; // e.g. "06:30 – 07:30"
  startMinutesFromMidnight: number;
  endMinutesFromMidnight: number;
  status: "active" | "upcoming" | "completed";
  category: "light" | "focus" | "nap" | "caffeine" | "nutrition" | "sleep";
  description: string;
  actionTip: string;
  isCritical: boolean;
}

export interface ProcessSSample {
  hour: number; // 0.0 to 24.0
  timeString: string; // "14:30"
  processS: number; // 0.0 to 1.0 (sleep pressure)
  processC: number; // 0.0 to 1.0 (circadian alertness)
  combinedReadiness: number; // 0.0 to 1.0
  napEffectS?: number; // S(t) if nap taken
}

export interface NapSimulationResult {
  napType: "power_nap_20m" | "full_cycle_90m" | "nsdr_20m";
  napStartHour: number;
  napEndHour: number;
  isSafe: boolean; // Does it preserve bedtime sleep pressure?
  bedtimeInterferenceWarning: string | null;
  adenosineClearedPct: number;
  energyBoostScore: number; // 1 - 100
  recommendedLatestEnd: string;
  curve: ProcessSSample[];
}

/**
 * Generates today's 24-Hour Biological Milestone Timeline based on actual wake-up time.
 */
export function generateCircadianTimeline(
  actualWakeTime: Date | string,
  targetBedtime: string = "22:30",
  sleepDebtMinutes: number = 0,
  currentTime: Date = new Date()
): BiologicalMilestone[] {
  const wake = new Date(actualWakeTime);
  const wakeHour = wake.getHours();
  const wakeMin = wake.getMinutes();
  const wakeMinutesFromMidnight = wakeHour * 60 + wakeMin;

  const [bedH, bedM] = targetBedtime.split(":").map(Number);
  const bedMinutesFromMidnight = bedH * 60 + bedM;

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Helper to format minutes from midnight to HH:mm
  const formatTime = (totalMin: number): string => {
    let normalized = totalMin % (24 * 60);
    if (normalized < 0) normalized += 24 * 60;
    const h = Math.floor(normalized / 60);
    const m = Math.floor(normalized % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  const getStatus = (start: number, end: number): "active" | "upcoming" | "completed" => {
    if (nowMinutes >= start && nowMinutes <= end) return "active";
    if (nowMinutes < start) return "upcoming";
    return "completed";
  };

  // Tighten caffeine cutoff by 90 minutes if carrying substantial sleep debt
  const caffeineOffsetMinutes = sleepDebtMinutes > 60 ? 11.5 * 60 : 10 * 60;
  const caffeineCutoffMinutes = bedMinutesFromMidnight - caffeineOffsetMinutes;

  const rawMilestones = [
    {
      id: "mile_light_anchor",
      name: "Morning Sunlight Anchor",
      shortLabel: "Light Anchor",
      start: wakeMinutesFromMidnight,
      end: wakeMinutesFromMidnight + 60,
      category: "light" as const,
      description: "Trigger cortisol awakening pulse and start your 16-hour circadian melatonin timer.",
      actionTip: "Get 15–20 minutes of outdoor sunlight. Avoid sunglasses.",
      isCritical: true,
    },
    {
      id: "mile_peak_focus_1",
      name: "Peak Cognitive Window 1",
      shortLabel: "Deep Work 1",
      start: wakeMinutesFromMidnight + 150, // Wake + 2.5h
      end: wakeMinutesFromMidnight + 300, // Wake + 5h
      category: "focus" as const,
      description: "Maximum sympathetic activation and prefrontal cortex processing speed.",
      actionTip: "Tackle your highest-cognitive load task or creative problem solving.",
      isCritical: false,
    },
    {
      id: "mile_nap_nsdr",
      name: "Safe Nap & NSDR Cutoff",
      shortLabel: "Nap / NSDR Gate",
      start: wakeMinutesFromMidnight + 360, // Wake + 6h
      end: wakeMinutesFromMidnight + 480, // Wake + 8h (~14:30)
      category: "nap" as const,
      description: "Post-lunch dip in Process C alertness. Final window to nap without harming tonight's sleep onset.",
      actionTip: "Take a 20m power nap or 20m NSDR (Non-Sleep Deep Rest). Must conclude before cutoff.",
      isCritical: true,
    },
    {
      id: "mile_caffeine_cutoff",
      name: "Hard Caffeine Curfew",
      shortLabel: "Caffeine Cutoff",
      start: caffeineCutoffMinutes - 30,
      end: caffeineCutoffMinutes,
      category: "caffeine" as const,
      description: "Caffeine has a 5–7 hour half-life and 10–12 hour quarter-life that blocks adenosine receptors.",
      actionTip: "Switch to water, herbal tea, or decaf. Protect tonight's deep slow-wave sleep.",
      isCritical: true,
    },
    {
      id: "mile_peak_focus_2",
      name: "Peak Physical & Focus Window 2",
      shortLabel: "Athletic Window",
      start: wakeMinutesFromMidnight + 540, // Wake + 9h
      end: wakeMinutesFromMidnight + 660, // Wake + 11h
      category: "focus" as const,
      description: "Core body temperature and neuromuscular power hit daily maximum.",
      actionTip: "Optimal window for strength training, intervals, or high-intensity athletic performance.",
      isCritical: false,
    },
    {
      id: "mile_meal_cutoff",
      name: "Last Heavy Meal & High-Strain Cutoff",
      shortLabel: "Meal / Workout Cutoff",
      start: bedMinutesFromMidnight - 210, // Bedtime - 3.5h
      end: bedMinutesFromMidnight - 180, // Bedtime - 3h
      category: "nutrition" as const,
      description: "Late digestion and elevated core body temperature delay RHR Nadir into late sleep.",
      actionTip: "Finish dinner and intense exertion. Allow core temperature and digestion to drop.",
      isCritical: true,
    },
    {
      id: "mile_sleep_gate",
      name: "Melatonin Sleep Gate",
      shortLabel: "Sleep Gate",
      start: bedMinutesFromMidnight - 45,
      end: bedMinutesFromMidnight,
      category: "sleep" as const,
      description: "Endogenous melatonin surges; sleep propensity and adenosine saturation align.",
      actionTip: "Dim lighting to warm tones, silence notifications, and initiate wind-down.",
      isCritical: true,
    },
  ];

  return rawMilestones.map((m) => ({
    id: m.id,
    name: m.name,
    shortLabel: m.shortLabel,
    timeWindow: `${formatTime(m.start)} – ${formatTime(m.end)}`,
    startMinutesFromMidnight: m.start,
    endMinutesFromMidnight: m.end,
    status: getStatus(m.start, m.end),
    category: m.category,
    description: m.description,
    actionTip: m.actionTip,
    isCritical: m.isCritical,
  }));
}

/**
 * Simulates Borbély Process S Curve throughout the day with optional nap interventions.
 * S(t) rise: S(t) = 1 - (1 - S_0) * exp(-t / 18.2)
 * S(t) decay: S(t) = S_nap * exp(-t / 4.2)
 */
export function simulateProcessS(
  wakeHourFractional: number = 6.5, // 06:30
  bedHourFractional: number = 22.5, // 22:30
  napOption?: {
    type: "power_nap_20m" | "full_cycle_90m" | "nsdr_20m";
    napStartHour: number; // e.g. 13.5 (13:30)
  }
): NapSimulationResult {
  const TAU_RISE = 18.2; // Hours for sleep pressure build-up
  const TAU_DECAY = 4.2; // Hours for sleep pressure clearance during sleep

  const samples: ProcessSSample[] = [];
  const hoursAwakeTotal = bedHourFractional - wakeHourFractional;

  let napDurationHours = 0;
  let napDropRatio = 0;

  if (napOption) {
    if (napOption.type === "power_nap_20m") {
      napDurationHours = 20 / 60;
      napDropRatio = 0.14; // Light stage 1/2 clears mild adenosine without entering SWS
    } else if (napOption.type === "full_cycle_90m") {
      napDurationHours = 90 / 60;
      napDropRatio = 0.42; // Deep sleep clears major sleep pressure
    } else {
      napDurationHours = 20 / 60;
      napDropRatio = 0.05; // NSDR reduces sympathetic tension, minimal SWS drop
    }
  }

  const napStart = napOption ? napOption.napStartHour : -1;
  const napEnd = napOption ? napStart + napDurationHours : -1;

  // Recommended safe cutoff: 8 hours before bed
  const recommendedLatestEnd = `${Math.floor(bedHourFractional - 8).toString().padStart(2, "0")}:15`;

  let currentS = 0.08; // Baseline residual sleep pressure upon waking
  let currentSNap = 0.08;

  // Generate 24-hour hourly grid (e.g. from wake to bed + 2 hours)
  for (let h = Math.floor(wakeHourFractional); h <= 24; h += 0.5) {
    const timeH = Math.floor(h);
    const timeM = Math.round((h % 1) * 60);
    const timeString = `${timeH.toString().padStart(2, "0")}:${timeM.toString().padStart(2, "0")}`;

    if (h < wakeHourFractional) {
      continue;
    }

    const tSinceWake = h - wakeHourFractional;

    // Normal Process S
    const normalS = 1.0 - (1.0 - 0.08) * Math.exp(-tSinceWake / TAU_RISE);

    // Process C circadian alertness rhythm (sinusoidal peak at wake + 4h and wake + 10h)
    const processC =
      0.5 +
      0.35 * Math.sin(((h - wakeHourFractional - 3.5) / 12) * Math.PI) -
      0.15 * Math.sin(((h - wakeHourFractional - 7.0) / 6) * Math.PI);

    // With Nap
    let napS = normalS;
    if (napOption && h >= napStart) {
      if (h <= napEnd) {
        // During nap: rapid decay
        const tInNap = h - napStart;
        napS = normalS * (1 - (napDropRatio * tInNap) / napDurationHours);
      } else {
        // After nap: builds up again from lower starting point
        const tSinceNapEnd = h - napEnd;
        const sAtNapEnd = normalS * (1 - napDropRatio);
        napS = 1.0 - (1.0 - sAtNapEnd) * Math.exp(-tSinceNapEnd / TAU_RISE);
      }
    }

    samples.push({
      hour: h,
      timeString,
      processS: Number(normalS.toFixed(3)),
      processC: Number(Math.max(0, Math.min(1, processC)).toFixed(3)),
      combinedReadiness: Number(Math.max(0, Math.min(1, 1 - normalS + processC * 0.5)).toFixed(3)),
      napEffectS: napOption ? Number(napS.toFixed(3)) : undefined,
    });
  }

  // Safety evaluation: At target bedtime, does S(t) with nap reach at least 0.55 threshold?
  let isSafe = true;
  let bedtimeInterferenceWarning: string | null = null;

  if (napOption) {
    if (napEnd > bedHourFractional - 7.0) {
      isSafe = false;
      bedtimeInterferenceWarning = `Nap ended too close to bedtime (${timeStringFromFractional(napEnd)}). Bedtime sleep pressure S(t) will be depressed by ~${Math.round(napDropRatio * 100)}%, causing sleep-onset latency or midnight awakenings.`;
    }
  }

  return {
    napType: napOption ? napOption.type : "power_nap_20m",
    napStartHour: napStart,
    napEndHour: napEnd,
    isSafe,
    bedtimeInterferenceWarning,
    adenosineClearedPct: Math.round(napDropRatio * 100),
    energyBoostScore: napOption?.type === "full_cycle_90m" ? 85 : napOption?.type === "power_nap_20m" ? 65 : 45,
    recommendedLatestEnd,
    curve: samples,
  };
}

function timeStringFromFractional(f: number): string {
  const h = Math.floor(f);
  const m = Math.round((f % 1) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
