'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import type { Tag } from '@/types';

export interface UnifiedSearchInputProps {
  initialTags?: string[];
  initialTagLogic?: 'and' | 'or';
  initialSearch?: string;
  placeholder?: string;
  onSearch: (tags: string[], tagLogic: 'and' | 'or', search: string) => void;
  onClear: () => void;
}

// Extract chip slugs and trailing text from the contenteditable div
function parseDiv(div: HTMLDivElement): { slugs: string[]; text: string } {
  const slugs: string[] = [];
  const textParts: string[] = [];

  div.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const slug = el.getAttribute('data-tag-slug');
      if (slug) slugs.push(slug);
    } else if (node.nodeType === Node.TEXT_NODE) {
      textParts.push(node.textContent ?? '');
    }
  });

  return { slugs, text: textParts.join('').replace(/\u200B/g, '').trim() };
}

// Build chip HTML (inline, not rendered by React — written directly into contenteditable)
function makeChipHtml(slug: string, name: string): string {
  return `<span contenteditable="false" data-tag-slug="${slug}" class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent font-medium select-none cursor-default" style="user-select:none"><span class="pointer-events-none">${name}</span><button type="button" data-remove-slug="${slug}" class="ml-0.5 text-accent/60 hover:text-accent leading-none" tabindex="-1">×</button></span>`;
}

