'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface PWAStateData {
  lastPath: string;
  lastVisitedMonth?: string;
  lastVisitedDate?: string;
  userType?: 'membro' | 'supervisor' | 'admin';
  timestamp: number;
}

const PWA_STATE_KEY = 'pwa-state-persistence';
const STATE_EXPIRY_HOURS = 24; // Estado expira em 24 horas

export function usePWAState() {
  const router = useRouter();
  const pathname = usePathname();
  const [isRestoring, setIsRestoring] = useState(false);

  // Salvar estado atual
  const saveCurrentState = useCallback((additionalData?: Partial<PWAStateData>) => {
    if (typeof window === 'undefined') return;
    
    try {
      const stateData: PWAStateData = {
        lastPath: pathname,
        timestamp: Date.now(),
        ...additionalData
      };

      localStorage.setItem(PWA_STATE_KEY, JSON.stringify(stateData));
    } catch (error) {
      console.warn('Erro ao salvar estado PWA:', error);
    }
  }, [pathname]);

  // Restaurar estado salvo
  const restoreLastState = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const savedState = localStorage.getItem(PWA_STATE_KEY);
      if (!savedState) return false;

      const stateData: PWAStateData = JSON.parse(savedState);
      
      // Verificar se o estado não expirou
      const hoursElapsed = (Date.now() - stateData.timestamp) / (1000 * 60 * 60);
      if (hoursElapsed > STATE_EXPIRY_HOURS) {
        localStorage.removeItem(PWA_STATE_KEY);
        return false;
      }

      // Não restaurar se já estamos na página correta
      if (pathname === stateData.lastPath) {
        return false;
      }

      // Não restaurar se estamos na página inicial
      if (pathname === '/') {
        setIsRestoring(true);
        router.push(stateData.lastPath);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Erro ao restaurar estado PWA:', error);
      localStorage.removeItem(PWA_STATE_KEY);
      return false;
    }
  }, [pathname, router]);

  // Salvar mês visitado no calendário
  const saveVisitedMonth = useCallback((month: string) => {
    saveCurrentState({ lastVisitedMonth: month });
  }, [saveCurrentState]);

  // Salvar data visitada
  const saveVisitedDate = useCallback((date: string) => {
    saveCurrentState({ lastVisitedDate: date });
  }, [saveCurrentState]);

  // Salvar tipo de usuário
  const saveUserType = useCallback((userType: 'membro' | 'supervisor' | 'admin') => {
    saveCurrentState({ userType });
  }, [saveCurrentState]);

  // Obter estado salvo
  const getSavedState = useCallback((): PWAStateData | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const savedState = localStorage.getItem(PWA_STATE_KEY);
      if (!savedState) return null;

      const stateData: PWAStateData = JSON.parse(savedState);
      
      // Verificar se não expirou
      const hoursElapsed = (Date.now() - stateData.timestamp) / (1000 * 60 * 60);
      if (hoursElapsed > STATE_EXPIRY_HOURS) {
        localStorage.removeItem(PWA_STATE_KEY);
        return null;
      }

      return stateData;
    } catch (error) {
      console.warn('Erro ao obter estado salvo:', error);
      return null;
    }
  }, []);

  // Limpar estado
  const clearState = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PWA_STATE_KEY);
  }, []);

  // Verificar se é PWA
  const isPWA = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }, []);

  // Auto-salvar estado quando a rota muda
  useEffect(() => {
    if (!isRestoring) {
      saveCurrentState();
    }
  }, [pathname, saveCurrentState, isRestoring]);

  // Tentar restaurar estado na inicialização (apenas para PWA)
  useEffect(() => {
    if (isPWA() && pathname === '/') {
      const restored = restoreLastState();
      if (!restored) {
        setIsRestoring(false);
      }
    } else {
      setIsRestoring(false);
    }
  }, [pathname, isPWA, restoreLastState]);

  return {
    saveCurrentState,
    restoreLastState,
    saveVisitedMonth,
    saveVisitedDate,
    saveUserType,
    getSavedState,
    clearState,
    isPWA: isPWA(),
    isRestoring
  };
}