'use client';

import { useState, useRef, useCallback } from 'react';
import { useMedia } from '@/hooks/useMedia';
import { Button, Input, Card } from '@/components/ui';
import api, { getErrorMessage } from '@/lib/api';
import { Upload, X, Image as ImageIcon, Search, Check, Loader2 } from 'lucide-react';
import type { Media } from '@/types';

interface MediaPickerProps {
  value?: string;
  onChange: (url: string | null, mediaId?: string) => void;
  onClose?: () => void;
}

export function MediaPicker({ value, onChange, onClose }: MediaPickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { media, totalPages, isLoading, mutate } = useMedia({ page, limit: 12, search: search || undefined });

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
    if (file) {
      handleUpload(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const selectMedia = (mediaItem: Media) => {
    onChange(mediaItem.url, mediaItem.id);
  };

  const clearSelection = () => {
    onChange(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-foreground/20 rounded-lg p-6 text-center hover:border-foreground/40 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-foreground/50" />
            <span className="text-sm text-foreground/60">Uploading...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-foreground/50" />
            <span className="text-sm text-foreground/60">
              Drop an image here or click to upload
            </span>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-3 py-2 rounded text-sm">
          {uploadError}
        </div>
      )}

      {/* Current Selection */}
      {value && (
        <div className="flex items-center gap-3 p-3 bg-foreground/5 rounded-lg">
          <img
            src={value}
            alt="Selected"
            className="w-16 h-16 object-cover rounded"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Selected image</p>
            <p className="text-xs text-foreground/60 truncate">{value}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
        <Input
          type="text"
          placeholder="Search media..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10"
        />
      </div>

      {/* Media Grid */}
      <div className="border border-foreground/10 rounded-lg p-4 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/50" />
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-8 text-foreground/50">
            <ImageIcon className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">No media found</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {media.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectMedia(item)}
                className={`relative aspect-square rounded overflow-hidden border-2 transition-colors ${
                  value === item.url
                    ? 'border-blue-500'
                    : 'border-transparent hover:border-foreground/20'
                }`}
              >
                <img
                  src={item.url}
                  alt={item.alt_text || item.filename}
                  className="w-full h-full object-cover"
                />
                {value === item.url && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-blue-500" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-foreground/60">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Actions */}
      {onClose && (
        <div className="flex justify-end pt-2 border-t border-foreground/10">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
