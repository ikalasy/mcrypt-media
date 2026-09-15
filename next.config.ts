import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Baseline CSP. Next.js needs inline scripts/styles; hls.js needs blob: media
 * sources; TMDB posters come from image.tmdb.org. Dev is left alone because
 * Turbopack's HMR uses eval and websockets.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const productionHeaders = isProduction
  ? [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
    ]
  : [];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  // Hides the floating "N" dev-tools badge; it never ships in production anyway.
  devIndicators: false,
  experimental: {
    // Keep visited pages in the client cache briefly so Back is instant instead of a full re-render.
    staleTimes: { dynamic: 60, static: 300 },
  },
  // Artwork is proxied from Jellyfin, so the Next image optimizer is not used.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...productionHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
