import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className,
  cols = { default: 1, md: 2, lg: 4 }
}) => {
  const gridClasses = cn(
    'responsive-grid',
    // Grid columns baseado nas props
    cols.default === 1 && 'grid-cols-1',
    cols.default === 2 && 'grid-cols-2',
    cols.default === 3 && 'grid-cols-3',
    cols.default === 4 && 'grid-cols-4',
    
    // Breakpoints médios
    cols.md === 1 && 'md:grid-cols-1',
    cols.md === 2 && 'md:grid-cols-2',
    cols.md === 3 && 'md:grid-cols-3',
    cols.md === 4 && 'md:grid-cols-4',
    
    // Breakpoints grandes
    cols.lg === 1 && 'lg:grid-cols-1',
    cols.lg === 2 && 'lg:grid-cols-2',
    cols.lg === 3 && 'lg:grid-cols-3',
    cols.lg === 4 && 'lg:grid-cols-4',
    
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

export interface SectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  className
}) => {
  return (
    <section className={cn('mb-12', className)} aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h2 
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className="text-2xl font-bold text-gray-800 mb-6 flex items-center"
      >
        {icon && (
          <span className="h-7 w-7 mr-3 text-primary-600 flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        )}
        {title}
      </h2>
      
      {subtitle && (
        <p className="text-gray-600 mb-6 -mt-2">
          {subtitle}
        </p>
      )}
      
      {children}
    </section>
  );
}; 