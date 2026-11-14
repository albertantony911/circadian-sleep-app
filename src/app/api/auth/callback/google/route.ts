import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oauthConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncGoogleHealthSessions } from "@/lib/sync/google-health";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/settings/sources?error=${encodeURIComponent(error || "no_code")}`, req.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings/sources?error=missing_credentials", req.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange token");
    }

    const db = await getDb();
    const userId = "usr_nadir_primary";
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    // Check if connection already exists
    const existing = await db
      .select()
      .from(oauthConnections)
      .where(eq(oauthConnections.provider, "google_health"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(oauthConnections)
        .set({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || existing[0].refreshToken,
          expiresAt,
          scope: tokenData.scope,
          syncStatus: "idle",
          lastErrorMessage: null,
        })
        .where(eq(oauthConnections.id, existing[0].id));
    } else {
      await db.insert(oauthConnections).values({
        id: `oauth_gh_${Date.now()}`,
        userId,
        provider: "google_health",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        scope: tokenData.scope,
        syncStatus: "idle",
      });
    }

    // Trigger initial delta sync in background
    syncGoogleHealthSessions(userId).catch(console.error);

    return NextResponse.redirect(new URL("/settings/sources?connected=google_health", req.url));
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(`/settings/sources?error=${encodeURIComponent(err.message)}`, req.url)
    );
  }
}
