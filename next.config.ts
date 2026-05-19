import type { NextConfig } from "next";

const serverRouteTraceExcludes = [
  "./docs/**/*",
  "./drizzle/**/*",
  "./scripts/**/*",
  "./src/**/*",
  "./supabase/**/*",
  "./*.md",
  "./*.ts",
  "./*.mjs",
  "./tsconfig.tsbuildinfo",
];

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/piece-assets/[assetId]/file": serverRouteTraceExcludes,
    "/api/piece-assets/upload": serverRouteTraceExcludes,
    "/api/transcriptions": serverRouteTraceExcludes,
  },
};

export default nextConfig;
