/**
 * 🔍 CLASSIFICADOR DE ERROS REALTIME
 * 
 * Utilitário para classificar erros automaticamente baseado em:
 * - Tipo de erro original
 * - Mensagem de erro
 * - Contexto da operação
 * - Códigos de erro do Supabase
 */

import {
  RealtimeError,
  RealtimeErrorType,
  ErrorSeverity,
  RecoveryStrategy,
  ErrorContext,
  SUPABASE_ERROR_MAPPING
} from '../types/error-types';

// 🎯 PADRÕES DE MENSAGEM PARA CLASSIFICAÇÃO
const ERROR_MESSAGE_PATTERNS: Record<RealtimeErrorType, RegExp[]> = {
  [RealtimeErrorType.CONNECTION_ERROR]: [
    /connection.*failed/i,
    /websocket.*error/i,
    /network.*error/i,
    /unable.*connect/i,
    /connection.*lost/i,
    /connection.*timeout/i,
    /socket.*closed/i
  ],
  [RealtimeErrorType.RATE_LIMIT_ERROR]: [
    /rate.*limit/i,
    /too.*many.*requests/i,
    /quota.*exceeded/i,
    /throttle/i,
    /429/
  ],
  [RealtimeErrorType.AUTHENTICATION_ERROR]: [
    /unauthorized/i,
    /authentication.*failed/i,
    /invalid.*token/i,
    /jwt.*expired/i,
    /access.*denied/i,
    /401/,
    /403/
  ],
  [RealtimeErrorType.CONFIGURATION_ERROR]: [
    /configuration.*error/i,
    /invalid.*config/i,
    /missing.*parameter/i,
    /invalid.*table/i,
    /schema.*error/i
  ],
  [RealtimeErrorType.FETCH_ERROR]: [
    /fetch.*failed/i,
    /http.*error/i,
    /request.*failed/i,
    /api.*error/i,
    /500/,
    /502/,
    /503/,
    /504/
  ],
  [RealtimeErrorType.POLLING_ERROR]: [
    /polling.*error/i,
    /poll.*failed/i,
    /interval.*error/i
  ],
  [RealtimeErrorType.SUBSCRIPTION_ERROR]: [
    /subscription.*failed/i,
    /channel.*error/i,
    /subscribe.*error/i,
    /realtime.*error/i
  ],
  [RealtimeErrorType.NETWORK_ERROR]: [
    /network.*unavailable/i,
    /offline/i,
    /no.*internet/i,
    /dns.*error/i,
    /host.*unreachable/i
  ],
  [RealtimeErrorType.TIMEOUT_ERROR]: [
    /timeout/i,
    /timed.*out/i,
    /request.*timeout/i,
    /operation.*timeout/i
  ],
  [RealtimeErrorType.VALIDATION_ERROR]: [
    /validation.*error/i,
    /invalid.*input/i,
    /schema.*validation/i,
    /type.*error/i
  ],
  [RealtimeErrorType.UNKNOWN_ERROR]: []
};

