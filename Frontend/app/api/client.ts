export async function apiFetch(path: string, options?: RequestInit) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`/api/backend${normalizedPath}`, {
    credentials: "include",
    ...options,
  });

  if (res.status === 401 || res.status === 403) {
    window.location.replace("/signin");
    throw new Error("Unauthorized");
  }

  return res;
}