'use client';

import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useWidgetSize } from '@/contexts/WidgetSizeContext';

export type CalloutType = 'info' | 'warning' | 'success' | 'danger';

interface CalloutProps {
  type?: CalloutType;
  children: React.ReactNode;
  summary?: string;
  className?: string;
}

const CALLOUT_CONFIG: Record<CalloutType, {
  Icon: React.ComponentType<{ className?: string }>;
  border: string;
  bg: string;
  accentBorder: string;
}> = {
  info:    { Icon: Info,          border: 'border-blue-500/40',   bg: 'bg-blue-500/10',   accentBorder: 'border-l-blue-500' },
  warning: { Icon: AlertTriangle, border: 'border-yellow-500/40', bg: 'bg-yellow-500/10', accentBorder: 'border-l-yellow-500' },
  success: { Icon: CheckCircle,   border: 'border-green-500/40',  bg: 'bg-green-500/10',  accentBorder: 'border-l-green-500' },
  danger:  { Icon: XCircle,       border: 'border-red-500/40',    bg: 'bg-red-500/10',    accentBorder: 'border-l-red-500' },
};

export function Callout({ type = 'info', children, summary = '', className = '' }: CalloutProps) {
  const size = useWidgetSize();
  const { Icon, border, bg, accentBorder } = CALLOUT_CONFIG[type];

  if (size === 'small') {
    const previewText = summary || '';
    const truncated = previewText.length > 80 ? previewText.slice(0, 80) + '…' : previewText;
    return (
      <div className={`flex items-center gap-2 py-1.5 px-3 border-l-4 ${accentBorder} text-sm my-2 ${className}`}>
        <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
        <span className="truncate text-foreground/80">{truncated}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 p-4 rounded-lg border ${border} ${bg} my-4 ${className}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
