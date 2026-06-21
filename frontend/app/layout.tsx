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

export const metadata: Metadata = {
  title: {
    default: 'AECMS',
    template: '%s | AECMS',
  },
  description: 'Advanced Ecommerce Content Management System',
  keywords: ['cms', 'ecommerce', 'content management'],
};

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
  const { paletteId, fontPairingId, siteTitle, faviconUrl } = await getSiteTheme();
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
        {/* Favicon from settings */}
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        {/* Site title from settings */}
        <title>{siteTitle}</title>
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
