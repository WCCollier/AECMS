import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import type { CalloutType } from '@/components/widgets/Callout/Callout';

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
  const { border, bg } = STYLES[type];

  return (
    <NodeViewWrapper>
      <div className={`flex flex-col p-4 rounded-lg border ${border} ${bg} my-4`}>
        {editor.isEditable && (
          <div contentEditable={false} className="flex gap-1 mb-2">
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
          </div>
        )}
        <NodeViewContent className="prose prose-sm max-w-none" />
      </div>
    </NodeViewWrapper>
  );
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
