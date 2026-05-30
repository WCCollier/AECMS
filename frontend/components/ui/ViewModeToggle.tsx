'use client';

import { useViewMode } from '@/contexts/ViewModeContext';
import { LayoutList, Infinity as InfinityIcon } from 'lucide-react';

export function ViewModeToggle() {
  const { mode, setMode } = useViewMode();
  const isInfinite = mode === 'infinite';

  return (
    <div className="flex items-center text-sm text-foreground/60 border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setMode('paginated')}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-r border-border ${
          !isInfinite ? 'text-foreground bg-foreground/10' : 'hover:text-foreground hover:bg-foreground/5'
        }`}
        title="Paginated view"
        aria-pressed={!isInfinite}
      >
        <LayoutList className="w-4 h-4" />
        <span className="hidden sm:inline">Pages</span>
      </button>

      <button
        onClick={() => setMode('infinite')}
        className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
          isInfinite ? 'text-foreground bg-foreground/10' : 'hover:text-foreground hover:bg-foreground/5'
        }`}
        title="Infinite scroll"
        aria-pressed={isInfinite}
      >
        <InfinityIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Scroll</span>
      </button>
    </div>
  );
}
