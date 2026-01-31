import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static export for error pages to avoid _global-error prerendering bug
  experimental: {
    // Use turbopack for development
  },
  // Skip generating static pages for certain routes
  output: 'standalone',
};

export default nextConfig;
