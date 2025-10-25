'use client';

import { useEffect } from 'react';
import { usePWAState } from '@/hooks/usePWAState';
import { useNativeBackButton } from '@/hooks/useNativeBackButton';

export default function PWAStateManager() {
  const { isPWA, isRestoring } = usePWAState();
  const { hasOpenModals } = useNativeBackButton();

  // Prevenir comportamento padrão do botão voltar quando há modais
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Salvar estado antes de fechar o app
      if (isPWA) {
        // O estado já é salvo automaticamente pelo hook usePWAState
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isPWA]);

  // Adicionar classe CSS quando está restaurando estado
  useEffect(() => {
    if (isRestoring) {
      document.body.classList.add('pwa-restoring');
    } else {
      document.body.classList.remove('pwa-restoring');
    }
  }, [isRestoring]);

  // Adicionar classe CSS quando é PWA
  useEffect(() => {
    if (isPWA) {
      document.body.classList.add('is-pwa');
    } else {
      document.body.classList.remove('is-pwa');
    }
  }, [isPWA]);

  return null; // Este componente não renderiza nada visível
}