'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { MediaPicker } from './MediaPicker';
import { Image as ImageIcon, X, Edit } from 'lucide-react';

interface ImageFieldProps {
  label?: string;
  emptyLabel?: string;
  value?: string | null;
  onChange: (url: string | null) => void;
}

export function ImageField({ label, emptyLabel = 'Add image', value, onChange }: ImageFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (url: string | null) => {
    onChange(url);
    if (url) {
      setShowPicker(false);
    }
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium mb-2">{label}</label>}

      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt={label ?? 'Selected image'}
            className="w-full h-48 object-cover rounded-lg border border-foreground/20"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPicker(true)}
              className="bg-background"
            >
              <Edit className="w-4 h-4 mr-1" />
              Change
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(null)}
              className="bg-background"
            >
              <X className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="w-full h-32 border-2 border-dashed border-foreground/20 rounded-lg flex flex-col items-center justify-center gap-2 text-foreground/50 hover:border-foreground/40 hover:text-foreground/70 transition-colors"
        >
          <ImageIcon className="w-8 h-8" />
          <span className="text-sm">{emptyLabel}</span>
        </button>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-foreground/20 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Select Image</h3>
            <MediaPicker
              value={value || undefined}
              onChange={handleChange}
              onClose={() => setShowPicker(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
