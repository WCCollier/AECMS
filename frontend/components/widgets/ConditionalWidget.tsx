'use client';

import { useAuth } from '@/contexts/AuthContext';

export type ShowWhen = 'always' | 'logged_in' | 'logged_out';

interface ConditionalWidgetProps {
  showWhen?: ShowWhen;
  children: React.ReactNode;
}

export function ConditionalWidget({ showWhen = 'always', children }: ConditionalWidgetProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Hold until auth context resolves — prevents flash
  if (isLoading) return null;
  if (showWhen === 'logged_in'  && !isAuthenticated) return null;
  if (showWhen === 'logged_out' &&  isAuthenticated) return null;
  return <>{children}</>;
}
