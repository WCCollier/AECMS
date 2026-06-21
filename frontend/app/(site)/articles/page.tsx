import type { Metadata } from 'next';
import { LatestPageClient } from './LatestPageClient';
import { getSeoSettings } from '@/lib/seoMeta';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  return {
    title: 'Articles',
    description: seo.site_description || `Articles from ${seo.site_name}`,
    openGraph: {
      title: `Articles | ${seo.site_name}`,
      description: seo.site_description || `Articles from ${seo.site_name}`,
      siteName: seo.site_name,
      type: 'website',
    },
  };
}

export default function LatestPage() {
  return <LatestPageClient />;
}
