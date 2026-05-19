import { NextResponse } from "next/server";
import { APP_AUTH_COOKIE_NAME } from "@/lib/app-auth";

function clearSession(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set(APP_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET(request: Request) {
  return clearSession(request);
}

export async function POST(request: Request) {
  return clearSession(request);
}
