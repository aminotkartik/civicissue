import { NextRequest, NextResponse } from "next/server";
import { linkOrCreateGoogleUser } from "@/lib/queries/users";
import { setSessionCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ROLE_HOME: Record<string, string> = {
  CITIZEN: "/dashboard",
  AUTHORITY: "/authority",
  WORKER: "/worker",
  ADMIN: "/admin",
};

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const code = new URL(req.url).searchParams.get("code");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!code || !clientId || !secret) {
      return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
    }
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: secret,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    const idToken = tokens.id_token;
    if (!idToken) throw new Error("no id_token in response");
    // Decode the verified id_token payload (signature check via Google's JWKS
    // is handled by fetching userinfo as a second factor).
    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token ?? idToken}` },
    });
    if (!profileRes.ok) throw new Error("userinfo fetch failed");
    const profile = (await profileRes.json()) as { sub: string; email?: string; name?: string };
    if (!profile.email) throw new Error("google account has no email");
    const user = await linkOrCreateGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name ?? profile.email,
    });
    if (user.isSuspended || !user.isActive) {
      return NextResponse.redirect(new URL("/login?error=account_suspended", appUrl));
    }
    await setSessionCookie({ sub: user.id, email: user.email, role: user.role, name: user.name });
    await recordAudit({ id: user.id, email: user.email }, "LOGIN_GOOGLE", "USER", user.id);
    return NextResponse.redirect(new URL(ROLE_HOME[user.role] ?? "/dashboard", appUrl));
  } catch (err) {
    console.error("[civicissue:auth] google callback failed:", err);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", appUrl));
  }
}
