import React, { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { MediaGallery } from '@/components/widgets/MediaGallery/MediaGallery';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { Pencil, Trash2, Plus, Star, StarOff, Trash, ChevronUp, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import type { MediaItem } from '@/types';
import { conditionalDisplayAttribute, showWhenBadge, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
import type { ShowWhen } from './conditionalDisplay';
import { ConditionalWidget } from '@/components/widgets/ConditionalWidget';

interface CarouselEntry {
  id: string;
  url: string;
  isPrimary: boolean;
  alt_text?: string | null;
}

function entriesToMediaItems(entries: CarouselEntry[]): MediaItem[] {
  return entries.map((e, i) => ({
    id: e.id,
    url: e.url,
    order: i,
    is_primary: e.isPrimary,
    alt_text: e.alt_text ?? null,
  }));
}

function mediaItemsToEntries(items: MediaItem[]): CarouselEntry[] {
  return [...items].sort((a, b) => (a.is_primary ? -1 : 1) - (b.is_primary ? -1 : 1) || a.order - b.order).map((m) => ({
    id: m.id,
    url: m.url,
    isPrimary: m.is_primary,
    alt_text: m.alt_text,
  }));
}

function parseMedia(raw: string): MediaItem[] {
  try { return JSON.parse(raw) as MediaItem[]; } catch { return []; }
}

function CarouselPanel({
  initial,
  onSave,
  onCancel,
}: {
  initial: CarouselEntry[];
  onSave: (entries: CarouselEntry[]) => void;
  onCancel: () => void;
}) {
  const [entries, setEntries] = useState<CarouselEntry[]>(initial);
  const [showPicker, setShowPicker] = useState(false);

  const handlePick = (url: string | null, id?: string) => {
    if (!url || !id) return;
    if (entries.some((e) => e.id === id)) { setShowPicker(false); return; }
    setEntries((prev) => [
      ...prev,
      { id, url, isPrimary: prev.length === 0, alt_text: null },
    ]);
    setShowPicker(false);
  };

  const remove = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    if (next.length > 0 && !next.some((e) => e.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    setEntries(next);
  };

  const setPrimary = (id: string) =>
    setEntries((prev) => prev.map((e) => ({ ...e, isPrimary: e.id === id })));

  const move = (id: string, dir: -1 | 1) => {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const next = [...entries];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setEntries(next);
  };

  return (
    <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-3">
      <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Inline Media Carousel</p>

      {entries.length === 0 ? (
        <div className="border-2 border-dashed border-foreground/20 rounded-lg p-4 text-center text-foreground/40 text-sm">
          No images added yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${
                e.isPrimary ? 'border-foreground/40 bg-foreground/5' : 'border-foreground/15'
              }`}
            >
              <div className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-foreground/10">
                <Image src={e.url} alt={e.alt_text || ''} fill className="object-cover" sizes="40px" />
              </div>
              <span className="flex-1 min-w-0 text-xs text-foreground/60 truncate">{e.url.split('/').pop()}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button type="button" onClick={() => move(e.id, -1)} disabled={i === 0} className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(e.id, 1)} disabled={i === entries.length - 1} className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setPrimary(e.id)} disabled={e.isPrimary} title="Set primary" className="p-1 rounded hover:bg-foreground/10 disabled:opacity-30">
                  {e.isPrimary ? <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> : <StarOff className="w-3.5 h-3.5 text-foreground/40" />}
                </button>
                <button type="button" onClick={() => remove(e.id)} className="p-1 rounded hover:bg-foreground/10 text-red-500">
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-surface-raised hover:border-accent/30 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add image
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(entries)}
          disabled={entries.length === 0}
          className="flex-1 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {initial.length === 0 ? 'Insert Carousel' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-foreground/20 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Select Image</h3>
            <MediaPicker onChange={handlePick} onClose={() => setShowPicker(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function MediaCarouselNodeView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const media = parseMedia(node.attrs.media as string);
  const showWhen = (node.attrs.show_when || 'always') as ShowWhen;
  const badge = editor.isEditable ? showWhenBadge(showWhen) : null;

  if (media.length === 0 && editor.isEditable) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <CarouselPanel
          initial={[]}
          onSave={(entries) => {
            updateAttributes({ media: JSON.stringify(entriesToMediaItems(entries)) });
          }}
          onCancel={() => deleteNode()}
        />
      </NodeViewWrapper>
    );
  }

  if (editing) {
    return (
      <NodeViewWrapper contentEditable={false}>
        <CarouselPanel
          initial={mediaItemsToEntries(media)}
          onSave={(entries) => {
            updateAttributes({ media: JSON.stringify(entriesToMediaItems(entries)) });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </NodeViewWrapper>
    );
  }

  const inner = (
    <NodeViewWrapper contentEditable={false}>
      <div className="relative group my-4">
        {badge && (
          <div className="absolute top-2 left-2 z-20 text-xs bg-accent/90 text-white px-2 py-0.5 rounded">
            {badge}
          </div>
        )}
        <MediaGallery media={media} aspectRatio="video" />
        {editor.isEditable && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
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
              onClick={() => setEditing(true)}
              className="bg-black/70 hover:bg-black text-white text-xs px-2 py-1 rounded flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" /> Edit
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

export const MediaCarouselNode = Node.create({
  name: 'mediaCarousel',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      media: {
        default: '[]',
        parseHTML: (el) => el.getAttribute('data-media') || '[]',
        renderHTML: (attrs) => ({ 'data-media': attrs.media }),
      },
      ...conditionalDisplayAttribute,
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="media-carousel"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node-type': 'media-carousel' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaCarouselNodeView);
  },
});
