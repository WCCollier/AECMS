'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ViewModeProvider>
        {children}
      </ViewModeProvider>
    </AuthProvider>
  );
}
