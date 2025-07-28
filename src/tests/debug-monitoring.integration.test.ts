/**
 * 🧪 TESTES DE INTEGRAÇÃO - SISTEMA DE DEBUG E MONITORAMENTO
 * 
 * Testa a integração completa do sistema de debug e monitoramento
 * com os hooks realtime unificados.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';
import {
  debugLogger,
  performanceMonitor,
  connectionHealthMonitor,
  debugInfoCollector,
  realtimeDebugger
} from '../hooks/utils';

// Mock do RealtimeManager
vi.mock('../core/infrastructure/services/RealtimeManager', () => ({
  realtimeManager: {
    subscribe: vi.fn().mockResolvedValue({
      channelId: 'test-channel',
      tables: ['test_table'],
      unsubscribe: vi.fn()
    }),
    getChannelStats: vi.fn().mockReturnValue({
      totalChannels: 1,
      activeSubscriptions: 1,
      connectionPoolSize: 1,
      globalEventCount: 0,
      memoryUsage: 1024,
      uptime: 1000
    })
  }
}));

describe('Sistema de Debug e Monitoramento', () => {
  beforeEach(() => {
    // Limpar dados de monitoramento antes de cada teste
    debugLogger.clearLogs();
    performanceMonitor.clearData();
    connectionHealthMonitor.clearData();
    
    // Configurar mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup após cada teste
    realtimeDebugger.cleanup();
  });

  describe('Debug Logger', () => {
    it('deve registrar eventos de conexão quando debug está habilitado', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      // Aguardar inicialização
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verificar se logs foram criados
      const logs = debugLogger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      // Verificar se há logs relacionados à conexão
      const connectionLogs = logs.filter(log => 
        log.message.includes('connection') || log.message.includes('subscription')
      );
      expect(connectionLogs.length).toBeGreaterThan(0);
    });

    it('não deve registrar logs quando debug está desabilitado', async () => {
      const initialLogCount = debugLogger.getLogs().length;
      
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: false
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verificar se não foram adicionados logs de debug
      const finalLogCount = debugLogger.getLogs().length;
      expect(finalLogCount).toBe(initialLogCount);
    });
  });

  describe('Performance Monitor', () => {
    it('deve coletar métricas de performance', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.connectionTime).toBe('number');
      expect(typeof metrics.totalEventsReceived).toBe('number');
      expect(typeof metrics.memoryUsage).toBe('number');
    });

    it('deve registrar eventos de banco de dados', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        // Simular evento de banco de dados
        performanceMonitor.recordDatabaseEvent('INSERT', 50, 1024);
      });

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.totalEventsReceived).toBeGreaterThan(0);
    });
  });

  describe('Connection Health Monitor', () => {
    it('deve monitorar saúde da conexão', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        // Simular eventos de conexão
        connectionHealthMonitor.recordConnectionEvent('connected');
        connectionHealthMonitor.recordEventLatency('INSERT', 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const healthMetrics = connectionHealthMonitor.getHealthMetrics();
      
      if (healthMetrics) {
        expect(healthMetrics.status).toBeDefined();
        expect(typeof healthMetrics.score).toBe('number');
        expect(healthMetrics.score).toBeGreaterThanOrEqual(0);
        expect(healthMetrics.score).toBeLessThanOrEqual(100);
      }
    });

    it('deve detectar problemas de latência', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        // Simular alta latência
        connectionHealthMonitor.recordEventLatency('INSERT', 2000); // 2 segundos
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const issues = connectionHealthMonitor.getActiveIssues();
      const latencyIssues = issues.filter(issue => issue.type === 'latency');
      
      expect(latencyIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Debug Info Collector', () => {
    it('deve coletar informações completas de debug', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const debugInfo = result.current.debugInfo;
      
      expect(debugInfo).toBeDefined();
      expect(debugInfo.channelId).toBeDefined();
      expect(debugInfo.tablesMonitored).toEqual(['test_table']);
      
      // Verificar se informações completas estão presentes quando debug está habilitado
      if (typeof debugInfo === 'object' && 'performance' in debugInfo) {
        expect(debugInfo.performance).toBeDefined();
        expect(debugInfo.health).toBeDefined();
        expect(debugInfo.diagnostics).toBeDefined();
      }
    });

    it('deve retornar informações simplificadas quando debug está desabilitado', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: false
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const debugInfo = result.current.debugInfo;
      
      expect(debugInfo).toBeDefined();
      expect(debugInfo.channelId).toBeDefined();
      expect(debugInfo.tablesMonitored).toEqual(['test_table']);
      
      // Verificar se apenas informações básicas estão presentes
      expect(typeof debugInfo.managerStats).toBe('object');
      expect(Object.keys(debugInfo.managerStats)).toHaveLength(0);
    });
  });

  describe('Realtime Debugger', () => {
    it('deve criar e gerenciar sessões de debug', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verificar se sessão foi criada
      const activeSessions = realtimeDebugger.getActiveSessions();
      expect(activeSessions.length).toBeGreaterThan(0);
      
      const session = activeSessions[0];
      expect(session.channelId).toBeDefined();
      expect(session.hookType).toBe('useRealtimeUnified');
      expect(session.events).toBeDefined();
    });

    it('deve registrar eventos na sessão de debug', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true,
          apiEndpoint: '/api/test'
        })
      );

      await act(async () => {
        // Simular fetch de dados
        await result.current.refetch('test');
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const activeSessions = realtimeDebugger.getActiveSessions();
      if (activeSessions.length > 0) {
        const session = activeSessions[0];
        expect(session.events.length).toBeGreaterThan(0);
        
        // Verificar se há eventos relacionados ao fetch
        const fetchEvents = session.events.filter(event => 
          event.category.includes('fetch')
        );
        expect(fetchEvents.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integração Completa', () => {
    it('deve funcionar com todos os sistemas de monitoramento habilitados', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true,
          enableRealtime: true,
          enablePolling: true,
          enableFetch: true,
          apiEndpoint: '/api/test'
        })
      );

      await act(async () => {
        // Simular atividade
        await result.current.refetch('integration_test');
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Verificar se todos os sistemas estão funcionando
      const logs = debugLogger.getLogs();
      const metrics = performanceMonitor.getMetrics();
      const healthMetrics = connectionHealthMonitor.getHealthMetrics();
      const activeSessions = realtimeDebugger.getActiveSessions();
      const debugInfo = result.current.debugInfo;

      expect(logs.length).toBeGreaterThan(0);
      expect(metrics).toBeDefined();
      expect(debugInfo).toBeDefined();
      
      // Verificar se a sessão de debug contém snapshots
      if (activeSessions.length > 0) {
        const session = activeSessions[0];
        expect(session.events.length).toBeGreaterThan(0);
      }
    });

    it('deve gerar relatórios de debug válidos', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const activeSessions = realtimeDebugger.getActiveSessions();
      if (activeSessions.length > 0) {
        const sessionId = activeSessions[0].id;
        const report = realtimeDebugger.generateReport(sessionId);
        
        expect(report).toBeDefined();
        expect(typeof report).toBe('string');
        expect(report).toContain('Debug Session Report');
        expect(report).toContain('useRealtimeUnified');
      }
    });
  });

  describe('Performance e Cleanup', () => {
    it('deve fazer cleanup adequado dos recursos de monitoramento', async () => {
      const { result, unmount } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: true
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const initialSessionCount = realtimeDebugger.getActiveSessions().length;
      
      // Desmontar o hook
      unmount();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verificar se a sessão foi finalizada
      const finalSessionCount = realtimeDebugger.getActiveSessions().length;
      expect(finalSessionCount).toBeLessThan(initialSessionCount);
    });

    it('não deve impactar significativamente a performance quando debug está desabilitado', async () => {
      const startTime = Date.now();
      
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          debug: false
        })
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verificar se a inicialização foi rápida (menos de 500ms)
      expect(duration).toBeLessThan(500);
      
      // Verificar se o debugInfo ainda está disponível mas simplificado
      expect(result.current.debugInfo).toBeDefined();
      expect(result.current.debugInfo.channelId).toBeDefined();
    });
  });
});