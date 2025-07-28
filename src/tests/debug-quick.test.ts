/**
 * 🧪 TESTE RÁPIDO - SISTEMA DE DEBUG
 * 
 * Teste rápido para verificar se o sistema está funcionando sem timeouts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { debugLogger, LogLevel } from '../hooks/utils/debug-logger';
import { performanceMonitor } from '../hooks/utils/performance-monitor';

describe('Debug System - Quick Test', () => {
    beforeEach(() => {
        debugLogger.clearLogs();
        performanceMonitor.clearData();
    });

    it('should log messages', () => {
        const initialCount = debugLogger.getLogs().length;
        debugLogger.info('Test message');
        const logs = debugLogger.getLogs();
        expect(logs.length).toBe(initialCount + 1);

        const testLog = logs.find(log => log.message === 'Test message');
        expect(testLog).toBeDefined();
        expect(testLog?.message).toBe('Test message');
    });

    it('should record performance metrics', () => {
        performanceMonitor.recordDatabaseEvent('INSERT', 100);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.totalEventsReceived).toBe(1);
    });

    it('should export logs', () => {
        debugLogger.info('Export test');
        const exported = debugLogger.exportLogs();
        expect(typeof exported).toBe('string');
        const parsed = JSON.parse(exported);
        expect(parsed.logs).toBeDefined();
    });
});