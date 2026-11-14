import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateScheduleSchema = z.object({
  targetSleepMinutes: z.number().min(240).max(720).optional(),
  chronotype: z.enum(["early_bird", "intermediate", "night_owl"]).optional(),
  preferredBedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  preferredWakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function GET() {
  const db = await getDb();
  const userList = await db.select().from(users).limit(1);

  if (userList.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = userList[0];
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    targetSleepMinutes: user.targetSleepMinutes,
    chronotype: user.chronotype,
    preferredBedTime: user.preferredBedTime,
    preferredWakeTime: user.preferredWakeTime,
    ingestApiKey: user.ingestApiKey,
  });
}

export async function PUT(req: NextRequest) {
  const db = await getDb();
  const userList = await db.select().from(users).limit(1);

  if (userList.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const user = userList[0];
  const body = await req.json();
  const parsed = updateScheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schedule input", details: parsed.error.format() }, { status: 400 });
  }

  await db
    .update(users)
    .set({
      ...parsed.data,
    })
    .where(eq(users.id, user.id));

  return NextResponse.json({ success: true, updated: parsed.data });
}
