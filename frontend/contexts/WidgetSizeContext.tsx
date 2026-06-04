'use client';

import React from 'react';

export type WidgetSize = 'large' | 'small';

export const WidgetSizeContext = React.createContext<WidgetSize>('large');

export function WidgetSizeProvider({
  size,
  children,
}: {
  size: WidgetSize;
  children: React.ReactNode;
}) {
  return (
    <WidgetSizeContext.Provider value={size}>
      {children}
    </WidgetSizeContext.Provider>
  );
}

export function useWidgetSize(): WidgetSize {
  return React.useContext(WidgetSizeContext);
}
