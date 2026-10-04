/**
 * Converts an AECMS article body (TipTap/ProseMirror JSON, or legacy raw HTML)
 * into an HTML string suitable for Substack's draft_body field.
 *
 * AECMS's custom widget nodes (callout, videoEmbed, xEmbed, mediaCarousel,
 * articleEmbed, productEmbed, rssEmbed, searchResultsEmbed) have no Substack
 * equivalent — they're converted to the closest reasonable static fallback
 * (see NODE_HANDLERS below) rather than dropped silently, so a human reviewing
 * the draft can see where something was simplified and decide whether to
 * touch it up by hand before publishing.
 */

type PMNode = {
  type?: string;
  attrs?: Record<string, any>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, any> }[];
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

const MARK_TAGS: Record<string, (attrs: Record<string, any> | undefined, inner: string) => string> = {
  bold: (_a, inner) => `<strong>${inner}</strong>`,
  italic: (_a, inner) => `<em>${inner}</em>`,
  strike: (_a, inner) => `<s>${inner}</s>`,
  code: (_a, inner) => `<code>${inner}</code>`,
  link: (attrs, inner) => `<a href="${escapeAttr(attrs?.href ?? '')}">${inner}</a>`,
};

function renderText(node: PMNode): string {
  let inner = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    const wrap = MARK_TAGS[mark.type];
    if (wrap) inner = wrap(mark.attrs, inner);
  }
  return inner;
}

function renderInline(nodes: PMNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === 'text' ? renderText(n) : renderBlock(n))).join('');
}

function renderChildren(node: PMNode): string {
  return (node.content ?? []).map(renderBlock).join('\n');
}

/** Best-effort fallback for a widget/media item shape: { url, alt_text } */
function firstMediaItem(mediaJson: string | undefined): { url: string; alt_text?: string } | null {
  try {
    const arr = JSON.parse(mediaJson ?? '[]');
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const primary = arr.find((m: any) => m?.isPrimary) ?? arr[0];
    return primary?.url ? { url: primary.url, alt_text: primary.alt_text } : null;
  } catch {
    return null;
  }
}

const OMITTED_NOTICE = '<p><em>[Embedded content omitted from syndication — view the full article on the site]</em></p>';

const CALLOUT_PREFIX: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  success: '✅',
  error: '🚫',
};

const NODE_HANDLERS: Record<string, (node: PMNode) => string> = {
  paragraph: (n) => `<p>${renderInline(n.content)}</p>`,
  heading: (n) => {
    const level = Math.min(Math.max(n.attrs?.level ?? 1, 1), 6);
    return `<h${level}>${renderInline(n.content)}</h${level}>`;
  },
  bulletList: (n) => `<ul>${renderChildren(n)}</ul>`,
  orderedList: (n) => `<ol>${renderChildren(n)}</ol>`,
  listItem: (n) => `<li>${renderChildren(n)}</li>`,
  blockquote: (n) => `<blockquote>${renderChildren(n)}</blockquote>`,
  codeBlock: (n) => `<pre><code>${escapeHtml((n.content ?? []).map((t) => t.text ?? '').join(''))}</code></pre>`,
  horizontalRule: () => '<hr>',
  hardBreak: () => '<br>',
  image: (n) => `<img src="${escapeAttr(n.attrs?.src ?? '')}" alt="${escapeAttr(n.attrs?.alt ?? '')}">`,

  // Transparent container — just render its children in place.
  richTextBox: (n) => renderChildren(n),

  // Callout has real paragraph children (content: 'paragraph+') — keep them,
  // just mark the type with an emoji so the distinction isn't lost entirely.
  callout: (n) => {
    const prefix = CALLOUT_PREFIX[n.attrs?.type ?? 'info'] ?? 'ℹ️';
    return `<blockquote><p>${prefix} <strong>${escapeHtml((n.attrs?.summary || '').trim() || 'Note')}</strong></p>${renderChildren(n)}</blockquote>`;
  },

  videoEmbed: (n) => `<p>🎬 <a href="${escapeAttr(n.attrs?.url ?? '')}">Watch the video</a></p>`,
  xEmbed: (n) => `<p>🐦 <a href="${escapeAttr(n.attrs?.url ?? '')}">View the post</a></p>`,

  mediaCarousel: (n) => {
    const media = firstMediaItem(n.attrs?.media);
    if (!media) return '';
    let extra = '';
    try {
      const arr = JSON.parse(n.attrs?.media ?? '[]');
      if (Array.isArray(arr) && arr.length > 1) extra = `<p><em>(+${arr.length - 1} more image${arr.length - 1 === 1 ? '' : 's'} — view on site)</em></p>`;
    } catch { /* ignore */ }
    return `<img src="${escapeAttr(media.url)}" alt="${escapeAttr(media.alt_text ?? '')}">${extra}`;
  },

  // Dynamic/data-driven widgets with no static content worth syndicating.
  articleEmbed: () => OMITTED_NOTICE,
  productEmbed: () => OMITTED_NOTICE,
  rssEmbed: () => OMITTED_NOTICE,
  searchResultsEmbed: () => OMITTED_NOTICE,
};

function renderBlock(node: PMNode): string {
  if (!node?.type) return '';
  const handler = NODE_HANDLERS[node.type];
  if (handler) return handler(node);
  // Unknown node type: flatten any nested text rather than dropping it silently.
  if (node.content?.length) return renderChildren(node);
  return '';
}

/**
 * Converts an article's stored `content` field to an HTML string.
 * Handles both TipTap JSON (current format) and legacy raw HTML (older
 * articles, pre-TipTap-migration) — see RichTextContent.tsx on the frontend,
 * which does the same JSON-first, HTML-fallback parse.
 */
export function articleContentToSubstackHtml(content: string): string {
  if (!content) return '';
  try {
    const doc = JSON.parse(content) as PMNode;
    if (doc?.type === 'doc') return renderChildren(doc);
  } catch {
    // Not JSON — fall through to legacy-HTML path below.
  }
  // Legacy HTML content is already suitable as draft_body as-is.
  return content;
}
