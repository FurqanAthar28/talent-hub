import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrl } from '../../backend-url';

const API_BASE_URL = getBackendBaseUrl();

// All protected frontend requests pass through this proxy.
// Example: /api/backend/profiles/me -> Django /api/profiles/me/
// The browser only talks to Next.js, while Django still validates JWT cookies.
type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { message: 'API base URL is missing' },
      { status: 500 }
    );
  }

  const { path } = await context.params;
  const isMediaRequest = path[0] === 'media';
  const upstreamPath = isMediaRequest
    ? path.join('/')
    : `api/${path.join('/')}/`;
  const upstreamUrl = new URL(`${API_BASE_URL}/${upstreamPath}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const cookie = request.headers.get('cookie');

  if (contentType) headers.set('content-type', contentType);
  if (cookie) headers.set('cookie', cookie);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  const content = await upstream.arrayBuffer();
  const response = new NextResponse(content, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ||
        (isMediaRequest ? 'application/octet-stream' : 'application/json'),
    },
  });

  for (const cookieHeader of upstream.headers.getSetCookie()) {
    response.headers.append('Set-Cookie', cookieHeader);
  }

  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
