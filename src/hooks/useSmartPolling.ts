import { useEffect, useRef, useCallback } from 'react';

interface UseSmartPollingOptions {
  callback: () => void | Promise<void>;
  enabled?: boolean;
  // Intervalos em ms
  activeInterval?: number; // Quando usuário está ativo
  inactiveInterval?: number; // Quando usuário está inativo
  focusInterval?: number; // Quando está com foco na aba
  blurInterval?: number; // Quando aba está em background
  // Tempo para considerar usuário inativo (ms)
  inactivityTimeout?: number;
}

export const useSmartPolling = ({
  callback,
  enabled = true,
  activeInterval = 5000, // 5s quando ativo
  inactiveInterval = 30000, // 30s quando inativo
  focusInterval = 5000, // 5s quando tab está em foco
  blurInterval = 60000, // 60s quando tab está em background
  inactivityTimeout = 60000 // 1 minuto para considerar inativo
}: UseSmartPollingOptions) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isDocumentVisibleRef = useRef<boolean>(true);
  const isUserActiveRef = useRef<boolean>(true);

  // Calcular intervalo atual baseado no estado
  const getCurrentInterval = useCallback(() => {
    // Se tab não está visível, usar intervalo maior
    if (!isDocumentVisibleRef.current) {
      return blurInterval;
    }

    // Se usuário está inativo, usar intervalo maior
    if (!isUserActiveRef.current) {
      return inactiveInterval;
    }

    // Se tab está visível e usuário ativo, usar intervalo menor
    return isDocumentVisibleRef.current ? focusInterval : activeInterval;
  }, [activeInterval, inactiveInterval, focusInterval, blurInterval]);

  // Resetar timer com novo intervalo
  const resetInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!enabled) return;

    const currentInterval = getCurrentInterval();

    // Executar callback imediatamente se mudou para estado ativo
    if (currentInterval <= activeInterval) {
      callback();
    }

    intervalRef.current = setInterval(() => {
      callback();
    }, currentInterval);
  }, [callback, enabled, getCurrentInterval, activeInterval]);

  // Atualizar atividade do usuário
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    // Se estava inativo e voltou a ser ativo
    if (!isUserActiveRef.current) {
      isUserActiveRef.current = true;
      resetInterval();
    }
  }, [resetInterval]);

  // Verificar inatividade periodicamente
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const wasActive = isUserActiveRef.current;
      isUserActiveRef.current = (now - lastActivityRef.current) < inactivityTimeout;
      
      // Se mudou o estado de atividade
      if (wasActive !== isUserActiveRef.current) {
        resetInterval();
      }
    }, 5000); // Verificar a cada 5s

    return () => clearInterval(checkInactivity);
  }, [inactivityTimeout, resetInterval]);

  // Monitorar atividade do usuário
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Monitorar visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isDocumentVisibleRef.current;
      isDocumentVisibleRef.current = !document.hidden;
      
      if (wasVisible !== isDocumentVisibleRef.current) {
        resetInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetInterval]);

  // Iniciar polling
  useEffect(() => {
    if (enabled) {
      resetInterval();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, resetInterval]);

  // Forçar execução manual
  const forceExecute = useCallback(() => {
    callback();
    resetInterval(); // Resetar timer para evitar execução duplicada
  }, [callback, resetInterval]);

  return {
    forceExecute,
    isActive: isUserActiveRef.current,
    isVisible: isDocumentVisibleRef.current
  };
}; 