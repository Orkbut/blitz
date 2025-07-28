/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimeUnificado
 * 
 * Mantém compatibilidade total com a interface original do useRealtimeUnificado
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimeUnificado
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

// 🎯 INTERFACE DE OPERAÇÃO ORIGINAL
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

// 🎯 INTERFACE DE RETORNO ORIGINAL
interface UseRealtimeUnificadoReturn {
  // Estados das operações
  operacoes: Operacao[];
  loading: boolean;
  error: string | null;
  refetch: (reason?: string) => void;
  
  // Estados do sistema
  isActive: boolean;
  isVisible: boolean;
  isConnected: boolean;
  
  // Métodos utilitários
  forceExecute: () => void;
  reconnect: () => void;
}

/**
 * 🔄 WRAPPER PARA useRealtimeUnificado
 * 
 * Implementa a interface completa original (realtime + polling + fetch) usando useRealtimeUnified.
 * Este era o hook mais complexo, combinando múltiplas funcionalidades.
 */
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
}: UseRealtimeUnificadoParams): UseRealtimeUnificadoReturn => {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeUnificado',
    'https://docs.projeto.com/migration/useRealtimeUnificado'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimeUnificado');
  
  // 🔧 FORMATAR DATAS PARA API
  const startDateStr = useMemo(() => {
    return startDate instanceof Date ? startDate.toISOString().split('T')[0] : startDate;
  }, [startDate]);
  
  const endDateStr = useMemo(() => {
    return endDate instanceof Date ? endDate.toISOString().split('T')[0] : endDate;
  }, [endDate]);
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: operacaoIds.length > 0 
      ? `operacoes-unified-${operacaoIds.sort((a, b) => a - b).join('-')}`
      : `operacoes-unified-${startDateStr}-${endDateStr}`,
    
    tables: ['operacao', 'participacao', 'justificativa_obrigatoria', 'historico_modificacao'],
    
    // Filtros baseados nos IDs das operações (se especificados)
    filters: operacaoIds.length > 0 ? {
      operacao: `id.in.(${operacaoIds.join(',')})`,
      participacao: `operacao_id.in.(${operacaoIds.join(',')})`,
      justificativa_obrigatoria: `referencia_id.in.(${operacaoIds.join(',')})`,
      historico_modificacao: `operacao_id.in.(${operacaoIds.join(',')})`
    } : undefined,
    
    // Feature flags - useRealtimeUnificado tinha tudo habilitado
    enableRealtime: enabled && isVisible,
    enablePolling: true, // Original tinha smart polling
    enableFetch: true,   // Original fazia fetch de dados
    
    // Configuração de datas para fetch
    startDate: startDateStr,
    endDate: endDateStr,
    
    // Endpoint da API (baseado no comportamento original)
    apiEndpoint: '/api/unified/operacoes',
    
    // Configuração de polling (baseada nos parâmetros originais)
    activeInterval,
    inactiveInterval,
    focusInterval,
    blurInterval,
    
    debug: process.env.NODE_ENV === 'development'
  }), [
    operacaoIds,
    startDateStr,
    endDateStr,
    enabled,
    isVisible,
    activeInterval,
    inactiveInterval,
    focusInterval,
    blurInterval
  ]);
  
  // 🎯 CALLBACK HANDLER PARA MAPEAR EVENTOS
  const handleDatabaseChange = useCallback((event: any) => {
    if (!onUpdate) return;
    
    const { table, eventType, payload } = event;
    let operacaoId: number | null = null;
    
    // Extrair operacao_id baseado na tabela
    switch (table) {
      case 'operacao':
        operacaoId = payload.new?.id || payload.old?.id;
        break;
      case 'participacao':
        operacaoId = payload.new?.operacao_id || payload.old?.operacao_id;
        
        // Detecção de soft delete (cancelamento)
        if (eventType === 'UPDATE' && 
            payload.new?.ativa === false && 
            payload.old?.ativa === true) {
          console.log(`[TEMP-LOG-REALTIME-UNIFICADO] 🚫 Participação cancelada - Op: ${operacaoId}`);
          onUpdate(operacaoId, 'PARTICIPACAO_CANCELED');
          return;
        }
        break;
      case 'justificativa_obrigatoria':
        operacaoId = payload.new?.referencia_id;
        if (operacaoId) {
          onUpdate(operacaoId, `ADMIN_${payload.new?.contexto || 'UPDATE'}`);
          return;
        }
        break;
      case 'historico_modificacao':
        operacaoId = payload.new?.operacao_id;
        if (operacaoId) {
          onUpdate(operacaoId, 'HISTORICO_UPDATE');
          return;
        }
        break;
    }
    
    // Filtrar apenas operações monitoradas (se especificadas)
    if (operacaoId && (operacaoIds.length === 0 || operacaoIds.includes(operacaoId))) {
      console.log(`[TEMP-LOG-REALTIME-UNIFICADO] 📡 Evento realtime: ${eventType} - Op: ${operacaoId}`);
      onUpdate(operacaoId, `${table.toUpperCase()}_${eventType}`);
    }
  }, [onUpdate, operacaoIds]);
  
  // 🎯 USAR HOOK UNIFICADO
  const unifiedResult = useRealtimeUnified<Operacao>({
    ...unifiedConfig,
    onDatabaseChange: handleDatabaseChange
  });
  
  // 📊 LOG DE MÉTRICAS DE PERFORMANCE
  const endTime = performance.now();
  logPerformanceMetric('useRealtimeUnificado', 'hookExecutionTime', endTime - startTime);
  
  // 🎯 MAPEAR RESULTADO PARA INTERFACE ORIGINAL
  const result: UseRealtimeUnificadoReturn = useMemo(() => ({
    // Estados das operações
    operacoes: unifiedResult.data,
    loading: unifiedResult.loading,
    error: unifiedResult.error,
    refetch: async (reason?: string) => {
      await unifiedResult.refetch(reason);
    },
    
    // Estados do sistema
    isActive: unifiedResult.isActive,
    isVisible: unifiedResult.isVisible,
    isConnected: unifiedResult.isConnected,
    
    // Métodos utilitários
    forceExecute: unifiedResult.forceExecute,
    reconnect: unifiedResult.reconnect
  }), [unifiedResult]);
  
  return result;
};

