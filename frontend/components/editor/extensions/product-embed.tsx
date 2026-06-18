import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { ProductEmbed } from '@/components/widgets/ProductEmbed/ProductEmbed';
import { Pencil, Trash2, ShoppingBag, Search, Type } from 'lucide-react';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { titleAttributeDefaults, TitleSettingsPanel } from './title-settings';
import type { TitleAttrs } from './title-settings';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';
import adminApi from '@/lib/adminApi';
import type { Product, PaginatedResponse } from '@/types';

function ProductPicker({ onSelect, onCancel }: { onSelect: (id: string) => void; onCancel: () => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setSearch(q);
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'published', limit: '30' });
      if (q.trim()) params.set('search', q.trim());
      const res = await adminApi.get<PaginatedResponse<Product>>(`/products?${params}`);
      setResults(res.data.data ?? []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { handleSearch(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" /> Embed Product
        </p>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50 hover:text-foreground">Cancel</button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search published products…"
          autoFocus
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>
      {loading ? (
        <p className="text-sm text-foreground/50 text-center py-2">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-foreground/50 text-center py-2">No published products found</p>
      ) : (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-raised transition-colors"
            >
              <p className="text-sm font-medium line-clamp-1">{p.title}</p>
              <p className="text-xs text-foreground/50">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.price)}
                {' · '}{p.status}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductEmbedNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [picking, setPicking] = useState(!node.attrs.productId);
  const [editingTitle, setEditingTitle] = useState(false);
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;
  const badge = editor.isEditable ? showWhenBadge(showWhen) : null;

  const titleAttrs: TitleAttrs = {
    titleOverride: node.attrs.titleOverride ?? '',
    titleCase:     node.attrs.titleCase     ?? 'default',
    titleAlign:    node.attrs.titleAlign    ?? 'left',
    titleLevel:    node.attrs.titleLevel    ?? 'h3',
    titleHidden:   node.attrs.titleHidden   ?? false,
  };

  if (editor.isEditable && picking) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <ProductPicker
          onSelect={(id) => { updateAttributes({ productId: id }); setPicking(false); }}
          onCancel={() => { if (!node.attrs.productId) deleteNode(); else setPicking(false); }}
        />
      </NodeViewWrapper>
    );
  }

  if (editor.isEditable && editingTitle) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <TitleSettingsPanel
          attrs={titleAttrs}
          onUpdate={(updates) => updateAttributes(updates)}
          onDone={() => setEditingTitle(false)}
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
        <ProductEmbed productId={node.attrs.productId} titleAttrs={titleAttrs} />
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
              onClick={() => setEditingTitle(true)}
              className="bg-black/70 hover:bg-black text-white text-xs px-2 py-1 rounded flex items-center gap-1"
            >
              <Type className="w-3 h-3" /> Title
            </button>
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

export const ProductEmbedNode = Node.create({
  name: 'productEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      productId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-product-id') || '',
        renderHTML: (attrs) => ({ 'data-product-id': attrs.productId }),
      },
      ...conditionalDisplayAttribute,
      ...titleAttributeDefaults,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="product-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'product-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProductEmbedNodeView);
  },
});
