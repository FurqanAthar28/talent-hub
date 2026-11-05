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

  // Step 1: work out the Django address.
  // "media/..." files are served as-is. Everything else lives under "api/".
  const { path } = await context.params;
  const isMediaRequest = path[0] === "media";
  const upstreamPath = isMediaRequest
    ? path.join("/")
    : `api/${path.join("/")}/`;

  const upstreamUrl = new URL(`${API_BASE_URL}/${upstreamPath}`);
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
    });
  } catch (error) {
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

  const response = new NextResponse(content, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ||
        (isMediaRequest ? "application/octet-stream" : "application/json"),
    },
  });

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
