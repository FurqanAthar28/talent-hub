import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrl } from '../backend-url';

const API_BASE_URL = getBackendBaseUrl();

export async function POST(request: NextRequest) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { message: 'API base URL is missing' },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const upstream = await fetch(`${API_BASE_URL}/api/accounts/signup/`, {
    method: 'POST',
    body: formData,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
