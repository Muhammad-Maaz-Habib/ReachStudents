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

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  const isLoggedIn = !!token;

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
