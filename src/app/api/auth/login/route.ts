import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  APP_AUTH_COOKIE_NAME,
  appAuthPassword,
  appAuthSessionToken,
  isAppAuthEnabled,
  safeRedirectPath,
} from "@/lib/app-auth";

function safeCompare(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password");
  const nextPath = safeRedirectPath(formData.get("next"));

  if (!isAppAuthEnabled()) {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (
    typeof password !== "string" ||
    !safeCompare(password, appAuthPassword())
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);

    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set(APP_AUTH_COOKIE_NAME, await appAuthSessionToken(), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
