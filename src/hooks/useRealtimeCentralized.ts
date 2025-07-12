'use client';

import { useEffect, useRef, useCallback } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRealtimeContext } from '@/contexts/RealtimeContext';

// 🎯 INTERFACE COMPATÍVEL COM useRealtimeSimple
interface UseRealtimeCentralizedParams {
  enabled?: boolean;
  onOperacaoChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onParticipacaoChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
  debug?: boolean;
}

// 🎯 HOOK CENTRALIZADO QUE SUBSTITUI useRealtimeSimple
export const useRealtimeCentralized = ({
  enabled = true,
  onOperacaoChange,
  onParticipacaoChange,
  debug = false
}: UseRealtimeCentralizedParams) => {
  // 🔄 USAR O CONTEXTO CENTRALIZADO
  const { isConnected, connectionStatus, subscribe, unsubscribe, updateSubscription } = useRealtimeContext();
  
  // 🔄 GERAR ID ÚNICO PARA ESTA SUBSCRIPTION
  const subscriptionIdRef = useRef<string>(`subscription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  
  // 🔄 REFS PARA CALLBACKS (evitar re-subscriptions)
  const onOperacaoChangeRef = useRef(onOperacaoChange);
  const onParticipacaoChangeRef = useRef(onParticipacaoChange);
  
  // 🔄 MANTER CALLBACKS ATUALIZADOS
  onOperacaoChangeRef.current = onOperacaoChange;
  onParticipacaoChangeRef.current = onParticipacaoChange;
  
  // 🎯 CRIAR SUBSCRIPTION ESTÁVEL
  const createSubscription = useCallback(() => {
    return {
      id: subscriptionIdRef.current,
      enabled,
      debug,
      onOperacaoChange: onOperacaoChangeRef.current,
      onParticipacaoChange: onParticipacaoChangeRef.current
    };
  }, [enabled, debug]);

  // 🎯 EFEITO PRINCIPAL: GERENCIAR SUBSCRIPTION
  useEffect(() => {
    if (!enabled) {
      // Se desabilitado, remover subscription
      unsubscribe(subscriptionIdRef.current);
      return;
    }

    // 🔄 REGISTRAR/ATUALIZAR SUBSCRIPTION
    const subscription = createSubscription();
    subscribe(subscription);

    // 🧹 CLEANUP: Remover subscription quando componente desmontar
    return () => {
      unsubscribe(subscriptionIdRef.current);
    };
  }, [enabled, debug, subscribe, unsubscribe, createSubscription]);

  // 🎯 ATUALIZAR CALLBACKS SEM RECRIAR SUBSCRIPTION
  useEffect(() => {
    if (enabled) {
      updateSubscription(subscriptionIdRef.current, {
        onOperacaoChange: onOperacaoChangeRef.current,
        onParticipacaoChange: onParticipacaoChangeRef.current
      });
    }
  }, [onOperacaoChange, onParticipacaoChange, enabled, updateSubscription]);

  // 🎯 RETORNAR MESMA INTERFACE DO useRealtimeSimple
  return {
    isConnected,
    connectionStatus,
    channel: null // Não exposamos o canal interno (abstração)
  };
};

// 🎯 EXPORT ALTERNATIVO PARA COMPATIBILIDADE
export const useRealtimeSimple = useRealtimeCentralized; 