import type { NextConfig } from "next";

/**
 * When BACKEND_ORIGIN is set, every /api/* call is proxied to the backend
 * service (backend/, port 3001 locally). The browser still talks only to this
 * origin, so the Supabase session cookie stays first-party and no CORS or
 * credentials: "include" is needed.
 *
 * When it is not set, the frontend's own /api routes answer, which keeps the
 * seeded demo working with no backend running.
 */
const backendOrigin = process.env.BACKEND_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!backendOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
