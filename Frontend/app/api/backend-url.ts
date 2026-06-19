export function getBackendBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;

  return baseUrl ? baseUrl.replace(/\/+$/, "") : "";
}