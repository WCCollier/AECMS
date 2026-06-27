'use client';

import { useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { getDisplayExtensions } from './extensions';

interface RichTextContentProps {
  content: string;
  /** CSS class applied to the editable area — defaults to 'prose-article' */
  className?: string;
  /** Recursion depth — pass depth+1 when rendering inside an embedded article/product.
   *  When > 0, nested SearchResultsEmbed nodes render a placeholder to prevent recursion. */
  depth?: number;
}

/**
 * Read-only TipTap renderer. Accepts both TipTap JSON strings (produced by
 * getJSON()) and legacy HTML strings — both are handled transparently.
 */
export function RichTextContent({ content, className = 'prose-article', depth = 0 }: RichTextContentProps) {
  // Parse JSON if possible; fall back to the raw HTML string.
  // TipTap's useEditor accepts both an HTML string and a JSON object as `content`.
  const parsed = useMemo(() => {
    if (!content) return '';
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }, [content]);

  const extensions = useMemo(() => getDisplayExtensions({ depth }), [depth]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions,
    content: parsed,
    editorProps: {
      attributes: { class: className },
    },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
