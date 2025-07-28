/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimeCalendarioSupervisor
 * 
 * Mantém compatibilidade total com a interface original do useRealtimeCalendarioSupervisor
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimeCalendarioSupervisor
interface UseRealtimeCalendarioSupervisorParams {
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean;
  onOperacaoChange?: (operacaoId: number, changeType: string) => void;
  onParticipacaoChange?: (operacaoId: number, changeType: string) => void;
  debug?: boolean;
}

// 🎯 INTERFACE DE RETORNO ORIGINAL
interface UseRealtimeCalendarioSupervisorReturn {
  isConnected: boolean;
  connectionStatus: string;
  eventsReceived: number;
  lastEventTime: number | null;
  reconnect: () => void;
}

/**
 * 🔄 WRAPPER PARA useRealtimeCalendarioSupervisor
 * 
 * Implementa o monitoramento específico para calendário de supervisor usando useRealtimeUnified.
 * Foca em operações dentro de um período específico.
 */
export const useRealtimeCalendarioSupervisor = ({
  startDate,
  endDate,
  enabled = true,
  onOperacaoChange,
  onParticipacaoChange,
  debug = false
}: UseRealtimeCalendarioSupervisorParams): UseRealtimeCalendarioSupervisorReturn => {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeCalendarioSupervisor',
    'https://docs.projeto.com/migration/useRealtimeCalendarioSupervisor'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimeCalendarioSupervisor');
  
  // 🔧 FORMATAR DATAS PARA FILTROS
  const dateFilters = useMemo(() => {
    if (!startDate || !endDate) return undefined;
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    return {
      operacao: `data_operacao.gte.${startStr},data_operacao.lte.${endStr}`
    };
  }, [startDate, endDate]);
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: `calendario-supervisor-${startDate?.toISOString().split('T')[0]}-${endDate?.toISOString().split('T')[0]}`,
    tables: ['operacao', 'participacao'],
    
    // Filtros baseados no período (se especificado)
    filters: dateFilters,
    
    // Feature flags - useRealtimeCalendarioSupervisor era focado em realtime
    enableRealtime: enabled,
    enablePolling: false, // Original não tinha polling próprio
    enableFetch: false,   // Original não fazia fetch
    
    debug
  }), [startDate, endDate, enabled, debug, dateFilters]);
  
  // 🎯 CALLBACK HANDLER PARA MAPEAR EVENTOS
  const handleDatabaseChange = useCallback((event: any) => {
    const { table, eventType, payload } = event;
    
    if (debug) {
      console.log(`[RealtimeCalendarioSupervisor] Evento ${table}:`, {
        eventType,
        recordId: payload.new?.id || payload.old?.id
      });
    }
    
    // Mapear eventos para callbacks específicos
    switch (table) {
      case 'operacao': {
        const operacaoId = payload.new?.id || payload.old?.id;
        if (operacaoId && onOperacaoChange) {
          // Verificar se a operação está no período (se filtros estão definidos)
          if (!dateFilters || isOperacaoInPeriod(payload.new || payload.old, startDate, endDate)) {
            onOperacaoChange(operacaoId, `OPERACAO_${eventType}`);
          }
        }
        break;
      }
      
      case 'participacao': {
        const operacaoId = payload.new?.operacao_id || payload.old?.operacao_id;
        if (operacaoId && onParticipacaoChange) {
          // Para participações, assumimos que a operação já está no período
          // (o filtro na operacao já garante isso)
          onParticipacaoChange(operacaoId, `PARTICIPACAO_${eventType}`);
        }
        break;
      }
    }
  }, [onOperacaoChange, onParticipacaoChange, debug, dateFilters, startDate, endDate]);
  
  // 🎯 USAR HOOK UNIFICADO
  const unifiedResult = useRealtimeUnified({
    ...unifiedConfig,
    onDatabaseChange: handleDatabaseChange
  });
  
  // 📊 LOG DE MÉTRICAS DE PERFORMANCE
  const endTime = performance.now();
  logPerformanceMetric('useRealtimeCalendarioSupervisor', 'hookExecutionTime', endTime - startTime);
  
  // 🎯 MAPEAR RESULTADO PARA INTERFACE ORIGINAL
  const result: UseRealtimeCalendarioSupervisorReturn = useMemo(() => ({
    isConnected: unifiedResult.isConnected,
    connectionStatus: unifiedResult.connectionStatus,
    eventsReceived: unifiedResult.eventsReceived,
    lastEventTime: unifiedResult.lastEventTime,
    reconnect: unifiedResult.reconnect
  }), [
    unifiedResult.isConnected,
    unifiedResult.connectionStatus,
    unifiedResult.eventsReceived,
    unifiedResult.lastEventTime,
    unifiedResult.reconnect
  ]);
  
  return result;
};

/**
 * 🔧 HELPER FUNCTION PARA VERIFICAR SE OPERAÇÃO ESTÁ NO PERÍODO
 */
function isOperacaoInPeriod(operacao: any, startDate?: Date, endDate?: Date): boolean {
  if (!startDate || !endDate || !operacao?.data_operacao) {
    return true; // Se não há filtros de data, aceita tudo
  }
  
  const operacaoDate = new Date(operacao.data_operacao);
  return operacaoDate >= startDate && operacaoDate <= endDate;
}