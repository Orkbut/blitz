'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ==========================================
// 🚀 HOOK REAL-TIME ULTRA-ESTÁVEL
// ZERO re-renders - Todas dependências via refs
// ==========================================

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

export const useRealtimePuro = ({
  operacaoIds = [],
  enabled = true,
  onUpdate,
  onDataChange,
  onNovoEvento
}: UseRealtimePuroParams) => {
  
  // ==========================================
  // 🔧 ESTADOS ULTRA-ESTÁVEIS
  // ==========================================
  const [isConnected, setIsConnected] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('Inicializando...');
  
  // 🎯 REF PARA ESTABILIZAR isConnected (evita re-renders por mudanças constantes)
  const isConnectedStableRef = useRef(false);
  
  // ==========================================
  // 🔧 REFS ESTÁVEIS - NUNCA MUDAM REFERÊNCIA
  // ==========================================
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const lastOperacaoIdsRef = useRef<string>('');
  
  // Callbacks via refs (não causam re-renders)
  const onUpdateRef = useRef(onUpdate);
  const onDataChangeRef = useRef(onDataChange);
  const onNovoEventoRef = useRef(onNovoEvento);
  
  // Atualizar refs silenciosamente (sem re-render)
  onUpdateRef.current = onUpdate;
  onDataChangeRef.current = onDataChange;
  onNovoEventoRef.current = onNovoEvento;
  
  // ==========================================
  // 🔧 DEPENDÊNCIA ULTRA-ESTÁVEL
  // ==========================================
  const operacaoIdsString = useMemo(() => {
    const sorted = [...operacaoIds].sort((a, b) => a - b);
    const result = sorted.join(',');
    console.log(`[REALTIME-ULTRA] 🔄 IDs processados: [${result}]`);
    return result;
  }, [operacaoIds]);
  
  // ==========================================
  // 🔧 SETUP REAL-TIME ULTRA-ESTÁVEL
  // ==========================================
  const setupRealtime = useCallback(() => {
    const renderTime = Date.now();
    console.log(`[REALTIME-ULTRA] 🚀 Setup chamado - ${renderTime}`);
    console.log(`[REALTIME-ULTRA] 📋 Enabled: ${enabled}, IDs: [${operacaoIdsString}]`);
    
    // Verificar se realmente precisa recriar
    if (lastOperacaoIdsRef.current === operacaoIdsString && isSubscribedRef.current) {
      console.log(`[REALTIME-ULTRA] ✅ Canal já ativo para IDs: [${operacaoIdsString}] - SKIP`);
      setDebugInfo(`Canal ativo - IDs: [${operacaoIdsString}]`);
      return;
    }
    
    // Cleanup anterior se existir
    if (channelRef.current) {
      console.log(`[REALTIME-ULTRA] 🧹 Limpando canal anterior`);
      channelRef.current.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
    }
    
    if (!enabled || operacaoIds.length === 0) {
      console.log(`[REALTIME-ULTRA] ⏸️ Desabilitado ou sem operações`);
      if (isConnectedStableRef.current) {
        isConnectedStableRef.current = false;
        setIsConnected(false);
      }
      setDebugInfo('Desabilitado');
      return;
    }

    try {
      const channelName = `ultra-puro-${operacaoIdsString}`;
      console.log(`[REALTIME-ULTRA] 📡 Criando canal: ${channelName}`);
      setDebugInfo(`Criando canal: ${channelName}`);
      
      const channel = supabase
        .channel(channelName)
        // 📋 PARTICIPAÇÕES (EU VOU/CANCELAR)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'participacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const oldData = payload.old as any;
              let operacaoId = null;
              
              if (payload.eventType === 'DELETE') {
                operacaoId = oldData?.operacao_id;
              } else {
                operacaoId = newData?.operacao_id || oldData?.operacao_id;
              }
              
              if (operacaoId && operacaoIds.includes(operacaoId)) {
                console.log(`[REALTIME-ULTRA] 📡 PARTICIPAÇÃO ${payload.eventType} - Op: ${operacaoId}`);
                
                if (onUpdateRef.current) onUpdateRef.current(operacaoId, `PARTICIPACAO_${payload.eventType}`);
                if (onDataChangeRef.current) onDataChangeRef.current();
              }
            } catch (error) {
              console.error('[REALTIME-ULTRA] Erro handler participação:', error);
            }
          }
        )
        // 🔄 OPERAÇÕES (MUDANÇAS GERAIS)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'operacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const oldData = payload.old as any;
              const operacaoId = newData?.id || oldData?.id;
              
              if (operacaoId && operacaoIds.includes(operacaoId)) {
                console.log(`[REALTIME-ULTRA] 🔄 OPERAÇÃO ${payload.eventType} - Op: ${operacaoId}`);
                
                if (onUpdateRef.current) onUpdateRef.current(operacaoId, `OPERACAO_${payload.eventType}`);
                if (onDataChangeRef.current) onDataChangeRef.current();
              }
            } catch (error) {
              console.error('[REALTIME-ULTRA] Erro handler operação:', error);
            }
          }
        )
        // 📋 EVENTOS DE HISTÓRICO (eventos_operacao)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'eventos_operacao'
          },
          (payload) => {
            try {
              const newData = payload.new as any;
              const operacaoId = newData?.operacao_id;
              
              if (operacaoId && operacaoIds.includes(operacaoId)) {
                console.log(`[REALTIME-ULTRA] 📋 EVENTO HISTÓRICO - Op: ${operacaoId} - Tipo: ${newData?.tipo_evento}`);
                
                // Notificar evento específico
                if (onNovoEventoRef.current) {
                  onNovoEventoRef.current(newData as EventoOperacao);
                }
                
                // Notificar mudança geral
                if (onUpdateRef.current) onUpdateRef.current(operacaoId, `EVENTO_INSERT`);
                if (onDataChangeRef.current) onDataChangeRef.current();
              }
            } catch (error) {
              console.error('[REALTIME-ULTRA] Erro handler evento:', error);
            }
          }
        );

      channel.subscribe((status) => {
        console.log(`[REALTIME-ULTRA] 📡 Status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log(`[REALTIME-ULTRA] ✅ CONECTADO: ${channelName}`);
          isSubscribedRef.current = true;
          lastOperacaoIdsRef.current = operacaoIdsString;
          if (!isConnectedStableRef.current) {
            isConnectedStableRef.current = true;
            setIsConnected(true);
            console.log(`🎯 [REALTIME-ULTRA] Conexão estabelecida: ${channelName}`);
          } else {
            console.log(`🎯 [REALTIME-ULTRA] Conexão já estável - SKIP re-render: ${channelName}`);
          }
          setDebugInfo(`Conectado: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[REALTIME-ULTRA] ❌ ERRO: ${channelName}`);
          isSubscribedRef.current = false;
          if (isConnectedStableRef.current) {
            isConnectedStableRef.current = false;
            setIsConnected(false);
          }
          setDebugInfo(`Erro: ${channelName}`);
        } else if (status === 'CLOSED') {
          console.log(`[REALTIME-ULTRA] 🔐 FECHADO: ${channelName}`);
          isSubscribedRef.current = false;
          if (isConnectedStableRef.current) {
            isConnectedStableRef.current = false;
            setIsConnected(false);
          }
          setDebugInfo(`Fechado: ${channelName}`);
        } else if (status === 'TIMED_OUT') {
          console.log(`[REALTIME-ULTRA] ⏱️ TIMEOUT: ${channelName}`);
          isSubscribedRef.current = false;
          if (isConnectedStableRef.current) {
            isConnectedStableRef.current = false;
            setIsConnected(false);
          }
          setDebugInfo(`Timeout: ${channelName}`);
        }
      });

      channelRef.current = channel;
      
    } catch (error) {
      console.error('[REALTIME-ULTRA] Erro ao configurar:', error);
      if (isConnectedStableRef.current) {
        isConnectedStableRef.current = false;
        setIsConnected(false);
      }
      setDebugInfo(`Erro: ${error}`);
    }
  }, [enabled, operacaoIdsString]); // APENAS dependências primitivas

  // ==========================================
  // 🔧 EFFECT ÚNICO E ESTÁVEL
  // ==========================================
  useEffect(() => {
    console.log(`[REALTIME-ULTRA] 🎯 Effect executado - IDs: [${operacaoIdsString}]`);
    setupRealtime();
    
    return () => {
      console.log(`[REALTIME-ULTRA] 🧹 Cleanup`);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
        isSubscribedRef.current = false;
        if (isConnectedStableRef.current) {
          isConnectedStableRef.current = false;
          setIsConnected(false);
        }
      }
    };
  }, [setupRealtime]); // Dependência única e estável

  // ==========================================
  // 🔧 RETORNO ESTÁVEL
  // ==========================================
  return useMemo(() => ({
    isConnected,
    debugInfo,
    reconnect: setupRealtime
  }), [isConnected, debugInfo, setupRealtime]);
}; 