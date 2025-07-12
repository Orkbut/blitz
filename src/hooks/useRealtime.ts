/**
 * 🚀 HOOK REALTIME UNIFICADO
 * 
 * Substitui TODOS os hooks fragmentados:
 * ❌ useRealtimePuro.ts (288 linhas)
 * ❌ useRealtimeUnificado.ts (480 linhas) 
 * ❌ useRealtimeOperacoes.ts (329 linhas)
 * ❌ useRealtimeCentralized.ts (84 linhas)
 * ❌ useRealtimeSimple.ts (209 linhas)
 * ❌ useRealtimeEventos.ts (90 linhas)
 * ❌ useRealtimeCalendarioSupervisor.ts (159 linhas)
 * ❌ useSmartPolling.ts (153 linhas)
 * 
 * ✅ useRealtime.ts (~200 linhas) - 89% REDUÇÃO
 * 
 * BASEADO NA DOCUMENTAÇÃO OFICIAL SUPABASE:
 * - Event bus pattern para total desacoplamento
 * - Rate limiting automático
 * - Health monitoring integrado
 * - Error handling com códigos oficiais
 * - Channel pooling para performance
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  realtimeManager, 
  type DatabaseChangeEvent, 
  type ChannelSubscription 
} from '@/core/infrastructure/services/RealtimeManager';

// 🎯 INTERFACE PRINCIPAL
export interface UseRealtimeParams {
  // 📋 CONFIGURAÇÃO BÁSICA
  channelId: string;                    // ID único do canal (ex: 'operacoes-calendario')
  tables: string[];                     // Tabelas a monitorar (ex: ['operacao', 'participacao'])
  
  // 🔍 FILTROS OPCIONAIS
  filters?: Record<string, string>;     // Filtros por tabela (ex: { operacao: 'modalidade.eq.BLITZ' })
  
  // 🎛️ CONTROLES
  enabled?: boolean;                    // Habilitar/desabilitar (padrão: true)
  
  // 📡 CALLBACKS
  onDatabaseChange?: (event: DatabaseChangeEvent) => void;  // Evento de mudança no banco
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'error', error?: string) => void;
  
  // 🐛 DEBUG
  debug?: boolean;                      // Logs detalhados (padrão: false)
}

// 🎯 INTERFACE DE RETORNO
export interface UseRealtimeReturn {
  // 📊 ESTADOS
  isConnected: boolean;                 // Status da conexão
  lastError: string | null;            // Último erro encontrado
  lastEventTime: number | null;        // Timestamp do último evento recebido
  
  // 📈 ESTATÍSTICAS
  eventsReceived: number;               // Contador de eventos recebidos
  reconnectCount: number;               // Contador de reconexões
  
  // 🎛️ CONTROLES
  reconnect: () => void;                // Forçar reconexão manual
  disconnect: () => void;               // Desconectar manualmente
  
  // 🐛 DEBUG
  debugInfo: {
    channelId: string;
    tablesMonitored: string[];
    managerStats: Record<string, any>;
  };
}

/**
 * 🎯 HOOK REALTIME UNIFICADO
 * 
 * API simples que esconde toda complexidade do RealtimeManager.
 * Implementa as melhores práticas da documentação oficial.
 */
