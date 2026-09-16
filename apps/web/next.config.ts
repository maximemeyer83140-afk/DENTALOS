import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting runs separately via `pnpm lint`; don't duplicate it during `next build`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
