type ApiFetchOptions = {
  redirectOnUnauthorized?: boolean;
};

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

  if (redirectOnUnauthorized && (res.status === 401 || res.status === 403)) {
    window.location.replace("/signin");
  }

  return res;
}
