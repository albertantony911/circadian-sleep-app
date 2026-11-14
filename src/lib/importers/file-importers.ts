import { RawSleepRecord } from "../analytics/deduplication";

export interface ImportResult {
  records: RawSleepRecord[];
  skippedCount: number;
  format: "sleep_as_android_csv" | "health_connect_json" | "unknown";
  error?: string;
}

/**
 * Parses Sleep as Android CSV format:
 * Id,Tz,From,To,Sched,Hours,Rating,Comment,Framerate,Snore,Noise,Cycles,Deep,Geo
 * 1731542400000,GMT+01:00,14. 11. 2026 23:15,15. 11. 2026 7:15,14. 11. 2026 23:00,8.0,4.0,"",...
 */
export function parseSleepAsAndroidCSV(csvContent: string): RawSleepRecord[] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const records: RawSleepRecord[] = [];

  // Find header index
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].includes("From") && lines[i].includes("To")) {
      headerIndex = i;
      headers = lines[i].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      break;
    }
  }

  if (headerIndex === -1) {
    return [];
  }

  const fromIdx = headers.findIndex((h) => h.toLowerCase() === "from");
  const toIdx = headers.findIndex((h) => h.toLowerCase() === "to");
  const hoursIdx = headers.findIndex((h) => h.toLowerCase() === "hours");
  const deepIdx = headers.findIndex((h) => h.toLowerCase() === "deep");
  const idIdx = headers.findIndex((h) => h.toLowerCase() === "id");

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (row.length <= Math.max(fromIdx, toIdx)) continue;

    const fromStr = row[fromIdx];
    const toStr = row[toIdx];
    if (!fromStr || !toStr) continue;

    // Handle Sleep as Android date format: "DD. MM. YYYY HH:mm" or ISO
    const startDate = parseCustomDate(fromStr);
    const endDate = parseCustomDate(toStr);

    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      continue;
    }

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    if (durationMinutes <= 30) continue;

    const deepRatio = deepIdx !== -1 && row[deepIdx] ? parseFloat(row[deepIdx]) : 0.2;
    const deepMinutes = Math.round(durationMinutes * Math.min(0.5, Math.max(0.05, isNaN(deepRatio) ? 0.2 : deepRatio)));
    const remMinutes = Math.round(durationMinutes * 0.22);
    const awakeMinutes = Math.round(durationMinutes * 0.08);
    const lightMinutes = Math.max(0, durationMinutes - deepMinutes - remMinutes - awakeMinutes);

    records.push({
      externalId: idIdx !== -1 && row[idIdx] ? `saa_${row[idIdx]}` : `saa_${startDate.getTime()}`,
      sourceApp: "sleep_as_android_csv",
      startTime: startDate,
      endTime: endDate,
      durationMinutes,
      timeInBedMinutes: durationMinutes + awakeMinutes,
      sleepEfficiencyPct: Math.round((durationMinutes / (durationMinutes + awakeMinutes)) * 100),
      deepMinutes,
      lightMinutes,
      remMinutes,
      awakeMinutes,
      sleepScore: Math.round(80 + (deepMinutes / durationMinutes) * 40),
    });
  }

  return records;
}

/**
 * Parses Google Takeout / Health Connect JSON exports.
 */
export function parseHealthConnectJSON(jsonContent: string): RawSleepRecord[] {
  try {
    const data = JSON.parse(jsonContent);
    const records: RawSleepRecord[] = [];
    const items = Array.isArray(data) ? data : data.records || data.sleepSessions || [data];

    for (const item of items) {
      const startTime = new Date(item.startTime || item.start_time || item.start);
      const endTime = new Date(item.endTime || item.end_time || item.end);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      if (durationMinutes <= 30) continue;

      records.push({
        externalId: item.id || item.externalId || `gh_${startTime.getTime()}`,
        sourceApp: "health_connect_json",
        startTime,
        endTime,
        durationMinutes,
        timeInBedMinutes: item.timeInBedMinutes || durationMinutes,
        sleepEfficiencyPct: item.sleepEfficiencyPct || 85,
        deepMinutes: item.deepMinutes || Math.round(durationMinutes * 0.2),
        lightMinutes: item.lightMinutes || Math.round(durationMinutes * 0.5),
        remMinutes: item.remMinutes || Math.round(durationMinutes * 0.22),
        awakeMinutes: item.awakeMinutes || Math.round(durationMinutes * 0.08),
        sleepScore: item.sleepScore || 85,
      });
    }

    return records;
  } catch {
    return [];
  }
}

function parseCustomDate(str: string): Date | null {
  // Try standard ISO first
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;

  // Pattern: "DD. MM. YYYY HH:mm"
  const match = str.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hours, minutes] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
  }

  return null;
}
