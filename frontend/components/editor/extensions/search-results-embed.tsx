import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { SearchResultsWidget } from '@/components/widgets/SearchResultsWidget';
import { TagChipStrip } from '@/components/ui';
import { LayoutGrid, Trash2, Settings } from 'lucide-react';

type ContentType = 'articles' | 'products';
type TagLogic = 'and' | 'or';
type Display = 'grid' | 'list';
type DisplayMode = 'auto' | 'paginated';

interface SearchResultsAttrs {
  contentType: ContentType;
  tags: string;       // stored as JSON string: string[]
  tagLogic: TagLogic;
  search: string;
  display: Display;
  pageSize: number;
  title: string;
  displayMode: DisplayMode;
}

function parseTagsAttr(raw: string): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Checks whether any substantive node follows `currentIndex` in the same
 * parent node array. Empty paragraphs are ignored; anything else counts as
 * trailing content, which means infinite scroll should not auto-enable.
 */
function hasTrailingContent(
  editor: NodeViewProps['editor'],
  getPos: () => number | undefined,
): boolean {
  const pos = typeof getPos === 'function' ? getPos() : undefined;
  if (pos === undefined) return false;

  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  const idxInParent = $pos.index($pos.depth);

  for (let i = idxInParent + 1; i < parent.childCount; i++) {
    const sibling = parent.child(i);
    if (sibling.type.name !== 'paragraph' || (sibling.textContent?.trim() ?? '') !== '') {
      return true;
    }
  }
  return false;
}

