'use client';

import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export type CalloutType = 'info' | 'warning' | 'success' | 'danger';

interface CalloutProps {
  type?: CalloutType;
  children: React.ReactNode;
  className?: string;
}

const CALLOUT_CONFIG: Record<CalloutType, {
  Icon: React.ComponentType<{ className?: string }>;
  border: string;
  bg: string;
}> = {
  info:    { Icon: Info,          border: 'border-blue-500/40',   bg: 'bg-blue-500/10' },
  warning: { Icon: AlertTriangle, border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' },
  success: { Icon: CheckCircle,   border: 'border-green-500/40',  bg: 'bg-green-500/10' },
  danger:  { Icon: XCircle,       border: 'border-red-500/40',    bg: 'bg-red-500/10' },
};

export function Callout({ type = 'info', children, className = '' }: CalloutProps) {
  const { Icon, border, bg } = CALLOUT_CONFIG[type];
  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${border} ${bg} my-4 ${className}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
