/**
 * 🔍 EXEMPLO DE USO - SISTEMA DE DEBUG E MONITORAMENTO
 * 
 * Demonstra como usar o sistema completo de debug e monitoramento
 * com os hooks realtime unificados.
 */

import React, { useState, useEffect } from 'react';
import { useRealtimeUnified } from '../useRealtimeUnified';
import {
  debugLogger,
  performanceMonitor,
  connectionHealthMonitor,
  debugInfoCollector,
  realtimeDebugger
} from '../utils';

// 🎯 COMPONENTE DE EXEMPLO COM DEBUG COMPLETO
export const DebugMonitoringExample: React.FC = () => {
  const [debugEnabled, setDebugEnabled] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [debugReport, setDebugReport] = useState<string>('');

  // Hook com debug habilitado
  const {
    data,
    loading,
    error,
    isConnected,
    connectionStatus,
    eventsReceived,
    reconnectCount,
    refetch,
    debugInfo
  } = useRealtimeUnified({
    tables: ['operacao', 'participacao'],
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    apiEndpoint: '/api/operacoes',
    debug: debugEnabled,
    activeInterval: 5000,
    inactiveInterval: 30000,
    onDatabaseChange: (event) => {
      console.log('Database change:', event);
    },
    onConnectionChange: (status) => {
      console.log('Connection status:', status);
    },
    onError: (error) => {
      console.error('Hook error:', error);
    }
  });

  // Gerar relatório de debug
  const generateDebugReport = () => {
    if (typeof debugInfo === 'object' && 'performance' in debugInfo) {
      const report = debugInfoCollector.generateReport(debugInfo);
      setDebugReport(report);
    } else {
      setDebugReport('Debug info not available (debug mode disabled)');
    }
  };

  // Exportar logs
  const exportLogs = () => {
    const logs = debugLogger.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtime-debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Limpar dados de monitoramento
  const clearMonitoringData = () => {
    debugLogger.clearLogs();
    performanceMonitor.clearData();
    connectionHealthMonitor.clearData();
    realtimeDebugger.cleanup();
    setDebugReport('');
  };

  // Simular erro para teste
  const simulateError = () => {
    debugLogger.error('Simulated error for testing', {
      type: 'TEST_ERROR',
      timestamp: Date.now()
    });
  };

  // Obter métricas de performance
  const getPerformanceMetrics = () => {
    const metrics = performanceMonitor.getMetrics();
    console.log('Performance Metrics:', metrics);
    return metrics;
  };

  // Obter saúde da conexão
  const getConnectionHealth = () => {
    const health = connectionHealthMonitor.getHealthMetrics();
    console.log('Connection Health:', health);
    return health;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🔍 Debug & Monitoring Example</h2>
      
      {/* Status da Conexão */}
      <div style={{ 
        padding: '10px', 
        margin: '10px 0', 
        backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
        border: `1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px'
      }}>
        <strong>Connection Status:</strong> {connectionStatus} 
        {isConnected ? ' ✅' : ' ❌'}
        <br />
        <strong>Events Received:</strong> {eventsReceived}
        <br />
        <strong>Reconnects:</strong> {reconnectCount}
        <br />
        <strong>Data Count:</strong> {data.length}
        <br />
        <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
        <br />
        <strong>Error:</strong> {error || 'None'}
      </div>

      {/* Controles de Debug */}
      <div style={{ margin: '20px 0' }}>
        <h3>Debug Controls</h3>
        
        <label style={{ display: 'block', margin: '10px 0' }}>
          <input
            type="checkbox"
            checked={debugEnabled}
            onChange={(e) => setDebugEnabled(e.target.checked)}
          />
          Enable Debug Mode
        </label>

        <button 
          onClick={() => refetch('manual_test')}
          style={{ margin: '5px', padding: '8px 16px' }}
        >
          Manual Refetch
        </button>

        <button 
          onClick={simulateError}
          style={{ margin: '5px', padding: '8px 16px' }}
        >
          Simulate Error
        </button>

        <button 
          onClick={getPerformanceMetrics}
          style={{ margin: '5px', padding: '8px 16px' }}
        >
          Log Performance Metrics
        </button>

        <button 
          onClick={getConnectionHealth}
          style={{ margin: '5px', padding: '8px 16px' }}
        >
          Log Connection Health
        </button>

        <button 
          onClick={generateDebugReport}
          style={{ margin: '5px', padding: '8px 16px' }}
        >
          Generate Debug Report
        </button>

        <button 
          onClick={exportLogs}
          style={{ margin: '5px', padding: '8px 16px' }}
        >
          Export Logs
        </button>

        <button 
          onClick={clearMonitoringData}
          style={{ margin: '5px', padding: '8px 16px', backgroundColor: '#dc3545', color: 'white' }}
        >
          Clear All Data
        </button>
      </div>

      {/* Debug Info */}
      <div style={{ margin: '20px 0' }}>
        <h3>
          Debug Information
          <button 
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            style={{ marginLeft: '10px', padding: '4px 8px' }}
          >
            {showDebugInfo ? 'Hide' : 'Show'}
          </button>
        </h3>
        
        {showDebugInfo && (
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
            fontSize: '12px'
          }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        )}
      </div>

      {/* Debug Report */}
      {debugReport && (
        <div style={{ margin: '20px 0' }}>
          <h3>Debug Report</h3>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '400px',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {debugReport}
          </pre>
        </div>
      )}

      {/* Data Display */}
      <div style={{ margin: '20px 0' }}>
        <h3>Data ({data.length} items)</h3>
        {data.length > 0 ? (
          <div style={{ 
            maxHeight: '300px', 
            overflow: 'auto',
            backgroundColor: '#f8f9fa',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {data.slice(0, 10).map((item: any, index: number) => (
              <div key={index} style={{ 
                padding: '5px', 
                borderBottom: '1px solid #dee2e6',
                fontSize: '12px'
              }}>
                {JSON.stringify(item)}
              </div>
            ))}
            {data.length > 10 && (
              <div style={{ padding: '5px', fontStyle: 'italic' }}>
                ... and {data.length - 10} more items
              </div>
            )}
          </div>
        ) : (
          <p>No data available</p>
        )}
      </div>

      {/* Console Output */}
      <div style={{ margin: '20px 0' }}>
        <h3>Console Output</h3>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Check the browser console for detailed debug logs when debug mode is enabled.
          You can also open the Network tab to see fetch requests and WebSocket connections.
        </p>
      </div>
    </div>
  );
};

// 🎯 COMPONENTE DE MONITORAMENTO EM TEMPO REAL
export const RealtimeMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Atualizar métricas
      const currentMetrics = performanceMonitor.getMetrics();
      setMetrics(currentMetrics);

      // Atualizar saúde
      const currentHealth = connectionHealthMonitor.getHealthMetrics();
      setHealth(currentHealth);

      // Atualizar logs recentes
      const recentLogs = debugLogger.getLogs({ since: Date.now() - 30000 }); // últimos 30s
      setLogs(recentLogs.slice(-10)); // últimos 10 logs
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>📊 Realtime Monitoring Dashboard</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Performance Metrics */}
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <h3>Performance Metrics</h3>
          {metrics ? (
            <div style={{ fontSize: '12px' }}>
              <div>Connection Time: {metrics.connectionTime.toFixed(2)}ms</div>
              <div>Avg Event Latency: {metrics.averageEventLatency.toFixed(2)}ms</div>
              <div>Total Events: {metrics.totalEventsReceived}</div>
              <div>Events/sec: {metrics.eventsPerSecond.toFixed(2)}</div>
              <div>Network Requests: {metrics.totalNetworkRequests}</div>
              <div>Success Rate: {(metrics.networkSuccessRate * 100).toFixed(1)}%</div>
              <div>Memory Usage: {(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</div>
              <div>Rerenders: {metrics.rerenderCount}</div>
            </div>
          ) : (
            <div>Loading metrics...</div>
          )}
        </div>

        {/* Connection Health */}
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <h3>Connection Health</h3>
          {health ? (
            <div style={{ fontSize: '12px' }}>
              <div>Status: <span style={{ 
                color: health.status === 'EXCELLENT' ? 'green' : 
                       health.status === 'GOOD' ? 'blue' :
                       health.status === 'FAIR' ? 'orange' : 'red'
              }}>{health.status}</span></div>
              <div>Score: {health.score}/100</div>
              <div>Uptime: {health.uptime.toFixed(1)}%</div>
              <div>Avg Latency: {health.averageLatency.toFixed(2)}ms</div>
              <div>Reconnects: {health.reconnectCount}</div>
              <div>Network Quality: {health.networkQuality}</div>
              <div>Event Loss Rate: {health.eventLossRate.toFixed(2)}%</div>
              <div>Active Issues: {health.issues.length}</div>
            </div>
          ) : (
            <div>Loading health data...</div>
          )}
        </div>
      </div>

      {/* Recent Logs */}
      <div style={{ 
        margin: '20px 0',
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        <h3>Recent Logs (Last 10)</h3>
        <div style={{ 
          maxHeight: '300px', 
          overflow: 'auto',
          fontSize: '11px'
        }}>
          {logs.length > 0 ? logs.map((log, index) => (
            <div key={index} style={{ 
              padding: '2px 0',
              borderBottom: '1px solid #eee',
              color: log.level === 0 ? 'red' : log.level === 1 ? 'orange' : 'black'
            }}>
              <span style={{ color: '#666' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {' '}
              <span style={{ fontWeight: 'bold' }}>
                [{['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'][log.level]}]
              </span>
              {' '}
              {log.message}
            </div>
          )) : (
            <div>No recent logs</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugMonitoringExample;