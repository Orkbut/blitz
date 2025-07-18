'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UseRealtimeOperacoesParams {
  operacaoIds?: number[];
  onUpdate?: (operacaoId: number, eventType?: string) => void;
  enabled?: boolean;
  forceRefreshTriggers?: boolean;
  // 🚀 NOVO: Controle de visibilidade para evitar atualizações desnecessárias
  isVisible?: boolean;
}

// 🔧 GERADOR DE ID ÚNICO (uma vez por módulo)
let instanceCounter = 0;

// 🚀 Sistema de health básico
interface RealtimeHealthCheck {
  lastEventTime: number;
  missedEvents: number;
  connectionRetries: number;
  isHealthy: boolean;
}

const healthMonitor = new Map<string, RealtimeHealthCheck>();

export const useRealtimeOperacoes = ({
  operacaoIds = [],
  onUpdate,
  enabled = true,
  forceRefreshTriggers = true,
  isVisible = true
}: UseRealtimeOperacoesParams) => {
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false); // 🚨 PREVENIR MÚLTIPLAS SUBSCRIPTIONS
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 🚀 DEBOUNCE SEGURO
  
  // 🎯 ID único POR INSTÂNCIA do hook, mas ESTÁVEL
  const instanceIdRef = useRef<number | undefined>(undefined);
  if (instanceIdRef.current === undefined) {
    instanceIdRef.current = ++instanceCounter;
  }
  
  // 🔧 Nome único POR INSTÂNCIA + IDs das operações (SUPER ESTÁVEL!)
  const idsString = useMemo(() => {
    return operacaoIds.sort((a, b) => a - b).join('-');
  }, [operacaoIds.sort((a, b) => a - b).join('-')]);
  
  const channelName = useMemo(() => {
    if (operacaoIds.length === 0) return null;
    return `operacoes-${instanceIdRef.current}-${idsString}`;
  }, [idsString]);

  // 🔧 CALLBACK ESTÁVEL removido - usando onUpdate diretamente para evitar loops

  // 🚀 NOVA FUNCIONALIDADE: Detectar operações críticas que precisam de refresh imediato
  useEffect(() => {
    if (!forceRefreshTriggers || !enabled || !onUpdate) return;

    const handleBeforeUnload = () => {
      // Limpar recursos antes de sair da página
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };

    // 🎯 POLLING INTELIGENTE: Verificar mudanças a cada 5 segundos quando ativo
    const pollInterval = setInterval(async () => {
      if (operacaoIds.length === 0) return;

      try {
        // Verificar se houve mudanças recentes nas operações monitoradas
        const { data: recentChanges } = await supabase
          .from('operacao')
          .select('id, atualizacao_forcada')
          .in('id', operacaoIds)
          .gte('updated_at', new Date(Date.now() - 10000).toISOString()); // Últimos 10 segundos

        if (recentChanges && recentChanges.length > 0) {
          recentChanges.forEach(op => {
            if (onUpdate) onUpdate(op.id, 'POLL_UPDATE');
          });
        }
      } catch (error) {
        // Erro silencioso
      }
    }, 5000);

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [idsString, enabled, forceRefreshTriggers, onUpdate]); // 🚀 DEPENDÊNCIAS ESTÁVEIS

  useEffect(() => {
    // 🚀 CONTROLE INTELIGENTE: Só conectar se habilitado, tem IDs, está visível E tem callback
    if (!enabled || operacaoIds.length === 0 || !channelName || !isVisible || !onUpdate) {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          // Erro silencioso
        }
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    if (isSubscribedRef.current && channelRef.current && channelRef.current.topic === `realtime:${channelName}`) {
      return;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          // Erro silencioso
        }
        channelRef.current = null;
        isSubscribedRef.current = false;
      }

      // Criar nova subscription com nome único e ESTÁVEL
      const channel = supabase
        .channel(channelName)
        // 🚀 PARTICIPAÇÕES: Todos os eventos - FOCO EM CANCELAMENTOS
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
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
                if (operacaoId && operacaoIds.includes(operacaoId)) {
                  // Processar DELETE físico
                } else {
                  return;
                }
              } else {
                operacaoId = newData?.operacao_id || oldData?.operacao_id;
                
                // Detecção soft delete: UPDATE com ativa=false é cancelamento
                if (payload.eventType === 'UPDATE' && newData?.ativa === false && oldData?.ativa === true) {
                  if (operacaoId && operacaoIds.includes(operacaoId)) {
                    setTimeout(() => {
                      if (onUpdate) onUpdate(operacaoId, 'PARTICIPACAO_CANCELED');
                    }, 50);
                    return;
                  }
                }
                
                // Filtrar apenas operações monitoradas
                if (operacaoId && !operacaoIds.includes(operacaoId)) {
                  return;
                }
              }
              
              if (operacaoId) {
                if (isVisible || payload.eventType === 'DELETE') {
                  setTimeout(() => {
                    if (onUpdate) onUpdate(operacaoId, `PARTICIPACAO_${payload.eventType}`);
                  }, 50);
                }
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        )
        // 🚀 OPERAÇÕES: Todos os eventos (incluindo exclusões/reativações)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'operacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const oldData = payload.old as any;
              let operacaoId = null;

              if (payload.eventType === 'DELETE') {
                operacaoId = oldData?.id;
              } else {
                operacaoId = newData?.id;
              }

              // Filtrar apenas operações monitoradas
              if (operacaoId && !operacaoIds.includes(operacaoId)) {
                return;
              }

              if (operacaoId && isVisible) {
                if (onUpdate) onUpdate(operacaoId, `OPERACAO_${payload.eventType}`);
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        )
        // 🚀 NOVA: Monitorar justificativas obrigatórias (indicam operações administrativas)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'justificativa_obrigatoria'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const contexto = newData?.contexto;
              const referenciaId = newData?.referencia_id;

              if (referenciaId && operacaoIds.includes(referenciaId) && isVisible) {
                setTimeout(() => {
                  if (onUpdate) onUpdate(referenciaId, `ADMIN_${contexto}`);
                }, 200);
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        )
        // 🚀 NOVA: Monitorar histórico de modificações
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'historico_modificacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const operacaoId = newData?.operacao_id;

              if (operacaoId && operacaoIds.includes(operacaoId) && isVisible) {
                setTimeout(() => {
                  if (onUpdate) onUpdate(operacaoId, 'HISTORICO_UPDATE');
                }, 100);
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            isSubscribedRef.current = false;
          }
        });

      channelRef.current = channel;
    } catch (error) {
      isSubscribedRef.current = false;
    }

    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          // Erro silencioso
        }
        channelRef.current = null;
      }
      isSubscribedRef.current = false;
    };
  }, [channelName, enabled, idsString, isVisible]); // 🚀 DEPENDÊNCIAS ESTÁVEIS (sem onUpdate)

  return {
    isConnected: channelRef.current?.state === 'joined',
    channelName, // Para debug
    isStable: isSubscribedRef.current // 🚀 NOVO: Indica se está estável (sem loops)
  };
};

// 🚀 NOVA FUNÇÃO: Força refresh para operações específicas após RPCs
export const triggerRealtimeRefresh = async (operacaoIds: number[], eventType: string = 'FORCE_REFRESH') => {
  try {
    // Fazer uma pequena atualização na tabela para triggar realtime
    for (const operacaoId of operacaoIds) {
      await supabase
        .from('operacao')
        .update({ 
          updated_at: new Date().toISOString(),
          // Campo específico para indicar refresh forçado
          atualizacao_forcada: new Date().toISOString()
        })
        .eq('id', operacaoId);
    }
    
  } catch (error) {
    // Erro silencioso
  }
}; 