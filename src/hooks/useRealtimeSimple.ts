'use client';

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UseRealtimeSimpleParams {
  enabled?: boolean;
  onOperacaoChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onParticipacaoChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
  debug?: boolean;
}

export const useRealtimeSimple = ({
  enabled = true,
  onOperacaoChange,
  onParticipacaoChange,
  debug = false
}: UseRealtimeSimpleParams) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isConnectedRef = useRef(false);

  // ✅ REFS PARA CALLBACKS - Evitam reconexões desnecessárias
  const onOperacaoChangeRef = useRef(onOperacaoChange);
  const onParticipacaoChangeRef = useRef(onParticipacaoChange);

  // ✅ Atualizar refs sempre que callbacks mudarem (sem causar re-render)
  onOperacaoChangeRef.current = onOperacaoChange;
  onParticipacaoChangeRef.current = onParticipacaoChange;

  const log = useCallback((message: string, data?: any) => {
    // Log silencioso
  }, [debug]);

  // ✅ RATE LIMIT PROTECTION - Conforme documentação Supabase (100 joins/second)
  const lastConnectionAttempt = useRef(0);
  const connectionAttempts = useRef(0);
  const lastResetTime = useRef(Date.now());
  
  const MIN_RECONNECT_INTERVAL = 1000; // 1 segundo entre tentativas
  const MAX_JOINS_PER_SECOND = 5; // Bem abaixo do limite de 100 para segurança
  const RATE_LIMIT_WINDOW = 1000; // 1 segundo

  useEffect(() => {
    if (!enabled) {
      log('Realtime desabilitado');
      return;
    }

    // ✅ PROTEÇÃO CONTRA RATE LIMIT SUPABASE (100 joins/second)
    const now = Date.now();
    
    // Reset contador se passou mais de 1 segundo
    if (now - lastResetTime.current >= RATE_LIMIT_WINDOW) {
      connectionAttempts.current = 0;
      lastResetTime.current = now;
    }
    
    // Verificar se excedeu tentativas por segundo
    if (connectionAttempts.current >= MAX_JOINS_PER_SECOND) {
      log(`⚠️ Rate limit local atingido (${connectionAttempts.current}/${MAX_JOINS_PER_SECOND} por segundo)`);
      return;
    }
    
    // Verificar intervalo mínimo entre tentativas
    if (now - lastConnectionAttempt.current < MIN_RECONNECT_INTERVAL) {
      log('Ignorando tentativa de reconexão (intervalo mínimo)');
      return;
    }
    
    connectionAttempts.current++;
    lastConnectionAttempt.current = now;

    // Limpar canal anterior se existir
    if (channelRef.current) {
      log('Limpando canal anterior');
      channelRef.current.unsubscribe();
      channelRef.current = null;
      isConnectedRef.current = false;
    }

    // Criar novo canal com nome único
    const channelName = `realtime-simple-${Date.now()}`;
    log('Criando novo canal:', channelName);

    const channel = supabase.channel(channelName, {
      config: {
        // ✅ CONFIGURAÇÕES OTIMIZADAS CONFORME DOCUMENTAÇÃO SUPABASE
        presence: { key: '' },
        broadcast: { self: false, ack: false }
      }
    });

    // ✅ LISTENERS USANDO REFS - Callbacks estáveis
    if (onOperacaoChangeRef.current) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operacao'
        },
        (payload) => {
          log('Evento operacao recebido:', payload);
          // ✅ Usar callback através da ref (sempre atualizada)
          onOperacaoChangeRef.current?.(payload);
        }
      );
    }

    if (onParticipacaoChangeRef.current) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participacao'
        },
        (payload) => {
          log('Evento participacao recebido:', payload);
          // ✅ Usar callback através da ref (sempre atualizada)
          onParticipacaoChangeRef.current?.(payload);
        }
      );
    }

    // ✅ ERROR HANDLING CONFORME DOCUMENTAÇÃO SUPABASE
    channel.subscribe((status, err) => {
      log('Status da subscription:', status);
      
      if (status === 'SUBSCRIBED') {
        isConnectedRef.current = true;
        log('✅ Conectado ao realtime!');
      } else if (status === 'CHANNEL_ERROR') {
        isConnectedRef.current = false;
        log('❌ Erro no canal:', { status, error: err });
        
        // ✅ TRATAMENTO ESPECÍFICO PARA ERROS SUPABASE CONFORME DOCUMENTAÇÃO
        if (err) {
          const errorMessage = err.toString?.() || String(err);
          
          // Verificar códigos de erro documentados
          if (errorMessage.includes('ConnectionRateLimitReached')) {
            log('⚠️ Rate limit atingido - aguardando antes de reconectar');
            setTimeout(() => {
              if (enabled && !channelRef.current) {
                lastConnectionAttempt.current = 0;
              }
            }, 10000); // 10 segundos para rate limit
          } else if (errorMessage.includes('TenantNotFound') || errorMessage.includes('Unauthorized')) {
            log('❌ Erro de autorização - não tentando reconectar');
            return; // Não tentar reconectar para erros de auth
          } else if (errorMessage.includes('DatabaseConnectionIssue') || errorMessage.includes('UnableToConnectToTenantDatabase')) {
            log('⚠️ Problema de conexão com banco - tentando reconectar em 5s');
            setTimeout(() => {
              if (enabled && !channelRef.current) {
                lastConnectionAttempt.current = 0;
              }
            }, 5000);
          } else {
            // Erro genérico - reconexão normal
            setTimeout(() => {
              if (enabled && !channelRef.current) {
                log('🔄 Tentando reconectar...');
                lastConnectionAttempt.current = 0;
              }
            }, 3000);
          }
        }
      } else if (status === 'TIMED_OUT') {
        isConnectedRef.current = false;
        log('⏰ Timeout na conexão - reconectando');
        
        setTimeout(() => {
          if (enabled && !channelRef.current) {
            log('🔄 Reconectando após timeout...');
            lastConnectionAttempt.current = 0;
          }
        }, 2000);
      } else if (status === 'CLOSED') {
        isConnectedRef.current = false;
        log('📴 Status da subscription: CLOSED');
      }
    });

    channelRef.current = channel;

    // ✅ CLEANUP ROBUSTO
    return () => {
      log('Limpando subscription');
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (error) {
          log('Erro ao fazer unsubscribe:', error);
        }
        channelRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [enabled, log]); // ✅ DEPENDÊNCIAS MÍNIMAS E ESTÁVEIS

  return {
    isConnected: isConnectedRef.current,
    channel: channelRef.current
  };
}; 