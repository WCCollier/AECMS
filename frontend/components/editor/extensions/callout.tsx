import React, { useRef } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { CalloutType } from '@/components/widgets/Callout/Callout';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';

const TYPES: CalloutType[] = ['info', 'warning', 'success', 'danger'];

const LABELS: Record<CalloutType, string> = {
  info: 'ℹ Info',
  warning: '⚠ Warning',
  success: '✓ Success',
  danger: '✕ Danger',
};

const STYLES: Record<CalloutType, { border: string; bg: string }> = {
  info:    { border: 'border-blue-500/40',   bg: 'bg-blue-500/10' },
  warning: { border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  success: { border: 'border-green-500/40',  bg: 'bg-green-500/10' },
  danger:  { border: 'border-red-500/40',    bg: 'bg-red-500/10' },
};

function CalloutNodeView({ node, editor, updateAttributes }: NodeViewProps) {
  const type = (node.attrs.type || 'info') as CalloutType;
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;
  const { border, bg } = STYLES[type];
  const contentRef = useRef<HTMLDivElement>(null);

  const badge = editor.isEditable ? showWhenBadge(showWhen) : null;

  const handleBlur = () => {
    if (!editor.isEditable) return;
    const text = contentRef.current?.textContent?.slice(0, 100) ?? '';
    updateAttributes({ summary: text });
  };

  const content = (
    <NodeViewWrapper>
      <div className={`flex flex-col p-4 rounded-lg border ${border} ${bg} my-4`} ref={contentRef} onBlur={handleBlur}>
        {editor.isEditable && (
          <div contentEditable={false} className="flex flex-wrap gap-1 mb-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateAttributes({ type: t })}
                className={`text-xs px-2 py-0.5 rounded border transition-colors select-none ${
                  t === type
                    ? 'bg-foreground/20 border-foreground/40 font-medium'
                    : 'border-foreground/15 hover:bg-foreground/10'
                }`}
              >
                {LABELS[t]}
              </button>
            ))}
            <div className="w-px h-4 bg-foreground/20 mx-0.5 self-center" />
            {SHOW_WHEN_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateAttributes({ show_when: opt })}
                className={`text-xs px-2 py-0.5 rounded border transition-colors select-none ${
                  opt === showWhen
                    ? 'bg-accent/20 border-accent/40 text-accent font-medium'
                    : 'border-foreground/15 hover:bg-foreground/10'
                }`}
              >
                {SHOW_WHEN_LABELS[opt]}
              </button>
            ))}
          </div>
        )}
        {badge && (
          <div contentEditable={false} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded self-start mb-1">
            {badge}
          </div>
        )}
        <NodeViewContent className="prose prose-sm max-w-none" />
      </div>
    </NodeViewWrapper>
  );

  if (!editor.isEditable) {
    return (
      <ConditionalWidget showWhen={showWhen}>
        {content}
      </ConditionalWidget>
    );
  }

  return content;
}

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (el) => (el.getAttribute('data-callout-type') || 'info') as CalloutType,
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type }),
      },
      summary: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-summary') || '',
        renderHTML: (attrs) => ({ 'data-summary': attrs.summary }),
      },
      ...conditionalDisplayAttribute,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'callout' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