// 🎯 MAPEAMENTO DE SEVERIDADE POR TIPO
const SEVERITY_MAPPING: Record<RealtimeErrorType, ErrorSeverity> = {
  [RealtimeErrorType.CONNECTION_ERROR]: ErrorSeverity.HIGH,
  [RealtimeErrorType.RATE_LIMIT_ERROR]: ErrorSeverity.MEDIUM,
  [RealtimeErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
  [RealtimeErrorType.CONFIGURATION_ERROR]: ErrorSeverity.CRITICAL,
  [RealtimeErrorType.FETCH_ERROR]: ErrorSeverity.MEDIUM,
  [RealtimeErrorType.POLLING_ERROR]: ErrorSeverity.LOW,
  [RealtimeErrorType.SUBSCRIPTION_ERROR]: ErrorSeverity.HIGH,
  [RealtimeErrorType.NETWORK_ERROR]: ErrorSeverity.HIGH,
  [RealtimeErrorType.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
  [RealtimeErrorType.VALIDATION_ERROR]: ErrorSeverity.CRITICAL,
  [RealtimeErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
};

// 🎯 MAPEAMENTO DE ESTRATÉGIA DE RECUPERAÇÃO
const RECOVERY_STRATEGY_MAPPING: Record<RealtimeErrorType, RecoveryStrategy> = {
  [RealtimeErrorType.CONNECTION_ERROR]: RecoveryStrategy.EXPONENTIAL_BACKOFF,
  [RealtimeErrorType.RATE_LIMIT_ERROR]: RecoveryStrategy.EXPONENTIAL_BACKOFF,
  [RealtimeErrorType.AUTHENTICATION_ERROR]: RecoveryStrategy.ESCALATE,
  [RealtimeErrorType.CONFIGURATION_ERROR]: RecoveryStrategy.ESCALATE,
  [RealtimeErrorType.FETCH_ERROR]: RecoveryStrategy.RETRY,
  [RealtimeErrorType.POLLING_ERROR]: RecoveryStrategy.FALLBACK,
  [RealtimeErrorType.SUBSCRIPTION_ERROR]: RecoveryStrategy.RETRY,
  [RealtimeErrorType.NETWORK_ERROR]: RecoveryStrategy.EXPONENTIAL_BACKOFF,
  [RealtimeErrorType.TIMEOUT_ERROR]: RecoveryStrategy.RETRY,
  [RealtimeErrorType.VALIDATION_ERROR]: RecoveryStrategy.ESCALATE,
  [RealtimeErrorType.UNKNOWN_ERROR]: RecoveryStrategy.RETRY
};

// 🎯 ERROS RETRYABLE POR TIPO
const RETRYABLE_MAPPING: Record<RealtimeErrorType, boolean> = {
  [RealtimeErrorType.CONNECTION_ERROR]: true,
  [RealtimeErrorType.RATE_LIMIT_ERROR]: true,
  [RealtimeErrorType.AUTHENTICATION_ERROR]: false,
  [RealtimeErrorType.CONFIGURATION_ERROR]: false,
  [RealtimeErrorType.FETCH_ERROR]: true,
  [RealtimeErrorType.POLLING_ERROR]: true,
  [RealtimeErrorType.SUBSCRIPTION_ERROR]: true,
  [RealtimeErrorType.NETWORK_ERROR]: true,
  [RealtimeErrorType.TIMEOUT_ERROR]: true,
  [RealtimeErrorType.VALIDATION_ERROR]: false,
  [RealtimeErrorType.UNKNOWN_ERROR]: true
};

/**
 * 🎯 CLASSIFICADOR DE ERROS
 */
export class ErrorClassifier {
  /**
   * Classifica um erro genérico em RealtimeError
   */
  static classify(
    error: Error | any,
    context?: Partial<ErrorContext>
  ): RealtimeError {
    const timestamp = Date.now();
    const fullContext: ErrorContext = {
      timestamp,
      ...context
    };

    // 1. Tentar classificar por código Supabase
    const supabaseType = this.classifyBySupabaseCode(error);
    if (supabaseType) {
      return this.createRealtimeError(error, supabaseType, fullContext);
    }

    // 2. Tentar classificar por mensagem
    const messageType = this.classifyByMessage(error.message || error.toString());
    if (messageType !== RealtimeErrorType.UNKNOWN_ERROR) {
      return this.createRealtimeError(error, messageType, fullContext);
    }

    // 3. Tentar classificar por tipo de erro JavaScript
    const jsType = this.classifyByJavaScriptType(error);
    if (jsType !== RealtimeErrorType.UNKNOWN_ERROR) {
      return this.createRealtimeError(error, jsType, fullContext);
    }

    // 4. Tentar classificar por contexto
    const contextType = this.classifyByContext(fullContext);
    if (contextType !== RealtimeErrorType.UNKNOWN_ERROR) {
      return this.createRealtimeError(error, contextType, fullContext);
    }

    // 5. Fallback para erro desconhecido
    return this.createRealtimeError(error, RealtimeErrorType.UNKNOWN_ERROR, fullContext);
  }

  /**
   * Classifica por código de erro do Supabase
   */
  private static classifyBySupabaseCode(error: any): RealtimeErrorType | null {
    const code = error.code || error.type || error.error_code;
    if (code && SUPABASE_ERROR_MAPPING[code]) {
      return SUPABASE_ERROR_MAPPING[code];
    }
    return null;
  }

  /**
   * Classifica por mensagem de erro
   */
  private static classifyByMessage(message: string): RealtimeErrorType {
    for (const [type, patterns] of Object.entries(ERROR_MESSAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return type as RealtimeErrorType;
        }
      }
    }
    return RealtimeErrorType.UNKNOWN_ERROR;
  }

  /**
   * Classifica por tipo de erro JavaScript
   */
  private static classifyByJavaScriptType(error: any): RealtimeErrorType {
    if (error instanceof TypeError) {
      return RealtimeErrorType.VALIDATION_ERROR;
    }
    
    if (error instanceof ReferenceError) {
      return RealtimeErrorType.CONFIGURATION_ERROR;
    }
    
    if (error.name === 'AbortError') {
      return RealtimeErrorType.TIMEOUT_ERROR;
    }
    
    if (error.name === 'NetworkError' || error.name === 'FetchError') {
      return RealtimeErrorType.NETWORK_ERROR;
    }
    
    if (error.name === 'TimeoutError') {
      return RealtimeErrorType.TIMEOUT_ERROR;
    }

    return RealtimeErrorType.UNKNOWN_ERROR;
  }

  /**
   * Classifica por contexto da operação
   */
  private static classifyByContext(context: ErrorContext): RealtimeErrorType {
    if (context.operation === 'fetch' || context.endpoint) {
      return RealtimeErrorType.FETCH_ERROR;
    }
    
    if (context.operation === 'subscribe' || context.channelId) {
      return RealtimeErrorType.SUBSCRIPTION_ERROR;
    }
    
    if (context.operation === 'poll') {
      return RealtimeErrorType.POLLING_ERROR;
    }

    return RealtimeErrorType.UNKNOWN_ERROR;
  }

  /**
   * Cria um RealtimeError completo
   */
  private static createRealtimeError(
    originalError: Error | any,
    type: RealtimeErrorType,
    context: ErrorContext
  ): RealtimeError {
    const message = originalError.message || originalError.toString() || 'Erro desconhecido';
    const code = originalError.code || originalError.type || undefined;
    
    const realtimeError = new Error(message) as RealtimeError;
    
    // Definir propriedades readonly usando Object.defineProperty
    Object.defineProperty(realtimeError, 'type', {
      value: type,
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'code', {
      value: code,
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'severity', {
      value: SEVERITY_MAPPING[type],
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'retryable', {
      value: RETRYABLE_MAPPING[type],
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'recoveryStrategy', {
      value: RECOVERY_STRATEGY_MAPPING[type],
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'context', {
      value: { ...context },
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'timestamp', {
      value: context.timestamp,
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'channelId', {
      value: context.channelId,
      writable: false,
      enumerable: true
    });
    
    Object.defineProperty(realtimeError, 'originalError', {
      value: originalError,
      writable: false,
      enumerable: true
    });

    return realtimeError;
  }

  /**
   * Verifica se um erro é retryable
   */
  static isRetryable(error: RealtimeError): boolean {
    return error.retryable && error.severity !== ErrorSeverity.CRITICAL;
  }

  /**
   * Obtém a estratégia de recuperação para um erro
   */
  static getRecoveryStrategy(error: RealtimeError): RecoveryStrategy {
    return error.recoveryStrategy;
  }

  /**
   * Verifica se um erro é crítico
   */
  static isCritical(error: RealtimeError): boolean {
    return error.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Obtém uma descrição amigável do erro
   */
  static getFriendlyMessage(error: RealtimeError): string {
    const messages: Record<RealtimeErrorType, string> = {
      [RealtimeErrorType.CONNECTION_ERROR]: 'Problema de conexão. Tentando reconectar...',
      [RealtimeErrorType.RATE_LIMIT_ERROR]: 'Muitas requisições. Aguardando para tentar novamente...',
      [RealtimeErrorType.AUTHENTICATION_ERROR]: 'Erro de autenticação. Verifique suas credenciais.',
      [RealtimeErrorType.CONFIGURATION_ERROR]: 'Erro de configuração. Verifique os parâmetros.',
      [RealtimeErrorType.FETCH_ERROR]: 'Erro ao buscar dados. Tentando novamente...',
      [RealtimeErrorType.POLLING_ERROR]: 'Erro na atualização automática.',
      [RealtimeErrorType.SUBSCRIPTION_ERROR]: 'Erro na conexão em tempo real.',
      [RealtimeErrorType.NETWORK_ERROR]: 'Problema de rede. Verifique sua conexão.',
      [RealtimeErrorType.TIMEOUT_ERROR]: 'Operação demorou muito. Tentando novamente...',
      [RealtimeErrorType.VALIDATION_ERROR]: 'Dados inválidos fornecidos.',
      [RealtimeErrorType.UNKNOWN_ERROR]: 'Erro inesperado. Tentando resolver...'
    };

    return messages[error.type] || error.message;
  }

  /**
   * Cria um resumo do erro para logging
   */
  static createErrorSummary(error: RealtimeError): Record<string, any> {
    return {
      type: error.type,
      severity: error.severity,
      retryable: error.retryable,
      strategy: error.recoveryStrategy,
      message: error.message,
      code: error.code,
      channelId: error.channelId,
      timestamp: new Date(error.timestamp).toISOString(),
      context: error.context
    };
  }
}