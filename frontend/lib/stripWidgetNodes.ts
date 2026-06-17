const WIDGET_NODE_TYPES = new Set([
  'mediaCarousel',
  'callout',
  'videoEmbed',
  'xEmbed',
  'articleEmbed',
  'productEmbed',
  'rssEmbed',
  'image',
]);

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  [key: string]: unknown;
}

function stripNode(node: TipTapNode): TipTapNode | null {
  if (WIDGET_NODE_TYPES.has(node.type)) return null;
  if (!node.content) return node;
  const cleanContent = node.content
    .map(stripNode)
    .filter((n): n is TipTapNode => n !== null);
  return { ...node, content: cleanContent };
}

/** Deep-clones a TipTap JSON doc, removing all widget-type nodes. */
export function stripWidgetNodes(doc: object): object {
  const root = doc as TipTapNode;
  if (root.type !== 'doc' || !root.content) return doc;
  const cleanContent = root.content
    .map(stripNode)
    .filter((n): n is TipTapNode => n !== null);
  return { ...root, content: cleanContent };
}

/** Extracts the text content of the first paragraph node in a (possibly stripped) doc. */
export function extractFirstParagraphText(doc: object): string {
  const root = doc as TipTapNode;
  if (!root.content) return '';
  for (const node of root.content) {
    if (node.type === 'paragraph' && node.content) {
      return node.content
        .filter((n) => n.type === 'text')
        .map((n) => String(n.text ?? ''))
        .join('');
    }
  }
  return '';
}

/** Recursively collects all text from a TipTap doc, up to maxChars. */
export function extractAllText(doc: object, maxChars = 400): string {
  const parts: string[] = [];
  function walk(node: TipTapNode) {
    if (node.type === 'text' && node.text) parts.push(String(node.text));
    if (node.content) {
      for (const child of node.content) {
        walk(child);
        if (parts.join('').length >= maxChars) return;
      }
    }
  }
  walk(doc as TipTapNode);
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text;
}

/** Strips HTML tags and entities from a string, returning plain text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
