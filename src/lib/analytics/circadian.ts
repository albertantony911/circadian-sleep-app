export interface CircadianAnalysis {
  workdayMidpoint: string; // e.g. "03:15"
  freeDayMidpoint: string; // e.g. "04:30"
  socialJetlagMinutes: number;
  socialJetlagHours: number;
  socialJetlagSeverity: "minimal" | "mild" | "moderate" | "severe";
  melatoninWindowStart: string; // e.g. "21:00"
  melatoninWindowEnd: string; // e.g. "22:30"
  optimalWakeWindowStart: string; // e.g. "06:30"
  optimalWakeWindowEnd: string; // e.g. "07:00"
  circadianAlignmentScore: number; // 0 - 100
  chronotype: "early_bird" | "intermediate" | "night_owl";
}

/**
 * Converts a Date to fractional hours from midnight (0.00 to 23.99).
 */
export function timeToFractionalHours(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Formats fractional hours (0.0 to 24.0) into HH:MM string.
 */
export function fractionalHoursToTimeString(hours: number): string {
  let normalized = hours % 24;
  if (normalized < 0) normalized += 24;
  const h = Math.floor(normalized);
  const m = Math.floor((normalized - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calculates sleep midpoint accounting for overnight wrap-around.
 */
export function calculateSessionMidpoint(startTime: Date, endTime: Date): number {
  const startHours = timeToFractionalHours(startTime);
  let durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  if (durationHours < 0) durationHours += 24;

  let midpoint = startHours + durationHours / 2;
  if (midpoint >= 24) midpoint -= 24;
  return midpoint;
}

/**
 * Computes average midpoint across multiple sessions using circular mean.
 */
export function averageMidpoints(midpointsInHours: number[]): number {
  if (midpointsInHours.length === 0) return 3.5; // default 03:30

  let sinSum = 0;
  let cosSum = 0;

  for (const h of midpointsInHours) {
    const angle = (h / 24) * 2 * Math.PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }

  let meanAngle = Math.atan2(sinSum, cosSum);
  if (meanAngle < 0) meanAngle += 2 * Math.PI;

  return (meanAngle / (2 * Math.PI)) * 24;
}

export function analyzeCircadianRhythm(
  sessions: Array<{ startTime: Date | string; endTime: Date | string; isMainSleep?: boolean }>,
  targetBedTime: string = "22:30",
  targetWakeTime: string = "06:30",
  userChronotype: "early_bird" | "intermediate" | "night_owl" = "intermediate"
): CircadianAnalysis {
  const mainSessions = sessions.filter((s) => s.isMainSleep !== false);

  const workdayMidpoints: number[] = [];
  const freeDayMidpoints: number[] = [];

  mainSessions.forEach((s) => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const dayOfWeek = start.getDay(); // 0 is Sunday, 6 is Saturday

    const mid = calculateSessionMidpoint(start, end);
    // Friday night (5) and Saturday night (6) count towards free days
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      freeDayMidpoints.push(mid);
    } else {
      workdayMidpoints.push(mid);
    }
  });

  const avgWorkdayMid = workdayMidpoints.length > 0 ? averageMidpoints(workdayMidpoints) : 3.25; // 03:15
  const avgFreeDayMid = freeDayMidpoints.length > 0 ? averageMidpoints(freeDayMidpoints) : avgWorkdayMid + 0.75;

  // Social jetlag is the absolute difference between free day midpoint and workday midpoint
  let jetlagHours = Math.abs(avgFreeDayMid - avgWorkdayMid);
  if (jetlagHours > 12) jetlagHours = 24 - jetlagHours;
  const socialJetlagMinutes = Math.round(jetlagHours * 60);

  let socialJetlagSeverity: CircadianAnalysis["socialJetlagSeverity"] = "minimal";
  if (socialJetlagMinutes > 120) {
    socialJetlagSeverity = "severe";
  } else if (socialJetlagMinutes > 60) {
    socialJetlagSeverity = "moderate";
  } else if (socialJetlagMinutes > 30) {
    socialJetlagSeverity = "mild";
  }

  // Melatonin Dim Light Melatonin Onset (DLMO) window: ~2 hours prior to habitual bedtime
  const [bedH, bedM] = targetBedTime.split(":").map(Number);
  const targetBedHours = bedH + bedM / 60;
  const melatoninStart = targetBedHours - 2.0;
  const melatoninEnd = targetBedHours - 0.5;

  // Optimal Wake Window: aligns with scheduled wake time ± 15 mins for cycle completion
  const [wakeH, wakeM] = targetWakeTime.split(":").map(Number);
  const targetWakeHours = wakeH + wakeM / 60;
  const wakeStart = targetWakeHours - 0.25;
  const wakeEnd = targetWakeHours + 0.25;

  // Circadian alignment score: 100 base minus social jetlag penalties
  // 30 min jetlag = ~90 score, 60 min = ~75 score, 120 min = ~50 score
  const jetlagPenalty = Math.min(60, (socialJetlagMinutes / 120) * 50);
  const alignmentScore = Math.max(30, Math.round(100 - jetlagPenalty));

  return {
    workdayMidpoint: fractionalHoursToTimeString(avgWorkdayMid),
    freeDayMidpoint: fractionalHoursToTimeString(avgFreeDayMid),
    socialJetlagMinutes,
    socialJetlagHours: parseFloat(jetlagHours.toFixed(1)),
    socialJetlagSeverity,
    melatoninWindowStart: fractionalHoursToTimeString(melatoninStart),
    melatoninWindowEnd: fractionalHoursToTimeString(melatoninEnd),
    optimalWakeWindowStart: fractionalHoursToTimeString(wakeStart),
    optimalWakeWindowEnd: fractionalHoursToTimeString(wakeEnd),
    circadianAlignmentScore: alignmentScore,
    chronotype: userChronotype,
  };
}
