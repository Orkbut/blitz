'use client';

import { useEffect, useRef, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UseRealtimeCalendarioSupervisorParams {
  operacaoIds?: number[];
  onUpdate?: (operacaoId: number, eventType?: string) => void;
  enabled?: boolean;
  isVisible?: boolean;
}

// 🔧 Hook isolado APENAS para o calendário do supervisor
export const useRealtimeCalendarioSupervisor = ({
  operacaoIds = [],
  onUpdate,
  enabled = true,
  isVisible = true
}: UseRealtimeCalendarioSupervisorParams) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  
  // 🎯 Nome único e específico para calendário supervisor
  const channelName = useMemo(() => {
    if (operacaoIds.length === 0) return null;
    const idsString = operacaoIds.sort((a, b) => a - b).join('-');
    return `calendario-supervisor-${idsString}`;
  }, [operacaoIds.sort((a, b) => a - b).join('-')]);

  useEffect(() => {
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
      return;
    }

    if (isSubscribedRef.current && channelRef.current && channelRef.current.topic === `realtime:${channelName}`) {
      return;
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

      // Criar subscription específica para calendário supervisor
      const channel = supabase
        .channel(channelName)
        // 🚀 PARTICIPAÇÕES: Foco em cancelamentos e mudanças de status
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
                
                if (payload.eventType === 'UPDATE' && newData?.ativa === false && oldData?.ativa === true) {
                  if (operacaoId && operacaoIds.includes(operacaoId)) {
                    setTimeout(() => {
                      if (onUpdate) onUpdate(operacaoId, 'PARTICIPACAO_CANCELED');
                    }, 100);
                    return;
                  }
                }
              }
              
              if (operacaoId && operacaoIds.includes(operacaoId)) {
                setTimeout(() => {
                  if (onUpdate) onUpdate(operacaoId, `PARTICIPACAO_${payload.eventType}`);
                }, 100);
              }
            } catch (error) {
              // Erro silencioso
            }
          }
        )
        // 🚀 OPERAÇÕES: Mudanças na própria operação
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
              const operacaoId = payload.eventType === 'DELETE' ? oldData?.id : newData?.id;

              if (operacaoId && operacaoIds.includes(operacaoId)) {
                setTimeout(() => {
                  if (onUpdate) onUpdate(operacaoId, `OPERACAO_${payload.eventType}`);
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
  }, [channelName, enabled, isVisible, operacaoIds.join(',')]);

  return {
    isConnected: channelRef.current?.state === 'joined',
    channelName,
    isSubscribed: isSubscribedRef.current
  };
}; 
