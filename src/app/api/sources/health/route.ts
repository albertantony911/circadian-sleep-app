import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users, oauthConnections, syncLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const db = await getDb();
  const userId = "usr_nadir_primary";

  const userList = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const connections = await db.select().from(oauthConnections).where(eq(oauthConnections.userId, userId));
  const logs = await db.select().from(syncLogs).where(eq(syncLogs.userId, userId)).orderBy(desc(syncLogs.createdAt)).limit(20);

  const user = userList[0];

  return NextResponse.json({
    ingestApiKey: user?.ingestApiKey,
    connections,
    logs,
  });
}

// Regenerate ingest API key
export async function POST(req: NextRequest) {
  const db = await getDb();
  const userId = "usr_nadir_primary";

  const newKey = `ak_live_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  await db.update(users).set({ ingestApiKey: newKey }).where(eq(users.id, userId));

  return NextResponse.json({ success: true, ingestApiKey: newKey });
}
