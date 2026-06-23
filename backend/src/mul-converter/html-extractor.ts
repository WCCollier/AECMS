import type { PageData } from './mul-converter.types';

const COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6,8})\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%(?:\s*,\s*[\d.]+)?\s*\)/g;

function normalizeColor(raw: string): string {
  // Normalize hex to lowercase 6-char; leave rgb/hsl as-is for dedup
  const t = raw.trim().toLowerCase();
  if (t.startsWith('#')) {
    if (t.length === 4) {
      return '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
    }
    if (t.length === 5) {
      return '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3] + t[4] + t[4];
    }
    return t.slice(0, 7); // drop alpha channel
  }
  return t;
}

function extractColors(html: string): string[] {
  const freq = new Map<string, number>();

  // Extract from <style> blocks
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const [, css] of styleBlocks) {
    for (const m of css.matchAll(COLOR_RE)) {
      const c = normalizeColor(m[0]);
      freq.set(c, (freq.get(c) ?? 0) + 1);
    }
  }

  // Extract from inline style="" attributes
  const inlineStyles = [...html.matchAll(/style="([^"]+)"/gi)];
  for (const [, style] of inlineStyles) {
    for (const m of style.matchAll(COLOR_RE)) {
      const c = normalizeColor(m[0]);
      freq.set(c, (freq.get(c) ?? 0) + 1);
    }
  }

  // Filter out pure-white, pure-black, and fully transparent
  const SKIP = new Set(['#ffffff', '#fff', '#000000', '#000', '#000000ff', '#ffffffff']);

  return [...freq.entries()]
    .filter(([c]) => !SKIP.has(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([c]) => c);
}

function extractDomStructure(html: string): string {
  // Lightweight structural summary: tag + class tokens for top DOM levels
  // Does NOT include content text or all attributes — just structural shape
  const tagRe = /<(\w+)(?:[^>]*class="([^"]*)")?[^>]*>/gi;
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link', 'head', 'br', 'hr', 'img', 'input', 'source', 'track']);

  const entries: string[] = [];
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = tagRe.exec(html)) !== null && count < 150) {
    const tag = match[1].toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;

    // Take first 3 class tokens to avoid noise
    const classes = (match[2] ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');

    entries.push(classes ? `<${tag} class="${classes}">` : `<${tag}>`);
    count++;
  }

  return entries.join('\n');
}

function extractMeta(html: string): { title: string; description: string; ogImage?: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    ?? html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    ?? html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  const ogImage = ogImageMatch ? ogImageMatch[1].trim() : undefined;

  return { title, description, ogImage };
}

function extractImageUrls(html: string, ogImage?: string): string[] {
  const urls: string[] = [];

  if (ogImage) urls.push(ogImage);

  // Hero/banner images: look for img tags in elements with hero/banner/feature class names
  const heroImgRe = /class="[^"]*(?:hero|banner|feature|header|cover)[^"]*"[^>]*>[\s\S]{0,500}<img[^>]+src="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = heroImgRe.exec(html)) !== null && urls.length < 5) {
    const src = m[1];
    if (src.startsWith('http') && !urls.includes(src)) urls.push(src);
  }

  // Prominent img tags (large or with specific class tokens)
  const imgRe = /<img[^>]+src="([^"]+)"[^>]*(?:class="([^"]*)")?/gi;
  while ((m = imgRe.exec(html)) !== null && urls.length < 8) {
    const src = m[1];
    const cls = m[2] ?? '';
    if (
      src.startsWith('http') &&
      !urls.includes(src) &&
      !src.includes('icon') &&
      !src.includes('logo') &&
      (cls.includes('hero') || cls.includes('banner') || cls.includes('feature') || cls.includes('bg'))
    ) {
      urls.push(src);
    }
  }

  return urls.slice(0, 8);
}

export function extractPageData(url: string, html: string): PageData {
  const colors = extractColors(html);
  const domStructure = extractDomStructure(html);
  const { title, description, ogImage } = extractMeta(html);
  const imageUrls = extractImageUrls(html, ogImage);

  return { url, title, description, colors, domStructure, imageUrls, ogImage };
}
