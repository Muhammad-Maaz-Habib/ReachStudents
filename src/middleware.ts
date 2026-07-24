import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import type { UserRole } from "@/generated/prisma/browser";

const publicRoutes = ["/login", "/forgot-password", "/onboarding"];
const staffRoutes = [
  "/dashboard",
  "/roster",
  "/mentor-groups",
  "/clubs",
  "/excursions",
  "/schedule",
  "/checkin",
  "/leave",
  "/messages",
  "/announcements",
  "/health",
  "/incidents",
  "/forms",
  "/staff",
  "/reports",
  "/settings",
  "/emergency",
  "/account",
];
const parentRoutes = ["/parent"];
const studentRoutes = ["/student"];

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

function isStudentRoute(pathname: string) {
  return studentRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function homeForRole(role: string | undefined) {
  if (role === "PARENT") return "/parent/dashboard";
  if (role === "STUDENT") return "/student/dashboard";
  return "/dashboard";
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
  const secureCookie =
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production";

  const token = await getToken({
    req: request,
    secret,
    secureCookie,
  });
  const isLoggedIn = !!token;

  if (pathname === "/") {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.redirect(
      new URL(homeForRole(token.role as string), request.url),
    );
  }

  if (isPublic(pathname)) {
    if (isLoggedIn) {
      return NextResponse.redirect(
        new URL(homeForRole(token.role as string), request.url),
      );
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as UserRole;

  if (token.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (!token.mustChangePassword && pathname === "/change-password") {
    return NextResponse.redirect(
      new URL(homeForRole(role), request.url),
    );
  }

  if (pathname === "/change-password") {
    return NextResponse.next();
  }

  if (isParentRoute(pathname) && role !== "PARENT") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  if (isStudentRoute(pathname) && role !== "STUDENT") {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  if (isStaffRoute(pathname) && (role === "PARENT" || role === "STUDENT")) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  if (role === "STUDENT" && !isStudentRoute(pathname)) {
    return NextResponse.redirect(new URL("/student/dashboard", request.url));
  }

  if (role === "PARENT" && !isParentRoute(pathname)) {
    return NextResponse.redirect(new URL("/parent/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
