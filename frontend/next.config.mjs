/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone output for production deployment
  output: 'standalone',

  async redirects() {
    return [
      { source: '/latest', destination: '/articles', permanent: true },
      { source: '/latest/:path*', destination: '/articles/:path*', permanent: true },
    ];
  },

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

  webpack(config, { isServer }) {
    if (!isServer) {
      const existing = config.optimization.splitChunks ?? {};
      config.optimization.splitChunks = {
        ...existing,
        maxSize: 512 * 1024,
        cacheGroups: {
          ...(existing.cacheGroups ?? {}),
          tiptap: {
            test: /[\\/]node_modules[\\/](@tiptap|@prosemirror|prosemirror-[-\w]+)[\\/]/,
            name: false,
            chunks: 'all',
            priority: 30,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
