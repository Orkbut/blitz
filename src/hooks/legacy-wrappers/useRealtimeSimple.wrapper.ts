/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimeSimple
 * 
 * Mantém compatibilidade total com a interface original do useRealtimeSimple
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimeSimple
interface UseRealtimeSimpleParams {
  enabled?: boolean;
  onOperacaoChange?: (payload: any) => void;
  onParticipacaoChange?: (payload: any) => void;
  debug?: boolean;
}

// 🎯 INTERFACE DE RETORNO ORIGINAL
interface UseRealtimeSimpleReturn {
  isConnected: boolean;
  channel: any; // Original retornava o canal do Supabase
}

/**
 * 🔄 WRAPPER PARA useRealtimeSimple
 * 
 * Implementa a interface simples original usando useRealtimeUnified.
 * Foca em simplicidade e callbacks diretos para mudanças de tabela.
 */
export const useRealtimeSimple = ({
  enabled = true,
  onOperacaoChange,
  onParticipacaoChange,
  debug = false
}: UseRealtimeSimpleParams): UseRealtimeSimpleReturn => {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeSimple',
    'https://docs.projeto.com/migration/useRealtimeSimple'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimeSimple');
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: `realtime-simple-${Date.now()}`, // Nome único como no original
    tables: ['operacao', 'participacao'],
    
    // Feature flags - useRealtimeSimple era apenas realtime básico
    enableRealtime: enabled,
    enablePolling: false, // Original não tinha polling
    enableFetch: false,   // Original não fazia fetch
    
    debug
  }), [enabled, debug]);
  
  // 🎯 CALLBACK HANDLER PARA MAPEAR EVENTOS
  const handleDatabaseChange = useCallback((event: any) => {
    const { table, eventType, payload } = event;
    
    if (debug) {
      console.log(`[RealtimeSimple] Evento ${table} recebido:`, payload);
    }
    
    // Mapear eventos para callbacks específicos
    switch (table) {
      case 'operacao':
        if (onOperacaoChange) {
          // Manter formato original do payload
          onOperacaoChange({
            eventType,
            new: payload.new,
            old: payload.old,
            table,
            schema: 'public'
          });
        }
        break;
        
      case 'participacao':
        if (onParticipacaoChange) {
          // Manter formato original do payload
          onParticipacaoChange({
            eventType,
            new: payload.new,
            old: payload.old,
            table,
            schema: 'public'
          });
        }
        break;
    }
  }, [onOperacaoChange, onParticipacaoChange, debug]);
  
  // 🎯 USAR HOOK UNIFICADO
  const unifiedResult = useRealtimeUnified({
    ...unifiedConfig,
    onDatabaseChange: handleDatabaseChange
  });
  
  // 📊 LOG DE MÉTRICAS DE PERFORMANCE
  const endTime = performance.now();
  logPerformanceMetric('useRealtimeSimple', 'hookExecutionTime', endTime - startTime);
  
  // 🎯 MAPEAR RESULTADO PARA INTERFACE ORIGINAL
  const result: UseRealtimeSimpleReturn = useMemo(() => ({
    isConnected: unifiedResult.isConnected,
    channel: null // Original retornava o canal, mas não é necessário expor
  }), [unifiedResult.isConnected]);
  
  return result;
};