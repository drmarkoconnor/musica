import { NextResponse, type NextRequest } from "next/server";
import {
  APP_AUTH_COOKIE_NAME,
  appAuthSessionToken,
  isAppAuthEnabled,
} from "@/lib/app-auth";

const publicPaths = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
]);

export async function middleware(request: NextRequest) {
  if (!isAppAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (publicPaths.has(pathname) || pathname.startsWith("/.netlify/functions/")) {
    return NextResponse.next();
  }

  const expectedToken = await appAuthSessionToken();
  const actualToken = request.cookies.get(APP_AUTH_COOKIE_NAME)?.value;

  if (actualToken && actualToken === expectedToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|txt|xml|webmanifest)).*)",
  ],
};
