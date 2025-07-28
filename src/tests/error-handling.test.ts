/**
 * 🧪 TESTES PARA SISTEMA DE TRATAMENTO DE ERROS
 * 
 * Testa classificação, recuperação e boundary de erros realtime
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  RealtimeErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  RealtimeError
} from '../hooks/types/error-types';
import { ErrorClassifier } from '../hooks/utils/error-classifier';
import { ErrorRecoveryManager } from '../hooks/utils/error-recovery';
import { RealtimeErrorHandler } from '../hooks/utils/error-handler';
import { rateLimiter } from '../hooks/utils/rate-limiter';

// 🎯 MOCKS
const mockOperation = vi.fn();
const mockFallback = vi.fn();
const mockErrorCallback = vi.fn();
const mockRecoveryCallback = vi.fn();

describe('ErrorClassifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classify', () => {
    it('deve classificar erro de conexão por mensagem', () => {
      const error = new Error('Connection failed');
      const classified = ErrorClassifier.classify(error);

      expect(classified.type).toBe(RealtimeErrorType.CONNECTION_ERROR);
      expect(classified.severity).toBe(ErrorSeverity.HIGH);
      expect(classified.retryable).toBe(true);
      expect(classified.recoveryStrategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
    });

    it('deve classificar erro de rate limit', () => {
      const error = new Error('Rate limit exceeded');
      const classified = ErrorClassifier.classify(error);

      expect(classified.type).toBe(RealtimeErrorType.RATE_LIMIT_ERROR);
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
      expect(classified.retryable).toBe(true);
    });

    it('deve classificar erro de autenticação', () => {
      const error = new Error('Unauthorized access');
      const classified = ErrorClassifier.classify(error);

      expect(classified.type).toBe(RealtimeErrorType.AUTHENTICATION_ERROR);
      expect(classified.severity).toBe(ErrorSeverity.HIGH);
      expect(classified.retryable).toBe(false);
      expect(classified.recoveryStrategy).toBe(RecoveryStrategy.ESCALATE);
    });

    it('deve classificar por código Supabase', () => {
      const error = { 
        code: 'UnableToConnectToProject',
        message: 'Connection error'
      };
      const classified = ErrorClassifier.classify(error);

      expect(classified.type).toBe(RealtimeErrorType.CONNECTION_ERROR);
    });

    it('deve classificar TypeError como validation error', () => {
      const error = new TypeError('Invalid type');
      const classified = ErrorClassifier.classify(error);

      expect(classified.type).toBe(RealtimeErrorType.VALIDATION_ERROR);
      expect(classified.severity).toBe(ErrorSeverity.CRITICAL);
      expect(classified.retryable).toBe(false);
    });

    it('deve incluir contexto no erro classificado', () => {
      const error = new Error('Test error');
      const context = {
        channelId: 'test-channel',
        operation: 'fetch',
        timestamp: Date.now()
      };

      const classified = ErrorClassifier.classify(error, context);

      expect(classified.context).toEqual(expect.objectContaining(context));
      expect(classified.channelId).toBe('test-channel');
    });

    it('deve classificar como UNKNOWN_ERROR quando não consegue identificar', () => {
      const error = new Error('Some random error message');
      const classified = ErrorClassifier.classify(error);

      expect(classified.type).toBe(RealtimeErrorType.UNKNOWN_ERROR);
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('utility methods', () => {
    it('deve verificar se erro é retryable', () => {
      const retryableError = ErrorClassifier.classify(new Error('Connection failed'));
      const nonRetryableError = ErrorClassifier.classify(new TypeError('Invalid'));

      expect(ErrorClassifier.isRetryable(retryableError)).toBe(true);
      expect(ErrorClassifier.isRetryable(nonRetryableError)).toBe(false);
    });

    it('deve verificar se erro é crítico', () => {
      const criticalError = ErrorClassifier.classify(new TypeError('Invalid'));
      const nonCriticalError = ErrorClassifier.classify(new Error('Connection failed'));

      expect(ErrorClassifier.isCritical(criticalError)).toBe(true);
      expect(ErrorClassifier.isCritical(nonCriticalError)).toBe(false);
    });

    it('deve gerar mensagem amigável', () => {
      const error = ErrorClassifier.classify(new Error('Connection failed'));
      const message = ErrorClassifier.getFriendlyMessage(error);

      expect(message).toBe('Problema de conexão. Tentando reconectar...');
    });

    it('deve criar resumo do erro', () => {
      const error = ErrorClassifier.classify(new Error('Test error'));
      const summary = ErrorClassifier.createErrorSummary(error);

      expect(summary).toHaveProperty('type');
      expect(summary).toHaveProperty('severity');
      expect(summary).toHaveProperty('retryable');
      expect(summary).toHaveProperty('message');
      expect(summary).toHaveProperty('timestamp');
    });
  });
});

describe('ErrorRecoveryManager', () => {
  let recoveryManager: ErrorRecoveryManager;

  beforeEach(() => {
    recoveryManager = new ErrorRecoveryManager({
      maxConcurrentRecoveries: 5,
      enableMetrics: true
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    recoveryManager.shutdown();
  });

  describe('recover', () => {
    it('deve executar retry simples com sucesso', async () => {
      const error = ErrorClassifier.classify(new Error('Fetch failed'));
      // Modificar estratégia para RETRY
      Object.defineProperty(error, 'recoveryStrategy', {
        value: RecoveryStrategy.RETRY,
        writable: false
      });

      mockOperation.mockResolvedValueOnce('success');

      const result = await recoveryManager.recover(error, mockOperation);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);
      expect(result.retryCount).toBe(1);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('deve executar retry com falha após esgotar tentativas', async () => {
      const error = ErrorClassifier.classify(new Error('Fetch failed'));
      Object.defineProperty(error, 'recoveryStrategy', {
        value: RecoveryStrategy.RETRY,
        writable: false
      });

      mockOperation.mockRejectedValue(new Error('Still failing'));

      const result = await recoveryManager.recover(error, mockOperation);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);
      expect(result.retryCount).toBeGreaterThan(1);
      expect(mockOperation).toHaveBeenCalledTimes(3); // maxRetries padrão
    }, 10000); // Aumentar timeout para 10s

    it('deve executar exponential backoff', async () => {
      const error = ErrorClassifier.classify(new Error('Connection failed'));
      // Já vem com EXPONENTIAL_BACKOFF por padrão

      mockOperation
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      const result = await recoveryManager.recover(error, mockOperation);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF);
      expect(result.retryCount).toBeGreaterThanOrEqual(2); // Pode ser 2 ou 3 dependendo do timing
      
      // Deve ter levado tempo devido ao backoff
      expect(endTime - startTime).toBeGreaterThan(1000); // Pelo menos 1s de delay
    });

    it('deve executar fallback quando fornecido', async () => {
      const error = ErrorClassifier.classify(new Error('Polling error'));
      Object.defineProperty(error, 'recoveryStrategy', {
        value: RecoveryStrategy.FALLBACK,
        writable: false
      });

      mockFallback.mockResolvedValueOnce('fallback result');

      const result = await recoveryManager.recover(error, undefined, mockFallback);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK);
      expect(result.fallbackUsed).toBe(true);
      expect(mockFallback).toHaveBeenCalledTimes(1);
    });

    it('deve executar escalate para erros não recuperáveis', async () => {
      const error = ErrorClassifier.classify(new TypeError('Invalid type'));
      // Já vem com ESCALATE por padrão

      const result = await recoveryManager.recover(error);

      expect(result.success).toBe(false);
      expect(result.strategy).toBe(RecoveryStrategy.ESCALATE);
      expect(result.error).toBe(error);
    });

    it('deve respeitar limite de recuperações concorrentes', async () => {
      const manager = new ErrorRecoveryManager({ maxConcurrentRecoveries: 1 });
      const error1 = ErrorClassifier.classify(new Error('Error 1'));
      const error2 = ErrorClassifier.classify(new Error('Error 2'));

      // Primeira recuperação que demora
      const promise1 = manager.recover(error1, () => new Promise(resolve => setTimeout(resolve, 100)));
      
      // Segunda recuperação deve falhar por limite
      const result2 = await manager.recover(error2, mockOperation);

      expect(result2.success).toBe(false);
      expect(result2.error?.message).toContain('Limite de recuperações concorrentes');

      await promise1;
      manager.shutdown();
    });
  });

  describe('metrics', () => {
    it('deve coletar métricas de recuperação', async () => {
      const error = ErrorClassifier.classify(new Error('Test error'));
      Object.defineProperty(error, 'recoveryStrategy', {
        value: RecoveryStrategy.RETRY,
        writable: false
      });

      mockOperation.mockResolvedValueOnce('success');

      await recoveryManager.recover(error, mockOperation);

      const metrics = recoveryManager.getMetrics();
      expect(metrics.totalRecoveries).toBe(1);
      expect(metrics.successfulRecoveries).toBe(1);
      expect(metrics.failedRecoveries).toBe(0);
      expect(metrics.averageRecoveryTime).toBeGreaterThanOrEqual(0); // Pode ser 0 se muito rápido
    });
  });

  describe('active recoveries', () => {
    it('deve rastrear recuperações ativas', async () => {
      const error = ErrorClassifier.classify(new Error('Test error'));
      Object.defineProperty(error, 'recoveryStrategy', {
        value: RecoveryStrategy.RETRY,
        writable: false
      });

      const slowOperation = () => new Promise(resolve => setTimeout(resolve, 50));
      
      const promise = recoveryManager.recover(error, slowOperation);
      
      // Verificar que há recuperação ativa
      const active = recoveryManager.getActiveRecoveries();
      expect(active).toHaveLength(1);
      expect(active[0].error).toBe(error);

      await promise;

      // Após completar, não deve haver recuperações ativas
      const activeAfter = recoveryManager.getActiveRecoveries();
      expect(activeAfter).toHaveLength(0);
    });
  });
});

describe('RealtimeErrorHandler', () => {
  let errorHandler: RealtimeErrorHandler;

  beforeEach(() => {
    // Reset rate limiter para evitar interferência entre testes
    rateLimiter.reset();
    
    errorHandler = new RealtimeErrorHandler({
      enableAutoRecovery: true,
      enableLogging: true,
      enableMetrics: true,
      onError: mockErrorCallback,
      onRecovery: mockRecoveryCallback
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    errorHandler.shutdown();
  });

  describe('handleError', () => {
    it('deve manipular erro com recuperação automática', async () => {
      const error = new Error('Connection failed');
      mockOperation.mockResolvedValueOnce('recovered');

      const result = await errorHandler.handleError(error, {}, mockOperation);

      expect(result.success).toBe(true);
      expect(mockErrorCallback).toHaveBeenCalled();
      expect(mockRecoveryCallback).toHaveBeenCalled();
    });

    it('deve usar handler customizado quando disponível', async () => {
      const customHandler = vi.fn().mockResolvedValue({
        success: true,
        strategy: RecoveryStrategy.RETRY,
        retryCount: 1
      });

      errorHandler.setCustomHandler(RealtimeErrorType.CONNECTION_ERROR, customHandler);

      const error = new Error('Connection failed');
      const result = await errorHandler.handleError(error);

      expect(customHandler).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('deve coletar métricas de erro', async () => {
      const error = new Error('Test error');
      await errorHandler.handleError(error);

      const metrics = errorHandler.getMetrics();
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.lastErrorTime).toBeTruthy();
    });

    it('deve manter log de erros', async () => {
      const error = new Error('Test error');
      await errorHandler.handleError(error);

      const log = errorHandler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].error.message).toBe('Test error');
      expect(log[0].resolved).toBe(false);
    });

    it('deve marcar erro como resolvido após recuperação bem-sucedida', async () => {
      const error = new Error('Connection failed');
      mockOperation.mockResolvedValueOnce('recovered');

      await errorHandler.handleError(error, {}, mockOperation);

      const log = errorHandler.getErrorLog();
      const unresolvedErrors = errorHandler.getUnresolvedErrors();
      
      expect(log).toHaveLength(1);
      expect(log[0].resolved).toBe(true);
      expect(log[0].resolutionTime).toBeTruthy();
      expect(unresolvedErrors).toHaveLength(0);
    });
  });

  describe('listeners', () => {
    it('deve notificar listeners de erro', async () => {
      const listener = vi.fn();
      errorHandler.addErrorListener(listener);

      const error = new Error('Test error');
      await errorHandler.handleError(error);

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Test error'
      }));
    });

    it('deve remover listeners', async () => {
      const listener = vi.fn();
      errorHandler.addErrorListener(listener);
      errorHandler.removeErrorListener(listener);

      const error = new Error('Test error');
      await errorHandler.handleError(error);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('deve atualizar configuração', () => {
      const newConfig = { enableAutoRecovery: false };
      errorHandler.updateConfig(newConfig);

      const config = errorHandler.getConfig();
      expect(config.enableAutoRecovery).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('deve limpar log de erros', async () => {
      const error = new Error('Test error');
      await errorHandler.handleError(error);

      expect(errorHandler.getErrorLog()).toHaveLength(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorLog()).toHaveLength(0);
    });

    it('deve limpar métricas', async () => {
      const error = new Error('Test error');
      await errorHandler.handleError(error);

      expect(errorHandler.getMetrics().totalErrors).toBe(1);

      errorHandler.clearMetrics();
      expect(errorHandler.getMetrics().totalErrors).toBe(0);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    // Reset rate limiter para evitar interferência
    rateLimiter.reset();
  });

  it('deve integrar classificação, recuperação e handling', async () => {
    const handler = new RealtimeErrorHandler({
      enableAutoRecovery: true,
      enableMetrics: true
    });

    const originalError = new Error('Connection timeout');
    let attemptCount = 0;
    
    const operation = vi.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Still failing');
      }
      return Promise.resolve('success');
    });

    const result = await handler.handleError(originalError, {}, operation);

    expect(result.success).toBe(true);
    expect(result.retryCount).toBeGreaterThan(1);
    expect(operation).toHaveBeenCalledTimes(3);

    const metrics = handler.getMetrics();
    expect(metrics.totalErrors).toBe(1);
    expect(metrics.successfulRecoveries).toBe(1);

    handler.shutdown();
  });

  it('deve lidar com múltiplos tipos de erro simultaneamente', async () => {
    // Reset rate limiter para este teste específico
    rateLimiter.reset();
    
    const handler = new RealtimeErrorHandler({ enableMetrics: true });

    const errors = [
      new Error('Connection failed'),
      new Error('Rate limit exceeded'),
      new TypeError('Invalid type'),
      new Error('Fetch failed')
    ];

    const results = await Promise.all(
      errors.map(error => handler.handleError(error))
    );

    expect(results).toHaveLength(4);
    
    const metrics = handler.getMetrics();
    expect(metrics.totalErrors).toBe(4);
    expect(metrics.errorsByType[RealtimeErrorType.CONNECTION_ERROR]).toBe(1);
    expect(metrics.errorsByType[RealtimeErrorType.RATE_LIMIT_ERROR]).toBe(1);
    expect(metrics.errorsByType[RealtimeErrorType.VALIDATION_ERROR]).toBe(1);
    expect(metrics.errorsByType[RealtimeErrorType.FETCH_ERROR]).toBe(1);

    handler.shutdown();
  });
});