import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}