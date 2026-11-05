/**
 * Where Django runs, from API_BASE_URL in .env.local (see .env.example).
 * Only the server-side API proxy uses this, never the browser.
 * The trailing "/" is removed, so "http://x:8000/" and "http://x:8000" both work.
 */
export function getBackendBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;

  return baseUrl ? baseUrl.replace(/\/+$/, "") : "";
}
