'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

// ==========================================
// 🚀 HOOK REAL-TIME UNIFICADO
// Consolida: useRealtimeOperacoes + useOperacoes + useSmartPolling
// Redução estimada: 597 linhas → ~250 linhas (58% redução)
// ==========================================

interface UseRealtimeUnificadoParams {
  // Parâmetros de operações
  startDate: Date;
  endDate: Date;
  operacaoIds?: number[];
  
  // Parâmetros de realtime
  enabled?: boolean;
  isVisible?: boolean;
  onUpdate?: (operacaoId: number, eventType?: string) => void;
  
  // Parâmetros de polling inteligente
  activeInterval?: number;
  inactiveInterval?: number;
  focusInterval?: number;
  blurInterval?: number;
  inactivityTimeout?: number;
}

interface Operacao {
  id: number;
  data_operacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: string;
  horario?: string;
  limite_participantes: number;
  participantes_confirmados?: number;
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'NA_FILA' | 'DISPONIVEL';
    posicao_fila?: number;
  };
}

// 🔧 TIPOS INTERNOS
interface RealtimeHealthCheck {
  lastEventTime: number;
  missedEvents: number;
  connectionRetries: number;
  isHealthy: boolean;
}

// 🔧 GERADORES ÚNICOS
let instanceCounter = 0;
const healthMonitor = new Map<string, RealtimeHealthCheck>();

