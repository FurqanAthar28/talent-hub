const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy: where the browser may load things from.
 * Everything comes from our own site ('self'). That blocks most injected
 * <script> attacks: a script from another site simply won't run.
 *   'unsafe-inline' scripts/styles -> Next.js writes small inline scripts and styles
 *   'unsafe-eval' + ws:            -> only while developing (hot reload)
 *   data:/blob: images             -> small built-in images and file previews
 *   frame-ancestors 'none'         -> nobody may show our pages in a frame
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Next.js settings.
 *
 * (The old "experimental serverActions" setting was removed: this app
 * has no Server Actions. File uploads go through the API proxy.)
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Don't tell the world which framework we use ("X-Powered-By: Next.js").
  poweredByHeader: false,

  // Extra safety rules the browser follows on every page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Don't let other websites show our pages inside a frame
          // (stops "click-jacking" tricks).
          { key: "X-Frame-Options", value: "DENY" },
          // Use the file type we say, never guess (stops some upload tricks).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // When following a link to another site, only send our domain,
          // not the full address of the page the user was on.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // We never use the camera, microphone or location.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // "Always use https for this site" (for 1 year). Browsers ignore
          // it on http://localhost, so it never gets in the way while developing.
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