/**
 * 🚀 FUNÇÃO HELPER PARA TRIGGER DE REFRESH UNIFICADO (compatibilidade)
 * 
 * Mantém compatibilidade com a função triggerUnifiedRefresh original.
 */
export const triggerUnifiedRefresh = async (
  operacaoIds: number[], 
  eventType: string = 'FORCE_REFRESH'
): Promise<{ success: boolean; data?: any; error?: any }> => {
  
  showDeprecationWarning(
    'triggerUnifiedRefresh',
    'https://docs.projeto.com/migration/triggerUnifiedRefresh'
  );
  
  console.log(`[TEMP-LOG-REALTIME-UNIFICADO] 🔄 Trigger unificado: ${eventType} para ops: ${operacaoIds.join(',')}`);
  
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data, error } = await supabase
      .from('operacao')
      .update({ atualizacao_forcada: new Date().toISOString() })
      .in('id', operacaoIds);
      
    if (error) {
      console.error('[TEMP-LOG-REALTIME-UNIFICADO] ❌ Erro no trigger:', error);
      return { success: false, error };
    }
    
    console.log(`[TEMP-LOG-REALTIME-UNIFICADO] ✅ Trigger executado para ${operacaoIds.length} operações`);
    return { success: true, data };
    
  } catch (error) {
    console.error('[TEMP-LOG-REALTIME-UNIFICADO] ❌ Erro no trigger:', error);
    return { success: false, error };
  }
};