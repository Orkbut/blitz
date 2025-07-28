/**
 * 🧪 TESTES UNITÁRIOS - SISTEMA DE DEBUG
 * 
 * Testa os componentes individuais do sistema de debug e monitoramento.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    debugLogger,
    LogLevel,
    performanceMonitor,
    connectionHealthMonitor,
    debugInfoCollector,
    realtimeDebugger
} from '../hooks/utils';
import { getDebugLogger } from '../hooks/utils/debug-logger';

describe('Sistema de Debug - Testes Unitários', () => {
    beforeEach(() => {
        // Limpar dados antes de cada teste
        debugLogger.clearLogs();
        performanceMonitor.clearData();
        connectionHealthMonitor.clearData();
    });

    afterEach(() => {
        // Cleanup após cada teste
        realtimeDebugger.cleanup();
    });

    describe('Debug Logger', () => {
        it('deve registrar logs com diferentes níveis', () => {
            debugLogger.error('Erro de teste', { code: 'TEST_ERROR' });
            debugLogger.warn('Warning de teste', { type: 'TEST_WARNING' });
            debugLogger.info('Info de teste', { status: 'OK' });
            debugLogger.debug('Debug de teste', { debug: true });

            const logs = debugLogger.getLogs();
            expect(logs.length).toBe(4);

            const errorLog = logs.find(log => log.level === LogLevel.ERROR);
            expect(errorLog).toBeDefined();
            expect(errorLog?.message).toBe('Erro de teste');
            expect(errorLog?.data).toEqual({ code: 'TEST_ERROR' });
        });

        it('deve filtrar logs por nível', () => {
            debugLogger.error('Erro');
            debugLogger.warn('Warning');
            debugLogger.info('Info');
            debugLogger.debug('Debug');

            const errorLogs = debugLogger.getLogs({ level: LogLevel.ERROR });
            expect(errorLogs.length).toBe(1);
            expect(errorLogs[0].level).toBe(LogLevel.ERROR);

            const warnAndAbove = debugLogger.getLogs({ level: LogLevel.WARN });
            expect(warnAndAbove.length).toBe(2);
        });

        it('deve filtrar logs por channelId', () => {
            debugLogger.info('Log canal 1', {}, { channelId: 'channel-1' });
            debugLogger.info('Log canal 2', {}, { channelId: 'channel-2' });
            debugLogger.info('Log canal 1 novamente', {}, { channelId: 'channel-1' });

            const channel1Logs = debugLogger.getLogs({ channelId: 'channel-1' });
            expect(channel1Logs.length).toBe(2);

            const channel2Logs = debugLogger.getLogs({ channelId: 'channel-2' });
            expect(channel2Logs.length).toBe(1);
        });

        it('deve exportar logs como JSON', () => {
            debugLogger.info('Teste de exportação');

            const exported = debugLogger.exportLogs();
            expect(typeof exported).toBe('string');

            const parsed = JSON.parse(exported);
            expect(parsed.logs).toBeDefined();
            expect(parsed.stats).toBeDefined();
            expect(parsed.config).toBeDefined();
        });

        it('deve limitar o número de logs', () => {
            // Configurar limite baixo para teste
            const logger = getDebugLogger({ maxLogEntries: 3 });

            logger.info('Log 1');
            logger.info('Log 2');
            logger.info('Log 3');
            logger.info('Log 4');
            logger.info('Log 5');

            const logs = logger.getLogs();
            expect(logs.length).toBe(3);

            // Deve manter os logs mais recentes
            expect(logs[0].message).toBe('Log 3');
            expect(logs[2].message).toBe('Log 5');
        });
    });

    describe('Performance Monitor', () => {
        it('deve registrar timing de operações', () => {
            performanceMonitor.startTiming('test-operation', { test: true });

            // Simular algum trabalho
            const start = Date.now();
            while (Date.now() - start < 10) {
                // Esperar 10ms
            }

            performanceMonitor.endTiming('test-operation', true, { result: 'success' });

            const metrics = performanceMonitor.getMetrics();
            expect(metrics.connectionTime).toBeGreaterThan(0);
        });

        it('deve registrar eventos de banco de dados', () => {
            performanceMonitor.recordDatabaseEvent('INSERT', 50, 1024);
            performanceMonitor.recordDatabaseEvent('UPDATE', 75, 512);
            performanceMonitor.recordDatabaseEvent('DELETE', 25, 256);

            const metrics = performanceMonitor.getMetrics();
            expect(metrics.totalEventsReceived).toBe(3);
            expect(metrics.averageEventLatency).toBeGreaterThan(0);
        });

        it('deve registrar requisições de rede', () => {
            performanceMonitor.recordNetworkRequest('/api/test', 'GET', 200, true, 2048, false);
            performanceMonitor.recordNetworkRequest('/api/test2', 'POST', 500, false, 0, false);

            const metrics = performanceMonitor.getMetrics();
            expect(metrics.totalNetworkRequests).toBe(2);
            expect(metrics.failedNetworkRequests).toBe(1);
            expect(metrics.networkSuccessRate).toBe(0.5);
            expect(metrics.totalBytesTransferred).toBe(2048);
        });

        it('deve registrar renders de componente', () => {
            performanceMonitor.recordRender('TestComponent', 5, 'props_change', false);
            performanceMonitor.recordRender('TestComponent', 2, 'state_change', true);

            const metrics = performanceMonitor.getMetrics();
            expect(metrics.rerenderCount).toBe(2);
            expect(metrics.skippedRerenders).toBe(1);
            expect(metrics.averageRerenderTime).toBe(3.5);
        });

        it('deve gerar relatório de métricas', () => {
            // Adicionar alguns dados
            performanceMonitor.recordDatabaseEvent('INSERT', 100);
            performanceMonitor.recordNetworkRequest('/api/test', 'GET', 150, true, 1024);
            performanceMonitor.recordRender('TestComponent', 3, 'update');

            const metrics = performanceMonitor.getMetrics();

            expect(typeof metrics.connectionTime).toBe('number');
            expect(typeof metrics.averageEventLatency).toBe('number');
            expect(typeof metrics.totalNetworkRequests).toBe('number');
            expect(typeof metrics.rerenderCount).toBe('number');
            expect(typeof metrics.memoryUsage).toBe('number');
        });

        it('deve limpar dados corretamente', () => {
            performanceMonitor.recordDatabaseEvent('INSERT', 100);
            performanceMonitor.recordNetworkRequest('/api/test', 'GET', 150, true, 1024);

            let metrics = performanceMonitor.getMetrics();
            expect(metrics.totalEventsReceived).toBe(1);
            expect(metrics.totalNetworkRequests).toBe(1);

            performanceMonitor.clearData();

            metrics = performanceMonitor.getMetrics();
            expect(metrics.totalEventsReceived).toBe(0);
            expect(metrics.totalNetworkRequests).toBe(0);
        });
    });

    describe('Connection Health Monitor', () => {
        it('deve registrar eventos de conexão', () => {
            connectionHealthMonitor.recordConnectionEvent('connected');
            connectionHealthMonitor.recordConnectionEvent('disconnected');
            connectionHealthMonitor.recordConnectionEvent('connected');

            // Forçar verificação de saúde
            const healthMetrics = connectionHealthMonitor.forceHealthCheck();

            expect(healthMetrics).toBeDefined();
            expect(healthMetrics.reconnectCount).toBeGreaterThan(0);
        });

        it('deve registrar latência de eventos', () => {
            connectionHealthMonitor.recordEventLatency('INSERT', 50);
            connectionHealthMonitor.recordEventLatency('UPDATE', 100);
            connectionHealthMonitor.recordEventLatency('DELETE', 75);

            const healthMetrics = connectionHealthMonitor.forceHealthCheck();

            expect(healthMetrics.averageLatency).toBeGreaterThan(0);
            expect(healthMetrics.currentLatency).toBeGreaterThan(0);
        });

        it('deve detectar problemas de alta latência', () => {
            // Simular alta latência
            connectionHealthMonitor.recordEventLatency('SLOW_QUERY', 2000);

            const issues = connectionHealthMonitor.getActiveIssues();
            const latencyIssues = issues.filter(issue => issue.type === 'latency');

            expect(latencyIssues.length).toBeGreaterThan(0);
            expect(latencyIssues[0].severity).toBe('high');
        });

        it('deve registrar eventos de dados', () => {
            connectionHealthMonitor.recordDataEvent('received', 'event-1', 'users', 512);
            connectionHealthMonitor.recordDataEvent('lost', 'event-2', 'posts');
            connectionHealthMonitor.recordDataEvent('duplicate', 'event-3', 'comments');

            const healthMetrics = connectionHealthMonitor.forceHealthCheck();

            expect(healthMetrics.eventLossRate).toBeGreaterThan(0);
            expect(healthMetrics.duplicateEventRate).toBeGreaterThan(0);
        });

        it('deve calcular score de saúde', () => {
            // Simular conexão saudável
            connectionHealthMonitor.recordConnectionEvent('connected');
            connectionHealthMonitor.recordEventLatency('INSERT', 50);
            connectionHealthMonitor.recordDataEvent('received', 'event-1', 'users');

            const healthMetrics = connectionHealthMonitor.forceHealthCheck();

            expect(healthMetrics.score).toBeGreaterThanOrEqual(0);
            expect(healthMetrics.score).toBeLessThanOrEqual(100);
            expect(healthMetrics.status).toBeDefined();
        });
    });

    describe('Debug Info Collector', () => {
        it('deve coletar informações básicas de debug', () => {
            const debugInfo = debugInfoCollector.collect({
                channelId: 'test-channel',
                hookType: 'test-hook',
                config: {
                    tables: ['test_table'],
                    enableRealtime: true,
                    enablePolling: false,
                    enableFetch: true,
                    debug: true
                },
                state: {
                    isConnected: true,
                    connectionStatus: 'connected',
                    loading: false,
                    error: null,
                    data: [{ id: 1, name: 'test' }],
                    eventsReceived: 5,
                    reconnectCount: 1
                }
            });

            expect(debugInfo.channelId).toBe('test-channel');
            expect(debugInfo.hookType).toBe('test-hook');
            expect(debugInfo.config.tables).toEqual(['test_table']);
            expect(debugInfo.state.isConnected).toBe(true);
            expect(debugInfo.state.dataCount).toBe(1);
            expect(debugInfo.performance).toBeDefined();
            expect(debugInfo.diagnostics).toBeDefined();
        });

        it('deve gerar recomendações baseadas no estado', () => {
            const debugInfo = debugInfoCollector.collect({
                channelId: 'test-channel',
                hookType: 'test-hook',
                config: {
                    tables: Array.from({ length: 15 }, (_, i) => `table_${i}`), // Muitas tabelas
                    enableRealtime: true,
                    enablePolling: true, // Ambos habilitados
                    enableFetch: true,
                    debug: false // Debug desabilitado com problemas
                },
                state: {
                    isConnected: false,
                    connectionStatus: 'error',
                    loading: false,
                    error: 'Connection failed',
                    data: [],
                    eventsReceived: 0,
                    reconnectCount: 10 // Muitas reconexões
                }
            });

            expect(debugInfo.recommendations.length).toBeGreaterThan(0);

            const hasTableRecommendation = debugInfo.recommendations.some(rec =>
                rec.includes('tables') || rec.includes('filtering')
            );
            expect(hasTableRecommendation).toBe(true);
        });

        it('deve executar diagnósticos', () => {
            const debugInfo = debugInfoCollector.collect({
                channelId: 'test-channel',
                hookType: 'test-hook',
                config: {
                    tables: ['test_table'],
                    enableRealtime: true,
                    enablePolling: false,
                    enableFetch: true,
                    debug: true
                },
                state: {
                    isConnected: true,
                    connectionStatus: 'connected',
                    loading: false,
                    error: null,
                    data: [],
                    eventsReceived: 0,
                    reconnectCount: 0
                }
            });

            expect(debugInfo.diagnostics.networkConnectivity).toBeDefined();
            expect(debugInfo.diagnostics.authenticationStatus).toBeDefined();
            expect(debugInfo.diagnostics.rateLimitStatus).toBeDefined();
            expect(debugInfo.diagnostics.dataIntegrity).toBeDefined();
            expect(Array.isArray(debugInfo.diagnostics.performanceIssues)).toBe(true);
        });

        it('deve exportar informações como JSON', () => {
            const debugInfo = debugInfoCollector.collect({
                channelId: 'test-channel',
                hookType: 'test-hook',
                config: { tables: ['test'], enableRealtime: true, enablePolling: false, enableFetch: false, debug: true },
                state: { isConnected: true, connectionStatus: 'connected', loading: false, error: null, data: [], eventsReceived: 0, reconnectCount: 0 }
            });

            const exported = debugInfoCollector.export(debugInfo);
            expect(typeof exported).toBe('string');

            const parsed = JSON.parse(exported);
            expect(parsed.channelId).toBe('test-channel');
            expect(parsed.hookType).toBe('test-hook');
        });

        it('deve gerar relatório formatado', () => {
            const debugInfo = debugInfoCollector.collect({
                channelId: 'test-channel',
                hookType: 'test-hook',
                config: { tables: ['test'], enableRealtime: true, enablePolling: false, enableFetch: false, debug: true },
                state: { isConnected: true, connectionStatus: 'connected', loading: false, error: null, data: [], eventsReceived: 0, reconnectCount: 0 }
            });

            const report = debugInfoCollector.generateReport(debugInfo);
            expect(typeof report).toBe('string');
            expect(report).toContain('Debug Report');
            expect(report).toContain('test-hook');
            expect(report).toContain('test-channel');
            expect(report).toContain('Configuration');
            expect(report).toContain('Current State');
        });
    });

    describe('Realtime Debugger', () => {
        it('deve criar e gerenciar sessões', () => {
            const sessionId = realtimeDebugger.startSession('test-channel', 'test-hook');

            expect(typeof sessionId).toBe('string');
            expect(sessionId).not.toBe('disabled');

            const session = realtimeDebugger.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session?.channelId).toBe('test-channel');
            expect(session?.hookType).toBe('test-hook');
            expect(session?.events).toEqual([]);

            const activeSessions = realtimeDebugger.getActiveSessions();
            expect(activeSessions.length).toBe(1);
            expect(activeSessions[0].id).toBe(sessionId);
        });

        it('deve adicionar eventos à sessão', () => {
            const sessionId = realtimeDebugger.startSession('test-channel', 'test-hook');

            realtimeDebugger.addEvent(sessionId, 'connection', 'status_change', 'Connected', { status: 'connected' }, 'medium');
            realtimeDebugger.addEvent(sessionId, 'data', 'fetch_start', 'Starting fetch', { reason: 'initial' }, 'low');
            realtimeDebugger.addEvent(sessionId, 'error', 'fetch_failed', 'Fetch failed', { error: 'Network error' }, 'high');

            const session = realtimeDebugger.getSession(sessionId);
            expect(session?.events.length).toBe(3);

            const errorEvent = session?.events.find(e => e.type === 'error');
            expect(errorEvent).toBeDefined();
            expect(errorEvent?.severity).toBe('high');
            expect(errorEvent?.message).toBe('Fetch failed');
        });

        it('deve finalizar sessão e gerar resumo', () => {
            const sessionId = realtimeDebugger.startSession('test-channel', 'test-hook');

            // Adicionar alguns eventos
            realtimeDebugger.addEvent(sessionId, 'connection', 'connected', 'Connected');
            realtimeDebugger.addEvent(sessionId, 'data', 'event_received', 'Data received');
            realtimeDebugger.addEvent(sessionId, 'error', 'connection_lost', 'Connection lost', {}, 'high');

            const endedSession = realtimeDebugger.endSession(sessionId);

            expect(endedSession).toBeDefined();
            expect(endedSession?.endTime).toBeDefined();
            expect(endedSession?.summary).toBeDefined();
            expect(endedSession?.summary?.totalEvents).toBe(3);
            expect(endedSession?.summary?.errorCount).toBe(1);
            expect(endedSession?.summary?.healthScore).toBeLessThan(100);

            // Sessão não deve mais estar ativa
            const activeSessions = realtimeDebugger.getActiveSessions();
            expect(activeSessions.length).toBe(0);
        });

        it('deve exportar sessão como JSON', () => {
            const sessionId = realtimeDebugger.startSession('test-channel', 'test-hook');
            realtimeDebugger.addEvent(sessionId, 'connection', 'connected', 'Connected');

            const exported = realtimeDebugger.exportSession(sessionId);
            expect(typeof exported).toBe('string');

            const parsed = JSON.parse(exported!);
            expect(parsed.id).toBe(sessionId);
            expect(parsed.channelId).toBe('test-channel');
            expect(parsed.events.length).toBe(1);
        });

        it('deve gerar relatório de sessão', () => {
            const sessionId = realtimeDebugger.startSession('test-channel', 'test-hook');
            realtimeDebugger.addEvent(sessionId, 'connection', 'connected', 'Connected');
            realtimeDebugger.addEvent(sessionId, 'error', 'timeout', 'Request timeout', {}, 'medium');

            const report = realtimeDebugger.generateReport(sessionId);
            expect(typeof report).toBe('string');
            expect(report).toContain('Debug Session Report');
            expect(report).toContain('test-channel');
            expect(report).toContain('test-hook');
            expect(report).toContain('Total Events: 2');
            expect(report).toContain('Error Count: 1');
        });

        it('deve fazer cleanup de sessões antigas', () => {
            const sessionId1 = realtimeDebugger.startSession('channel-1', 'hook-1');
            const sessionId2 = realtimeDebugger.startSession('channel-2', 'hook-2');

            // Finalizar uma sessão
            realtimeDebugger.endSession(sessionId1);

            expect(realtimeDebugger.getActiveSessions().length).toBe(1);

            // Cleanup com idade muito baixa (0ms) deve remover sessões finalizadas
            realtimeDebugger.cleanup(0);

            // Sessão ativa deve permanecer
            expect(realtimeDebugger.getActiveSessions().length).toBe(1);
            expect(realtimeDebugger.getSession(sessionId2)).toBeDefined();
        });
    });

    describe('Integração entre Componentes', () => {
        it('deve funcionar com todos os sistemas integrados', () => {
            // Iniciar sessão de debug
            const sessionId = realtimeDebugger.startSession('integration-test', 'test-hook');

            // Simular atividade
            debugLogger.info('Starting integration test', {}, { channelId: 'integration-test' });

            performanceMonitor.startTiming('integration-operation');
            performanceMonitor.recordDatabaseEvent('INSERT', 100, 1024);
            performanceMonitor.endTiming('integration-operation', true);

            connectionHealthMonitor.recordConnectionEvent('connected');
            connectionHealthMonitor.recordEventLatency('INSERT', 100);

            realtimeDebugger.addEvent(sessionId, 'data', 'integration_test', 'Integration test completed');

            // Verificar se todos os sistemas registraram dados
            const logs = debugLogger.getLogs();
            const metrics = performanceMonitor.getMetrics();
            const healthMetrics = connectionHealthMonitor.forceHealthCheck();
            const session = realtimeDebugger.getSession(sessionId);

            expect(logs.length).toBeGreaterThan(0);
            expect(metrics.totalEventsReceived).toBeGreaterThan(0);
            expect(healthMetrics).toBeDefined();
            expect(session?.events.length).toBeGreaterThan(0);

            // Coletar informações de debug
            const debugInfo = debugInfoCollector.collect({
                channelId: 'integration-test',
                hookType: 'test-hook',
                config: { tables: ['test'], enableRealtime: true, enablePolling: false, enableFetch: false, debug: true },
                state: { isConnected: true, connectionStatus: 'connected', loading: false, error: null, data: [], eventsReceived: 1, reconnectCount: 0 }
            });

            expect(debugInfo.performance.totalEventsReceived).toBeGreaterThan(0);
            expect(debugInfo.recentLogs.length).toBeGreaterThan(0);
        });
    });
});