import React from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';

function RichTextBoxNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;
  const badge = editor.isEditable ? showWhenBadge(showWhen) : null;

  const inner = (
    <NodeViewWrapper>
      <div className="border border-border rounded-lg p-4 my-4">
        {editor.isEditable && (
          <div contentEditable={false} className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-foreground/40 select-none">Rich Text Box</span>
              {badge && (
                <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">{badge}</span>
              )}
            </div>
            <div className="flex gap-1">
              {SHOW_WHEN_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateAttributes({ show_when: opt })}
                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                    opt === showWhen
                      ? 'bg-accent/20 border-accent/40 text-accent font-medium'
                      : 'border-foreground/15 hover:bg-foreground/10'
                  }`}
                >
                  {SHOW_WHEN_LABELS[opt]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => deleteNode()}
                className="ml-1 p-1 rounded hover:bg-foreground/10 text-red-500"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        <NodeViewContent className="prose prose-sm max-w-none focus:outline-none" />
      </div>
    </NodeViewWrapper>
  );

  if (!editor.isEditable) {
    return <ConditionalWidget showWhen={showWhen}>{inner}</ConditionalWidget>;
  }
  return inner;
}

export const RichTextBoxNode = Node.create({
  name: 'richTextBox',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      ...conditionalDisplayAttribute,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="rich-text-box"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'rich-text-box' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RichTextBoxNodeView);
  },
});
