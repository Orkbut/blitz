'use client';

/**
 * 🎯 SMART POLLING SYSTEM
 * 
 * Sistema de polling inteligente que adapta intervalos baseado na atividade do usuário
 * e visibilidade da página. Integra com o hook unificado para fornecer fallback robusto.
 */

export interface SmartPollingConfig {
  // Intervalos em milissegundos
  activeInterval?: number;    // Quando usuário está ativo (default: 5000ms)
  inactiveInterval?: number;  // Quando usuário está inativo (default: 30000ms)
  focusInterval?: number;     // Quando aba está em foco (default: 5000ms)
  blurInterval?: number;      // Quando aba está em background (default: 60000ms)
  
  // Configurações
  enabled?: boolean;          // Se polling está habilitado (default: true)
  executeOnStart?: boolean;   // Se deve executar callback imediatamente (default: true)
  executeOnFocus?: boolean;   // Se deve executar quando aba ganha foco (default: true)
  
  // Timeout para considerar usuário inativo
  inactivityTimeout?: number; // Default: 60000ms (1 minuto)
  
  // Debug
  debug?: boolean;
}

export interface SmartPollingState {
  isRunning: boolean;
  isUserActive: boolean;
  isDocumentVisible: boolean;
  currentInterval: number;
  lastExecutionTime: number | null;
  executionCount: number;
}

export type PollingCallback = () => void | Promise<void>;

/**
 * Hook para polling inteligente com intervalos adaptativos
 */
export function useSmartPolling(
  callback: PollingCallback,
  config: SmartPollingConfig = {}
) {
  const {
    activeInterval = 5000,
    inactiveInterval = 30000,
    focusInterval = 5000,
    blurInterval = 60000,
    enabled = true,
    executeOnStart = true,
    executeOnFocus = true,
    inactivityTimeout = 60000,
    debug = false
  } = config;

  // Estado do polling
  const [state, setState] = React.useState<SmartPollingState>({
    isRunning: false,
    isUserActive: true,
    isDocumentVisible: !document.hidden,
    currentInterval: focusInterval,
    lastExecutionTime: null,
    executionCount: 0
  });

  // Refs para timers e cleanup
  const pollingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = React.useRef<number>(Date.now());
  const callbackRef = React.useRef(callback);

  // Atualizar callback ref
  callbackRef.current = callback;

  // Calcular intervalo atual baseado no estado
  const calculateCurrentInterval = React.useCallback(() => {
    if (!state.isDocumentVisible) {
      return blurInterval;
    }
    if (!state.isUserActive) {
      return inactiveInterval;
    }
    return state.isDocumentVisible ? focusInterval : activeInterval;
  }, [state.isDocumentVisible, state.isUserActive, activeInterval, inactiveInterval, focusInterval, blurInterval]);

  // Executar callback com tratamento de erro
  const executeCallback = React.useCallback(async (reason: string = 'timer') => {
    try {
      const now = Date.now();
      
      setState(prev => ({
        ...prev,
        lastExecutionTime: now,
        executionCount: prev.executionCount + 1
      }));

      if (debug) {
        console.log('[SmartPolling] Executing callback:', {
          reason,
          currentInterval: state.currentInterval,
          timestamp: new Date(now).toISOString()
        });
      }

      await callbackRef.current();
    } catch (error) {
      console.error('[SmartPolling] Error executing callback:', error);
    }
  }, [debug, state.currentInterval]);

  // Atualizar atividade do usuário
  const updateActivity = React.useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    
    setState(prev => {
      if (!prev.isUserActive) {
        return { ...prev, isUserActive: true };
      }
      return prev;
    });
  }, []);

  // Verificar inatividade
  const checkInactivity = React.useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTimeRef.current;
    const isInactive = timeSinceLastActivity > inactivityTimeout;
    
    setState(prev => {
      if (prev.isUserActive && isInactive) {
        if (debug) {
          console.log('[SmartPolling] User became inactive');
        }
        return { ...prev, isUserActive: false };
      }
      return prev;
    });
  }, [inactivityTimeout, debug]);

  // Reiniciar timer com novo intervalo
  const restartTimer = React.useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    if (!enabled || !state.isRunning) {
      return;
    }

    const currentInterval = calculateCurrentInterval();
    
    setState(prev => ({ ...prev, currentInterval }));

    pollingTimerRef.current = setInterval(() => {
      executeCallback('timer');
    }, currentInterval);

    if (debug) {
      console.log('[SmartPolling] Timer restarted with interval:', currentInterval);
    }
  }, [enabled, state.isRunning, calculateCurrentInterval, executeCallback, debug]);

  // Setup de listeners de atividade
  React.useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [enabled, updateActivity]);

  // Setup de listener de visibilidade
  React.useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      const wasVisible = state.isDocumentVisible;
      
      setState(prev => ({ ...prev, isDocumentVisible: isVisible }));

      if (debug) {
        console.log('[SmartPolling] Visibility changed:', { isVisible });
      }

      // Executar callback quando ganha foco
      if (isVisible && !wasVisible && executeOnFocus && state.isRunning) {
        executeCallback('focus_gained');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, executeOnFocus, state.isDocumentVisible, state.isRunning, executeCallback, debug]);

  // Timer de verificação de inatividade
  React.useEffect(() => {
    if (!enabled) return;

    inactivityTimerRef.current = setInterval(checkInactivity, 5000);

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [enabled, checkInactivity]);

  // Reiniciar timer quando estado muda
  React.useEffect(() => {
    if (state.isRunning) {
      restartTimer();
    }
  }, [state.isUserActive, state.isDocumentVisible, restartTimer]);

  // Iniciar polling
  const start = React.useCallback(() => {
    if (state.isRunning || !enabled) return;

    setState(prev => ({ ...prev, isRunning: true }));

    if (executeOnStart) {
      executeCallback('start');
    }

    if (debug) {
      console.log('[SmartPolling] Started');
    }
  }, [state.isRunning, enabled, executeOnStart, executeCallback, debug]);

  // Parar polling
  const stop = React.useCallback(() => {
    if (!state.isRunning) return;

    setState(prev => ({ ...prev, isRunning: false }));

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    if (debug) {
      console.log('[SmartPolling] Stopped');
    }
  }, [state.isRunning, debug]);

  // Executar forçadamente
  const forceExecute = React.useCallback(() => {
    if (!state.isRunning) return;
    
    executeCallback('force_execute');
    restartTimer();
  }, [state.isRunning, executeCallback, restartTimer]);

  // Cleanup ao desmontar
  React.useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, []);

  return {
    // Estado
    ...state,
    
    // Ações
    start,
    stop,
    forceExecute,
    
    // Utilitários
    updateActivity
  };
}

// Importar React se não estiver disponível
import * as React from 'react';