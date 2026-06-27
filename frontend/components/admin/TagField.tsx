'use client';

import { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import useSWR from 'swr';
import adminApi from '@/lib/adminApi';

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface TagFieldProps {
  value: Tag[];
  onChange: (tags: Tag[]) => void;
}

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

export function TagField({ value, onChange }: TagFieldProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allTags = [], mutate } = useSWR<Tag[]>('/tags', fetcher);

  const selectedIds = new Set(value.map((t) => t.id));

  const filtered = allTags.filter(
    (t) =>
      !selectedIds.has(t.id) &&
      t.name.toLowerCase().includes(input.toLowerCase()),
  );

  const trimmed = input.trim();
  const canCreate =
    trimmed.length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  const add = (tag: Tag) => {
    onChange([...value, tag]);
    setInput('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (id: string) => onChange(value.filter((t) => t.id !== id));

  const createAndAdd = async () => {
    if (!trimmed) return;
    setCreating(true);
    try {
      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const res = await adminApi.post<Tag>('/tags', { name: trimmed, slug });
      await mutate();
      add(res.data);
    } catch {
      // tag may already exist; silently ignore
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) add(filtered[0]);
      else if (canCreate) createAndAdd();
    }
    if (e.key === 'Backspace' && input === '' && value.length > 0) {
      remove(value[value.length - 1].id);
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative">
      <div
        className="min-h-[42px] flex flex-wrap gap-1.5 p-2 border border-foreground/20 rounded-lg bg-background cursor-text focus-within:ring-2 focus-within:ring-foreground/20"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-foreground/10 text-foreground/80 text-sm rounded-full"
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(tag.id); }}
              className="hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? 'Add tags…' : ''}
          disabled={creating}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm placeholder:text-foreground/30"
        />
      </div>

      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-background border border-foreground/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(tag)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-foreground/5 transition-colors"
            >
              {tag.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={createAndAdd}
              className="w-full text-left px-3 py-2 text-sm hover:bg-foreground/5 transition-colors flex items-center gap-2 text-accent border-t border-foreground/10"
            >
              <Plus className="w-3.5 h-3.5" />
              Create &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
