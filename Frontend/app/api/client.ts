type ApiFetchOptions = {
  redirectOnUnauthorized?: boolean;
};

export const unauthorizedEventName = "talenthub:unauthorized";

export async function apiFetch(
  path: string,
  options?: RequestInit,
  apiOptions: ApiFetchOptions = {}
) {
  const { redirectOnUnauthorized = true } = apiOptions;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`/api/backend${normalizedPath}`, {
    credentials: "include",
    ...options,
  });

  if (redirectOnUnauthorized && res.status === 401) {
    window.dispatchEvent(new Event(unauthorizedEventName));
  }

  return res;
}
