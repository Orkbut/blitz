/**
 * 🔄 SISTEMA DE RECUPERAÇÃO DE ERROS
 * 
 * Implementa estratégias de recuperação automática para diferentes tipos de erro,
 * incluindo retry com backoff exponencial, fallbacks e escalação.
 */

import {
  RealtimeError,
  RealtimeErrorType,
  RecoveryStrategy,
  RecoveryResult,
  RetryConfig,
  DEFAULT_RETRY_CONFIGS,
  ErrorSeverity
} from '../types/error-types';

// 🎯 INTERFACE PARA OPERAÇÕES RETRYABLE
export interface RetryableOperation<T = any> {
  (): Promise<T>;
}

// 🎯 INTERFACE PARA FALLBACK
export interface FallbackOperation<T = any> {
  (): Promise<T> | T;
}

// 🎯 CONFIGURAÇÃO DE RECOVERY MANAGER
export interface RecoveryManagerConfig {
  maxConcurrentRecoveries: number;
  globalTimeout: number;
  enableMetrics: boolean;
  onRecoveryStart?: (error: RealtimeError) => void;
  onRecoverySuccess?: (error: RealtimeError, result: RecoveryResult) => void;
  onRecoveryFailure?: (error: RealtimeError, result: RecoveryResult) => void;
}

// 🎯 ESTADO DE RECOVERY ATIVO
interface ActiveRecovery {
  error: RealtimeError;
  startTime: number;
  retryCount: number;
  strategy: RecoveryStrategy;
  operation?: RetryableOperation;
  fallback?: FallbackOperation;
  timeoutId?: NodeJS.Timeout;
}

/**
 * 🎯 GERENCIADOR DE RECUPERAÇÃO DE ERROS
 */
export class ErrorRecoveryManager {
  private activeRecoveries = new Map<string, ActiveRecovery>();
  private retryConfigs = new Map<RealtimeErrorType, RetryConfig>();
  private config: RecoveryManagerConfig;
  private metrics = {
    totalRecoveries: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    averageRecoveryTime: 0,
    recoveryTimes: [] as number[]
  };

  constructor(config: Partial<RecoveryManagerConfig> = {}) {
    this.config = {
      maxConcurrentRecoveries: 10,
      globalTimeout: 300000, // 5 minutos
      enableMetrics: true,
      ...config
    };

    // Inicializar configurações padrão de retry
    Object.entries(DEFAULT_RETRY_CONFIGS).forEach(([type, config]) => {
      this.retryConfigs.set(type as RealtimeErrorType, config);
    });
  }

  /**
   * Inicia processo de recuperação para um erro
   */
  async recover<T = any>(
    error: RealtimeError,
    operation?: RetryableOperation<T>,
    fallback?: FallbackOperation<T>
  ): Promise<RecoveryResult> {
    const recoveryId = this.generateRecoveryId(error);

    // Verificar limite de recuperações concorrentes
    if (this.activeRecoveries.size >= this.config.maxConcurrentRecoveries) {
      return {
        success: false,
        strategy: RecoveryStrategy.ESCALATE,
        retryCount: 0,
        error: this.createRecoveryError('Limite de recuperações concorrentes atingido')
      };
    }

    // Verificar se já existe recuperação ativa para este erro
    if (this.activeRecoveries.has(recoveryId)) {
      const active = this.activeRecoveries.get(recoveryId)!;
      return {
        success: false,
        strategy: active.strategy,
        retryCount: active.retryCount,
        error: this.createRecoveryError('Recuperação já em andamento')
      };
    }

    const startTime = Date.now();
    const strategy = error.recoveryStrategy;

    // Registrar recuperação ativa
    const activeRecovery: ActiveRecovery = {
      error,
      startTime,
      retryCount: 0,
      strategy,
      operation,
      fallback
    };

    this.activeRecoveries.set(recoveryId, activeRecovery);

    // Callback de início
    if (this.config.onRecoveryStart) {
      try {
        this.config.onRecoveryStart(error);
      } catch (callbackError) {
        console.warn('[ErrorRecovery] Erro no callback onRecoveryStart:', callbackError);
      }
    }

    try {
      let result: RecoveryResult;

      switch (strategy) {
        case RecoveryStrategy.RETRY:
          result = await this.executeRetry(activeRecovery);
          break;
        case RecoveryStrategy.EXPONENTIAL_BACKOFF:
          result = await this.executeExponentialBackoff(activeRecovery);
          break;
        case RecoveryStrategy.FALLBACK:
          result = await this.executeFallback(activeRecovery);
          break;
        case RecoveryStrategy.RESET:
          result = await this.executeReset(activeRecovery);
          break;
        case RecoveryStrategy.DISABLE:
          result = this.executeDisable(activeRecovery);
          break;
        case RecoveryStrategy.IGNORE:
          result = this.executeIgnore(activeRecovery);
          break;
        case RecoveryStrategy.ESCALATE:
        default:
          result = this.executeEscalate(activeRecovery);
          break;
      }

      // Atualizar métricas
      if (this.config.enableMetrics) {
        this.updateMetrics(result, Date.now() - startTime);
      }

      // Callbacks de resultado
      if (result.success && this.config.onRecoverySuccess) {
        try {
          this.config.onRecoverySuccess(error, result);
        } catch (callbackError) {
          console.warn('[ErrorRecovery] Erro no callback onRecoverySuccess:', callbackError);
        }
      } else if (!result.success && this.config.onRecoveryFailure) {
        try {
          this.config.onRecoveryFailure(error, result);
        } catch (callbackError) {
          console.warn('[ErrorRecovery] Erro no callback onRecoveryFailure:', callbackError);
        }
      }

      return result;

    } catch (recoveryError) {
      const result: RecoveryResult = {
        success: false,
        strategy,
        retryCount: activeRecovery.retryCount,
        error: this.createRecoveryError(
          recoveryError instanceof Error ? recoveryError.message : 'Erro na recuperação'
        )
      };

      if (this.config.enableMetrics) {
        this.updateMetrics(result, Date.now() - startTime);
      }

      return result;

    } finally {
      // Limpar recuperação ativa
      this.activeRecoveries.delete(recoveryId);
    }
  }

