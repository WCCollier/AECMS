import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { getPaletteById, getFontPairingById, buildCssOverrides } from '@/lib/themes';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const { siteTitle, faviconUrl } = await getSiteTheme();
  const iconEntry = faviconUrl
    ? { url: faviconUrl, type: mimeFromUrl(faviconUrl) }
    : { url: '/favicon.ico', type: 'image/x-icon' };
  return {
    title: {
      default: siteTitle,
      template: `%s | ${siteTitle}`,
    },
    description: 'Advanced Ecommerce Content Management System',
    icons: { icon: iconEntry },
  };
}

function mimeFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  const map: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon' };
  return map[ext ?? ''] ?? 'image/png';
}

async function getSiteTheme(): Promise<{ paletteId: string; fontPairingId: string; siteTitle: string; faviconUrl: string | null }> {
  try {
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:4000';
    const [themeRes, titleRes, identityRes] = await Promise.allSettled([
      fetch(`${backendUrl}/settings-public/theme`, { next: { revalidate: 300 } }),
      fetch(`${backendUrl}/settings-public/general`, { next: { revalidate: 300 } }),
      fetch(`${backendUrl}/settings-public/identity`, { next: { revalidate: 300 } }),
    ]);
    let paletteId = 'midnight';
    let fontPairingId = 'default';
    let siteTitle = 'AECMS';
    let faviconUrl: string | null = null;

    if (themeRes.status === 'fulfilled' && themeRes.value.ok) {
      const theme = await themeRes.value.json();
      paletteId = theme.palette ?? 'midnight';
      fontPairingId = theme.fontPairing ?? 'default';
    }
    if (titleRes.status === 'fulfilled' && titleRes.value.ok) {
      const general = await titleRes.value.json();
      siteTitle = general.site_title ?? 'AECMS';
    }
    if (identityRes.status === 'fulfilled' && identityRes.value.ok) {
      const identity = await identityRes.value.json();
      faviconUrl = identity.favicon_url ?? null;
    }
    return { paletteId, fontPairingId, siteTitle, faviconUrl };
  } catch {
    return { paletteId: 'midnight', fontPairingId: 'default', siteTitle: 'AECMS', faviconUrl: null };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { paletteId, fontPairingId, siteTitle } = await getSiteTheme();
  const palette = getPaletteById(paletteId);
  const fontPairing = getFontPairingById(fontPairingId);
  const cssOverrides = buildCssOverrides(palette, fontPairing);

  return (
    <html lang="en">
      <head>
        {/* Google Fonts */}
        {fontPairing.id !== 'default' && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href={fontPairing.googleFontsUrl} rel="stylesheet" />
          </>
        )}
        {/* Runtime theme override */}
        <style dangerouslySetInnerHTML={{ __html: cssOverrides }} />
        {/* RSS feed auto-discovery */}
        <link rel="alternate" type="application/rss+xml" title={`${siteTitle} — RSS Feed`} href="/feed.xml" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
