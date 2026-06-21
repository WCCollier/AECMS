/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  async redirects() {
    return [
      { source: '/latest', destination: '/articles', permanent: true },
      { source: '/latest/:path*', destination: '/articles/:path*', permanent: true },
    ];
  },

  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // Turbopack is the default bundler in Next.js 16 — empty config satisfies the requirement
  turbopack: {},
};

export default nextConfig;
