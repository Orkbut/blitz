import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ 
  defaultValue, 
  value, 
  onValueChange, 
  children, 
  className 
}) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '');
  const activeValue = value ?? internalValue;

  const handleValueChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div className={cn('w-full', className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...(child.props as Record<string, any> || {}),
            value: activeValue,
            onValueChange: handleValueChange
          } as any);
        }
        return child;
      })}
    </div>
  );
};

export interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const TabsList: React.FC<TabsListProps> = ({ 
  children, 
  className, 
  value, 
  onValueChange 
}) => {
  return (
    <div className={cn('tab-container', className)}>
      <div className="flex space-x-0">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              ...(child.props as Record<string, any> || {}),
              value,
              onValueChange
            } as any);
          }
          return child;
        })}
      </div>
    </div>
  );
};

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  value, 
  children, 
  className,
  currentValue,
  onValueChange 
}) => {
  const isActive = currentValue === value;

  return (
    <button
      className={cn(
        'tab-button',
        isActive && 'tab-active',
        className
      )}
      onClick={() => onValueChange?.(value)}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
    >
      {children}
    </button>
  );
};

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  currentValue?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({ 
  value, 
  children, 
  className,
  currentValue 
}) => {
  if (currentValue !== value) return null;

  return (
    <div 
      className={cn('fade-in', className)}
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
    >
      {children}
    </div>
  );
}; 