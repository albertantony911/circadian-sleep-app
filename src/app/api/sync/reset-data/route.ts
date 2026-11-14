import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sleepSessions, sleepStages, syncLogs } from "@/lib/db/schema";
import { inArray, notInArray, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const body = await req.json().catch(() => ({}));
    const wipeAll = body.wipeAll === true;

    if (wipeAll) {
      // Complete wipe of all sessions and stages
      await db.delete(sleepStages);
      await db.delete(sleepSessions);
      await db.delete(syncLogs);
      return NextResponse.json({
        success: true,
        message: "All sleep sessions and sync logs have been cleared. Ready for fresh Health Connect sync.",
      });
    }

    // Default: Purge only simulated / mock seed records (e.g. fitbit_cloud or simulated rawPayload)
    const allSessions = await db.select().from(sleepSessions);
    const simulatedIds: string[] = [];

    for (const s of allSessions) {
      const isSimulated =
        s.id.startsWith("sess_") ||
        s.externalId?.startsWith("ext_sess_") ||
        s.sourceApp === "fitbit_cloud" ||
        s.sourceApp === "simulated_seed" ||
        (s.rawPayload && typeof s.rawPayload === "object" && (s.rawPayload as any).simulated === true);

      if (isSimulated) {
        simulatedIds.push(s.id);
      }
    }

    if (simulatedIds.length > 0) {
      await db.delete(sleepStages).where(inArray(sleepStages.sessionId, simulatedIds));
      await db.delete(sleepSessions).where(inArray(sleepSessions.id, simulatedIds));
    }

    return NextResponse.json({
      success: true,
      clearedCount: simulatedIds.length,
      message: `Cleared ${simulatedIds.length} simulated baseline sessions. Real Health Connect records preserved.`,
    });
  } catch (error: any) {
    console.error("Reset data error:", error);
    return NextResponse.json(
      { error: "Failed to reset sleep data", detail: error.message },
      { status: 500 }
    );
  }
}
