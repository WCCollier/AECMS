import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/api-proxy', '/checkout', '/order-confirmation'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