  /**
   * Executa retry simples
   */
  private async executeRetry(recovery: ActiveRecovery): Promise<RecoveryResult> {
    const config = this.getRetryConfig(recovery.error.type);
    
    if (!recovery.operation) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        retryCount: 0,
        error: this.createRecoveryError('Nenhuma operação fornecida para retry')
      };
    }

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      recovery.retryCount = attempt + 1;

      try {
        await recovery.operation();
        return {
          success: true,
          strategy: RecoveryStrategy.RETRY,
          retryCount: recovery.retryCount
        };
      } catch (error) {
        if (attempt < config.maxRetries - 1) {
          // Aguardar antes da próxima tentativa
          const delay = this.calculateDelay(config, attempt);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      strategy: RecoveryStrategy.RETRY,
      retryCount: recovery.retryCount,
      error: this.createRecoveryError(`Retry falhou após ${config.maxRetries} tentativas`)
    };
  }

  /**
   * Executa retry com backoff exponencial
   */
  private async executeExponentialBackoff(recovery: ActiveRecovery): Promise<RecoveryResult> {
    const config = this.getRetryConfig(recovery.error.type);
    
    if (!recovery.operation) {
      return {
        success: false,
        strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
        retryCount: 0,
        error: this.createRecoveryError('Nenhuma operação fornecida para backoff')
      };
    }

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      recovery.retryCount = attempt + 1;

      try {
        await recovery.operation();
        return {
          success: true,
          strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
          retryCount: recovery.retryCount
        };
      } catch (error) {
        if (attempt < config.maxRetries - 1) {
          const delay = this.calculateExponentialDelay(config, attempt);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      strategy: RecoveryStrategy.EXPONENTIAL_BACKOFF,
      retryCount: recovery.retryCount,
      nextRetryDelay: this.calculateExponentialDelay(config, recovery.retryCount),
      error: this.createRecoveryError(`Backoff falhou após ${config.maxRetries} tentativas`)
    };
  }

  /**
   * Executa fallback
   */
  private async executeFallback(recovery: ActiveRecovery): Promise<RecoveryResult> {
    if (!recovery.fallback) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        retryCount: 0,
        error: this.createRecoveryError('Nenhum fallback fornecido')
      };
    }

    try {
      await recovery.fallback();
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        retryCount: 0,
        fallbackUsed: true
      };
    } catch (error) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        retryCount: 0,
        error: this.createRecoveryError(
          error instanceof Error ? error.message : 'Fallback falhou'
        )
      };
    }
  }

  /**
   * Executa reset
   */
  private async executeReset(recovery: ActiveRecovery): Promise<RecoveryResult> {
    // Reset é uma operação que deve ser implementada pelo consumidor
    // Aqui apenas sinalizamos que o reset deve ser executado
    return {
      success: true,
      strategy: RecoveryStrategy.RESET,
      retryCount: 0,
      context: { resetRequired: true }
    };
  }

  /**
   * Executa disable
   */
  private executeDisable(recovery: ActiveRecovery): RecoveryResult {
    return {
      success: true,
      strategy: RecoveryStrategy.DISABLE,
      retryCount: 0,
      context: { disableRequired: true }
    };
  }

  /**
   * Executa ignore
   */
  private executeIgnore(recovery: ActiveRecovery): RecoveryResult {
    return {
      success: true,
      strategy: RecoveryStrategy.IGNORE,
      retryCount: 0,
      context: { ignored: true }
    };
  }

  /**
   * Executa escalate
   */
  private executeEscalate(recovery: ActiveRecovery): RecoveryResult {
    return {
      success: false,
      strategy: RecoveryStrategy.ESCALATE,
      retryCount: 0,
      error: recovery.error,
      context: { escalated: true }
    };
  }

  /**
   * Calcula delay simples
   */
  private calculateDelay(config: RetryConfig, attempt: number): number {
    let delay = config.baseDelay;
    
    if (config.jitter) {
      delay += Math.random() * 1000; // Adicionar jitter de até 1s
    }
    
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Calcula delay com backoff exponencial
   */
  private calculateExponentialDelay(config: RetryConfig, attempt: number): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    
    if (config.jitter) {
      delay += Math.random() * delay * 0.1; // Jitter de 10%
    }
    
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém configuração de retry para um tipo de erro
   */
  private getRetryConfig(errorType: RealtimeErrorType): RetryConfig {
    return this.retryConfigs.get(errorType) || DEFAULT_RETRY_CONFIGS[errorType];
  }

  /**
   * Gera ID único para recuperação
   */
  private generateRecoveryId(error: RealtimeError): string {
    return `${error.type}-${error.channelId || 'global'}-${error.timestamp}`;
  }

  /**
   * Cria erro de recuperação
   */
  private createRecoveryError(message: string): RealtimeError {
    const error = new Error(message) as RealtimeError;
    
    Object.defineProperty(error, 'type', {
      value: RealtimeErrorType.UNKNOWN_ERROR,
      writable: false
    });
    
    Object.defineProperty(error, 'severity', {
      value: ErrorSeverity.MEDIUM,
      writable: false
    });
    
    Object.defineProperty(error, 'retryable', {
      value: false,
      writable: false
    });
    
    Object.defineProperty(error, 'recoveryStrategy', {
      value: RecoveryStrategy.ESCALATE,
      writable: false
    });
    
    Object.defineProperty(error, 'timestamp', {
      value: Date.now(),
      writable: false
    });

    return error;
  }

  /**
   * Atualiza métricas de recuperação
   */
  private updateMetrics(result: RecoveryResult, recoveryTime: number): void {
    this.metrics.totalRecoveries++;
    
    if (result.success) {
      this.metrics.successfulRecoveries++;
    } else {
      this.metrics.failedRecoveries++;
    }
    
    this.metrics.recoveryTimes.push(recoveryTime);
    
    // Manter apenas os últimos 100 tempos para calcular média
    if (this.metrics.recoveryTimes.length > 100) {
      this.metrics.recoveryTimes.shift();
    }
    
    this.metrics.averageRecoveryTime = 
      this.metrics.recoveryTimes.reduce((sum, time) => sum + time, 0) / 
      this.metrics.recoveryTimes.length;
  }

  /**
   * Configura retry personalizado para um tipo de erro
   */
  setRetryConfig(errorType: RealtimeErrorType, config: RetryConfig): void {
    this.retryConfigs.set(errorType, config);
  }

  /**
   * Obtém métricas de recuperação
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Obtém recuperações ativas
   */
  getActiveRecoveries(): Array<{ id: string; error: RealtimeError; startTime: number; retryCount: number }> {
    return Array.from(this.activeRecoveries.entries()).map(([id, recovery]) => ({
      id,
      error: recovery.error,
      startTime: recovery.startTime,
      retryCount: recovery.retryCount
    }));
  }

  /**
   * Cancela uma recuperação ativa
   */
  cancelRecovery(recoveryId: string): boolean {
    const recovery = this.activeRecoveries.get(recoveryId);
    if (recovery) {
      if (recovery.timeoutId) {
        clearTimeout(recovery.timeoutId);
      }
      this.activeRecoveries.delete(recoveryId);
      return true;
    }
    return false;
  }

  /**
   * Limpa todas as recuperações ativas
   */
  clearActiveRecoveries(): void {
    this.activeRecoveries.forEach((recovery, id) => {
      if (recovery.timeoutId) {
        clearTimeout(recovery.timeoutId);
      }
    });
    this.activeRecoveries.clear();
  }

  /**
   * Shutdown do manager
   */
  shutdown(): void {
    this.clearActiveRecoveries();
  }
}

/**
 * 🎯 INSTÂNCIA GLOBAL DO RECOVERY MANAGER
 */
export const errorRecoveryManager = new ErrorRecoveryManager();