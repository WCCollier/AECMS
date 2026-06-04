import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { XEmbed } from '@/components/widgets/XEmbed/XEmbed';
import { Pencil, Trash2, Twitter } from 'lucide-react';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';

function XEmbedNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.url);
  const [draft, setDraft] = useState<string>(node.attrs.url || '');
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;
  const badge = editor.isEditable ? showWhenBadge(showWhen) : null;

  const commit = () => {
    if (!draft.trim()) return;
    updateAttributes({ url: draft.trim() });
    setEditing(false);
  };

  if (editor.isEditable && editing) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-2">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
            <Twitter className="w-3.5 h-3.5" /> Embed X / Twitter Post
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="https://x.com/user/status/…"
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
              autoFocus
            />
            <button
              type="button"
              onClick={commit}
              disabled={!draft.trim()}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Embed
            </button>
            {node.attrs.url && (
              <button
                type="button"
                onClick={() => { setDraft(node.attrs.url); setEditing(false); }}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  const inner = (
    <NodeViewWrapper contentEditable={false}>
      <div className="relative group">
        {badge && (
          <div className="absolute top-2 left-2 z-20 text-xs bg-accent/90 text-white px-2 py-0.5 rounded">
            {badge}
          </div>
        )}
        <XEmbed url={node.attrs.url} />
        {editor.isEditable && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex-wrap justify-end">
            {SHOW_WHEN_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateAttributes({ show_when: opt })}
                className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                  opt === showWhen
                    ? 'bg-accent/80 border-accent text-white'
                    : 'bg-black/50 border-white/20 text-white hover:bg-black/70'
                }`}
              >
                {SHOW_WHEN_LABELS[opt]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setDraft(node.attrs.url); setEditing(true); }}
              title="Edit URL"
              className="bg-black/70 hover:bg-black text-white text-xs px-2 py-1 rounded flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => deleteNode()}
              title="Remove"
              className="bg-red-500/80 hover:bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );

  if (!editor.isEditable) {
    return <ConditionalWidget showWhen={showWhen}>{inner}</ConditionalWidget>;
  }
  return inner;
}

export const XEmbedNode = Node.create({
  name: 'xEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') || '',
        renderHTML: (attrs) => ({ 'data-url': attrs.url }),
      },
      ...conditionalDisplayAttribute,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="x-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'x-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(XEmbedNodeView);
  },
});
