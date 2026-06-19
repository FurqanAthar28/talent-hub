import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrl } from '../backend-url';

const API_BASE_URL = getBackendBaseUrl();

// Browser -> Next.js -> Django signin.
// Keeping signin behind this same-origin route makes cookies simpler and avoids
// host mismatches in development and production.
export async function POST(request: NextRequest) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { message: 'API base URL is missing' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const upstream = await fetch(`${API_BASE_URL}/api/accounts/signin/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await upstream.json();
  const response = NextResponse.json(data, { status: upstream.status });

  const setCookie = upstream.headers.getSetCookie();
  for (const cookie of setCookie) {
    response.headers.append('Set-Cookie', cookie);
  }

  return response;
}

