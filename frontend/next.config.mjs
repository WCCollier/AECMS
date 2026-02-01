/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for production deployment
  output: 'standalone',

  // Skip type checking during build (faster builds, we use separate type check)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Skip ESLint during build (we use separate lint step)
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Experimental features for better error handling
  experimental: {
    // Force all pages to be dynamically rendered
    // This avoids static generation issues with providers
  },
};

export default nextConfig;
