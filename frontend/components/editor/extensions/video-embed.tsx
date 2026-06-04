import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { VideoEmbed } from '@/components/widgets/VideoEmbed/VideoEmbed';
import { Pencil, Trash2 } from 'lucide-react';

function VideoEmbedNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.url);
  const [draft, setDraft] = useState<string>(node.attrs.url || '');

  const commit = () => {
    if (!draft.trim()) return;
    updateAttributes({ url: draft.trim() });
    setEditing(false);
  };

  return (
    <NodeViewWrapper contentEditable={false}>
      {editor.isEditable && editing ? (
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
      ) : (
        <div className="relative group my-4">
          <VideoEmbed url={node.attrs.url} />
          {editor.isEditable && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
      )}
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
