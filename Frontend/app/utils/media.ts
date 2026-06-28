const DEFAULT_MEDIA_PREFIX = "/api/backend/media/";

export function buildMediaUrl(mediaPrefix: string | undefined, path: string) {
  const rawPath = path.trim();

  if (!rawPath) return "";

  if (/^https?:\/\//i.test(rawPath)) {
    const url = new URL(rawPath);

    if (!url.pathname.startsWith("/media/")) {
      return rawPath;
    }

    return buildMediaUrl(mediaPrefix, url.pathname);
  }

  let mediaPath = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");

  while (mediaPath.startsWith("api/backend/media/")) {
    mediaPath = mediaPath.slice("api/backend/media/".length);
  }

  while (mediaPath.startsWith("media/")) {
    mediaPath = mediaPath.slice("media/".length);
  }

  const prefix = (mediaPrefix || DEFAULT_MEDIA_PREFIX).replace(/\/+$/, "");

  return `${prefix}/${mediaPath}`;
}
