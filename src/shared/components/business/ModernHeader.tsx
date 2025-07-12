import React from 'react';
import { OnlineStatus } from '../ui';
import { cn } from '@/shared/utils/cn';

export interface ModernHeaderProps {
  title: string;
  subtitle: string;
  showDate?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const ModernHeader: React.FC<ModernHeaderProps> = ({
  title,
  subtitle,
  showDate = true,
  className,
  children
}) => {
  const currentDate = new Date().toLocaleDateString('pt-BR');
  
  return (
    <header className={cn('header', className)} role="banner">
      <div className="container">
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              {title}
            </h1>
            <p className="text-blue-100 text-lg">
              {subtitle}
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <OnlineStatus />
            
            {showDate && (
              <time 
                className="text-blue-100 font-medium"
                dateTime={new Date().toISOString()}
                aria-label={`Data atual: ${currentDate}`}
              >
                📅 {currentDate}
              </time>
            )}
            
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}; 