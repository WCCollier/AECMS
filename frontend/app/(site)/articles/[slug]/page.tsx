import type { Metadata } from 'next';
import { ArticlePageClient } from './ArticlePageClient';
import { JsonLd } from '@/components/JsonLd';
import { getSeoSettings, buildArticleMetadata } from '@/lib/seoMeta';
import { buildArticleSchema, buildBreadcrumbSchema } from '@/lib/jsonld';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getArticle(slug: string) {
  try {
    const res = await fetch(`${BACKEND}/articles/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [article, seo] = await Promise.all([getArticle(slug), getSeoSettings()]);
  if (!article) return { title: 'Article Not Found' };
  return buildArticleMetadata(article, seo, slug);
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, seo] = await Promise.all([getArticle(slug), getSeoSettings()]);

  return (
    <>
      {article && (
        <>
          <JsonLd data={buildArticleSchema(article, seo)} />
          <JsonLd data={buildBreadcrumbSchema([
            { name: seo.site_name || 'Home', url: BASE_URL },
            { name: 'Articles', url: `${BASE_URL}/articles` },
            { name: article.title },
          ])} />
        </>
      )}
      <ArticlePageClient />
    </>
  );
}
