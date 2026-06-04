'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { Star, StarOff, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react';

export interface GalleryEntry {
  mediaId: string;
  url: string;
  isPrimary: boolean;
}

interface MediaGalleryFieldProps {
  value: GalleryEntry[];
  onChange: (entries: GalleryEntry[]) => void;
}

export function MediaGalleryField({ value, onChange }: MediaGalleryFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handlePick = (url: string | null, mediaId?: string) => {
    if (!url || !mediaId) return;
    if (value.some((e) => e.mediaId === mediaId)) {
      setShowPicker(false);
      return;
    }
    const newEntry: GalleryEntry = {
      mediaId,
      url,
      isPrimary: value.length === 0,
    };
    onChange([...value, newEntry]);
    setShowPicker(false);
  };

  const remove = (mediaId: string) => {
    const next = value.filter((e) => e.mediaId !== mediaId);
    if (next.length > 0 && !next.some((e) => e.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    onChange(next);
  };

  const setPrimary = (mediaId: string) => {
    onChange(value.map((e) => ({ ...e, isPrimary: e.mediaId === mediaId })));
  };

  const move = (mediaId: string, direction: -1 | 1) => {
    const idx = value.findIndex((e) => e.mediaId === mediaId);
    if (idx < 0) return;
    const next = [...value];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="border-2 border-dashed border-foreground/20 rounded-lg p-6 text-center text-foreground/50 text-sm">
          No images added yet
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((entry, i) => (
            <div
              key={entry.mediaId}
              className={`flex items-center gap-3 p-2 rounded-lg border ${
                entry.isPrimary ? 'border-foreground/40 bg-foreground/5' : 'border-foreground/15'
              }`}
            >
              <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-foreground/10">
                <Image src={entry.url} alt="" fill className="object-cover" sizes="56px" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/50 truncate">{entry.url.split('/').pop()}</p>
                {entry.isPrimary && (
                  <span className="text-xs font-medium text-foreground/70">Primary image</span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Reorder */}
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => move(entry.mediaId, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => move(entry.mediaId, 1)}
                  disabled={i === value.length - 1}
                  aria-label="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>

                {/* Set primary */}
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => setPrimary(entry.mediaId)}
                  disabled={entry.isPrimary}
                  title={entry.isPrimary ? 'Primary image' : 'Set as primary'}
                  aria-label="Set as primary"
                >
                  {entry.isPrimary
                    ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    : <StarOff className="w-4 h-4 text-foreground/40" />}
                </Button>

                {/* Remove */}
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => remove(entry.mediaId)}
                  aria-label="Remove image"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowPicker(true)}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add image
      </Button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-foreground/20 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Select Image</h3>
            <MediaPicker
              onChange={handlePick}
              onClose={() => setShowPicker(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
