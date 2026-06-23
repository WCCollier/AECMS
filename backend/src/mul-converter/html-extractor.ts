import type { PageData, AnimationSignals } from './mul-converter.types';

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

function extractAnimationSignals(html: string): AnimationSignals {
  // Collect all CSS text (style blocks + inline styles)
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const inlineStyles = [...html.matchAll(/style="([^"]+)"/gi)].map(m => m[1]).join(';');
  const allCss = styleBlocks + '\n' + inlineStyles;

  // Collect all class names from HTML
  const classNames = [...html.matchAll(/class="([^"]+)"/gi)]
    .flatMap(m => m[1].split(/\s+/))
    .filter(Boolean);

  // Library fingerprints — check scripts and data attributes
  const scriptContent = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
  const fingerprints: string[] = [];
  if (/\baos\b/i.test(html) || /data-aos/i.test(html)) fingerprints.push('aos');
  if (/gsap|TweenLite|TweenMax/i.test(scriptContent + html)) fingerprints.push('gsap');
  if (/locomotive[- ]?scroll/i.test(scriptContent + html)) fingerprints.push('locomotive');
  if (/framer[- ]?motion/i.test(scriptContent + html)) fingerprints.push('framer-motion');
  if (/scrollreveal/i.test(scriptContent + html)) fingerprints.push('scrollreveal');
  if (/swiper/i.test(html)) fingerprints.push('swiper');

  // Motion class names — look for scroll/animation-related class tokens
  const MOTION_PATTERN = /parallax|fade|scroll[-_]reveal|scroll[-_]anim|animate|entrance|aos|reveal|in-view|motion/i;
  const motionClasses = [...new Set(classNames.filter(c => MOTION_PATTERN.test(c)))].slice(0, 20);

  // Overlay gradients — gradient strings from elements that look like overlays
  // Look for gradient values applied to ::before/::after or overlay/scrim class elements
  const gradientRe = /(?:linear|radial|conic)-gradient\([^;{}]+\)/gi;
  const allGradients = [...allCss.matchAll(gradientRe)].map(m => m[0]);
  // Filter to ones with rgba alpha (likely overlays, not decorative gradients)
  const overlayGradients = [...new Set(
    allGradients.filter(g => /rgba\s*\([^)]+,\s*0?\.?\d+\s*\)/.test(g))
  )].slice(0, 5);

  // z-index stacking — more than 2 high z-index rules → likely stacked layers
  const highZMatches = [...allCss.matchAll(/z-index\s*:\s*(\d+)/gi)].filter(m => parseInt(m[1]) > 10);

  return {
    hasFixedBackground:     /background-attachment\s*:\s*fixed/i.test(allCss),
    hasScrollTimeline:      /animation-timeline|scroll\(\)/i.test(allCss),
    hasKeyframes:           /@keyframes/i.test(styleBlocks),
    hasOpacityTransition:   /(?:transition|animation)[^;{]*opacity/i.test(allCss),
    hasTransformTransition: /(?:transition|animation)[^;{]*transform/i.test(allCss),
    hasStickyElements:      /position\s*:\s*sticky/i.test(allCss),
    hasHighZIndexStack:     highZMatches.length >= 2,
    libraryFingerprints:    fingerprints,
    overlayGradients,
    motionClassNames:       motionClasses,
  };
}

export function extractPageData(url: string, html: string): PageData {
  const colors = extractColors(html);
  const domStructure = extractDomStructure(html);
  const { title, description, ogImage } = extractMeta(html);
  const imageUrls = extractImageUrls(html, ogImage);
  const animationSignals = extractAnimationSignals(html);

  return { url, title, description, colors, domStructure, imageUrls, ogImage, animationSignals };
}
