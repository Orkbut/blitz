/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimePuro
 * 
 * Mantém compatibilidade total com a interface original do useRealtimePuro
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimePuro
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

interface UseRealtimePuroParams {
  operacaoIds: number[];
  enabled?: boolean;
  onUpdate?: (operacaoId: number, eventType: string) => void;
  onDataChange?: () => void;
  onNovoEvento?: (evento: EventoOperacao) => void;
}

// 🎯 INTERFACE DE RETORNO ORIGINAL
interface UseRealtimePuroReturn {
  isConnected: boolean;
  debugInfo: string;
  reconnect: () => void;
}

/**
 * 🔄 WRAPPER PARA useRealtimePuro
 * 
 * Implementa a interface "ultra-estável" original usando useRealtimeUnified.
 * Foca em zero re-renders e máxima estabilidade.
 */
export const useRealtimePuro = ({
  operacaoIds = [],
  enabled = true,
  onUpdate,
  onDataChange,
  onNovoEvento
}: UseRealtimePuroParams): UseRealtimePuroReturn => {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimePuro',
    'https://docs.projeto.com/migration/useRealtimePuro'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimePuro');
  
  // 🔧 GERAR CHANNEL ID ESTÁVEL (baseado no comportamento original)
  const operacaoIdsString = useMemo(() => {
    const sorted = [...operacaoIds].sort((a, b) => a - b);
    return sorted.join(',');
  }, [operacaoIds]);
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: `ultra-puro-${operacaoIdsString}`,
    tables: ['participacao', 'operacao', 'eventos_operacao'],
    
    // Filtros baseados nos IDs das operações
    filters: operacaoIds.length > 0 ? {
      operacao: `id.in.(${operacaoIds.join(',')})`,
      participacao: `operacao_id.in.(${operacaoIds.join(',')})`,
      eventos_operacao: `operacao_id.in.(${operacaoIds.join(',')})`
    } : undefined,
    
    // Feature flags - useRealtimePuro era focado apenas em realtime
    enableRealtime: enabled && operacaoIds.length > 0,
    enablePolling: false, // Original não tinha polling
    enableFetch: false,   // Original não fazia fetch
    
    debug: process.env.NODE_ENV === 'development'
  }), [operacaoIdsString, enabled, operacaoIds]);
  
  // 🎯 CALLBACK HANDLER ULTRA-ESTÁVEL
  const handleDatabaseChange = useCallback((event: any) => {
    const { table, eventType, payload } = event;
    
    try {
      switch (table) {
        case 'participacao': {
          const newData = payload.new;
          const oldData = payload.old;
          let operacaoId = null;
          
          if (eventType === 'DELETE') {
            operacaoId = oldData?.operacao_id;
          } else {
            operacaoId = newData?.operacao_id || oldData?.operacao_id;
          }
          
          if (operacaoId && operacaoIds.includes(operacaoId)) {
            console.log(`[REALTIME-ULTRA] 📡 PARTICIPAÇÃO ${eventType} - Op: ${operacaoId}`);
            
            if (onUpdate) onUpdate(operacaoId, `PARTICIPACAO_${eventType}`);
            if (onDataChange) onDataChange();
          }
          break;
        }
        
        case 'operacao': {
          const newData = payload.new;
          const oldData = payload.old;
          const operacaoId = newData?.id || oldData?.id;
          
          if (operacaoId && operacaoIds.includes(operacaoId)) {
            console.log(`[REALTIME-ULTRA] 🔄 OPERAÇÃO ${eventType} - Op: ${operacaoId}`);
            
            if (onUpdate) onUpdate(operacaoId, `OPERACAO_${eventType}`);
            if (onDataChange) onDataChange();
          }
          break;
        }
        
        case 'eventos_operacao': {
          if (eventType === 'INSERT') {
            const newData = payload.new;
            const operacaoId = newData?.operacao_id;
            
            if (operacaoId && operacaoIds.includes(operacaoId)) {
              console.log(`[REALTIME-ULTRA] 📋 EVENTO HISTÓRICO - Op: ${operacaoId} - Tipo: ${newData?.tipo_evento}`);
              
              // Callback específico para eventos
              if (onNovoEvento) {
                onNovoEvento(newData as EventoOperacao);
              }
              
              // Callbacks gerais
              if (onUpdate) onUpdate(operacaoId, 'EVENTO_INSERT');
              if (onDataChange) onDataChange();
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('[REALTIME-ULTRA] Erro no handler:', error);
    }
  }, [operacaoIds, onUpdate, onDataChange, onNovoEvento]);
  
  // 🎯 USAR HOOK UNIFICADO
  const unifiedResult = useRealtimeUnified({
    ...unifiedConfig,
    onDatabaseChange: handleDatabaseChange
  });
  
  // 📊 LOG DE MÉTRICAS DE PERFORMANCE
  const endTime = performance.now();
  logPerformanceMetric('useRealtimePuro', 'hookExecutionTime', endTime - startTime);
  
  // 🎯 MAPEAR RESULTADO PARA INTERFACE ORIGINAL
  const result: UseRealtimePuroReturn = useMemo(() => {
    const debugInfo = enabled && operacaoIds.length > 0 
      ? `Conectado: ${unifiedResult.debugInfo.channelId}`
      : 'Desabilitado';
    
    return {
      isConnected: unifiedResult.isConnected,
      debugInfo,
      reconnect: unifiedResult.reconnect
    };
  }, [
    enabled,
    operacaoIds.length,
    unifiedResult.isConnected,
    unifiedResult.debugInfo.channelId,
    unifiedResult.reconnect
  ]);
  
  return result;
};