export const useRealtime = ({
  channelId,
  tables,
  filters,
  enabled = true,
  onDatabaseChange,
  onConnectionChange,
  debug = false
}: UseRealtimeParams): UseRealtimeReturn => {
  
  // 📊 ESTADOS LOCAIS
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  const [eventsReceived, setEventsReceived] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  
  // 🔧 REFS ESTÁVEIS (evitam re-renders desnecessários)
  const onDatabaseChangeRef = useRef(onDatabaseChange);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const subscriptionRef = useRef<ChannelSubscription | null>(null);
  const isSubscribedRef = useRef(false);
  
  // Atualizar refs sem causar re-render
  onDatabaseChangeRef.current = onDatabaseChange;
  onConnectionChangeRef.current = onConnectionChange;
  
  // 🐛 LOG FUNCTION
  const log = useCallback((message: string, data?: any) => {
    if (debug) {
      console.log(`[useRealtime:${channelId}] ${message}`, data || '');
    }
  }, [debug, channelId]);
  
  // 🎯 CALLBACK HANDLERS ESTÁVEIS
  const handleDatabaseChange = useCallback((event: DatabaseChangeEvent) => {
    log(`📨 Evento recebido:`, {
      table: event.table,
      type: event.eventType,
      recordId: event.payload.new?.id || event.payload.old?.id
    });
    
    setLastEventTime(event.timestamp);
    setEventsReceived(prev => prev + 1);
    
    // Callback do usuário
    if (onDatabaseChangeRef.current) {
      try {
        onDatabaseChangeRef.current(event);
      } catch (error) {
        console.error(`[useRealtime:${channelId}] ❌ Erro no callback onDatabaseChange:`, error);
      }
    }
  }, [log, channelId]);
  
  const handleConnectionChange = useCallback((status: 'connected' | 'disconnected' | 'error', error?: string) => {
    log(`🔌 Status de conexão: ${status}${error ? ` (${error})` : ''}`);
    
    setIsConnected(status === 'connected');
    
    if (status === 'error' && error) {
      setLastError(error);
    } else if (status === 'connected') {
      setLastError(null);
      if (isSubscribedRef.current) {
        setReconnectCount(prev => prev + 1);
      }
    }
    
    // Callback do usuário
    if (onConnectionChangeRef.current) {
      try {
        onConnectionChangeRef.current(status, error);
      } catch (error) {
        console.error(`[useRealtime:${channelId}] ❌ Erro no callback onConnectionChange:`, error);
      }
    }
  }, [log, channelId]);
  
  // 🎯 CONTROLES MANUAIS
  const reconnect = useCallback(() => {
    log('🔄 Reconexão manual solicitada');
    
    if (subscriptionRef.current) {
      realtimeManager.unsubscribe(channelId);
      // Pequeno delay para garantir limpeza
      setTimeout(() => {
        if (subscriptionRef.current) {
          realtimeManager.subscribe(subscriptionRef.current);
        }
      }, 100);
    }
  }, [channelId, log]);
  
  const disconnect = useCallback(() => {
    log('🔌 Desconexão manual solicitada');
    
    realtimeManager.unsubscribe(channelId);
    isSubscribedRef.current = false;
    setIsConnected(false);
  }, [channelId, log]);
  
  // 🎯 EFFECT PRINCIPAL - GERENCIAR SUBSCRIPTION
  useEffect(() => {
    log('🚀 Effect principal executado', {
      enabled,
      tables: tables.length,
      hasFilters: !!filters
    });
    
    // 🛑 EARLY RETURN: Desabilitado ou sem tabelas
    if (!enabled || tables.length === 0) {
      log('⏸️ Hook desabilitado ou sem tabelas');
      
      if (isSubscribedRef.current) {
        disconnect();
      }
      return;
    }
    
    // 📋 CRIAR SUBSCRIPTION CONFIG
    const subscription: ChannelSubscription = {
      channelId,
      tables: [...tables], // Cópia para evitar mutação
      filters: filters ? { ...filters } : undefined,
      onDatabaseChange: handleDatabaseChange,
      onConnectionStatusChange: handleConnectionChange,
      enabled: true
    };
    
    subscriptionRef.current = subscription;
    
    // 🔌 SUBSCRIBE VIA MANAGER
    const success = realtimeManager.subscribe(subscription);
    
    if (success) {
      isSubscribedRef.current = true;
      log('✅ Subscription criado com sucesso');
    } else {
      log('❌ Falha ao criar subscription (possivelmente rate limit)');
      setLastError('Rate limit atingido');
    }
    
    // 🧹 CLEANUP
    return () => {
      log('🧹 Cleanup executado');
      
      if (isSubscribedRef.current) {
        realtimeManager.unsubscribe(channelId);
        isSubscribedRef.current = false;
      }
    };
    
  }, [
    channelId,
    enabled,
    JSON.stringify(tables.sort()), // Sort para evitar re-renders por ordem
    JSON.stringify(filters),
    handleDatabaseChange,
    handleConnectionChange,
    log,
    disconnect
  ]);
  
  // 🎯 DEBUG INFO
  const debugInfo = {
    channelId,
    tablesMonitored: tables,
    managerStats: realtimeManager.getChannelStats()
  };
  
  // 🎯 RETURN API LIMPA
  return {
    // Estados
    isConnected,
    lastError,
    lastEventTime,
    
    // Estatísticas  
    eventsReceived,
    reconnectCount,
    
    // Controles
    reconnect,
    disconnect,
    
    // Debug
    debugInfo
  };
};

