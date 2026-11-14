/**
 * Biological State Classifier & Prescriptive Action Engine
 * Synthesizes personal Z-scores, autonomic curve classification, sleep debt, and training strain
 * into one of five daily physiological regimes, each paired with 3 concrete actionable steps.
 */

import { HammockCurveType } from "./autonomic-recovery";

export type BiologicalState =
  | "supercompensation"
  | "pure_sleep_debt"
  | "metabolic_carryover"
  | "autonomic_strain"
  | "aligned_baseline";

export interface RecoveryActionItem {
  id: string;
  category: "training" | "sleep" | "nutrition" | "light" | "hydration";
  action: string;
  targetTime?: string;
  importance: "critical" | "recommended" | "optional";
}

export interface BiologicalStateVerdict {
  state: BiologicalState;
  title: string;
  badgeLabel: string;
  badgeColor: string; // Tailwind color token
  accentBorder: string;
  readinessScore: number; // 0 - 100
  summary: string;
  recoveryChecklist: RecoveryActionItem[];
}

export interface StateInputs {
  hrvZScore: number; // personal SD
  hrvCv7d: number; // %
  rhrNadirPct: number; // % of sleep duration when nadir occurred
  hammockType: HammockCurveType;
  sleepDebtMinutes: number;
  priorDayStrain: number; // 0 - 21
  sri: number; // 0 - 100
  deepSleepPct: number; // %
}

/**
 * Classifies today's biological state and generates a 3-step action plan.
 */
