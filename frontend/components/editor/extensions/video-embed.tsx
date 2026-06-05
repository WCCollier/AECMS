import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { VideoEmbed } from '@/components/widgets/VideoEmbed/VideoEmbed';
import { Pencil, Trash2 } from 'lucide-react';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';

function VideoEmbedNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.url);
  const [draft, setDraft] = useState<string>(node.attrs.url || '');
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;

  // Display mode: unconditional early return
  if (!editor.isEditable) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <ConditionalWidget showWhen={showWhen}>
          <VideoEmbed url={node.attrs.url} />
        </ConditionalWidget>
      </NodeViewWrapper>
    );
  }

  // ── Editor mode below ──────────────────────────────────────────────────────
  const badge = showWhenBadge(showWhen);

  const commit = () => {
    if (!draft.trim()) return;
    updateAttributes({ url: draft.trim() });
    setEditing(false);
  };

  if (editing || !node.attrs.url) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-2">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Insert Video</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="YouTube or Vimeo URL…"
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

  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="relative group my-4">
        {badge && (
          <div className="absolute top-2 left-2 z-20 text-xs bg-accent/90 text-white px-2 py-0.5 rounded">
            {badge}
          </div>
        )}
        <VideoEmbed url={node.attrs.url} />
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="flex gap-1 flex-wrap justify-end">
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
          </div>
          <div className="flex gap-1 justify-end">
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
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const VideoEmbedNode = Node.create({
  name: 'videoEmbed',
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
    return [{ tag: 'div[data-node-type="video-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'video-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedNodeView);
  },
});
