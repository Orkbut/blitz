/**
 * 📖 EXEMPLOS DE USO DOS WRAPPERS DE COMPATIBILIDADE
 * 
 * Demonstra como usar os wrappers para manter compatibilidade durante a migração.
 */

'use client';

import React, { useState, useCallback } from 'react';

// Imports dos wrappers (mantêm compatibilidade total)
import { 
  useRealtimeOperacoes,
  useRealtimePuro,
  useRealtimeSimple,
  useRealtimeEventos,
  useRealtimeCentralized,
  useRealtimeUnificado,
  useRealtimeCalendarioSupervisor
} from '../legacy-wrappers';

/**
 * 🎯 EXEMPLO 1: useRealtimeOperacoes
 * 
 * Uso idêntico ao hook original, mas internamente usa useRealtimeUnified.
 */
export const ExemploRealtimeOperacoes: React.FC = () => {
  const [operacaoIds] = useState([1, 2, 3]);
  const [eventos, setEventos] = useState<string[]>([]);

  const handleUpdate = useCallback((operacaoId: number, eventType?: string) => {
    const evento = `Op ${operacaoId}: ${eventType}`;
    setEventos(prev => [...prev.slice(-9), evento]); // Manter últimos 10
  }, []);

  const { isConnected, channelName, isStable } = useRealtimeOperacoes({
    operacaoIds,
    onUpdate: handleUpdate,
    enabled: true,
    forceRefreshTriggers: true,
    isVisible: true
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">🎯 useRealtimeOperacoes</h3>
      <div className="space-y-2">
        <div>Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}</div>
        <div>Canal: {channelName}</div>
        <div>Estável: {isStable ? '✅' : '⏳'}</div>
        <div>
          <strong>Eventos recentes:</strong>
          <ul className="text-sm">
            {eventos.map((evento, i) => (
              <li key={i}>{evento}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 EXEMPLO 2: useRealtimePuro
 * 
 * Hook "ultra-estável" com zero re-renders desnecessários.
 */
export const ExemploRealtimePuro: React.FC = () => {
  const [operacaoIds] = useState([1, 2]);
  const [eventos, setEventos] = useState<any[]>([]);

  const handleUpdate = useCallback((operacaoId: number, eventType: string) => {
    console.log(`[Puro] Op ${operacaoId}: ${eventType}`);
  }, []);

  const handleDataChange = useCallback(() => {
    console.log('[Puro] Dados alterados');
  }, []);

  const handleNovoEvento = useCallback((evento: any) => {
    setEventos(prev => [...prev.slice(-4), evento]); // Últimos 5
  }, []);

  const { isConnected, debugInfo, reconnect } = useRealtimePuro({
    operacaoIds,
    enabled: true,
    onUpdate: handleUpdate,
    onDataChange: handleDataChange,
    onNovoEvento: handleNovoEvento
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">🎯 useRealtimePuro</h3>
      <div className="space-y-2">
        <div>Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}</div>
        <div>Debug: {debugInfo}</div>
        <button 
          onClick={reconnect}
          className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Reconectar
        </button>
        <div>
          <strong>Eventos histórico:</strong>
          <ul className="text-sm">
            {eventos.map((evento, i) => (
              <li key={i}>{evento.tipo_evento} - {evento.servidor_nome}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 EXEMPLO 3: useRealtimeSimple
 * 
 * Interface mais simples para casos básicos.
 */
export const ExemploRealtimeSimple: React.FC = () => {
  const [operacaoEvents, setOperacaoEvents] = useState<any[]>([]);
  const [participacaoEvents, setParticipacaoEvents] = useState<any[]>([]);

  const handleOperacaoChange = useCallback((payload: any) => {
    setOperacaoEvents(prev => [...prev.slice(-2), payload]); // Últimos 3
  }, []);

  const handleParticipacaoChange = useCallback((payload: any) => {
    setParticipacaoEvents(prev => [...prev.slice(-2), payload]); // Últimos 3
  }, []);

  const { isConnected } = useRealtimeSimple({
    enabled: true,
    onOperacaoChange: handleOperacaoChange,
    onParticipacaoChange: handleParticipacaoChange,
    debug: false
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">🎯 useRealtimeSimple</h3>
      <div className="space-y-2">
        <div>Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}</div>
        
        <div>
          <strong>Eventos Operação:</strong>
          <ul className="text-sm">
            {operacaoEvents.map((event, i) => (
              <li key={i}>{event.eventType} - ID: {event.new?.id || event.old?.id}</li>
            ))}
          </ul>
        </div>
        
        <div>
          <strong>Eventos Participação:</strong>
          <ul className="text-sm">
            {participacaoEvents.map((event, i) => (
              <li key={i}>{event.eventType} - Op: {event.new?.operacao_id || event.old?.operacao_id}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 EXEMPLO 4: useRealtimeEventos
 * 
 * Monitoramento específico de eventos de operação.
 */
export const ExemploRealtimeEventos: React.FC = () => {
  const [operacaoIds] = useState([1, 2]);
  const [eventos, setEventos] = useState<any[]>([]);

  const handleNovoEvento = useCallback((evento: any) => {
    setEventos(prev => [...prev.slice(-4), evento]); // Últimos 5
  }, []);

  // Hook não retorna nada (void)
  useRealtimeEventos({
    operacaoIds,
    onNovoEvento: handleNovoEvento,
    enabled: true
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">🎯 useRealtimeEventos</h3>
      <div className="space-y-2">
        <div>Monitorando operações: {operacaoIds.join(', ')}</div>
        
        <div>
          <strong>Novos eventos:</strong>
          <ul className="text-sm">
            {eventos.map((evento, i) => (
              <li key={i}>
                {evento.tipo_evento} - {evento.servidor_nome} 
                <span className="text-gray-500">({new Date(evento.data_evento).toLocaleTimeString()})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 EXEMPLO 5: useRealtimeUnificado
 * 
 * Hook mais completo com fetch + realtime + polling.
 */
export const ExemploRealtimeUnificado: React.FC = () => {
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-31');
  const [operacaoIds] = useState([1, 2, 3]);

  const handleUpdate = useCallback((operacaoId: number, eventType?: string) => {
    console.log(`[Unificado] Op ${operacaoId}: ${eventType}`);
  }, []);

  const {
    operacoes,
    loading,
    error,
    refetch,
    isActive,
    isVisible,
    isConnected,
    forceExecute,
    reconnect
  } = useRealtimeUnificado({
    startDate,
    endDate,
    operacaoIds,
    enabled: true,
    isVisible: true,
    onUpdate: handleUpdate,
    activeInterval: 5000,
    inactiveInterval: 30000
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">🎯 useRealtimeUnificado</h3>
      <div className="space-y-2">
        <div className="flex gap-4">
          <span>Conectado: {isConnected ? '🟢' : '🔴'}</span>
          <span>Ativo: {isActive ? '🟢' : '🟡'}</span>
          <span>Visível: {isVisible ? '👁️' : '🙈'}</span>
        </div>
        
        <div>
          <span>Operações: {operacoes.length}</span>
          {loading && <span className="ml-2">⏳ Carregando...</span>}
          {error && <span className="ml-2 text-red-500">❌ {error}</span>}
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => refetch('manual')}
            className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
          >
            Refetch
          </button>
          <button 
            onClick={forceExecute}
            className="px-2 py-1 bg-green-500 text-white rounded text-sm"
          >
            Force Execute
          </button>
          <button 
            onClick={reconnect}
            className="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
          >
            Reconectar
          </button>
        </div>
        
        <div>
          <strong>Operações:</strong>
          <ul className="text-sm">
            {operacoes.slice(0, 3).map((op: any) => (
              <li key={op.id}>
                {op.modalidade} - {op.data_operacao} ({op.participantes_confirmados || 0} participantes)
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 EXEMPLO 6: useRealtimeCalendarioSupervisor
 * 
 * Monitoramento específico para calendário de supervisor.
 */
export const ExemploRealtimeCalendarioSupervisor: React.FC = () => {
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-31');
  const [operacaoChanges, setOperacaoChanges] = useState<string[]>([]);
  const [participacaoChanges, setParticipacaoChanges] = useState<string[]>([]);

  const handleOperacaoChange = useCallback((operacaoId: number, changeType: string) => {
    const change = `Op ${operacaoId}: ${changeType}`;
    setOperacaoChanges(prev => [...prev.slice(-2), change]); // Últimos 3
  }, []);

  const handleParticipacaoChange = useCallback((operacaoId: number, changeType: string) => {
    const change = `Op ${operacaoId}: ${changeType}`;
    setParticipacaoChanges(prev => [...prev.slice(-2), change]); // Últimos 3
  }, []);

  const {
    isConnected,
    connectionStatus,
    eventsReceived,
    lastEventTime,
    reconnect
  } = useRealtimeCalendarioSupervisor({
    startDate,
    endDate,
    enabled: true,
    onOperacaoChange: handleOperacaoChange,
    onParticipacaoChange: handleParticipacaoChange,
    debug: false
  });

  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-2">🎯 useRealtimeCalendarioSupervisor</h3>
      <div className="space-y-2">
        <div>Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'} ({connectionStatus})</div>
        <div>Eventos recebidos: {eventsReceived}</div>
        <div>Último evento: {lastEventTime ? new Date(lastEventTime).toLocaleTimeString() : 'Nenhum'}</div>
        <div>Período: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</div>
        
        <button 
          onClick={reconnect}
          className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Reconectar
        </button>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>Mudanças Operação:</strong>
            <ul className="text-sm">
              {operacaoChanges.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <strong>Mudanças Participação:</strong>
            <ul className="text-sm">
              {participacaoChanges.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 🎯 COMPONENTE PRINCIPAL COM TODOS OS EXEMPLOS
 */
export const LegacyWrappersExamples: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">🔄 Exemplos de Wrappers de Compatibilidade</h1>
        <p className="text-gray-600">
          Demonstra como usar os wrappers para manter compatibilidade durante a migração para useRealtimeUnified.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ExemploRealtimeOperacoes />
        <ExemploRealtimePuro />
        <ExemploRealtimeSimple />
        <ExemploRealtimeEventos />
        <ExemploRealtimeUnificado />
        <ExemploRealtimeCalendarioSupervisor />
      </div>
      
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-bold text-yellow-800 mb-2">⚠️ Aviso de Migração</h3>
        <p className="text-yellow-700">
          Estes wrappers mantêm compatibilidade total com os hooks originais, mas são temporários.
          Recomenda-se migrar gradualmente para <code>useRealtimeUnified</code> para melhor performance e funcionalidades.
        </p>
      </div>
    </div>
  );
};

export default LegacyWrappersExamples;