export function classifyBiologicalState(inputs: StateInputs): BiologicalStateVerdict {
  const {
    hrvZScore,
    hrvCv7d,
    rhrNadirPct,
    hammockType,
    sleepDebtMinutes,
    priorDayStrain,
    sri,
    deepSleepPct,
  } = inputs;

  // 1. Check Autonomic Strain (Highest urgency)
  if (hammockType === "elevated_flat" || hrvZScore <= -1.5 || hrvCv7d > 16.0) {
    return {
      state: "autonomic_strain",
      title: "Autonomic Strain Detected",
      badgeLabel: "Autonomic Strain",
      badgeColor: "bg-rose-950/80 text-rose-300 border-rose-800/50",
      accentBorder: "border-rose-500/40",
      readinessScore: 42,
      summary:
        "Your autonomic nervous system is carrying elevated sympathetic tone or early immune fatigue. Nocturnal heart rate dip was compressed and HRV dropped below your personal 30-day baseline.",
      recoveryChecklist: [
        {
          id: "act_strain_1",
          category: "training",
          action: "De-load physical exertion today: replace intense workouts with an easy Zone 1 walk (8k–10k steps) and light mobility.",
          importance: "critical",
        },
        {
          id: "act_strain_2",
          category: "hydration",
          action: "Increase fluid and electrolyte intake by 500ml throughout the morning to accelerate cardiovascular volume recovery.",
          importance: "recommended",
        },
        {
          id: "act_strain_3",
          category: "sleep",
          action: "Shift tonight's wind-down 45 minutes earlier to grant extra parasympathetic recovery opportunity.",
          targetTime: "21:45",
          importance: "critical",
        },
      ],
    };
  }

  // 2. Check Metabolic Carryover (Late digestion / evening workout / light)
  if (hammockType === "late_nadir_delayed" || hammockType === "downward_slope" || (rhrNadirPct > 60 && hrvZScore < -0.4)) {
    return {
      state: "metabolic_carryover",
      title: "Metabolic Carryover",
      badgeLabel: "Metabolic Carryover",
      badgeColor: "bg-amber-950/80 text-amber-300 border-amber-800/50",
      accentBorder: "border-amber-500/40",
      readinessScore: 68,
      summary:
        "Late digestion, late intense exercise, or evening screen light kept cardiac workload elevated during early sleep. Parasympathetic recovery was delayed until the final hours.",
      recoveryChecklist: [
        {
          id: "act_met_1",
          category: "nutrition",
          action: "Finish your last heavy meal at least 3.5 hours before target bedtime to prevent nocturnal thermic digestion.",
          targetTime: "19:00",
          importance: "critical",
        },
        {
          id: "act_met_2",
          category: "training",
          action: "Schedule today's workout before 17:30 so core body temperature has ample time to drop before sleep onset.",
          targetTime: "17:30",
          importance: "recommended",
        },
        {
          id: "act_met_3",
          category: "light",
          action: "Get 20 minutes of natural outdoor sunlight within 60 minutes of waking to anchor the circadian phase.",
          importance: "recommended",
        },
      ],
    };
  }

  // 3. Check Supercompensation (High strain cleanly absorbed)
  if (priorDayStrain >= 12.0 && deepSleepPct >= 17 && rhrNadirPct <= 50 && hrvZScore >= 0.2) {
    return {
      state: "supercompensation",
      title: "Supercompensation Active",
      badgeLabel: "Supercompensation",
      badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-800/50",
      accentBorder: "border-emerald-500/40",
      readinessScore: 94,
      summary:
        "Your body absorbed yesterday's training strain cleanly and rebuilt cellular tissue. Autonomic vitals rebounded with an optimal hammock curve and strong positive HRV.",
      recoveryChecklist: [
        {
          id: "act_super_1",
          category: "training",
          action: "Green light for high-intensity intervals, heavy strength training, or long endurance volume today.",
          importance: "recommended",
        },
        {
          id: "act_super_2",
          category: "nutrition",
          action: "Replenish glycogen and maintain 1.6–2.0g/kg protein intake to sustain muscular adaptation.",
          importance: "recommended",
        },
        {
          id: "act_super_3",
          category: "sleep",
          action: "Maintain tonight's target bedtime within ±15 minutes to preserve this physiological peak.",
          targetTime: "22:30",
          importance: "optional",
        },
      ],
    };
  }

  // 4. Check Pure Sleep Debt (Physiologically healthy but underslept)
  if (sleepDebtMinutes > 60 && hrvZScore >= -0.5 && hammockType === "optimal_hammock") {
    return {
      state: "pure_sleep_debt",
      title: "Pure Sleep Debt",
      badgeLabel: "Pure Sleep Debt",
      badgeColor: "bg-indigo-950/80 text-indigo-300 border-indigo-800/50",
      accentBorder: "border-indigo-500/40",
      readinessScore: 72,
      summary:
        "No systemic physiological stress or illness detected—you are strictly running on an accumulated sleep deficit. Your autonomic tone is sound, but homeostatic pressure is high.",
      recoveryChecklist: [
        {
          id: "act_debt_1",
          category: "sleep",
          action: "Take a 20-minute Power Nap before 14:15 to clear adenosine without interfering with tonight's sleep onset.",
          targetTime: "14:15",
          importance: "recommended",
        },
        {
          id: "act_debt_2",
          category: "sleep",
          action: "Shift tonight's bedtime 35 minutes earlier to chip away at your accumulated deficit.",
          targetTime: "21:55",
          importance: "critical",
        },
        {
          id: "act_debt_3",
          category: "light",
          action: "Do not sleep in tomorrow by more than 30 minutes; anchor your wake time to avoid weekend social jetlag.",
          importance: "recommended",
        },
      ],
    };
  }

  // 5. Default: Aligned Baseline
  return {
    state: "aligned_baseline",
    title: "Aligned Circadian Baseline",
    badgeLabel: "Aligned Baseline",
    badgeColor: "bg-violet-950/80 text-violet-300 border-violet-800/50",
    accentBorder: "border-violet-500/40",
    readinessScore: 88,
    summary:
      "Your sleep architecture, autonomic recovery, and circadian rhythms are synchronized with your 30-day baseline. Recovery battery is primed for standard cognitive and physical demands.",
    recoveryChecklist: [
      {
        id: "act_base_1",
        category: "light",
        action: "Anchor circadian rhythm with 15 minutes of outdoor sunlight within 45 minutes of wake-up.",
        importance: "recommended",
      },
      {
        id: "act_base_2",
        category: "nutrition",
        action: "Observe the hard caffeine cutoff 10 hours before bed to protect tonight's slow-wave deep sleep.",
        targetTime: "12:30",
        importance: "recommended",
      },
      {
        id: "act_base_3",
        category: "sleep",
        action: "Maintain consistent wake and bedtime windows (±20m) to preserve your current Sleep Regularity Index.",
        importance: "optional",
      },
    ],
  };
}
