/**
 * 🎯 EXEMPLOS DE USO DO HOOK REALTIME UNIFICADO
 * 
 * Demonstra diferentes cenários de uso do useRealtimeUnified
 * para substituir os hooks legados existentes.
 */

'use client';

import React from 'react';
import { useRealtimeUnified } from '../useRealtimeUnified';
import type { UseRealtimeUnifiedConfig } from '../useRealtimeUnified';
import type { DatabaseChangeEvent } from '@/core/infrastructure/services/RealtimeManager';

// 🎯 EXEMPLO 1: USO BÁSICO (substitui useRealtimeSimple)
export const ExemploBasico: React.FC = () => {
  const { data, loading, error, isConnected } = useRealtimeUnified({
    tables: ['operacao', 'participacao'],
    onDatabaseChange: (event: DatabaseChangeEvent) => {
      console.log('Mudança detectada:', event.table, event.eventType);
    }
  });

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h3>Status: {isConnected ? 'Conectado' : 'Desconectado'}</h3>
      <p>Dados recebidos: {data.length} itens</p>
    </div>
  );
};

// 🎯 EXEMPLO 2: COM FILTROS (substitui useRealtimeOperacoes)
export const ExemploComFiltros: React.FC<{ operacaoIds: number[] }> = ({ operacaoIds }) => {
  const config: UseRealtimeUnifiedConfig = {
    tables: ['operacao', 'participacao'],
    filters: {
      operacao: `id.in.(${operacaoIds.join(',')})`,
      participacao: `operacao_id.in.(${operacaoIds.join(',')})`
    },
    onDatabaseChange: (event) => {
      if (event.table === 'operacao') {
        console.log('Operação alterada:', event.payload.new?.id);
      } else if (event.table === 'participacao') {
        console.log('Participação alterada:', event.payload.new?.operacao_id);
      }
    },
    debug: true
  };

  const { 
    isConnected, 
    eventsReceived, 
    reconnectCount, 
    debugInfo,
    reconnect 
  } = useRealtimeUnified(config);

  return (
    <div>
      <h3>Monitoramento de Operações Específicas</h3>
      <p>Status: {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}</p>
      <p>Eventos recebidos: {eventsReceived}</p>
      <p>Reconexões: {reconnectCount}</p>
      <p>Canal: {debugInfo.channelId}</p>
      <p>Tabelas: {debugInfo.tablesMonitored.join(', ')}</p>
      <button onClick={reconnect}>Reconectar</button>
    </div>
  );
};

// 🎯 EXEMPLO 3: COM POLLING INTELIGENTE (substitui useRealtimeUnificado)
export const ExemploComPolling: React.FC = () => {
  const { 
    data, 
    loading, 
    isActive, 
    isVisible, 
    debugInfo,
    refetch,
    forceExecute 
  } = useRealtimeUnified({
    tables: ['operacao'],
    enablePolling: true,
    activeInterval: 3000,      // 3s quando ativo
    inactiveInterval: 15000,   // 15s quando inativo
    focusInterval: 2000,       // 2s quando focado
    blurInterval: 30000,       // 30s quando desfocado
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    onDataUpdate: (newData) => {
      console.log('Dados atualizados:', newData.length, 'itens');
    }
  });

  return (
    <div>
      <h3>Polling Inteligente</h3>
      <div>
        <p>Usuário ativo: {isActive ? '✅' : '❌'}</p>
        <p>Página visível: {isVisible ? '✅' : '❌'}</p>
        <p>Intervalo atual: {debugInfo.pollingInterval}ms</p>
        <p>Carregando: {loading ? '⏳' : '✅'}</p>
      </div>
      <div>
        <button onClick={() => refetch('manual')}>Atualizar Manualmente</button>
        <button onClick={forceExecute}>Forçar Execução</button>
      </div>
      <p>Total de itens: {data.length}</p>
    </div>
  );
};

// 🎯 EXEMPLO 4: MONITORAMENTO DE EVENTOS (substitui useRealtimeEventos)
export const ExemploEventos: React.FC<{ operacaoIds: number[] }> = ({ operacaoIds }) => {
  const [eventos, setEventos] = React.useState<any[]>([]);

  const { isConnected, eventsReceived } = useRealtimeUnified({
    tables: ['eventos_operacao'],
    filters: {
      eventos_operacao: `operacao_id.in.(${operacaoIds.join(',')})`
    },
    onDatabaseChange: (event) => {
      if (event.table === 'eventos_operacao' && event.eventType === 'INSERT') {
        setEventos(prev => [event.payload.new, ...prev.slice(0, 9)]); // Manter últimos 10
      }
    }
  });

  return (
    <div>
      <h3>Monitor de Eventos</h3>
      <p>Status: {isConnected ? '🟢 Online' : '🔴 Offline'}</p>
      <p>Eventos processados: {eventsReceived}</p>
      
      <h4>Últimos Eventos:</h4>
      <ul>
        {eventos.map((evento, index) => (
          <li key={index}>
            <strong>{evento.tipo_evento}</strong> - {evento.servidor_nome} 
            <small> ({new Date(evento.data_evento).toLocaleTimeString()})</small>
          </li>
        ))}
      </ul>
    </div>
  );
};

// 🎯 EXEMPLO 5: CONFIGURAÇÃO AVANÇADA COM TODOS OS RECURSOS
export const ExemploAvancado: React.FC = () => {
  const [configuracao, setConfiguracao] = React.useState<UseRealtimeUnifiedConfig>({
    tables: ['operacao', 'participacao'],
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    activeInterval: 5000,
    inactiveInterval: 30000,
    debug: true,
    onDatabaseChange: (event) => {
      console.log(`[${event.channelId}] ${event.table}.${event.eventType}:`, event.payload);
    },
    onConnectionChange: (status) => {
      console.log('Status da conexão:', status);
    },
    onError: (error) => {
      console.error('Erro no realtime:', error);
    }
  });

  const resultado = useRealtimeUnified(configuracao);

  const toggleRealtime = () => {
    setConfiguracao(prev => ({
      ...prev,
      enableRealtime: !prev.enableRealtime
    }));
  };

  const togglePolling = () => {
    setConfiguracao(prev => ({
      ...prev,
      enablePolling: !prev.enablePolling
    }));
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Configuração Avançada</h3>
      
      {/* Controles */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={toggleRealtime}>
          Realtime: {configuracao.enableRealtime ? 'ON' : 'OFF'}
        </button>
        <button onClick={togglePolling} style={{ marginLeft: '10px' }}>
          Polling: {configuracao.enablePolling ? 'ON' : 'OFF'}
        </button>
        <button onClick={resultado.reconnect} style={{ marginLeft: '10px' }}>
          Reconectar
        </button>
        <button onClick={resultado.disconnect} style={{ marginLeft: '10px' }}>
          Desconectar
        </button>
      </div>

      {/* Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <h4>Estado da Conexão</h4>
          <p>Status: <strong>{resultado.connectionStatus}</strong></p>
          <p>Conectado: {resultado.isConnected ? '✅' : '❌'}</p>
          <p>Último evento: {resultado.lastEventTime ? new Date(resultado.lastEventTime).toLocaleTimeString() : 'Nenhum'}</p>
        </div>
        
        <div>
          <h4>Estatísticas</h4>
          <p>Eventos recebidos: {resultado.eventsReceived}</p>
          <p>Reconexões: {resultado.reconnectCount}</p>
          <p>Usuário ativo: {resultado.isActive ? '✅' : '❌'}</p>
          <p>Página visível: {resultado.isVisible ? '✅' : '❌'}</p>
        </div>
      </div>

      {/* Debug Info */}
      <div style={{ marginTop: '20px' }}>
        <h4>Informações de Debug</h4>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {JSON.stringify(resultado.debugInfo, null, 2)}
        </pre>
      </div>

      {/* Erro */}
      {resultado.error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          <strong>Erro:</strong> {resultado.error}
        </div>
      )}
    </div>
  );
};

// 🎯 COMPONENTE PRINCIPAL DE DEMONSTRAÇÃO
export const ExemplosRealtimeUnified: React.FC = () => {
  return (
    <div>
      <h1>Exemplos do Hook Realtime Unificado</h1>
      
      <ExemploBasico />
      <ExemploComFiltros operacaoIds={[1, 2, 3]} />
      <ExemploComPolling />
      <ExemploEventos operacaoIds={[1, 2, 3]} />
      <ExemploAvancado />
    </div>
  );
};