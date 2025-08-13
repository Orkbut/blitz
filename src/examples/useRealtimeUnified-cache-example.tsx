'use client';

import React, { useEffect, useState } from 'react';
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

/**
 * 🚀 EXEMPLO DE USO DO HOOK useRealtimeUnified COM CONTROLE DE CACHE
 * 
 * Este exemplo demonstra como usar as novas funcionalidades de cache:
 * - Visualização de estatísticas de cache
 * - Invalidação seletiva de cache
 * - Limpeza manual do cache
 * - Monitoramento de performance
 */

interface Operacao {
  id: string;
  tipo: string;
  valor: number;
  data: string;
  status: string;
}

const RealtimeCacheExample: React.FC = () => {
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [autoRefreshStats, setAutoRefreshStats] = useState(true);

  // 🎯 CONFIGURAÇÃO DO HOOK COM CACHE OTIMIZADO
  const {
    data,
    loading,
    error,
    isConnected,
    connectionStatus,
    eventsReceived,
    fetchInProgress,
    lastFetchTime,
    fromCache,
    
    // 🚀 NOVOS MÉTODOS DE CONTROLE DE CACHE
    clearCache,
    invalidateCacheForTables,
    getCacheStats,
    
    // Métodos de controle
    refetch,
    reconnect,
    disconnect,
    
    debugInfo
  } = useRealtimeUnified<Operacao>({
    tables: ['operacoes', 'transacoes', 'usuarios'],
    apiEndpoint: '/api/unified/operacoes',
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    
    // ⚡ CONFIGURAÇÕES DE CACHE OTIMIZADAS
    cacheTimeout: 5 * 60 * 1000, // 5 minutos
    initialFetch: true,
    
    // 📊 CONFIGURAÇÕES DE POLLING INTELIGENTE
    activeInterval: 3000,
    inactiveInterval: 30000,
    focusInterval: 2000,
    blurInterval: 60000,
    
    // 🐛 DEBUG HABILITADO
    debug: true,
    
    // 📡 CALLBACKS OTIMIZADOS
    onDataUpdate: (newData) => {
      console.log('📊 Dados atualizados:', {
        count: newData.length,
        fromCache,
        timestamp: new Date().toISOString()
      });
    },
    
    onDatabaseChange: (event) => {
      console.log('🔄 Mudança no banco:', {
        table: event.table,
        eventType: event.eventType,
        timestamp: new Date().toISOString()
      });
    },
    
    onConnectionChange: (status) => {
      console.log('🔌 Status da conexão:', status);
    },
    
    onError: (error) => {
      console.error('❌ Erro no realtime:', error);
    }
  });

  // 📊 ATUALIZAÇÃO AUTOMÁTICA DAS ESTATÍSTICAS DE CACHE
  useEffect(() => {
    if (!autoRefreshStats) return;
    
    const interval = setInterval(() => {
      const stats = getCacheStats();
      setCacheStats(stats);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [getCacheStats, autoRefreshStats]);

  // 🎯 HANDLERS PARA CONTROLE DE CACHE
  const handleClearCache = () => {
    clearCache();
    console.log('🧹 Cache limpo manualmente');
    
    // Atualizar estatísticas imediatamente
    setTimeout(() => {
      setCacheStats(getCacheStats());
    }, 100);
  };

  const handleInvalidateSelected = () => {
    if (selectedTables.length === 0) {
      alert('Selecione pelo menos uma tabela para invalidar');
      return;
    }
    
    invalidateCacheForTables(selectedTables);
    console.log('🗑️ Cache invalidado para tabelas:', selectedTables);
    
    // Atualizar estatísticas
    setTimeout(() => {
      setCacheStats(getCacheStats());
    }, 100);
  };

  const handleTableSelection = (table: string) => {
    setSelectedTables(prev => 
      prev.includes(table) 
        ? prev.filter(t => t !== table)
        : [...prev, table]
    );
  };

  const handleRefreshStats = () => {
    setCacheStats(getCacheStats());
  };

  // 🎨 FORMATAÇÃO DE DADOS
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          🚀 Exemplo de Cache Inteligente - useRealtimeUnified
        </h1>
        
        {/* 📊 STATUS GERAL */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">Status da Conexão</h3>
            <p className={`text-lg font-bold ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              {connectionStatus.toUpperCase()}
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800">Registros</h3>
            <p className="text-lg font-bold text-green-600">
              {data.length} itens
            </p>
            <p className="text-sm text-gray-600">
              {fromCache ? '📦 Do cache' : '🌐 Da API'}
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800">Eventos</h3>
            <p className="text-lg font-bold text-purple-600">
              {eventsReceived}
            </p>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-semibold text-orange-800">Último Fetch</h3>
            <p className="text-sm text-orange-600">
              {formatTime(lastFetchTime)}
            </p>
            {fetchInProgress && (
              <p className="text-xs text-orange-500">⏳ Carregando...</p>
            )}
          </div>
        </div>

        {/* 🚀 CONTROLES DE CACHE */}
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            🚀 Controles de Cache
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controles de Ação */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Ações</h3>
              <div className="space-y-2">
                <button
                  onClick={handleClearCache}
                  className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  🧹 Limpar Todo o Cache
                </button>
                
                <button
                  onClick={() => refetch('manual')}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                  disabled={fetchInProgress}
                >
                  {fetchInProgress ? '⏳ Carregando...' : '🔄 Refetch Manual'}
                </button>
                
                <button
                  onClick={handleRefreshStats}
                  className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  📊 Atualizar Estatísticas
                </button>
              </div>
            </div>
            
            {/* Invalidação Seletiva */}
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">
                Invalidação Seletiva
              </h3>
              
              <div className="space-y-2 mb-3">
                {['operacoes', 'transacoes', 'usuarios'].map(table => (
                  <label key={table} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(table)}
                      onChange={() => handleTableSelection(table)}
                      className="rounded"
                    />
                    <span className="text-sm">{table}</span>
                  </label>
                ))}
              </div>
              
              <button
                onClick={handleInvalidateSelected}
                disabled={selectedTables.length === 0}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors"
              >
                🗑️ Invalidar Selecionadas
              </button>
            </div>
          </div>
        </div>

        {/* 📊 ESTATÍSTICAS DE CACHE */}
        {cacheStats && (
          <div className="bg-indigo-50 p-6 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-indigo-800">
                📊 Estatísticas de Cache
              </h2>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={autoRefreshStats}
                  onChange={(e) => setAutoRefreshStats(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-indigo-700">Auto-refresh</span>
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Tamanho do Cache</h3>
                <p className="text-2xl font-bold text-indigo-600">
                  {cacheStats.size} entradas
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Taxa de Acerto</h3>
                <p className="text-2xl font-bold text-green-600">
                  {(cacheStats.hitRate * 100).toFixed(1)}%
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Uso de Memória</h3>
                <p className="text-2xl font-bold text-orange-600">
                  {formatBytes(cacheStats.memoryUsage)}
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Requisições Pendentes</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {cacheStats.pendingRequests}
                </p>
              </div>
              
              <div className="bg-white p-4 rounded-lg md:col-span-2">
                <h3 className="font-semibold text-gray-700 mb-2">Chaves do Cache</h3>
                <div className="max-h-32 overflow-y-auto">
                  {cacheStats.keys.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {cacheStats.keys.map((key: string, index: number) => (
                        <li key={index} className="text-gray-600 font-mono text-xs">
                          {key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm">Cache vazio</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🐛 DEBUG INFO */}
        <div className="bg-yellow-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-yellow-800 mb-4">
            🐛 Informações de Debug
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-yellow-700 mb-2">Configuração</h3>
              <ul className="text-sm space-y-1">
                <li><strong>Channel ID:</strong> {debugInfo.channelId}</li>
                <li><strong>Tabelas:</strong> {debugInfo.tablesMonitored.join(', ')}</li>
                <li><strong>Intervalo de Polling:</strong> {debugInfo.pollingInterval}ms</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-yellow-700 mb-2">Estado</h3>
              <ul className="text-sm space-y-1">
                <li><strong>Loading:</strong> {loading ? 'Sim' : 'Não'}</li>
                <li><strong>Erro:</strong> {error || 'Nenhum'}</li>
                <li><strong>Conectado:</strong> {isConnected ? 'Sim' : 'Não'}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 📋 DADOS */}
        {data.length > 0 && (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                📋 Dados ({data.length} registros)
              </h2>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.slice(0, 10).map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.tipo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        R$ {item.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'ativo' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {data.length > 10 && (
                <div className="px-6 py-3 bg-gray-50 text-center text-sm text-gray-500">
                  ... e mais {data.length - 10} registros
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimeCacheExample;