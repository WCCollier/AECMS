export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { PageRenderer } from '@/components/pages/PageRenderer';
import type { Page } from '@/types';

async function getHomepage(): Promise<Page | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${baseUrl}/pages/slug/_home_`, { cache: 'no-store' });
    if (!res.ok) return null;
    const page: Page = await res.json();
    if (page.status !== 'published' || page.visibility === 'admin_only') return null;
    return page;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const page = await getHomepage();

  if (page) {
    return (
      <div>
        <PageRenderer page={page} />
      </div>
    );
  }

  // Fallback: rendered when the _home_ page hasn't been seeded yet
  return (
    <>
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
        </div>
        <div className="relative container mx-auto max-w-4xl text-center">
          <p className="text-accent text-sm font-semibold tracking-widest uppercase mb-4">
            Fantasy v Reality
          </p>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Ideas worth{' '}
            <span className="text-accent">fighting</span>{' '}
            for
          </h1>
          <p className="text-lg text-foreground/60 mb-10 max-w-2xl mx-auto leading-relaxed">
            Philosophy, fiction, and firearms — written from principle, not from permission.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/articles">
              <Button size="lg">Read Latest</Button>
            </Link>
            <Link href="/shop">
              <Button variant="outline" size="lg">Browse Shop</Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mx-4" />

      <section className="py-20 px-4 bg-surface/40">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PillarCard
              label="Short Thoughts"
              title="Philosophy"
              description="Brief, direct takes on ideas that matter — rights, language, courage, government, and what it means to be a warrior."
              href="/articles"
              count="50+"
            />
            <PillarCard
              label="Book Reviews"
              title="Reading"
              description="Honest reviews of fiction and non-fiction — sci-fi, military, fantasy, and Christian literature."
              href="/articles"
              count="15+"
            />
            <PillarCard
              label="Shop"
              title="American Shooter"
              description="Curriculum for gun owners who want to think clearly about firearms, safety, and self-defense."
              href="/shop"
              count="3 courses"
            />
          </div>
        </div>
      </section>
    </>
  );
}

function PillarCard({
  label, title, description, href, count,
}: {
  label: string; title: string; description: string; href: string; count: string;
}) {
  return (
    <Link href={href} className="group block bg-surface border border-border hover:border-accent/40 rounded-xl p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-accent tracking-widest uppercase">{label}</span>
        <span className="text-xs text-muted">{count}</span>
      </div>
      <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">{title}</h3>
      <p className="text-foreground/60 text-sm leading-relaxed">{description}</p>
    </Link>
  );
}
