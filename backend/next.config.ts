import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse drives pdf.js, which loads its worker and optional native canvas
  // at runtime; bundling them breaks that resolution.
  serverExternalPackages: ["@anthropic-ai/sdk", "pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  experimental: {
    // Compiler + embedding jobs can exceed the default body size on voice uploads.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
