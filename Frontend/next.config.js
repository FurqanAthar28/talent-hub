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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
