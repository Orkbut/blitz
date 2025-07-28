/**
 * 🎯 HANDLER PRINCIPAL DE ERROS REALTIME
 * 
 * Integra classificação, recuperação e logging de erros em uma interface unificada
 * para ser usado pelos hooks realtime.
 */

import {
  RealtimeError,
  RealtimeErrorType,
  ErrorSeverity,
  RecoveryResult,
  ErrorHandler,
  ErrorListener,
  ErrorMetrics,
  ErrorLoggingConfig,
  ErrorLogEntry
} from '../types/error-types';
import { ErrorClassifier } from './error-classifier';
import { ErrorRecoveryManager, errorRecoveryManager } from './error-recovery';
import { rateLimiter, checkRateLimit, recordRequest, recordError } from './rate-limiter';

// 🎯 CONFIGURAÇÃO DO ERROR HANDLER
export interface ErrorHandlerConfig {
  enableAutoRecovery: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxLogEntries: number;
  onError?: ErrorListener;
  onRecovery?: (error: RealtimeError, result: RecoveryResult) => void;
  customHandlers?: Map<RealtimeErrorType, ErrorHandler>;
}

/**
 * 🎯 GERENCIADOR PRINCIPAL DE ERROS REALTIME
 */
export class RealtimeErrorHandler {
  private config: ErrorHandlerConfig;
  private listeners: Set<ErrorListener> = new Set();
  private customHandlers: Map<RealtimeErrorType, ErrorHandler> = new Map();
  private errorLog: ErrorLogEntry[] = [];
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {} as Record<RealtimeErrorType, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recoveryAttempts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0,
    lastErrorTime: null
  };

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableAutoRecovery: true,
      enableLogging: true,
      enableMetrics: true,
      logLevel: 'error',
      maxLogEntries: 100,
      ...config
    };

    // Registrar handlers customizados se fornecidos
    if (config.customHandlers) {
      config.customHandlers.forEach((handler, type) => {
        this.customHandlers.set(type, handler);
      });
    }

    // Inicializar métricas por tipo
    Object.values(RealtimeErrorType).forEach(type => {
      this.metrics.errorsByType[type] = 0;
    });

    Object.values(ErrorSeverity).forEach(severity => {
      this.metrics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * Manipula um erro - ponto de entrada principal
   */
  async handleError(
    error: Error | RealtimeError,
    context?: Record<string, any>,
    operation?: () => Promise<any>,
    fallback?: () => Promise<any> | any
  ): Promise<RecoveryResult> {
    // 1. Classificar o erro se necessário
    const realtimeError = 'type' in error 
      ? error as RealtimeError
      : ErrorClassifier.classify(error, {
          timestamp: Date.now(),
          ...context
        });

    // 2. Atualizar métricas
    if (this.config.enableMetrics) {
      this.updateMetrics(realtimeError);
    }

    // 3. Logging
    if (this.config.enableLogging) {
      this.logError(realtimeError);
    }

    // 4. Notificar listeners
    this.notifyListeners(realtimeError);

    // 5. Callback de erro global
    if (this.config.onError) {
      try {
        this.config.onError(realtimeError);
      } catch (callbackError) {
        console.warn('[RealtimeErrorHandler] Erro no callback onError:', callbackError);
      }
    }

    // 6. Verificar se há handler customizado
    const customHandler = this.customHandlers.get(realtimeError.type);
    if (customHandler) {
      try {
        const result = await customHandler(realtimeError);
        this.handleRecoveryResult(realtimeError, result);
        return result;
      } catch (handlerError) {
        console.error('[RealtimeErrorHandler] Erro no handler customizado:', handlerError);
      }
    }

    // 7. Recuperação automática se habilitada
    if (this.config.enableAutoRecovery && realtimeError.retryable) {
      const result = await this.attemptRecovery(realtimeError, operation, fallback);
      this.handleRecoveryResult(realtimeError, result);
      return result;
    }

    // 8. Retornar resultado de falha se não há recuperação
    return {
      success: false,
      strategy: realtimeError.recoveryStrategy,
      retryCount: 0,
      error: realtimeError
    };
  }

  /**
   * Tenta recuperação usando o recovery manager
   */
  private async attemptRecovery(
    error: RealtimeError,
    operation?: () => Promise<any>,
    fallback?: () => Promise<any> | any
  ): Promise<RecoveryResult> {
    this.metrics.recoveryAttempts++;

    // Verificar rate limit para recuperação
    const rateLimitResult = checkRateLimit('error_recovery', error.channelId);
    if (!rateLimitResult.allowed) {
      this.metrics.failedRecoveries++;
      
      return {
        success: false,
        strategy: error.recoveryStrategy,
        retryCount: 0,
        nextRetryDelay: rateLimitResult.retryAfter,
        error: ErrorClassifier.classify(new Error('Rate limit exceeded for error recovery'), {
          operation: 'error_recovery_rate_limit',
          channelId: error.channelId,
          timestamp: Date.now()
        })
      };
    }

    try {
      const result = await errorRecoveryManager.recover(error, operation, fallback);
      
      if (result.success) {
        this.metrics.successfulRecoveries++;
        recordRequest('error_recovery', error.channelId);
      } else {
        this.metrics.failedRecoveries++;
        recordError('error_recovery', error.channelId);
      }

      return result;
    } catch (recoveryError) {
      this.metrics.failedRecoveries++;
      recordError('error_recovery', error.channelId);
      
      return {
        success: false,
        strategy: error.recoveryStrategy,
        retryCount: 0,
        error: ErrorClassifier.classify(recoveryError instanceof Error ? recoveryError : new Error('Recovery failed'), {
          operation: 'error_recovery',
          timestamp: Date.now()
        })
      };
    }
  }

  /**
   * Manipula resultado da recuperação
   */
  private handleRecoveryResult(error: RealtimeError, result: RecoveryResult): void {
    // Callback de recuperação
    if (this.config.onRecovery) {
      try {
        this.config.onRecovery(error, result);
      } catch (callbackError) {
        console.warn('[RealtimeErrorHandler] Erro no callback onRecovery:', callbackError);
      }
    }

    // Logging do resultado
    if (this.config.enableLogging) {
      const level = result.success ? 'info' : 'warn';
      this.log(level, `Recuperação ${result.success ? 'bem-sucedida' : 'falhou'}`, {
        originalError: ErrorClassifier.createErrorSummary(error),
        result
      });
    }

    // Marcar erro como resolvido no log se recuperação foi bem-sucedida
    if (result.success && this.config.enableLogging) {
      const logEntry = this.errorLog.find(entry => 
        entry.error.timestamp === error.timestamp && 
        entry.error.type === error.type
      );
      
      if (logEntry) {
        logEntry.resolved = true;
        logEntry.resolutionTime = Date.now();
      }
    }
  }

  /**
   * Atualiza métricas de erro
   */
  private updateMetrics(error: RealtimeError): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByType[error.type]++;
    this.metrics.errorsBySeverity[error.severity]++;
    this.metrics.lastErrorTime = error.timestamp;
  }

  /**
   * Registra erro no log
   */
  private logError(error: RealtimeError): void {
    const entry: ErrorLogEntry = {
      id: `${error.type}-${error.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: error.timestamp,
      error,
      level: this.config.logLevel,
      message: ErrorClassifier.getFriendlyMessage(error),
      stack: error.stack,
      context: error.context,
      resolved: false
    };

    this.errorLog.push(entry);

    // Manter apenas as últimas N entradas
    if (this.errorLog.length > this.config.maxLogEntries) {
      this.errorLog.shift();
    }

    // Console logging baseado no nível
    this.log(this.config.logLevel, `[${error.type}] ${error.message}`, {
      error: ErrorClassifier.createErrorSummary(error),
      context: error.context
    });
  }

  /**
   * Utilitário de logging
   */
  private log(level: string, message: string, data?: any): void {
    const logData = data ? [message, data] : [message];

    switch (level) {
      case 'error':
        console.error(...logData);
        break;
      case 'warn':
        console.warn(...logData);
        break;
      case 'info':
        console.info(...logData);
        break;
      case 'debug':
        console.debug(...logData);
        break;
    }
  }

  /**
   * Notifica todos os listeners
   */
  private notifyListeners(error: RealtimeError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.warn('[RealtimeErrorHandler] Erro no listener:', listenerError);
      }
    });
  }

  /**
   * Adiciona listener de erro
   */
  addErrorListener(listener: ErrorListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove listener de erro
   */
  removeErrorListener(listener: ErrorListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Registra handler customizado para um tipo de erro
   */
  setCustomHandler(errorType: RealtimeErrorType, handler: ErrorHandler): void {
    this.customHandlers.set(errorType, handler);
  }

  /**
   * Remove handler customizado
   */
  removeCustomHandler(errorType: RealtimeErrorType): void {
    this.customHandlers.delete(errorType);
  }

  /**
   * Obtém métricas atuais
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtém log de erros
   */
  getErrorLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  /**
   * Obtém erros não resolvidos
   */
  getUnresolvedErrors(): ErrorLogEntry[] {
    return this.errorLog.filter(entry => !entry.resolved);
  }

  /**
   * Limpa log de erros
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Limpa métricas
   */
  clearMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {} as Record<RealtimeErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      averageRecoveryTime: 0,
      lastErrorTime: null
    };

    // Reinicializar contadores
    Object.values(RealtimeErrorType).forEach(type => {
      this.metrics.errorsByType[type] = 0;
    });

    Object.values(ErrorSeverity).forEach(severity => {
      this.metrics.errorsBySeverity[severity] = 0;
    });
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Shutdown do handler
   */
  shutdown(): void {
    this.listeners.clear();
    this.customHandlers.clear();
    this.clearErrorLog();
    this.clearMetrics();
  }
}

/**
 * 🎯 INSTÂNCIA GLOBAL DO ERROR HANDLER
 */
export const realtimeErrorHandler = new RealtimeErrorHandler();

/**
 * 🎯 UTILITÁRIOS DE CONVENIÊNCIA
 */

/**
 * Manipula erro de forma simples
 */
export async function handleRealtimeError(
  error: Error | RealtimeError,
  context?: Record<string, any>
): Promise<RecoveryResult> {
  return realtimeErrorHandler.handleError(error, context);
}

/**
 * Manipula erro com operação de retry
 */
export async function handleRealtimeErrorWithRetry<T>(
  error: Error | RealtimeError,
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<RecoveryResult> {
  return realtimeErrorHandler.handleError(error, context, operation);
}

/**
 * Manipula erro com fallback
 */
export async function handleRealtimeErrorWithFallback<T>(
  error: Error | RealtimeError,
  fallback: () => Promise<T> | T,
  context?: Record<string, any>
): Promise<RecoveryResult> {
  return realtimeErrorHandler.handleError(error, context, undefined, fallback);
}

/**
 * Cria wrapper para função que pode gerar erros
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const result = await realtimeErrorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        context,
        () => fn(...args)
      );
      
      if (!result.success && result.error) {
        throw result.error;
      }
      
      return result;
    }
  }) as T;
}