import type { Metadata } from 'next';
import { ProductPageClient } from './ProductPageClient';
import { JsonLd } from '@/components/JsonLd';
import { getSeoSettings, buildProductMetadata } from '@/lib/seoMeta';
import { buildBookSchema, buildServiceSchema, buildProductSchema, buildBreadcrumbSchema } from '@/lib/jsonld';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getProduct(slug: string) {
  try {
    const res = await fetch(`${BACKEND}/products/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [product, seo] = await Promise.all([getProduct(slug), getSeoSettings()]);
  if (!product) return { title: 'Product Not Found' };
  return buildProductMetadata(product, seo, slug);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, seo] = await Promise.all([getProduct(slug), getSeoSettings()]);

  function buildSchema() {
    if (!product) return null;
    if (product.isbn || product.book_format) return buildBookSchema(product, seo);
    if (product.product_type === 'service') return buildServiceSchema(product, seo);
    return buildProductSchema(product, seo);
  }

  const schema = buildSchema();

  return (
    <>
      {schema && <JsonLd data={schema} />}
      {product && (
        <JsonLd data={buildBreadcrumbSchema([
          { name: seo.site_name || 'Home', url: BASE_URL },
          { name: 'Shop', url: `${BASE_URL}/shop` },
          { name: product.title },
        ])} />
      )}
      <ProductPageClient />
    </>
  );
}
