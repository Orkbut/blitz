/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimeCentralized
 * 
 * Mantém compatibilidade total com a interface original do useRealtimeCentralized
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimeCentralized
interface UseRealtimeCentralizedParams {
  enabled?: boolean;
  onOperacaoChange?: (payload: any) => void;
  onParticipacaoChange?: (payload: any) => void;
  debug?: boolean;
}

// 🎯 INTERFACE DE RETORNO ORIGINAL
interface UseRealtimeCentralizedReturn {
  isConnected: boolean;
  connectionStatus: string;
  channel: any; // Original retornava null (abstração)
}

/**
 * 🔄 WRAPPER PARA useRealtimeCentralized
 * 
 * Implementa a interface centralizada original usando useRealtimeUnified.
 * O hook original era uma abstração sobre useRealtimeSimple com contexto.
 */
export const useRealtimeCentralized = ({
  enabled = true,
  onOperacaoChange,
  onParticipacaoChange,
  debug = false
}: UseRealtimeCentralizedParams): UseRealtimeCentralizedReturn => {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeCentralized',
    'https://docs.projeto.com/migration/useRealtimeCentralized'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimeCentralized');
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: `centralized-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    tables: ['operacao', 'participacao'],
    
    // Feature flags - useRealtimeCentralized era baseado em contexto
    enableRealtime: enabled,
    enablePolling: false, // Original não tinha polling próprio
    enableFetch: false,   // Original não fazia fetch
    
    debug
  }), [enabled, debug]);
  
  // 🎯 CALLBACK HANDLER PARA MAPEAR EVENTOS
  const handleDatabaseChange = useCallback((event: any) => {
    const { table, eventType, payload } = event;
    
    if (debug) {
      console.log(`[RealtimeCentralized] Evento ${table} recebido:`, payload);
    }
    
    // Mapear eventos para callbacks específicos (formato original)
    switch (table) {
      case 'operacao':
        if (onOperacaoChange) {
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
  logPerformanceMetric('useRealtimeCentralized', 'hookExecutionTime', endTime - startTime);
  
  // 🎯 MAPEAR RESULTADO PARA INTERFACE ORIGINAL
  const result: UseRealtimeCentralizedReturn = useMemo(() => ({
    isConnected: unifiedResult.isConnected,
    connectionStatus: unifiedResult.connectionStatus,
    channel: null // Original não expunha o canal (abstração)
  }), [unifiedResult.isConnected, unifiedResult.connectionStatus]);
  
  return result;
};

/**
 * 🔄 EXPORT ALTERNATIVO PARA COMPATIBILIDADE
 * 
 * O hook original também era exportado como useRealtimeSimple
 */
export const useRealtimeSimpleAlternative = useRealtimeCentralized;