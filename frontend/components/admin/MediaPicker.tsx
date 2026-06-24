'use client';

import { useState, useRef, useCallback } from 'react';
import { useMedia } from '@/hooks/useMedia';
import { Button } from '@/components/ui';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import { Upload, X, Image as ImageIcon, Search, Check, Loader2 } from 'lucide-react';
import type { Media } from '@/types';

interface MediaPickerProps {
  value?: string;
  onChange: (url: string | null, mediaId?: string) => void;
  onClose?: () => void;
  /** MIME filter passed to backend, e.g. "image/*" */
  mimeFilter?: string;
  /** Show pixel dimensions on each grid thumbnail */
  showDimensions?: boolean;
  /** Compact layout: smaller upload zone, 3-col grid, no bottom close button */
  compact?: boolean;
}

export function MediaPicker({
  value,
  onChange,
  onClose,
  mimeFilter,
  showDimensions = false,
  compact = false,
}: MediaPickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pageSize = compact ? 9 : 12;
  const gridCols = compact ? 'grid-cols-3' : 'grid-cols-4';

  const { media, totalPages, isLoading, mutate } = useMedia({
    page,
    limit: pageSize,
    search: search || undefined,
    mimeFilter,
  });

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await adminApi.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newMedia: Media = response.data;
      mutate();
      onChange(newMedia.url, newMedia.id);
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }, [mutate, onChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        className={`border-2 border-dashed border-foreground/20 rounded-lg text-center hover:border-foreground/40 transition-colors cursor-pointer ${compact ? 'p-3' : 'p-6'}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={mimeFilter ?? 'image/*'}
          onChange={handleFileSelect}
          className="hidden"
        />
        {isUploading ? (
          <div className={`flex items-center justify-center gap-2`}>
            <Loader2 className={`animate-spin text-foreground/50 ${compact ? 'w-4 h-4' : 'w-8 h-8'}`} />
            {!compact && <span className="text-sm text-foreground/60">Uploading…</span>}
          </div>
        ) : (
          <div className={`flex items-center justify-center gap-2 ${compact ? '' : 'flex-col'}`}>
            <Upload className={`text-foreground/50 ${compact ? 'w-4 h-4' : 'w-8 h-8'}`} />
            <span className={`text-foreground/60 ${compact ? 'text-xs' : 'text-sm'}`}>
              {compact ? 'Drop or click to upload' : 'Drop an image here or click to upload'}
            </span>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-3 py-2 rounded text-xs">
          {uploadError}
        </div>
      )}

      {/* Current selection */}
      {value && (
        <div className="flex items-center gap-2 p-2 bg-foreground/5 rounded-lg">
          <img src={value} alt="Selected" className="w-12 h-12 object-cover rounded flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground/70 truncate">Selected</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 rounded hover:bg-surface-raised text-foreground/40 hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/40" />
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={`w-full pl-8 pr-3 border border-border rounded bg-background ${compact ? 'text-xs py-1' : 'text-sm py-1.5'}`}
        />
      </div>

      {/* Grid */}
      <div className={`border border-foreground/10 rounded-lg p-2 overflow-y-auto ${compact ? 'max-h-52' : 'max-h-72'}`}>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-foreground/40" />
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-6 text-foreground/40">
            <ImageIcon className="w-6 h-6 mx-auto mb-1" />
            <p className="text-xs">No media found</p>
          </div>
        ) : (
          <div className={`grid gap-1.5 ${gridCols}`}>
            {media.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.url, item.id)}
                className={`relative aspect-square rounded overflow-hidden border-2 transition-colors ${
                  value === item.url ? 'border-accent' : 'border-transparent hover:border-foreground/20'
                }`}
              >
                <img
                  src={item.url}
                  alt={item.alt_text || item.filename}
                  className="w-full h-full object-cover"
                />
                {value === item.url && (
                  <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-accent" />
                  </div>
                )}
                {showDimensions && item.width && item.height && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 leading-none">
                    {item.width}×{item.height}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-2 py-1 border border-border rounded disabled:opacity-40 hover:bg-surface-raised transition-colors"
          >←</button>
          <span className="text-xs text-foreground/50">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs px-2 py-1 border border-border rounded disabled:opacity-40 hover:bg-surface-raised transition-colors"
          >→</button>
        </div>
      )}

      {/* Close button (non-compact modal usage) */}
      {onClose && !compact && (
        <div className="flex justify-end pt-2 border-t border-foreground/10">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  );
}
