/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for production deployment
  output: 'standalone',

  // Proxy /api-proxy/* → backend on port 4000 (server-side, avoids browser CORS/port issues)
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        // Proxy backend-served static files (media library) through same origin
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },

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