function ConfigPanel({
  attrs,
  onUpdate,
  onDone,
}: {
  attrs: SearchResultsAttrs;
  onUpdate: (updates: Partial<SearchResultsAttrs>) => void;
  onDone: () => void;
}) {
  const [contentType, setContentType] = useState<ContentType>(attrs.contentType ?? 'articles');
  const [tags, setTags] = useState<string[]>(parseTagsAttr(attrs.tags));
  const [tagLogic, setTagLogic] = useState<TagLogic>(attrs.tagLogic ?? 'and');
  const [search, setSearch] = useState(attrs.search ?? '');
  const [display, setDisplay] = useState<Display>(attrs.display ?? 'grid');
  const [pageSize, setPageSize] = useState(attrs.pageSize ?? 6);
  const [title, setTitle] = useState(attrs.title ?? '');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(attrs.displayMode ?? 'auto');

  const save = () => {
    onUpdate({
      contentType,
      tags: JSON.stringify(tags),
      tagLogic,
      search,
      display,
      pageSize,
      title,
      displayMode,
    });
    onDone();
  };

  return (
    <div className="my-4 p-4 border border-accent/30 rounded-lg bg-surface space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> Collection Settings
        </p>
        <button type="button" onClick={onDone} className="text-xs text-foreground/50 hover:text-foreground">
          Cancel
        </button>
      </div>

      {/* Content type */}
      <div>
        <p className="text-xs font-medium text-foreground/60 mb-1.5">Content type</p>
        <div className="flex gap-2">
          {(['articles', 'products'] as ContentType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setContentType(t)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                contentType === t
                  ? 'bg-accent text-white border-accent'
                  : 'border-foreground/20 hover:border-accent/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tags + logic */}
      <div>
        <p className="text-xs font-medium text-foreground/60 mb-1.5">Tags</p>
        <TagChipStrip
          selected={tags}
          tagLogic={tagLogic}
          onChange={setTags}
          onLogicChange={setTagLogic}
          placeholder="Add tag filter…"
          alwaysShowLogic
        />
      </div>

      {/* Text search */}
      <div>
        <p className="text-xs font-medium text-foreground/60 mb-1.5">Text search (optional)</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by keyword…"
          className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>

      {/* Heading */}
      <div>
        <p className="text-xs font-medium text-foreground/60 mb-1.5">Heading (optional)</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Outsiders Series"
          className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>

      {/* Display + page size */}
      <div className="flex gap-4">
        <div>
          <p className="text-xs font-medium text-foreground/60 mb-1.5">Display</p>
          <div className="flex gap-2">
            {(['grid', 'list'] as Display[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDisplay(d)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize ${
                  display === d
                    ? 'bg-accent text-white border-accent'
                    : 'border-foreground/20 hover:border-accent/50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-foreground/60 mb-1.5">Items shown</p>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-border rounded-lg bg-background"
          >
            {[3, 6, 9, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Display mode */}
      <div>
        <p className="text-xs font-medium text-foreground/60 mb-1.5">Scroll mode</p>
        <div className="flex gap-2">
          {([['auto', 'Auto (infinite when at zone tail)'], ['paginated', 'Always paginated']] as [DisplayMode, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setDisplayMode(val)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                displayMode === val
                  ? 'bg-accent text-white border-accent'
                  : 'border-foreground/20 hover:border-accent/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-raised transition-colors">
          Cancel
        </button>
        <button type="button" onClick={save} className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
          Apply
        </button>
      </div>
    </div>
  );
}

function SearchResultsEmbedNodeView({ node, editor, updateAttributes, deleteNode, getPos }: NodeViewProps) {
  const [configuring, setConfiguring] = useState(() => !node.attrs.contentType);
  const attrs = node.attrs as SearchResultsAttrs;
  const tags = parseTagsAttr(attrs.tags);

  const summaryLabel = () => {
    const type = attrs.contentType ?? 'articles';
    const logicLabel = attrs.tagLogic === 'or' ? 'ANY of' : 'ALL of';
    const tagPart = tags.length > 0 ? `${logicLabel}: ${tags.join(', ')}` : 'no tag filter';
    const searchPart = attrs.search ? ` · "${attrs.search}"` : '';
    return `${type.charAt(0).toUpperCase() + type.slice(1)} · ${tagPart}${searchPart}`;
  };

  if (editor.isEditable && configuring) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <ConfigPanel
          attrs={attrs}
          onUpdate={(updates) => updateAttributes(updates)}
          onDone={() => setConfiguring(false)}
        />
      </NodeViewWrapper>
    );
  }

  if (!editor.isEditable) {
    // Zone-trailing detection: allow infinite scroll when displayMode is 'auto'
    // and there is no substantive content after this node in the same zone.
    const allowInfiniteScroll =
      (attrs.displayMode ?? 'auto') !== 'paginated' &&
      !hasTrailingContent(editor, getPos);

    return (
      <NodeViewWrapper contentEditable={false}>
        <SearchResultsWidget
          contentType={attrs.contentType ?? 'articles'}
          tags={tags}
          tagLogic={attrs.tagLogic ?? 'and'}
          search={attrs.search ?? ''}
          display={attrs.display ?? 'grid'}
          pageSize={Math.min(attrs.pageSize ?? 6, 12)}
          title={attrs.title ?? ''}
          allowInfiniteScroll={allowInfiniteScroll}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="relative group my-4 p-4 border border-dashed border-accent/40 rounded-lg bg-accent/5">
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <LayoutGrid className="w-4 h-4 text-accent/70 shrink-0" />
          <span className="font-medium">{summaryLabel()}</span>
          {attrs.title && <span className="text-foreground/40">&middot; &ldquo;{attrs.title}&rdquo;</span>}
          {(attrs.displayMode ?? 'auto') === 'paginated' && (
            <span className="text-foreground/30 text-[10px] ml-auto">paginated</span>
          )}
        </div>
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setConfiguring(true)}
            className="bg-black/70 hover:bg-black text-white text-xs px-2 py-1 rounded flex items-center gap-1"
          >
            <Settings className="w-3 h-3" /> Configure
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

export const SearchResultsEmbedNode = Node.create({
  name: 'searchResultsEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      contentType:  { default: 'articles',   parseHTML: (el) => el.getAttribute('data-content-type') || 'articles',    renderHTML: (a) => ({ 'data-content-type': a.contentType }) },
      tags:         { default: '[]',          parseHTML: (el) => el.getAttribute('data-tags') || '[]',                  renderHTML: (a) => ({ 'data-tags': a.tags }) },
      tagLogic:     { default: 'and',         parseHTML: (el) => el.getAttribute('data-tag-logic') || 'and',            renderHTML: (a) => ({ 'data-tag-logic': a.tagLogic }) },
      search:       { default: '',            parseHTML: (el) => el.getAttribute('data-search') || '',                   renderHTML: (a) => ({ 'data-search': a.search }) },
      display:      { default: 'grid',        parseHTML: (el) => el.getAttribute('data-display') || 'grid',              renderHTML: (a) => ({ 'data-display': a.display }) },
      pageSize:     { default: 6,             parseHTML: (el) => Number(el.getAttribute('data-page-size')) || 6,         renderHTML: (a) => ({ 'data-page-size': String(a.pageSize) }) },
      title:        { default: '',            parseHTML: (el) => el.getAttribute('data-title') || '',                    renderHTML: (a) => ({ 'data-title': a.title }) },
      displayMode:  { default: 'auto',        parseHTML: (el) => el.getAttribute('data-display-mode') || 'auto',         renderHTML: (a) => ({ 'data-display-mode': a.displayMode }) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="search-results-embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'search-results-embed' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SearchResultsEmbedNodeView);
  },
});
