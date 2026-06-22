'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Tag as TagIcon } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import type { Tag } from '@/types';

interface TagChipStripProps {
  selected: string[];
  tagLogic: 'and' | 'or';
  onChange: (tags: string[]) => void;
  onLogicChange: (logic: 'and' | 'or') => void;
  placeholder?: string;
  /** When true, the ALL/ANY toggle is always visible even with < 2 chips (for embed config modals) */
  alwaysShowLogic?: boolean;
}

export function TagChipStrip({
  selected,
  tagLogic,
  onChange,
  onLogicChange,
  placeholder = 'Filter by tag…',
  alwaysShowLogic = false,
}: TagChipStripProps) {
  const { tags } = useTags();
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = tags.filter(
    (t) =>
      !selected.includes(t.slug) &&
      (input === '' || t.name.toLowerCase().includes(input.toLowerCase()) || t.slug.includes(input.toLowerCase())),
  );

  const addTag = (slug: string) => {
    onChange([...selected, slug]);
    setInput('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (slug: string) => {
    const next = selected.filter((s) => s !== slug);
    onChange(next);
    // if dropping to 1, logic toggle becomes meaningless but we keep the state
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showToggle = alwaysShowLogic || selected.length >= 2;

  const tagName = (slug: string): string =>
    tags.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <div className="flex flex-wrap items-center gap-2" ref={containerRef}>
      {/* Selected tag chips */}
      {selected.map((slug) => (
        <span
          key={slug}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30"
        >
          {tagName(slug)}
          <button
            type="button"
            onClick={() => removeTag(slug)}
            className="hover:text-accent-foreground ml-0.5 leading-none"
            aria-label={`Remove tag ${slug}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {/* ALL / ANY toggle — shown when ≥2 chips (or always in modal) */}
      {showToggle && (
        <div className="relative group">
          <button
            type="button"
            onClick={() => onLogicChange(tagLogic === 'and' ? 'or' : 'and')}
            className="relative flex items-center w-16 h-6 rounded-full border border-foreground/20 bg-foreground/5 cursor-pointer select-none overflow-hidden"
            aria-label={`Tag match mode: ${tagLogic === 'and' ? 'ALL' : 'ANY'}`}
          >
            {/* Sliding highlight */}
            <span
              className={`absolute top-[2px] h-[calc(100%_-_4px)] w-[calc(50%_-_2px)] rounded-full bg-accent transition-all duration-200 ease-in-out ${
                tagLogic === 'or' ? 'left-[calc(50%_+_2px)]' : 'left-[2px]'
              }`}
            />
            {/* Labels */}
            <span
              className={`relative z-10 flex-1 text-center text-[10px] font-bold transition-colors ${
                tagLogic === 'and' ? 'text-white' : 'text-foreground/40'
              }`}
            >
              ALL
            </span>
            <span
              className={`relative z-10 flex-1 text-center text-[10px] font-bold transition-colors ${
                tagLogic === 'or' ? 'text-white' : 'text-foreground/40'
              }`}
            >
              ANY
            </span>
          </button>
          {/* Tooltip — 500ms hover delay via CSS */}
          <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 px-2.5 py-1.5 text-[11px] leading-snug bg-background border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 [transition-delay:0ms] group-hover:[transition-delay:500ms] z-50 text-center text-foreground/70">
            <strong className="text-foreground">ALL</strong> — results must have every selected tag
            <br />
            <strong className="text-foreground">ANY</strong> — results must have at least one
          </div>
        </div>
      )}

      {/* Tag input + dropdown */}
      <div className="relative">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-foreground/20 bg-background text-xs min-w-[130px]">
          <TagIcon className="w-3 h-3 text-foreground/40 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="bg-transparent outline-none w-full text-xs placeholder:text-foreground/30"
          />
          {input && (
            <button type="button" onClick={() => setInput('')} className="text-foreground/40 hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <ul className="absolute top-full mt-1 left-0 z-50 min-w-[160px] max-h-48 overflow-y-auto bg-background border border-border rounded-lg shadow-lg py-1">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addTag(t.slug); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-raised transition-colors flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
