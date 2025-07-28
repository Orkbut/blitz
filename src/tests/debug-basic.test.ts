/**
 * 🧪 TESTE BÁSICO - SISTEMA DE DEBUG
 * 
 * Teste simples para verificar se o sistema de debug está funcionando.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { debugLogger, LogLevel } from '../hooks/utils/debug-logger';

describe('Debug Logger - Teste Básico', () => {
  beforeEach(() => {
    debugLogger.clearLogs();
  });

  it('deve registrar e recuperar logs', () => {
    debugLogger.info('Teste básico');
    debugLogger.error('Erro de teste');
    
    const logs = debugLogger.getLogs();
    expect(logs.length).toBe(2);
    
    const infoLog = logs.find(log => log.level === LogLevel.INFO);
    const errorLog = logs.find(log => log.level === LogLevel.ERROR);
    
    expect(infoLog?.message).toBe('Teste básico');
    expect(errorLog?.message).toBe('Erro de teste');
  });

  it('deve filtrar logs por nível', () => {
    debugLogger.error('Erro');
    debugLogger.warn('Warning');
    debugLogger.info('Info');
    debugLogger.debug('Debug');

    const errorLogs = debugLogger.getLogs({ level: LogLevel.ERROR });
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].level).toBe(LogLevel.ERROR);
  });

  it('deve exportar logs como JSON válido', () => {
    debugLogger.info('Teste de exportação');
    
    const exported = debugLogger.exportLogs();
    expect(typeof exported).toBe('string');
    
    const parsed = JSON.parse(exported);
    expect(parsed.logs).toBeDefined();
    expect(Array.isArray(parsed.logs)).toBe(true);
    expect(parsed.logs.length).toBe(1);
  });
});