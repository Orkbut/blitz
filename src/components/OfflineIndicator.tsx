'use client';

import { usePWA } from '@/hooks/usePWA';
import { getSupervisorData } from '@/lib/auth-utils';
import { useEffect, useState } from 'react';

export default function OfflineIndicator() {
  const { isOnline } = usePWA();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar se está logado
    const supervisorData = getSupervisorData();
    const membroAuth = localStorage.getItem('membroAuth');
    setIsAuthenticated(!!(supervisorData || membroAuth));
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-3 z-50">
      <div className="flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div>
          {isAuthenticated ? (
            <div>
              <strong>Sistema requer conexão com a internet</strong>
              <div className="text-sm">Este sistema de agendamento não funciona offline</div>
            </div>
          ) : (
            <div>Você está offline - Conecte-se para fazer login</div>
          )}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="ml-4 bg-white text-red-600 px-3 py-1 rounded text-sm hover:bg-gray-100"
        >
          Reconectar
        </button>
      </div>
    </div>
  );
}