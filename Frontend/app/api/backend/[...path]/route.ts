/**
 * The "backend proxy".
 *
 * HOW IT WORKS
 *   Browser  ->  /api/backend/accounts/me   (this file, on the Next.js server)
 *            ->  {API_BASE_URL}/api/accounts/me/   (Django)
 *
 * Why use a proxy? The browser only ever talks to the frontend's own
 * address, so the login cookies belong to the frontend. That means no
 * CORS problems and no "third-party cookie" problems, even when the
 * frontend and backend live on completely different domains.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBackendBaseUrl } from "../../backend-url";

const API_BASE_URL = getBackendBaseUrl();

// Give up on Django after this long, so a stuck server can't leave pages
// "loading" forever. Can be changed with PROXY_TIMEOUT_MS in .env.local.
const DEFAULT_TIMEOUT_MS = 30_000;
const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

// Django's answer headers we pass back to the browser (everything else is dropped).
//   content-type        -> JSON, PDF, ...
//   content-disposition -> the file name for downloads ("ali-khan-cv.pdf")
//   cache-control       -> whether the answer may be stored
//   retry-after         -> "try again in N seconds" after too many tries (429)
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control", "retry-after"];

/**
 * Only plain address pieces like "profiles" or "42" may go to Django.
 * Without this check, "/api/backend/..%2F..%2Fadmin" became Django's /admin/
 * page: a way around "everything goes to /api/".
 */
function isSafeSegment(segment: string) {
  return segment !== "" && segment !== "." && segment !== ".." && !/[/\\]/.test(segment);
}

// The browser headers Django needs to see. We copy ONLY these.
//   content-type  -> what kind of body we send (JSON, a file upload, ...)
//   cookie        -> the login cookies and the CSRF cookie
//   x-csrftoken   -> the CSRF token the frontend copied from its cookie
//   origin        -> which website sent the request (Django's CSRF check
//                    REQUIRES this over https, or it rejects the request)
//   referer       -> backup for "origin" on older browsers
//   accept        -> what kind of answer the browser wants
const FORWARDED_REQUEST_HEADERS = [
  "content-type",
  "cookie",
  "x-csrftoken",
  "origin",
  "referer",
  "accept",
];

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { message: "API base URL is missing" },
      { status: 500 }
    );
  }

  // Step 1: work out the Django address. Everything lives under "api/".
  // (Files like CVs too: they come from /api/profiles/<id>/cv/.)
  const { path } = await context.params;
  if (!path.every(isSafeSegment)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const upstreamUrl = new URL(`${API_BASE_URL}/api/${path.map(encodeURIComponent).join("/")}/`);
  upstreamUrl.search = request.nextUrl.search; // keep "?page=2" etc.

  // Step 2: copy the headers Django needs.
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Step 3: send the request to Django.
  // GET and HEAD requests never have a body.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;

  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store", // API answers change all the time; never cache them
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      console.error(`Backend proxy: Django took longer than ${TIMEOUT_MS} ms`);
      return NextResponse.json(
        { message: "The server is taking too long. Please try again." },
        { status: 504 }
      );
    }
    console.error("Backend proxy request failed:", error);
    return NextResponse.json(
      { message: "Unable to connect to backend server" },
      { status: 502 }
    );
  }

  // Step 4: send Django's answer back to the browser.
  // A 204 ("No Content") answer must not have a body.
  const content =
    upstream.status === 204 ? null : await upstream.arrayBuffer();

  const response = new NextResponse(content, { status: upstream.status });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) response.headers.set(name, value);
  }
  if (!response.headers.has("content-type")) {
    response.headers.set("content-type", "application/json");
  }
  // Answers are private (your profile, your messages): never let a browser
  // or a shared cache keep a copy, unless Django said otherwise.
  if (!response.headers.has("cache-control")) {
    response.headers.set("cache-control", "private, no-store");
  }

  // Step 5: pass on any cookies Django set (login tokens, CSRF token).
  for (const cookieHeader of upstream.headers.getSetCookie()) {
    response.headers.append("Set-Cookie", cookieHeader);
  }

  return response;
}

// Next.js needs one exported function per HTTP method we allow.
export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
