import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface EventoOperacao {
  id: number;
  operacao_id: number;
  tipo_evento: string;
  servidor_id: number;
  servidor_nome: string;
  servidor_matricula: string;
  data_evento: string;
  detalhes: string;
  metadata: any;
  icone: string;
  cor: string;
}

interface UseRealtimeEventosProps {
  operacaoIds?: number[];
  onNovoEvento?: (evento: EventoOperacao) => void;
  enabled?: boolean;
}

export function useRealtimeEventos({
  operacaoIds = [],
  onNovoEvento,
  enabled = true
}: UseRealtimeEventosProps) {
  
  const handleEventoChange = useCallback((
    payload: RealtimePostgresChangesPayload<EventoOperacao>
  ) => {
    if (payload.eventType === 'INSERT' && payload.new) {
      const novoEvento = payload.new;
      
      // Realtime event logging removed for performance
      
      // Verificar se é uma operação que estamos monitorando
      if (operacaoIds.length === 0 || operacaoIds.includes(novoEvento.operacao_id)) {
        // Relevant event logging removed for performance
        onNovoEvento?.(novoEvento);
      }
    }
  }, [operacaoIds, onNovoEvento]);

  useEffect(() => {
    if (!enabled || operacaoIds.length === 0) {
      return;
    }

    // Realtime monitoring start logging removed for performance

    // Criar canal específico para eventos
    const channel = supabase
      .channel(`eventos-operacoes-${operacaoIds.join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'eventos_operacao',
          filter: operacaoIds.length === 1 
            ? `operacao_id=eq.${operacaoIds[0]}`
            : undefined // Sem filtro se múltiplas operações
        },
        handleEventoChange
      )
      .subscribe((status) => {
        // Subscription status logging removed for performance
      });

    return () => {
      // Monitoring end logging removed for performance
      supabase.removeChannel(channel);
    };
  }, [enabled, operacaoIds, handleEventoChange]);
}

// Hook específico para monitorar eventos de uma única operação
export function useRealtimeEventosOperacao(
  operacaoId: number | null,
  onNovoEvento?: (evento: EventoOperacao) => void
) {
  return useRealtimeEventos({
    operacaoIds: operacaoId ? [operacaoId] : [],
    onNovoEvento,
    enabled: !!operacaoId
  });
} 