'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ViewMode = 'infinite' | 'paginated';

const STORAGE_KEY = 'aecms_view_mode';

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue>({
  mode: 'infinite',
  setMode: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>('infinite');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'paginated' || stored === 'infinite') {
      setModeState(stored);
    }
  }, []);

  const setMode = (next: ViewMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ViewModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
