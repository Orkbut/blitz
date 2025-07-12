import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'confirmado' | 'pendente' | 'cancelado' | 'disponivel' | 'online';
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const statusVariants = {
  confirmado: 'status-confirmado',
  pendente: 'status-pendente', 
  cancelado: 'status-cancelado',
  disponivel: 'status-disponivel',
  online: 'status-badge bg-green-50 text-green-700 border-green-200'
};

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, icon, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'status-badge',
          statusVariants[status],
          className
        )}
        {...props}
      >
        {icon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export interface OnlineStatusProps {
  isOnline?: boolean;
  children?: React.ReactNode;
}

export const OnlineStatus: React.FC<OnlineStatusProps> = ({ 
  isOnline = true, 
  children = 'Sistema Online' 
}) => {
  return (
    <StatusBadge 
      status="online"
      icon={
        <div className={cn(
          'w-2 h-2 rounded-full',
          isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        )} />
      }
    >
      {children}
    </StatusBadge>
  );
}; 