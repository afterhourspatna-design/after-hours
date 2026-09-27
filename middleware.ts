import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/setup", "/forgot-password"];
const FORCE_PASSWORD_CHANGE_PATH = "/force-password-change";

const ROLE_PATHS: Record<string, string[]> = {
  ADMIN: ["/admin", "/staff", "/customer"],
  STAFF: ["/staff"],
  CUSTOMER: ["/customer"],
};

const ROLE_HOME: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  STAFF: "/staff/dashboard",
  CUSTOMER: "/customer/bookings",
};

export default auth(async (req: NextRequest & { auth: any }) => {
  const { nextUrl, auth: session } = req as any;
  const pathname = nextUrl.pathname;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!session) {
    if (isPublic) return NextResponse.next();
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user?.role as string;
  const mustChangePassword = !!session.user?.mustChangePassword;

  // Authenticated user hitting /login or /signup → redirect to their dashboard
  // BUT: if there's an error param, let them stay on /login (likely breaking a loop)
  if (isPublic) {
    if (pathname.startsWith("/setup")) return NextResponse.next();
    if (nextUrl.searchParams.has("error")) return NextResponse.next();
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/login", nextUrl.origin));
  }

  // Forced password-change gate: an authenticated user with a temp/reset
  // password can't reach anything else until they set their own.
  if (mustChangePassword) {
    if (pathname.startsWith(FORCE_PASSWORD_CHANGE_PATH)) return NextResponse.next();
    return NextResponse.redirect(new URL(FORCE_PASSWORD_CHANGE_PATH, nextUrl.origin));
  }
  if (pathname.startsWith(FORCE_PASSWORD_CHANGE_PATH)) {
    // Nothing pending — send them to their dashboard instead of the change screen.
    return NextResponse.redirect(new URL(ROLE_HOME[role] ?? "/login", nextUrl.origin));
  }

  // Root redirect
  if (pathname === "/") {
    const target = ROLE_HOME[role] || "/login";
    return NextResponse.redirect(new URL(target, nextUrl.origin));
  }

  // Role gate: check if user can access path
  const allowedPrefixes = ROLE_PATHS[role] ?? [];
  const canAccess = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!canAccess) {
    const url = new URL("/login", nextUrl.origin);
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  // Feature-flag gate for /customer routes
  if (pathname.startsWith("/customer")) {
    const featureOn = process.env.NEXT_PUBLIC_FEATURE_CUSTOMER_PORTAL === "true";
    if (!featureOn && role !== "ADMIN") {
      const url = new URL("/login", nextUrl.origin);
      url.searchParams.set("error", "portal_disabled");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
