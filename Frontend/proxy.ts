

import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIES } from "./app/config/constants";
import { PRIVATE_PATH_PREFIXES, ROUTES } from "./app/config/routes";

function isPrivatePage(pathname: string) {
  // "/profile" and "/profile/edit" are private; "/profiles-info" would not be.
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;

  // Private page, but no login cookie at all -> go and sign in.
  // (We check the long-lived REFRESH cookie: the short access cookie
  // may have expired while the login is still valid.)
  const hasLogin = request.cookies.has(AUTH_COOKIES.REFRESH);

  if (isPrivatePage(url.pathname) && !hasLogin) {
    const signinUrl = url.clone();
    signinUrl.pathname = ROUTES.SIGNIN;
    signinUrl.search = "";
    signinUrl.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run for pages only. Skip API calls, Next.js's own files and images,
  // so CSS, JavaScript and pictures always load.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
