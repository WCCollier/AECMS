'use client';

import { useWidgetSize } from '@/contexts/WidgetSizeContext';

interface RichTextBoxProps {
  children: React.ReactNode;
  charCount?: number;
  className?: string;
}

export function RichTextBox({ children, charCount = 0, className = '' }: RichTextBoxProps) {
  const size = useWidgetSize();
  const showWarning = size === 'small' && charCount > 300;

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {children}
      {showWarning && (
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 not-prose">
          Long content may be hard to read in this display area.
        </p>
      )}
    </div>
  );
}
