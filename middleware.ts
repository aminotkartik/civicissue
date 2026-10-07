/**
 * Edge middleware — first-line route protection (spec §58).
 * Verifies the session cookie for protected path prefixes and redirects
 * unauthenticated visitors to /login. Fine-grained, data-level authorization
 * is ALWAYS re-checked server-side in each route/component via lib/permissions.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/report",
  "/my-reports",
  "/notifications",
  "/profile",
  "/authority",
  "/worker",
  "/admin",
];

const ROLE_PREFIXES: Record<string, string[]> = {
  "/authority": ["AUTHORITY", "ADMIN"],
  "/worker": ["WORKER", "ADMIN"],
  "/admin": ["ADMIN"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  const allowedRoles = Object.entries(ROLE_PREFIXES).find(([p]) =>
    pathname.startsWith(p)
  )?.[1];
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/report/:path*",
    "/my-reports/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/authority/:path*",
    "/worker/:path*",
    "/admin/:path*",
  ],
};
