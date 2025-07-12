import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const buttonVariants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary', 
  success: 'btn-success',
  danger: 'btn-danger'
};

const buttonSizes = {
  sm: 'text-sm px-3 py-1.5 min-h-[32px]',
  md: 'text-base px-4 py-2 min-h-[40px]',
  lg: 'text-lg px-6 py-3 min-h-[48px]'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          buttonVariants[variant],
          buttonSizes[size],
          loading && 'opacity-75 cursor-not-allowed',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <div className="loading-spinner w-4 h-4 mr-2" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button'; 