/**
 * 🎯 HOOK ESPECIALIZADO: OPERAÇÕES
 * 
 * Versão otimizada para casos de uso de operações.
 * Açúcar sintático sobre o useRealtime base.
 */
export interface UseRealtimeOperacoesParams {
  operacaoIds?: number[];               // IDs específicos para filtrar
  enabled?: boolean;
  onOperacaoChange?: (operacaoId: number, eventType: string) => void;
  onParticipacaoChange?: (operacaoId: number, eventType: string) => void;
  debug?: boolean;
}

export const useRealtimeOperacoes = ({
  operacaoIds = [],
  enabled = true,
  onOperacaoChange,
  onParticipacaoChange,
  debug = false
}: UseRealtimeOperacoesParams) => {
  
  // 🎯 GERAR CHANNEL ID BASEADO NOS IDs
  const channelId = `operacoes-${operacaoIds.sort((a, b) => a - b).join('-')}`;
  
  // 🎯 FILTROS AUTOMÁTICOS (se IDs especificados)
  const filters = operacaoIds.length > 0 ? {
    operacao: `id.in.(${operacaoIds.join(',')})`,
    participacao: `operacao_id.in.(${operacaoIds.join(',')})`
  } : undefined;
  
  // 🎯 HANDLER UNIFICADO
  const handleDatabaseChange = useCallback((event: DatabaseChangeEvent) => {
    const recordId = event.payload.new?.id || event.payload.old?.id;
    const operacaoId = event.table === 'operacao' 
      ? recordId
      : event.payload.new?.operacao_id || event.payload.old?.operacao_id;
    
    if (!operacaoId) return;
    
    // Filtrar por IDs se especificados
    if (operacaoIds.length > 0 && !operacaoIds.includes(operacaoId)) {
      return;
    }
    
    if (event.table === 'operacao' && onOperacaoChange) {
      onOperacaoChange(operacaoId, event.eventType);
    } else if (event.table === 'participacao' && onParticipacaoChange) {
      onParticipacaoChange(operacaoId, event.eventType);
    }
  }, [operacaoIds, onOperacaoChange, onParticipacaoChange]);
  
  // 🎯 USAR HOOK BASE
  return useRealtime({
    channelId,
    tables: ['operacao', 'participacao'],
    filters,
    enabled: enabled && operacaoIds.length > 0,
    onDatabaseChange: handleDatabaseChange,
    debug
  });
};

/**
 * 🎯 HOOK ESPECIALIZADO: EVENTOS/HISTÓRICO
 * 
 * Para monitorar eventos_operacao (histórico).
 */
export interface UseRealtimeEventosParams {
  operacaoIds?: number[];
  enabled?: boolean;
  onNovoEvento?: (evento: any) => void;
  debug?: boolean;
}

export const useRealtimeEventos = ({
  operacaoIds = [],
  enabled = true,
  onNovoEvento,
  debug = false
}: UseRealtimeEventosParams) => {
  
  const channelId = `eventos-${operacaoIds.sort((a, b) => a - b).join('-')}`;
  
  const filters = operacaoIds.length > 0 ? {
    eventos_operacao: `operacao_id.in.(${operacaoIds.join(',')})`
  } : undefined;
  
  const handleDatabaseChange = useCallback((event: DatabaseChangeEvent) => {
    if (event.table === 'eventos_operacao' && event.eventType === 'INSERT' && onNovoEvento) {
      onNovoEvento(event.payload.new);
    }
  }, [onNovoEvento]);
  
  return useRealtime({
    channelId,
    tables: ['eventos_operacao'],
    filters,
    enabled: enabled && operacaoIds.length > 0,
    onDatabaseChange: handleDatabaseChange,
    debug
  });
};

export default useRealtime; 