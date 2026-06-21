import { Header, Footer } from '@/components/layout';

async function getSiteTitle(): Promise<string> {
  try {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    const res = await fetch(`${backendUrl}/settings-public/general`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      return data.site_title ?? 'My Site';
    }
  } catch { /* fall through */ }
  return 'My Site';
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteTitle = await getSiteTitle();
  return (
    <div className="flex flex-col min-h-screen">
      <Header siteTitle={siteTitle} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
