/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      // Allow any HTTPS hostname — covers GCS, S3, CDN, and any future storage provider.
      // Wildcard is appropriate for a single-owner CMS where the admin controls all content.
      { protocol: 'https', hostname: '**' },
    ],
  },

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

  experimental: {
    // Next.js rewrite proxy default is 30s. Mul Converter can run text analysis
    // (~10min max) + image generation (~8min per image × N sections) in one request.
    // Match the Cloud Run service timeout ceiling so the proxy never cuts the
    // connection before the backend finishes.
    proxyTimeout: 3_600_000,
  },
};

export default nextConfig;
