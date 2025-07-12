import React from 'react';
import { cn } from '@/shared/utils/cn';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'gray' | 'white';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'blue',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  };

  const colorClasses = {
    blue: 'border-blue-200 border-t-blue-600',
    gray: 'border-gray-200 border-t-gray-600',
    white: 'border-white/20 border-t-white'
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full animate-spin ${className}`}
      style={{
        animation: 'spin 1s linear infinite'
      }}
    />
  );
};

export interface LoadingPageProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
}

// Componente de Loading de Página Completa Elegante
export const ElegantPageLoader: React.FC<LoadingPageProps> = ({
  title = "Sistema RADAR",
  subtitle = "Carregando...",
  showLogo = true
}) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 197, 253, 0.08) 50%, rgba(236, 254, 255, 0.1) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: 'var(--font-montserrat), system-ui, sans-serif'
      }}
    >
      {/* Container do Loading */}
      <div 
        className="bg-white rounded-2xl p-10 flex flex-col items-center gap-6 min-w-[280px] transform"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fafbff 100%)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(229, 231, 235, 0.6)',
          animation: 'fadeInScale 0.6s ease-out'
        }}
      >
        {/* Logo/Ícone */}
        {showLogo && (
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
              animation: 'pulse 2s infinite'
            }}
          >
            <span className="text-2xl text-white font-bold">🚔</span>
          </div>
        )}

        {/* Spinner Elegante */}
        <div 
          className="w-10 h-10 rounded-full"
          style={{
            border: '3px solid rgba(59, 130, 246, 0.1)',
            borderTop: '3px solid #3b82f6',
            animation: 'spin 1s linear infinite'
          }}
        />

        {/* Texto */}
        <div className="text-center">
          <h3 
            className="text-lg font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            {title}
          </h3>
          <p className="text-sm text-gray-600 font-medium">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Estilos CSS para animações */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

// Componente de Loading Inline Elegante
export const ElegantInlineLoader: React.FC<{ message?: string }> = ({ 
  message = "Carregando..." 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div 
        className="w-8 h-8 rounded-full"
        style={{
          border: '2px solid rgba(59, 130, 246, 0.1)',
          borderTop: '2px solid #3b82f6',
          animation: 'spin 1s linear infinite'
        }}
      />
      <p className="text-sm text-gray-600 font-medium">{message}</p>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}; 