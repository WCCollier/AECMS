'use client';

import { useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { getDisplayExtensions } from './extensions';

interface RichTextContentProps {
  content: string;
  /** CSS class applied to the editable area — defaults to 'prose-article' */
  className?: string;
}

/**
 * Read-only TipTap renderer. Accepts both TipTap JSON strings (produced by
 * getJSON()) and legacy HTML strings — both are handled transparently.
 */
export function RichTextContent({ content, className = 'prose-article' }: RichTextContentProps) {
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

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: getDisplayExtensions(),
    content: parsed,
    editorProps: {
      attributes: { class: className },
    },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
