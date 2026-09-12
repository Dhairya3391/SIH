import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/sdk"],
  experimental: {
    // Compiler + embedding jobs can exceed the default body size on voice uploads.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
