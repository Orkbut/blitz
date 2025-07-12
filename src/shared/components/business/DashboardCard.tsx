import React from 'react';
import { Card, CardHeader, CardContent } from '../ui';
import { cn } from '@/shared/utils/cn';

export interface DashboardCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconBgColor: string;
  progressValue?: number;
  progressColor?: string;
  className?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  iconBgColor,
  progressValue = 75,
  progressColor = 'bg-primary-500',
  className
}) => {
  return (
    <Card hover className={className}>
      <CardHeader>
        <div className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center mr-4',
          iconBgColor
        )}>
          <span className="h-6 w-6 flex items-center justify-center" aria-hidden="true">
            {icon}
          </span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
          <p className="text-3xl font-bold text-primary-600">{value}</p>
        </div>
      </CardHeader>
      
      <div className="h-1 bg-primary-100 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all duration-500', progressColor)}
          style={{ width: `${progressValue}%` }}
          role="progressbar"
          aria-valuenow={progressValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title}: ${progressValue}%`}
        />
      </div>
    </Card>
  );
}; 