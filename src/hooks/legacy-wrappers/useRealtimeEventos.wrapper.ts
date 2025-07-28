/**
 * 🔄 WRAPPER DE COMPATIBILIDADE: useRealtimeEventos
 * 
 * Mantém compatibilidade total com a interface original do useRealtimeEventos
 * enquanto utiliza internamente o useRealtimeUnified para melhor performance.
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import { shouldUseUnified, showDeprecationWarning, logPerformanceMetric } from './migration-flags';

// 🎯 INTERFACE ORIGINAL DO useRealtimeEventos
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

/**
 * 🔄 WRAPPER PARA useRealtimeEventos
 * 
 * Implementa o monitoramento de eventos de operação usando useRealtimeUnified.
 * Foca especificamente na tabela eventos_operacao.
 */
export function useRealtimeEventos({
  operacaoIds = [],
  onNovoEvento,
  enabled = true
}: UseRealtimeEventosProps): void {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeEventos',
    'https://docs.projeto.com/migration/useRealtimeEventos'
  );
  
  // 📊 LOG DE USO PARA ANALYTICS
  const startTime = useMemo(() => performance.now(), []);
  
  // 🎯 VERIFICAR SE DEVE USAR VERSÃO UNIFICADA
  const useUnified = shouldUseUnified('useRealtimeEventos');
  
  // 🔧 CONFIGURAÇÃO PARA O HOOK UNIFICADO
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => ({
    channelId: `eventos-operacoes-${operacaoIds.join('-')}`,
    tables: ['eventos_operacao'],
    
    // Filtros baseados nos IDs das operações
    filters: operacaoIds.length > 0 ? {
      eventos_operacao: `operacao_id.in.(${operacaoIds.join(',')})`
    } : undefined,
    
    // Feature flags - useRealtimeEventos era apenas para eventos INSERT
    enableRealtime: enabled && operacaoIds.length > 0,
    enablePolling: false, // Original não tinha polling
    enableFetch: false,   // Original não fazia fetch
    
    debug: process.env.NODE_ENV === 'development'
  }), [operacaoIds, enabled]);
  
  // 🎯 CALLBACK HANDLER PARA EVENTOS
  const handleDatabaseChange = useCallback((event: any) => {
    const { table, eventType, payload } = event;
    
    // Apenas processar INSERTs na tabela eventos_operacao
    if (table === 'eventos_operacao' && eventType === 'INSERT' && payload.new) {
      const novoEvento = payload.new as EventoOperacao;
      
      // Verificar se é uma operação que estamos monitorando
      if (operacaoIds.length === 0 || operacaoIds.includes(novoEvento.operacao_id)) {
        if (onNovoEvento) {
          onNovoEvento(novoEvento);
        }
      }
    }
  }, [operacaoIds, onNovoEvento]);
  
  // 🎯 USAR HOOK UNIFICADO
  useRealtimeUnified({
    ...unifiedConfig,
    onDatabaseChange: handleDatabaseChange
  });
  
  // 📊 LOG DE MÉTRICAS DE PERFORMANCE
  const endTime = performance.now();
  logPerformanceMetric('useRealtimeEventos', 'hookExecutionTime', endTime - startTime);
}

/**
 * 🔄 WRAPPER PARA useRealtimeEventosOperacao
 * 
 * Hook específico para monitorar eventos de uma única operação.
 */
export function useRealtimeEventosOperacao(
  operacaoId: number | null,
  onNovoEvento?: (evento: EventoOperacao) => void
): void {
  
  // 🚨 AVISO DE DEPRECIAÇÃO
  showDeprecationWarning(
    'useRealtimeEventosOperacao',
    'https://docs.projeto.com/migration/useRealtimeEventosOperacao'
  );
  
  return useRealtimeEventos({
    operacaoIds: operacaoId ? [operacaoId] : [],
    onNovoEvento,
    enabled: !!operacaoId
  });
}