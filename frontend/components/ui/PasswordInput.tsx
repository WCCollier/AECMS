'use client';

import { forwardRef, useState } from 'react';
import { Input, type InputProps } from './Input';

interface PasswordInputProps extends Omit<InputProps, 'type'> {
  showToggle?: boolean;
}

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showToggle = true, className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    if (!showToggle) {
      return <Input ref={ref} type="password" className={className} {...props} />;
    }

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={`pr-10 ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors focus:outline-none"
          style={{ marginTop: props.label ? '12px' : undefined }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
export type { PasswordInputProps };
