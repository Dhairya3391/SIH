import type { NextConfig } from "next";

/**
 * Every /api/* call is proxied to the backend service (backend/, port 3001
 * locally). The browser still talks only to this origin, so the Supabase
 * session cookie stays first-party and no CORS or credentials: "include"
 * is needed.
 *
 * BACKEND_ORIGIN is required: without it /api/* has nothing to answer.
 * Local: BACKEND_ORIGIN=http://localhost:3001
 * Vercel project `sih`: BACKEND_ORIGIN=https://jharsetu-demo-api.vercel.app
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
