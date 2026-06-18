import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { RssFeedWidget } from '@/components/widgets/RssFeed/RssFeedWidget';
import { Pencil, Trash2, Rss } from 'lucide-react';

function RssEmbedNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.feedUrl);
  const [draftUrl, setDraftUrl] = useState<string>(node.attrs.feedUrl || '');

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <RssFeedWidget
          data={{
            feedUrl: node.attrs.feedUrl,
            specificItemUrl: node.attrs.specificItemUrl || undefined,
            count: node.attrs.count ?? 3,
            layout: node.attrs.layout ?? 'list',
            showImage: node.attrs.showImage ?? true,
            fadeHeight: node.attrs.fadeHeight ?? 220,
            ctaLabel: node.attrs.ctaLabel ?? 'Continue Reading',
            useProxy: node.attrs.useProxy ?? false,
          }}
        />
      </NodeViewWrapper>
    );
  }

  const commit = () => {
    if (!draftUrl.trim()) return;
    updateAttributes({ feedUrl: draftUrl.trim() });
    setEditing(false);
  };

  if (editing || !node.attrs.feedUrl) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Rss size={14} className="text-orange-400" />
            <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">RSS Feed Embed</p>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              placeholder="https://example.substack.com/feed"
              className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
              autoFocus
            />
            <button
              type="button"
              onClick={commit}
              disabled={!draftUrl.trim()}
              className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40"
            >
              Embed
            </button>
            {node.attrs.feedUrl && (
              <button
                type="button"
                onClick={() => { setDraftUrl(node.attrs.feedUrl); setEditing(false); }}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-raised"
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
        <RssFeedWidget
          mode="edit"
          data={{
            feedUrl: node.attrs.feedUrl,
            specificItemUrl: node.attrs.specificItemUrl || undefined,
            count: node.attrs.count ?? 3,
            layout: node.attrs.layout ?? 'list',
            showImage: node.attrs.showImage ?? true,
            fadeHeight: node.attrs.fadeHeight ?? 220,
            ctaLabel: node.attrs.ctaLabel ?? 'Continue Reading',
            useProxy: node.attrs.useProxy ?? false,
          }}
          onEnableProxy={() => updateAttributes({ useProxy: true })}
        />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            onClick={() => { setDraftUrl(node.attrs.feedUrl); setEditing(true); }}
            className="bg-black/70 hover:bg-black text-white text-xs px-2 py-1 rounded flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> Edit URL
          </button>
          <button
            type="button"
            onClick={() => deleteNode()}
            className="bg-red-500/80 hover:bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const RssEmbedNode = Node.create({
  name: 'rssEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      feedUrl: { default: '', parseHTML: (el) => el.getAttribute('data-feed-url') || '', renderHTML: (attrs) => ({ 'data-feed-url': attrs.feedUrl }) },
      specificItemUrl: { default: '', parseHTML: (el) => el.getAttribute('data-item-url') || '', renderHTML: (attrs) => ({ 'data-item-url': attrs.specificItemUrl }) },
      count: { default: 3, parseHTML: (el) => parseInt(el.getAttribute('data-count') || '3', 10), renderHTML: (attrs) => ({ 'data-count': attrs.count }) },
      layout: { default: 'list', parseHTML: (el) => el.getAttribute('data-layout') || 'list', renderHTML: (attrs) => ({ 'data-layout': attrs.layout }) },
      showImage: { default: true, parseHTML: (el) => el.getAttribute('data-show-image') !== 'false', renderHTML: (attrs) => ({ 'data-show-image': attrs.showImage }) },
      fadeHeight: { default: 220, parseHTML: (el) => parseInt(el.getAttribute('data-fade-height') || '220', 10), renderHTML: (attrs) => ({ 'data-fade-height': attrs.fadeHeight }) },
      ctaLabel: { default: 'Continue Reading', parseHTML: (el) => el.getAttribute('data-cta-label') || 'Continue Reading', renderHTML: (attrs) => ({ 'data-cta-label': attrs.ctaLabel }) },
      useProxy: { default: false, parseHTML: (el) => el.getAttribute('data-use-proxy') === 'true', renderHTML: (attrs) => ({ 'data-use-proxy': attrs.useProxy }) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="rss-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'rss-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RssEmbedNodeView);
  },
});
