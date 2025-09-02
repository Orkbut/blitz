'use client';

import { useEffect, useState } from 'react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Verificar status inicial
    setIsOnline(navigator.onLine);

    // Listeners para mudanças de conectividade
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Só mostrar se realmente estiver offline
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-50 shadow-lg">
      <div className="flex items-center justify-center gap-3 px-4">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
        </svg>
        <span className="text-sm font-medium">
          Sem conexão - Sistema requer internet
        </span>
        <button
          onClick={() => window.location.reload()}
          className="bg-white text-red-600 px-2 py-1 rounded text-xs hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          Reconectar
        </button>
      </div>
    </div>
  );
}