import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/transcriptions": [
      "./docs/**/*",
      "./drizzle/**/*",
      "./scripts/**/*",
      "./src/**/*",
      "./supabase/**/*",
      "./*.md",
      "./*.ts",
      "./*.mjs",
      "./tsconfig.tsbuildinfo",
    ],
  },
};

export default nextConfig;