// Rebuild the div (used on mount and on external state sync)
function rebuildDiv(div: HTMLDivElement, slugs: string[], allTags: Tag[], searchText = '') {
  div.innerHTML =
    slugs
      .map((slug) => {
        const tag = allTags.find((t) => t.slug === slug);
        return makeChipHtml(slug, tag?.name ?? slug);
      })
      .join('') + (searchText || '');
  // Place cursor at end
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(div);
  range.collapse(false);
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function UnifiedSearchInput({
  initialTags = [],
  initialTagLogic = 'and',
  initialSearch = '',
  placeholder = 'Search or filter by tag…',
  onSearch,
  onClear,
}: UnifiedSearchInputProps) {
  const { tags: allTags } = useTags();
  const divRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [chipSlugs, setChipSlugs] = useState<string[]>(initialTags);
  const [tagLogic, setTagLogic] = useState<'and' | 'or'>(initialTagLogic);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  // Committed state: what was last submitted via onSearch (null = nothing committed).
  // The button shows × only when the current input matches committed state.
  // When the user diverges from committed state, the button reverts to the magnifying glass.
  const [committed, setCommitted] = useState<{ tags: string[]; search: string } | null>(
    initialTags.length > 0 || !!initialSearch ? { tags: initialTags, search: initialSearch } : null,
  );

  // Derived: show the × (clear) button only when there IS a committed search
  // AND the current input still matches it.
  const showClear =
    committed !== null &&
    chipSlugs.join(',') === committed.tags.join(',') &&
    dropdownFilter === committed.search;

  // Track whether the div has been initialised (avoid double-rebuild on strict mode)
  const initialisedRef = useRef(false);

  // ── Mount: build initial content ──────────────────────────────────────────
  useEffect(() => {
    if (!divRef.current || !allTags.length) return;
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    rebuildDiv(divRef.current, initialTags, allTags, initialSearch);
    setChipSlugs(initialTags);
    setTagLogic(initialTagLogic);
  // allTags might not be loaded on first render; re-run when they arrive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTags]);

  // ── External state sync (URL navigation) ─────────────────────────────────
  // When the parent syncs from searchParams, we need to rebuild the div
  const prevInitialRef = useRef({ tags: initialTags, search: initialSearch, logic: initialTagLogic });
  useEffect(() => {
    const prev = prevInitialRef.current;
    const tagsChanged =
      prev.tags.join(',') !== initialTags.join(',') ||
      prev.search !== initialSearch ||
      prev.logic !== initialTagLogic;
    if (!tagsChanged) return;
    prevInitialRef.current = { tags: initialTags, search: initialSearch, logic: initialTagLogic };

    if (divRef.current && allTags.length) {
      rebuildDiv(divRef.current, initialTags, allTags, initialSearch);
    }
    setChipSlugs(initialTags);
    setTagLogic(initialTagLogic);
    setDropdownOpen(false);
    setDropdownFilter('');
    setCommitted(
      initialTags.length > 0 || !!initialSearch
        ? { tags: initialTags, search: initialSearch }
        : null,
    );
  }, [initialTags, initialSearch, initialTagLogic, allTags]);

  // ── Parse helpers ──────────────────────────────────────────────────────────
  const getCurrentState = useCallback(() => {
    if (!divRef.current) return { slugs: chipSlugs, text: '' };
    return parseDiv(divRef.current);
  }, [chipSlugs]);

  // ── Input event ───────────────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    if (!divRef.current) return;
    const { slugs, text } = parseDiv(divRef.current);
    setChipSlugs(slugs);
    setDropdownFilter(text);
    setDropdownOpen(text.length > 0 || false);
    setHighlightedIdx(0);
  }, []);

  // ── Add a tag chip ────────────────────────────────────────────────────────
  const addTag = useCallback(
    (slug: string) => {
      if (!divRef.current) return;
      const { slugs } = parseDiv(divRef.current);
      if (slugs.includes(slug)) return;
      const next = [...slugs, slug];
      rebuildDiv(divRef.current, next, allTags, '');
      setChipSlugs(next);
      setDropdownOpen(false);
      setDropdownFilter('');
      divRef.current.focus();
      // Auto-submit on chip add — same immediate-filter behaviour as TagChipStrip
      setCommitted({ tags: next, search: '' });
      onSearch(next, tagLogic, '');
    },
    [allTags, tagLogic, onSearch],
  );

  // ── Remove a tag chip ─────────────────────────────────────────────────────
  const removeTag = useCallback(
    (slug: string) => {
      if (!divRef.current) return;
      const { slugs, text } = parseDiv(divRef.current);
      const next = slugs.filter((s) => s !== slug);
      rebuildDiv(divRef.current, next, allTags, text);
      setChipSlugs(next);
      divRef.current.focus();
      // Auto-submit on chip remove — keep results in sync
      const newCommitted = next.length > 0 || !!text ? { tags: next, search: text } : null;
      setCommitted(newCommitted);
      onSearch(next, tagLogic, text);
    },
    [allTags, tagLogic, onSearch],
  );

  // ── Keydown ───────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const filtered = allTags.filter(
        (t) =>
          !chipSlugs.includes(t.slug) &&
          (dropdownFilter === '' ||
            t.name.toLowerCase().includes(dropdownFilter.toLowerCase()) ||
            t.slug.includes(dropdownFilter.toLowerCase())),
      );

      if (e.key === 'Enter') {
        e.preventDefault();
        if (dropdownOpen && filtered[highlightedIdx]) {
          addTag(filtered[highlightedIdx].slug);
        } else {
          const { slugs, text } = getCurrentState();
          setCommitted({ tags: slugs, search: text });
          onSearch(slugs, tagLogic, text);
        }
        return;
      }

      if (e.key === 'Escape') {
        setDropdownOpen(false);
        return;
      }

      if (e.key === 'ArrowDown' && dropdownOpen) {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }

      if (e.key === 'ArrowUp' && dropdownOpen) {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === 'Backspace' && !dropdownFilter) {
        // Remove last chip if cursor is at the very beginning of the text area
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.collapsed && range.startOffset <= 1) {
            // Check if the last sibling before the cursor is a chip
            const lastChip = divRef.current?.querySelector('[data-tag-slug]:last-of-type');
            if (lastChip) {
              const slug = lastChip.getAttribute('data-tag-slug');
              if (slug) {
                e.preventDefault();
                removeTag(slug);
              }
            }
          }
        }
      }
    },
    [allTags, chipSlugs, dropdownFilter, dropdownOpen, highlightedIdx, addTag, removeTag, getCurrentState, tagLogic, onSearch],
  );

  // ── Click on chip × button ────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const slug = target.closest('[data-remove-slug]')?.getAttribute('data-remove-slug');
      if (slug) {
        e.preventDefault();
        removeTag(slug);
      }
    },
    [removeTag],
  );

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search button ─────────────────────────────────────────────────────────
  const handleSearchButton = () => {
    if (showClear) {
      setCommitted(null);
      onClear();
    } else {
      const { slugs, text } = getCurrentState();
      setCommitted({ tags: slugs, search: text });
      onSearch(slugs, tagLogic, text);
    }
  };

  // ── Typeahead options ─────────────────────────────────────────────────────
  const filteredTags = allTags.filter(
    (t) =>
      !chipSlugs.includes(t.slug) &&
      (dropdownFilter === '' ||
        t.name.toLowerCase().includes(dropdownFilter.toLowerCase()) ||
        t.slug.includes(dropdownFilter.toLowerCase())),
  );

  const showToggle = chipSlugs.length >= 2;

  return (
    <div ref={containerRef} className="relative flex items-stretch gap-0">
      {/* ALL/ANY toggle — slides in from left when ≥ 2 chips */}
      <div
        className="flex items-center overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxWidth: showToggle ? '68px' : '0px', opacity: showToggle ? 1 : 0 }}
      >
        <div className="relative group mr-2 shrink-0">
          <button
            type="button"
            onClick={() => setTagLogic((l) => (l === 'and' ? 'or' : 'and'))}
            className="flex items-center w-14 h-7 rounded-full border border-foreground/20 bg-foreground/5 cursor-pointer select-none overflow-hidden"
            aria-label={`Tag match mode: ${tagLogic === 'and' ? 'ALL' : 'ANY'}`}
          >
            <span
              className={`absolute top-[2px] h-[calc(100%_-_4px)] w-[calc(50%_-_2px)] rounded-full bg-accent transition-all duration-200 ease-in-out ${
                tagLogic === 'or' ? 'left-[calc(50%_+_2px)]' : 'left-[2px]'
              }`}
            />
            <span className={`relative z-10 flex-1 text-center text-[10px] font-bold transition-colors ${tagLogic === 'and' ? 'text-white' : 'text-foreground/40'}`}>
              ALL
            </span>
            <span className={`relative z-10 flex-1 text-center text-[10px] font-bold transition-colors ${tagLogic === 'or' ? 'text-white' : 'text-foreground/40'}`}>
              ANY
            </span>
          </button>
          <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 px-2.5 py-1.5 text-[11px] leading-snug bg-background border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 [transition-delay:0ms] group-hover:[transition-delay:500ms] z-50 text-center text-foreground/70">
            <strong className="text-foreground">ALL</strong> — results must have every selected tag
            <br />
            <strong className="text-foreground">ANY</strong> — results must have at least one
          </div>
        </div>
      </div>

      {/* Input box */}
      <div className="relative flex-1 flex items-center border border-border rounded-lg bg-background px-3 py-1.5 min-w-[240px] focus-within:ring-1 focus-within:ring-accent/40 focus-within:border-accent/50 transition-colors">
        {/* The contenteditable area */}
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onFocus={() => {
            if (dropdownFilter) setDropdownOpen(true);
          }}
          className="flex-1 min-w-0 text-sm leading-6 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-foreground/30 whitespace-nowrap overflow-x-auto"
          data-placeholder={placeholder}
          aria-label="Search or filter by tag"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
        />

        {/* Search / Clear button */}
        <button
          type="button"
          onClick={handleSearchButton}
          className="ml-2 shrink-0 text-foreground/50 hover:text-foreground transition-colors"
          aria-label={showClear ? 'Clear search' : 'Search'}
        >
          {showClear ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* Typeahead dropdown */}
      {dropdownOpen && filteredTags.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto bg-background border border-border rounded-lg shadow-lg py-1"
        >
          {filteredTags.map((tag, i) => (
            <li key={tag.id} role="option" aria-selected={i === highlightedIdx}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(tag.slug);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                  i === highlightedIdx ? 'bg-accent/10 text-accent' : 'hover:bg-surface-raised'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0" />
                {tag.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
