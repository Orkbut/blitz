import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'nav' | 'glass';
  hover?: boolean;
  children: React.ReactNode;
}

const cardVariants = {
  default: 'card',
  nav: 'nav-card',
  glass: 'card backdrop-blur-sm bg-white/80'
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hover = true, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants[variant],
          hover && variant === 'default' && 'hover:scale-105 transition-transform',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center mb-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('space-y-3', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent'; 