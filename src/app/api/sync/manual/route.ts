import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oauthConnections, syncLogs, sleepSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const COOLDOWN_SECONDS = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const db = await getDb();
  const userId = "usr_nadir_primary";

  try {
    const body = await req.json().catch(() => ({}));
    const provider = body.provider || "fitbit";

    const connections = await db
      .select()
      .from(oauthConnections)
      .where(eq(oauthConnections.provider, provider))
      .limit(1);

    if (connections.length === 0) {
      return NextResponse.json({ error: "No OAuth connection found" }, { status: 404 });
    }

    const conn = connections[0];
    const now = Date.now();

    // 1. Circuit breaker: Check if provider is currently rate-limited by upstream API
    if (conn.syncStatus === "rate_limited" && conn.rateLimitResetAt) {
      const resetTime = new Date(conn.rateLimitResetAt).getTime();
      if (now < resetTime) {
        const remainingSeconds = Math.ceil((resetTime - now) / 1000);
        return NextResponse.json(
          {
            error: "Upstream API Rate-Limited (HTTP 429). Circuit breaker active.",
            rateLimited: true,
            remainingSeconds,
            resetAt: conn.rateLimitResetAt,
          },
          { status: 429, headers: { "Retry-After": String(remainingSeconds) } }
        );
      }
    }

    // 2. Cooldown lock check: Prevent rapid spam clicking (min 60s cooldown)
    if (conn.lastSyncAt) {
      const elapsedSeconds = Math.floor((now - new Date(conn.lastSyncAt).getTime()) / 1000);
      if (elapsedSeconds < COOLDOWN_SECONDS && !body.force) {
        const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds;
        return NextResponse.json(
          {
            status: "cooldown",
            message: `Please wait ${remainingSeconds}s before initiating another manual sync.`,
            remainingSeconds,
          },
          { status: 429 }
        );
      }
    }

    // Handle test simulation of rate limit (for UI demo verification)
    if (body.simulateRateLimit) {
      const resetDate = new Date(now + 120000); // 2 minutes in future
      await db
        .update(oauthConnections)
        .set({
          syncStatus: "rate_limited",
          rateLimitResetAt: resetDate,
          lastErrorMessage: "Simulated HTTP 429 Rate Limit Exceeded",
        })
        .where(eq(oauthConnections.id, conn.id));

      await db.insert(syncLogs).values({
        id: `log_rl_${Date.now()}`,
        userId,
        source: `${provider}_manual`,
        recordsUpserted: 0,
        recordsDeleted: 0,
        statusCode: 429,
        durationMs: Date.now() - startTime,
        errorDetail: "HTTP 429: Too Many Requests. Rate limit reset in 120s",
      });

      return NextResponse.json(
        {
          error: "Rate limit triggered (simulated)",
          rateLimited: true,
          remainingSeconds: 120,
          resetAt: resetDate,
        },
        { status: 429, headers: { "Retry-After": "120" } }
      );
    }

    // 3. Mark connection as syncing, then execute delta sync
    await db
      .update(oauthConnections)
      .set({ syncStatus: "syncing" })
      .where(eq(oauthConnections.id, conn.id));

    // Simulate upstream delta sync latency
    await new Promise((res) => setTimeout(res, 400));

    // Complete sync successfully
    const syncTime = new Date();
    await db
      .update(oauthConnections)
      .set({
        syncStatus: "idle",
        lastSyncAt: syncTime,
        rateLimitResetAt: null,
        lastErrorMessage: null,
      })
      .where(eq(oauthConnections.id, conn.id));

    const durationMs = Date.now() - startTime;
    await db.insert(syncLogs).values({
      id: `log_man_${Date.now()}`,
      userId,
      source: `${provider}_manual`,
      recordsUpserted: 1,
      recordsDeleted: 0,
      statusCode: 200,
      durationMs,
      errorDetail: null,
    });

    return NextResponse.json({
      success: true,
      lastSyncAt: syncTime,
      recordsUpserted: 1,
      durationMs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
