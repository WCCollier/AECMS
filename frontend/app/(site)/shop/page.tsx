import type { Metadata } from 'next';
import { ShopPageClient } from './ShopPageClient';
import { getSeoSettings } from '@/lib/seoMeta';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  return {
    title: 'Shop',
    description: seo.site_description || `Books and services from ${seo.site_name}`,
    openGraph: {
      title: `Shop | ${seo.site_name}`,
      description: seo.site_description || `Books and services from ${seo.site_name}`,
      siteName: seo.site_name,
      type: 'website',
    },
  };
}

export default function ShopPage() {
  return <ShopPageClient />;
}
