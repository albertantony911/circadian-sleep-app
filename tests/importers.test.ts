import { describe, it, expect } from "vitest";
import { parseSleepAsAndroidCSV, parseHealthConnectJSON } from "../src/lib/importers/file-importers";

describe("Backup Importers", () => {
  it("parses Sleep as Android CSV records with localized European dates", () => {
    const sampleCSV = `Id,Tz,From,To,Sched,Hours,Rating,Comment,Framerate,Snore,Noise,Cycles,Deep,Geo
"1731542400000","GMT+01:00","14. 11. 2026 23:15","15. 11. 2026 07:15","14. 11. 2026 23:00","8.0","4.0","","10","0","0.1","5","0.22",""
"1731628800000","GMT+01:00","15. 11. 2026 23:30","16. 11. 2026 07:30","15. 11. 2026 23:00","8.0","4.5","","10","0","0.1","5","0.25",""`;

    const records = parseSleepAsAndroidCSV(sampleCSV);
    expect(records).toHaveLength(2);
    expect(records[0].sourceApp).toBe("sleep_as_android_csv");
    expect(records[0].durationMinutes).toBe(480);
    expect(records[0].deepMinutes).toBeGreaterThan(60);
  });

  it("parses Health Connect JSON export array", () => {
    const sampleJSON = JSON.stringify([
      {
        id: "hc_record_01",
        startTime: "2026-11-14T23:00:00Z",
        endTime: "2026-11-15T07:00:00Z",
        sleepEfficiencyPct: 92,
        deepMinutes: 95,
        remMinutes: 110,
        lightMinutes: 240,
        awakeMinutes: 35,
      },
    ]);

    const records = parseHealthConnectJSON(sampleJSON);
    expect(records).toHaveLength(1);
    expect(records[0].durationMinutes).toBe(480);
    expect(records[0].sleepEfficiencyPct).toBe(92);
  });
});
