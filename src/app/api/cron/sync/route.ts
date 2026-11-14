import { NextRequest, NextResponse } from "next/server";
import { syncGoogleHealthSessions } from "@/lib/sync/google-health";

export async function GET(req: NextRequest) {
  // Optional security check for Vercel Cron header or CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Vercel Cron automatically includes header or runs natively
    // We allow Vercel's internal cron user-agent as well
    const userAgent = req.headers.get("user-agent") || "";
    if (!userAgent.includes("vercel-cron")) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }
  }

  try {
    const googleResult = await syncGoogleHealthSessions("usr_nadir_primary");

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      googleHealth: googleResult,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
