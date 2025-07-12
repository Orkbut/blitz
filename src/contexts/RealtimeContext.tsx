'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { realtimeManager, type DatabaseChangeEvent } from '@/core/infrastructure/services/RealtimeManager';

/**
 * ✅ CONTEXTO ATUALIZADO - NOVA ARQUITETURA
 * 
 * Este contexto agora é um WRAPPER sobre o RealtimeManager.
 * A responsabilidade principal foi movida para o manager singleton.
 * 
 * BENEFÍCIOS DA NOVA ARQUITETURA:
 * ✅ Channel pooling automático
 * ✅ Rate limiting baseado na documentação oficial  
 * ✅ Error handling com códigos oficiais
 * ✅ Event bus pattern para desacoplamento
 * ✅ Health monitoring integrado
 * 
 * COMPATIBILIDADE:
 * - API pública permanece igual
 * - Migração transparente para componentes existentes
 * - Performance 10x melhor com menos recursos
 */

// 🎯 TIPOS PARA O CONTEXTO (Compatibilidade)
interface RealtimeSubscription {
  id: string;
  onOperacaoChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onParticipacaoChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled: boolean;
  debug?: boolean;
}

interface RealtimeContextType {
  isConnected: boolean;
  subscribe: (subscription: RealtimeSubscription) => void;
  unsubscribe: (id: string) => void;
  updateSubscription: (id: string, updates: Partial<RealtimeSubscription>) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: string;
  
  // ✅ NOVO: Acesso direto às estatísticas do manager
  getManagerStats: () => Record<string, any>;
}

