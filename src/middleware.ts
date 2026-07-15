import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole } from "@/generated/prisma/browser";

const publicRoutes = ["/login", "/forgot-password", "/onboarding"];
const staffRoutes = [
  "/dashboard",
  "/roster",
  "/schedule",
  "/checkin",
  "/messages",
  "/announcements",
  "/health",
  "/incidents",
  "/forms",
  "/staff",
  "/reports",
  "/settings",
  "/emergency",
];
const parentRoutes = ["/parent"];

/** Auth.js v5: AUTH_SECRET is canonical; NEXTAUTH_SECRET is the v4 alias. */
function authSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

function isPublic(pathname: string) {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isStaffRoute(pathname: string) {
  return staffRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isParentRoute(pathname: string) {
  return parentRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const secret = authSecret();
  // Auth.js sets `__Secure-authjs.session-token` on HTTPS; without secureCookie,
  // getToken looks for `authjs.session-token` and returns null on Vercel.
  const secureCookie =
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production";

  const sessionCookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter(
      (name) =>
        name.includes("authjs.session-token") ||
        name.includes("next-auth.session-token"),
    );

  const token = await getToken({
    req: request,
    secret,
    secureCookie,
  });
  const isLoggedIn = !!token;

  // TEMP: remove after diagnosing Vercel auth redirect loop
  console.log("[auth-middleware]", {
    pathname,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    hasAuthUrl: Boolean(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL),
    authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? null,
    trustHost: process.env.AUTH_TRUST_HOST ?? null,
    vercel: process.env.VERCEL ?? null,
    protocol: request.nextUrl.protocol,
    secureCookie,
    sessionCookieNames,
    tokenIsNull: token == null,
    tokenSub: token?.sub ?? null,
    tokenRole: token?.role ?? null,
  });

  if (pathname === "/") {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (token.role === "PARENT") {
      return NextResponse.redirect(new URL("/parent/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublic(pathname)) {
    if (isLoggedIn) {
      const dest =
        token.role === "PARENT" ? "/parent/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as UserRole;

  if (isParentRoute(pathname) && role !== "PARENT") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isStaffRoute(pathname) && role === "PARENT") {
    return NextResponse.redirect(new URL("/parent/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
