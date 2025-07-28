/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimeOperacoes
 * 
 * Mantém compatibilidade total com a interface original do useRealtimeOperacoes
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimeOperacoes
interface UseRealtimeOperacoesParams {
  operacaoIds?: number[];
  onUpdate?: (operacaoId: number, eventType?: string) => void;
  enabled?: boolean;
  forceRefreshTriggers?: boolean;
  isVisible?: boolean;
}

// 🎯 INTERFACE DE RETORNO ORIGINAL
interface UseRealtimeOperacoesReturn {
  isConnected: boolean;
  channelName: string | null;
  isStable: boolean;
}

/**
 * 🔄 WRAPPER PARA useRealtimeOperacoes
 * 
 * Implementa a interface original usando useRealtimeUnified internamente.
 */
export const useRealtimeOperacoes = ({
  operacaoIds = [],
  onUpdate,
  enabled = true,
  forceRefreshTriggers = true,
  isVisible = true
}: UseRealtimeOperacoesParams): UseRealtimeOperacoesReturn => {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeOperacoes',
    'https://docs.projeto.com/migration/useRealtimeOperacoes'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimeOperacoes');
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: operacaoIds.length > 0 ? `operacoes-${operacaoIds.sort((a, b) => a - b).join('-')}` : undefined,
    tables: ['operacao', 'participacao', 'justificativa_obrigatoria', 'historico_modificacao'],
    
    // Filtros baseados nos IDs das operações
    filters: operacaoIds.length > 0 ? {
      operacao: `id.in.(${operacaoIds.join(',')})`,
      participacao: `operacao_id.in.(${operacaoIds.join(',')})`,
      justificativa_obrigatoria: `referencia_id.in.(${operacaoIds.join(',')})`,
      historico_modificacao: `operacao_id.in.(${operacaoIds.join(',')})`
    } : undefined,
    
    // Feature flags baseadas nos parâmetros originais
    enableRealtime: enabled && isVisible,
    enablePolling: forceRefreshTriggers,
    enableFetch: false, // useRealtimeOperacoes original não fazia fetch
    
    // Configuração de polling (baseada no comportamento original)
    activeInterval: 5000,
    inactiveInterval: 30000,
    focusInterval: 5000,
    blurInterval: 60000,
    
    debug: process.env.NODE_ENV === 'development'
  }), [operacaoIds, enabled, forceRefreshTriggers, isVisible]);
  
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
    
    // Filtrar apenas operações monitoradas
    if (operacaoId && (operacaoIds.length === 0 || operacaoIds.includes(operacaoId))) {
      onUpdate(operacaoId, `${table.toUpperCase()}_${eventType}`);
    }
  }, [onUpdate, operacaoIds]);
  
  // 🎯 USAR HOOK UNIFICADO OU FALLBACK PARA IMPLEMENTAÇÃO ORIGINAL
  const unifiedResult = useRealtimeUnified({
    ...unifiedConfig,
    onDatabaseChange: handleDatabaseChange
  });
  
  // 📊 LOG DE MÉTRICAS DE PERFORMANCE
  const endTime = performance.now();
  logPerformanceMetric('useRealtimeOperacoes', 'hookExecutionTime', endTime - startTime);
  
  // 🎯 MAPEAR RESULTADO PARA INTERFACE ORIGINAL
  const result: UseRealtimeOperacoesReturn = useMemo(() => ({
    isConnected: unifiedResult.isConnected,
    channelName: unifiedResult.debugInfo.channelId,
    isStable: unifiedResult.isConnected && unifiedResult.eventsReceived >= 0 // Considera estável se conectado
  }), [unifiedResult.isConnected, unifiedResult.debugInfo.channelId, unifiedResult.eventsReceived]);
  
  return result;
};

/**
 * 🚀 FUNÇÃO HELPER PARA TRIGGER DE REFRESH (compatibilidade)
 * 
 * Mantém compatibilidade com a função triggerRealtimeRefresh original.
 */
export const triggerRealtimeRefresh = async (
  operacaoIds: number[], 
  eventType: string = 'FORCE_REFRESH'
): Promise<{ success: boolean; data?: any; error?: any }> => {
  
  showDeprecationWarning(
    'triggerRealtimeRefresh',
    'https://docs.projeto.com/migration/triggerRealtimeRefresh'
  );
  
  try {
    // Simular o comportamento original de atualizar a tabela para trigger realtime
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data, error } = await supabase
      .from('operacao')
      .update({ 
        updated_at: new Date().toISOString(),
        atualizacao_forcada: new Date().toISOString()
      })
      .in('id', operacaoIds);
    
    if (error) {
      console.error('[triggerRealtimeRefresh] Erro:', error);
      return { success: false, error };
    }
    
    console.log(`[triggerRealtimeRefresh] ✅ Trigger executado para ${operacaoIds.length} operações`);
    return { success: true, data };
    
  } catch (error) {
    console.error('[triggerRealtimeRefresh] ❌ Erro no trigger:', error);
    return { success: false, error };
  }
};