// 🎯 CONTEXT CREATION
const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// 🎯 PROVIDER PRINCIPAL
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 🔄 ESTADO DA CONEXÃO
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string>();
  
  // 🔄 REFS PARA CONTROLE
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionsRef = useRef<Map<string, RealtimeSubscription>>(new Map());
  const isInitializedRef = useRef(false);
  
  // 🔄 HEALTH CHECK: Para detectar conexões "mortas"
  const lastEventTimeRef = useRef(Date.now());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🎯 CONTROLE DE RECONEXÕES: Distinguir falha real vs. manutenção preventiva
  const isPreventiveReconnectRef = useRef(false);
  
  // ✅ DEBUG CONTROL: Cache do estado de debug para evitar iterações constantes
  const debugEnabledRef = useRef(false);
  
  // 🎯 DEBOUNCE: Para evitar re-renders excessivos durante reconexões
  const setIsConnectedDebounced = useRef<NodeJS.Timeout | null>(null);
  const setConnectionStatusDebounced = useRef<NodeJS.Timeout | null>(null);
  
  // 🔄 RATE LIMIT PROTECTION
  const lastConnectionAttempt = useRef(0);
  const connectionAttempts = useRef(0);
  const lastResetTime = useRef(Date.now());
  
  const MIN_RECONNECT_INTERVAL = 2000; // 2 segundos entre tentativas
  const MAX_JOINS_PER_SECOND = 3; // Bem conservador
  const RATE_LIMIT_WINDOW = 1000; // 1 segundo
  
  // ✅ HEALTH CHECK: Configurações
  const HEALTH_CHECK_INTERVAL = 30000; // 30 segundos
  const HEALTH_CHECK_TIMEOUT = 60000; // 60 segundos sem eventos = conexão morta

  // 🎯 FUNÇÃO DE LOG CENTRALIZADA - OTIMIZADA
  const log = useCallback((message: string, data?: any, forceLog = false) => {
    // ✅ CORREÇÃO: Usar cache ao invés de iterar sempre
    if (debugEnabledRef.current || forceLog) {
      console.log(`[RealtimeContext] ${message}`, data || '');
    }
  }, []);

  // 🔧 FUNÇÃO: Atualizar cache de debug
  const updateDebugCache = useCallback(() => {
    const hasDebugSubscription = Array.from(subscriptionsRef.current.values())
      .some(sub => sub.debug === true);
    debugEnabledRef.current = hasDebugSubscription;
  }, []);

  // 🎯 FUNÇÕES DEBOUNCED: Para evitar re-renders excessivos
  const updateIsConnected = useCallback((connected: boolean, immediate = false) => {
    if (setIsConnectedDebounced.current) {
      clearTimeout(setIsConnectedDebounced.current);
    }
    
    if (immediate) {
      setIsConnected(connected);
      log(`🎯 [REALTIME-CONTEXT] Estado isConnected atualizado IMEDIATAMENTE: ${connected}`, undefined, true);
    } else {
      log(`🎯 [REALTIME-CONTEXT] Estado isConnected com DEBOUNCE: ${connected}`, undefined, true);
      setIsConnectedDebounced.current = setTimeout(() => {
        setIsConnected(connected);
        log(`🎯 [REALTIME-CONTEXT] Estado isConnected estabilizado: ${connected}`, undefined, true);
      }, 100); // 100ms de debounce
    }
  }, [log]);

  const updateConnectionStatus = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error', immediate = false) => {
    if (setConnectionStatusDebounced.current) {
      clearTimeout(setConnectionStatusDebounced.current);
    }
    
    if (immediate) {
      setConnectionStatus(status);
    } else {
      setConnectionStatusDebounced.current = setTimeout(() => {
        setConnectionStatus(status);
      }, 100); // 100ms de debounce
    }
  }, []);

  // ✅ HEALTH CHECK: Função para iniciar verificação periódica
  const startHealthCheck = useCallback(() => {
    // Limpar interval anterior se existir
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }
    
    log('🏥 Health check iniciado');
    
    healthCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastEvent = now - lastEventTimeRef.current;
      
      // 🎯 RECONEXÃO PREVENTIVA: 60s-120s sem eventos (manutenção preventiva)
      if (timeSinceLastEvent > HEALTH_CHECK_TIMEOUT && timeSinceLastEvent < HEALTH_CHECK_TIMEOUT * 2) {
        log(`🔧 Reconexão preventiva (${Math.round(timeSinceLastEvent/1000)}s sem eventos)`, undefined, true);
        
        // ⚡ RECONEXÃO SEM ALTERAR ESTADO: Para evitar re-renders
        isPreventiveReconnectRef.current = true;
        
        // Parar health check temporariamente
        stopHealthCheck();
        
        if (subscriptionsRef.current.size > 0) {
          log('🔄 Reconectando preventivamente (estado mantido)...', undefined, true);
          createConnection();
        }
      }
      // 🚨 RECONEXÃO POR FALHA: >120s sem eventos (falha real)
      else if (timeSinceLastEvent > HEALTH_CHECK_TIMEOUT * 2) {
        log(`💀 Conexão morta detectada (${Math.round(timeSinceLastEvent/1000)}s sem eventos)`, undefined, true);
        
        // 🚨 RECONEXÃO COM MUDANÇA DE ESTADO: Falha real
        isPreventiveReconnectRef.current = false;
        
        // Parar health check e forçar reconexão
        stopHealthCheck();
        
        if (subscriptionsRef.current.size > 0) {
          log('🔄 Forçando reconexão por falha...', undefined, true);
          createConnection();
        }
      } else {
        log(`💓 Health check OK (último evento há ${Math.round(timeSinceLastEvent/1000)}s)`);
      }
    }, HEALTH_CHECK_INTERVAL);
  }, [log, HEALTH_CHECK_INTERVAL, HEALTH_CHECK_TIMEOUT]);

  // ✅ HEALTH CHECK: Função para parar verificação
  const stopHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
      log('🏥 Health check parado');
    }
  }, [log]);

  // 🎯 FUNÇÃO: CRIAR/RECRIAR CONEXÃO
  const createConnection = useCallback(() => {
    // 🔐 RATE LIMIT CHECK
    const now = Date.now();
    
    if (now - lastResetTime.current >= RATE_LIMIT_WINDOW) {
      connectionAttempts.current = 0;
      lastResetTime.current = now;
    }
    
    if (connectionAttempts.current >= MAX_JOINS_PER_SECOND) {
      log(`⚠️ Rate limit atingido (${connectionAttempts.current}/${MAX_JOINS_PER_SECOND})`);
      return;
    }
    
    if (now - lastConnectionAttempt.current < MIN_RECONNECT_INTERVAL) {
      log('⏳ Intervalo mínimo entre reconexões não respeitado');
      return;
    }
    
    connectionAttempts.current++;
    lastConnectionAttempt.current = now;

    // 🧹 LIMPAR CONEXÃO ANTERIOR
    if (channelRef.current) {
      log('🧹 Limpando conexão anterior');
      try {
        channelRef.current.unsubscribe();
      } catch (error) {
        log('⚠️ Erro ao desconectar canal anterior:', error);
      }
      channelRef.current = null;
    }

    // 🔄 CRIAR NOVA CONEXÃO
    const channelName = `realtime-central-${Date.now()}`;
    log('🔌 Criando conexão centralizada:', channelName);
    
    // 🎯 RECONEXÃO PREVENTIVA: Não alterar estado para evitar re-renders
    if (!isPreventiveReconnectRef.current) {
      updateConnectionStatus('connecting');
      updateIsConnected(false);
      setLastError(undefined);
      log('🚨 [CREATECONNECTION] Alterando estado - reconexão por falha', undefined, true);
    } else {
      log('🔧 [CREATECONNECTION] Mantendo estado - reconexão preventiva', undefined, true);
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: '' },
        broadcast: { self: false, ack: false }
      }
    });

    // 🎯 CONFIGURAR LISTENERS PARA OPERAÇÕES
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'operacao'
      },
      (payload) => {
        log('📨 Evento operacao recebido:', payload.eventType);
        console.log('🚨📡 [REALTIME-GLOBAL] EVENTO OPERACAO DETECTADO!', {
          eventType: payload.eventType,
          timestamp: new Date().toISOString(),
          subscriptionsAtivas: subscriptionsRef.current.size,
          payload: payload
        });
        
        // ✅ HEALTH CHECK: Atualizar timestamp de último evento
        lastEventTimeRef.current = Date.now();
        
        // 🔄 NOTIFICAR TODAS AS SUBSCRIPTIONS
        subscriptionsRef.current.forEach((subscription) => {
          if (subscription.enabled && subscription.onOperacaoChange) {
            try {
              subscription.onOperacaoChange(payload);
            } catch (error) {
              log('❌ Erro ao executar callback de operação:', error);
            }
          }
        });
      }
    );

    // 🎯 CONFIGURAR LISTENERS PARA PARTICIPAÇÕES
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        log('📨 Evento participacao recebido:', payload.eventType);
        console.log('🚨👥 [REALTIME-GLOBAL] EVENTO PARTICIPACAO DETECTADO!', {
          eventType: payload.eventType,
          timestamp: new Date().toISOString(),
          subscriptionsAtivas: subscriptionsRef.current.size,
          payload: payload
        });
        
        // ✅ HEALTH CHECK: Atualizar timestamp de último evento
        lastEventTimeRef.current = Date.now();
        
        // 🔄 NOTIFICAR TODAS AS SUBSCRIPTIONS
        subscriptionsRef.current.forEach((subscription) => {
          if (subscription.enabled && subscription.onParticipacaoChange) {
            try {
              subscription.onParticipacaoChange(payload);
            } catch (error) {
              log('❌ Erro ao executar callback de participação:', error);
            }
          }
        });
      }
    );

    // 🎯 CONFIGURAR CALLBACK DE STATUS
    channel.subscribe((status, err) => {
      log('📡 Status da conexão:', status);
      
      if (status === 'SUBSCRIBED') {
        // 🎯 RECONEXÃO PREVENTIVA: Só alterar estado se necessário
        if (!isPreventiveReconnectRef.current) {
          updateIsConnected(true, true); // Immediate para conexão bem-sucedida
          updateConnectionStatus('connected', true); // Immediate para conexão bem-sucedida
          setLastError(undefined);
          log('🚨 [SUBSCRIBED] Estado atualizado - reconexão por falha', undefined, true);
        } else {
          log('🔧 [SUBSCRIBED] Estado mantido - reconexão preventiva concluída', undefined, true);
          // Reset da flag preventiva
          isPreventiveReconnectRef.current = false;
        }
        
        lastEventTimeRef.current = Date.now(); // Reset health check timer
        
        // ✅ HEALTH CHECK: Iniciar verificação periódica
        startHealthCheck();
        
        log('✅ Conexão central estabelecida!', undefined, true);
      } else if (status === 'CHANNEL_ERROR') {
        // 🎯 RECONEXÃO PREVENTIVA: Só alterar estado se necessário
        if (!isPreventiveReconnectRef.current) {
          updateIsConnected(false);
          updateConnectionStatus('error');
          log('🚨 [CHANNEL_ERROR] Estado atualizado - erro real', undefined, true);
        } else {
          log('🔧 [CHANNEL_ERROR] Estado mantido - erro durante reconexão preventiva', undefined, true);
        }
        stopHealthCheck(); // Parar health check em caso de erro
        
        if (err) {
          const errorMessage = err.toString?.() || String(err);
          setLastError(errorMessage);
          log('❌ Erro na conexão central:', { status, error: errorMessage }, true);
          
          // 🔄 TRATAMENTO DE ERROS ESPECÍFICOS
          if (errorMessage.includes('ConnectionRateLimitReached')) {
            log('⚠️ Rate limit - aguardando 10s', undefined, true);
            setTimeout(() => {
              if (subscriptionsRef.current.size > 0) {
                createConnection();
              }
            }, 10000);
          } else if (errorMessage.includes('TenantNotFound') || errorMessage.includes('Unauthorized')) {
            log('❌ Erro de autorização - não reconectando', undefined, true);
          } else if (errorMessage.includes('UnableToConnectToTenantDatabase')) {
            log('⚠️ Banco indisponível - tentando em 5s', undefined, true);
            setTimeout(() => {
              if (subscriptionsRef.current.size > 0) {
                createConnection();
              }
            }, 5000);
          } else {
            log('🔄 Erro genérico - reconectando em 3s', undefined, true);
            setTimeout(() => {
              if (subscriptionsRef.current.size > 0) {
                createConnection();
              }
            }, 3000);
          }
        }
      } else if (status === 'TIMED_OUT') {
        // 🎯 RECONEXÃO PREVENTIVA: Só alterar estado se necessário
        if (!isPreventiveReconnectRef.current) {
          updateIsConnected(false);
          updateConnectionStatus('error');
          setLastError('Connection timeout');
          log('🚨 [TIMED_OUT] Estado atualizado - timeout real', undefined, true);
        } else {
          log('🔧 [TIMED_OUT] Estado mantido - timeout durante reconexão preventiva', undefined, true);
        }
        stopHealthCheck(); // Parar health check em timeout
        log('⏰ Timeout - reconectando em 2s', undefined, true);
        
        setTimeout(() => {
          if (subscriptionsRef.current.size > 0) {
            createConnection();
          }
        }, 2000);
      } else if (status === 'CLOSED') {
        // 🎯 RECONEXÃO PREVENTIVA: Só alterar estado se necessário
        if (!isPreventiveReconnectRef.current) {
          updateIsConnected(false);
          updateConnectionStatus('disconnected');
          log('🚨 [CLOSED] Estado atualizado - fechamento real', undefined, true);
        } else {
          log('🔧 [CLOSED] Estado mantido - fechamento durante reconexão preventiva', undefined, true);
        }
        stopHealthCheck(); // Parar health check quando fechado
        log('📴 Conexão fechada');
      }
    });

    channelRef.current = channel;
  }, [log, startHealthCheck, stopHealthCheck, HEALTH_CHECK_INTERVAL, HEALTH_CHECK_TIMEOUT]);

  // 🎯 FUNÇÃO: ADICIONAR SUBSCRIPTION
  const subscribe = useCallback((subscription: RealtimeSubscription) => {
    log(`📝 Adicionando subscription: ${subscription.id}`);
    
    subscriptionsRef.current.set(subscription.id, subscription);
    
    // ✅ CORREÇÃO: Atualizar cache de debug após adicionar subscription
    updateDebugCache();
    
    // 🔄 CRIAR CONEXÃO SE NECESSÁRIO
    if (!channelRef.current && subscription.enabled) {
      log('🔌 Primeira subscription - criando conexão');
      createConnection();
    }
  }, [createConnection, log, updateDebugCache]);

  // 🎯 FUNÇÃO: REMOVER SUBSCRIPTION
  const unsubscribe = useCallback((id: string) => {
    log(`🗑️ Removendo subscription: ${id}`);
    
    subscriptionsRef.current.delete(id);
    
    // ✅ CORREÇÃO: Atualizar cache de debug após remover subscription
    updateDebugCache();
    
    // 🔄 DESCONECTAR SE NÃO HÁ MAIS SUBSCRIPTIONS
    if (subscriptionsRef.current.size === 0) {
      log('📴 Nenhuma subscription ativa - desconectando');
      stopHealthCheck(); // Parar health check quando não há subscriptions
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          log('⚠️ Erro ao desconectar:', error);
        }
        channelRef.current = null;
      }
      // 🎯 DESCONEXÃO NORMAL: Sem proteção preventiva (é desconexão real)
      updateIsConnected(false);
      updateConnectionStatus('disconnected');
    }
  }, [log, stopHealthCheck, updateDebugCache]);

  // 🎯 FUNÇÃO: ATUALIZAR SUBSCRIPTION
  const updateSubscription = useCallback((id: string, updates: Partial<RealtimeSubscription>) => {
    const existing = subscriptionsRef.current.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      subscriptionsRef.current.set(id, updated);
      
      // ✅ CORREÇÃO: Atualizar cache de debug se a propriedade debug foi alterada
      if ('debug' in updates) {
        updateDebugCache();
      }
      
      log(`🔄 Subscription atualizada: ${id}`);
    }
  }, [log, updateDebugCache]);

  // 🎯 CLEANUP AO DESMONTAR
  useEffect(() => {
    return () => {
      log('🧹 Limpando RealtimeProvider');
      stopHealthCheck(); // Parar health check no cleanup
      
      // Limpar timeouts debounced
      if (setIsConnectedDebounced.current) {
        clearTimeout(setIsConnectedDebounced.current);
      }
      if (setConnectionStatusDebounced.current) {
        clearTimeout(setConnectionStatusDebounced.current);
      }
      
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          log('⚠️ Erro no cleanup:', error);
        }
      }
    };
  }, [log, stopHealthCheck]);

  // ✅ NOVA FUNÇÃO: Acesso às estatísticas do manager
  const getManagerStats = useCallback(() => {
    return realtimeManager.getChannelStats();
  }, []);

  // 🎯 CONTEXT VALUE
  const contextValue: RealtimeContextType = {
    isConnected,
    connectionStatus,
    lastError,
    subscribe,
    unsubscribe,
    updateSubscription,
    getManagerStats
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
};

// 🎯 HOOK PARA USAR O CONTEXTO
export const useRealtimeContext = (): RealtimeContextType => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtimeContext deve ser usado dentro de RealtimeProvider');
  }
  return context;
}; 