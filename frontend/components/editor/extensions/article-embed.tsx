import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ArticleEmbed } from '@/components/widgets/ArticleEmbed/ArticleEmbed';
import { Pencil, Trash2, FileText, Search } from 'lucide-react';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';
import adminApi from '@/lib/adminApi';
import type { Article, PaginatedResponse } from '@/types';

function ArticlePicker({ onSelect, onCancel }: { onSelect: (id: string) => void; onCancel: () => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (!q.trim() && q !== '') return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'published', limit: '30' });
      if (q.trim()) params.set('search', q.trim());
      const res = await adminApi.get<PaginatedResponse<Article>>(`/articles?${params}`);
      setResults(res.data.data ?? []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { handleSearch(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Embed Article
        </p>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50 hover:text-foreground">Cancel</button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search published articles…"
          autoFocus
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>
      {loading ? (
        <p className="text-sm text-foreground/50 text-center py-2">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-foreground/50 text-center py-2">No published articles found</p>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {results.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-raised transition-colors"
            >
              <p className="text-sm font-medium line-clamp-1">{a.title}</p>
              <p className="text-xs text-foreground/50">{a.status} · {a.published_at ? new Date(a.published_at).toLocaleDateString() : 'Draft'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArticleEmbedNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [picking, setPicking] = useState(!node.attrs.articleId);
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;
  const badge = editor.isEditable ? showWhenBadge(showWhen) : null;

  if (editor.isEditable && picking) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <ArticlePicker
          onSelect={(id) => { updateAttributes({ articleId: id }); setPicking(false); }}
          onCancel={() => { if (!node.attrs.articleId) deleteNode(); else setPicking(false); }}
        />
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
        <ArticleEmbed articleId={node.attrs.articleId} />
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
              onClick={() => setPicking(true)}
              className="bg-black/70 hover:bg-black text-white text-xs px-2 py-1 rounded flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Change
            </button>
            <button
              type="button"
              onClick={() => deleteNode()}
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

export const ArticleEmbedNode = Node.create({
  name: 'articleEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      articleId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-article-id') || '',
        renderHTML: (attrs) => ({ 'data-article-id': attrs.articleId }),
      },
      ...conditionalDisplayAttribute,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="article-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'article-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArticleEmbedNodeView);
  },
});
