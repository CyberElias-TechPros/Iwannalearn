import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // The preview proxy serves the app from an e2b.app host; allow dev requests from it.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai", "localhost", "127.0.0.1"],
  poweredByHeader: false,
};

export default nextConfig;