export const useRealtimeUnificado = ({
  startDate,
  endDate,
  operacaoIds = [],
  enabled = true,
  isVisible = true,
  onUpdate,
  activeInterval = 5000,
  inactiveInterval = 30000,
  focusInterval = 5000,
  blurInterval = 60000,
  inactivityTimeout = 60000
}: UseRealtimeUnificadoParams) => {
  
  // Hook inicializado
  
  // ==========================================
  // 🔧 ESTADOS CONSOLIDADOS
  // ==========================================
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);
  
  // ==========================================
  // 🔧 REFS CONSOLIDADOS
  // ==========================================
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isDocumentVisibleRef = useRef<boolean>(true);
  const isUserActiveRef = useRef<boolean>(true);
  
  // 🎯 ID único por instância
  const instanceIdRef = useRef<number | undefined>(undefined);
  if (instanceIdRef.current === undefined) {
    instanceIdRef.current = ++instanceCounter;
  }
  
  // ==========================================
  // 🔧 MEMOIZAÇÕES ESTÁVEIS
  // ==========================================
  const startDateStr = useMemo(() => format(startDate, 'yyyy-MM-dd'), [startDate]);
  const endDateStr = useMemo(() => format(endDate, 'yyyy-MM-dd'), [endDate]);
  
  const idsString = useMemo(() => {
    return operacaoIds.sort((a, b) => a - b).join('-');
  }, [operacaoIds.sort((a, b) => a - b).join('-')]);
  
  const channelName = useMemo(() => {
    if (operacaoIds.length === 0) return null;
    return `operacoes-unified-${instanceIdRef.current}-${idsString}`;
  }, [idsString]);

  // ==========================================
  // 🔧 SMART POLLING CONSOLIDADO
  // ==========================================
  
  // Calcular intervalo atual baseado no estado
  const getCurrentInterval = useCallback(() => {
    if (!isDocumentVisibleRef.current) return blurInterval;
    if (!isUserActiveRef.current) return inactiveInterval;
    return isDocumentVisibleRef.current ? focusInterval : activeInterval;
  }, [activeInterval, inactiveInterval, focusInterval, blurInterval]);

  // Atualizar atividade do usuário
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (!isUserActiveRef.current) {
      isUserActiveRef.current = true;
    }
  }, []);

  // ==========================================
  // 🔧 FETCH OPERAÇÕES CONSOLIDADO
  // ==========================================
  const fetchOperacoes = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const membroId = localStorage.getItem('membroId') || '1';
      
      const params = new URLSearchParams({
        startDate: startDateStr,
        endDate: endDateStr,
        membroId,
        _t: Date.now().toString()
      });

      const url = `/api/unified/operacoes?${params}`;
      
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setOperacoes(data.data || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar operações');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar com o servidor';
      setError(errorMessage);
      setOperacoes([]);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, refetchCounter]);

  // ==========================================
  // 🔧 REFETCH UNIFICADO
  // ==========================================
  const refetch = useCallback((reason: string = 'Manual') => {
    setRefetchCounter(prev => prev + 1);
  }, []);

  // ==========================================
  // 🔧 SMART POLLING SETUP
  // ==========================================
  
  // Resetar timer com novo intervalo
  const resetPollingInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!enabled) return;

    const currentInterval = getCurrentInterval();

    intervalRef.current = setInterval(() => {
      refetch('SmartPolling');
    }, currentInterval);
  }, [enabled, getCurrentInterval, refetch]);

  // ==========================================
  // 🔧 REALTIME SETUP CONSOLIDADO
  // ==========================================
  const setupRealtime = useCallback(() => {
    if (!enabled || operacaoIds.length === 0 || !channelName || !isVisible) {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          // Erro silencioso
        }
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      return;
    }

    if (isSubscribedRef.current && channelRef.current && channelRef.current.topic === `realtime:${channelName}`) {
      return;
    }

    try {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
        isSubscribedRef.current = false;
      }

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'participacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const oldData = payload.old as any;
              let operacaoId = null;
              
              if (payload.eventType === 'DELETE') {
                operacaoId = oldData?.operacao_id;
              } else {
                operacaoId = newData?.operacao_id || oldData?.operacao_id;
                
                // Detecção soft delete
                if (payload.eventType === 'UPDATE' && newData?.ativa === false && oldData?.ativa === true) {
                  if (operacaoId && operacaoIds.includes(operacaoId)) {
                    setTimeout(() => {
                      if (onUpdate) onUpdate(operacaoId, 'PARTICIPACAO_CANCELED');
                      refetch('ParticipacaoCancelada');
                    }, 50);
                    return;
                  }
                }
                
                if (operacaoId && !operacaoIds.includes(operacaoId)) {
                  return;
                }
              }
              
              if (operacaoId) {
                setTimeout(() => {
                  if (onUpdate) onUpdate(operacaoId, `PARTICIPACAO_${payload.eventType}`);
                  refetch(`Realtime_${payload.eventType}`);
                }, 50);
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'operacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const oldData = payload.old as any;
              const operacaoId = newData?.id || oldData?.id;
              
              if (operacaoId && operacaoIds.includes(operacaoId)) {
                setTimeout(() => {
                  if (onUpdate) onUpdate(operacaoId, `OPERACAO_${payload.eventType}`);
                  refetch(`Realtime_Operacao_${payload.eventType}`);
                }, 50);
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        );

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
        }
      });

      channelRef.current = channel;
      
    } catch (error) {
      // Erro silencioso
    }
  }, [enabled, operacaoIds, channelName, isVisible, onUpdate, refetch]);

  // ==========================================
  // 🔧 EFFECTS CONSOLIDADOS
  // ==========================================
  
  // Effect: Monitorar atividade do usuário
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

  // Effect: Monitorar visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      const wasVisible = isDocumentVisibleRef.current;
      isDocumentVisibleRef.current = !document.hidden;
      
      if (wasVisible !== isDocumentVisibleRef.current) {
        resetPollingInterval();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resetPollingInterval]);

  // Effect: Verificar inatividade periodicamente
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const wasActive = isUserActiveRef.current;
      isUserActiveRef.current = (now - lastActivityRef.current) < inactivityTimeout;
      
      if (wasActive !== isUserActiveRef.current) {
        resetPollingInterval();
      }
    }, 5000);

    return () => clearInterval(checkInactivity);
  }, [inactivityTimeout, resetPollingInterval]);

  // Effect: Setup realtime
  useEffect(() => {
    setupRealtime();
  }, [setupRealtime]);

  // Effect: Setup polling
  useEffect(() => {
    if (enabled) {
      resetPollingInterval();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, resetPollingInterval]);

  // Effect: Fetch inicial e refetch
  useEffect(() => {
    fetchOperacoes();
  }, [fetchOperacoes]);

  // Effect: Cleanup
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // ==========================================
  // 🔧 RETURN CONSOLIDADO
  // ==========================================
  return {
    // Estados das operações
    operacoes,
    loading,
    error,
    refetch,
    
    // Estados do sistema
    isActive: isUserActiveRef.current,
    isVisible: isDocumentVisibleRef.current,
    isConnected: isSubscribedRef.current,
    
    // Métodos utilitários
    forceExecute: () => refetch('ForceExecute'),
    reconnect: setupRealtime
  };
};

// ==========================================
// 🔧 HELPER FUNCTIONS
// ==========================================

// Trigger manual para refresh de operações específicas
export const triggerUnifiedRefresh = async (operacaoIds: number[], eventType: string = 'FORCE_REFRESH') => {
  try {
    const { data } = await supabase
      .from('operacao')
      .update({ atualizacao_forcada: new Date().toISOString() })
      .in('id', operacaoIds);
      
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}; 