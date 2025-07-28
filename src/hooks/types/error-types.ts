/**
 * 🚨 SISTEMA DE CLASSIFICAÇÃO DE ERROS REALTIME
 * 
 * Sistema abrangente para classificar, tratar e recuperar de erros
 * em operações realtime, seguindo as melhores práticas de error handling.
 */

// 🎯 ENUM DE TIPOS DE ERRO
export enum RealtimeErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR', 
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  FETCH_ERROR = 'FETCH_ERROR',
  POLLING_ERROR = 'POLLING_ERROR',
  SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 🎯 SEVERIDADE DO ERRO
export enum ErrorSeverity {
  LOW = 'LOW',           // Não afeta funcionalidade crítica
  MEDIUM = 'MEDIUM',     // Afeta funcionalidade mas é recuperável
  HIGH = 'HIGH',         // Afeta funcionalidade crítica
  CRITICAL = 'CRITICAL'  // Sistema não funcional
}

// 🎯 ESTRATÉGIA DE RECUPERAÇÃO
export enum RecoveryStrategy {
  RETRY = 'RETRY',                    // Tentar novamente
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF', // Backoff exponencial
  FALLBACK = 'FALLBACK',              // Usar fallback
  IGNORE = 'IGNORE',                  // Ignorar erro
  ESCALATE = 'ESCALATE',              // Escalar para nível superior
  RESET = 'RESET',                    // Reset completo do estado
  DISABLE = 'DISABLE'                 // Desabilitar funcionalidade
}

// 🎯 INTERFACE PRINCIPAL DE ERRO REALTIME
export interface RealtimeError extends Error {
  readonly type: RealtimeErrorType;
  readonly code?: string;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly recoveryStrategy: RecoveryStrategy;
  readonly context?: Record<string, any>;
  readonly timestamp: number;
  readonly channelId?: string;
  readonly originalError?: Error;
  readonly retryCount?: number;
  readonly maxRetries?: number;
}

// 🎯 CONTEXTO DE ERRO ESPECÍFICO
export interface ErrorContext {
  channelId?: string;
  operation?: string;
  table?: string;
  endpoint?: string;
  config?: Record<string, any>;
  userAgent?: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
}

// 🎯 RESULTADO DE RECUPERAÇÃO
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  retryCount: number;
  nextRetryDelay?: number;
  fallbackUsed?: boolean;
  error?: RealtimeError;
  context?: Record<string, any>;
}

// 🎯 CONFIGURAÇÃO DE RETRY
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: RealtimeErrorType[];
}

// 🎯 MÉTRICAS DE ERRO
export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<RealtimeErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoveryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
  lastErrorTime: number | null;
}

// 🎯 CONFIGURAÇÃO DE ERROR BOUNDARY
export interface ErrorBoundaryConfig {
  fallbackComponent?: React.ComponentType<{ error: RealtimeError; retry: () => void }>;
  onError?: (error: RealtimeError, errorInfo: any) => void;
  enableLogging?: boolean;
  enableReporting?: boolean;
  maxErrorsBeforeDisable?: number;
  resetOnPropsChange?: boolean;
}

// 🎯 ESTADO DE ERROR BOUNDARY
export interface ErrorBoundaryState {
  hasError: boolean;
  error: RealtimeError | null;
  errorCount: number;
  lastErrorTime: number | null;
  isDisabled: boolean;
  retryCount: number;
}

// 🎯 HANDLER DE ERRO CUSTOMIZADO
export type ErrorHandler = (error: RealtimeError) => RecoveryResult | Promise<RecoveryResult>;

// 🎯 LISTENER DE ERRO
export type ErrorListener = (error: RealtimeError) => void;

// 🎯 CONFIGURAÇÃO DE LOGGING
export interface ErrorLoggingConfig {
  enabled: boolean;
  level: 'error' | 'warn' | 'info' | 'debug';
  includeStack: boolean;
  includeContext: boolean;
  maxLogEntries: number;
  persistLogs: boolean;
}

// 🎯 ENTRADA DE LOG DE ERRO
export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  error: RealtimeError;
  level: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  resolved: boolean;
  resolutionTime?: number;
}

// 🎯 MAPEAMENTO DE CÓDIGOS DE ERRO SUPABASE
export const SUPABASE_ERROR_MAPPING: Record<string, RealtimeErrorType> = {
  'UnableToConnectToProject': RealtimeErrorType.CONNECTION_ERROR,
  'RealtimeRestarting': RealtimeErrorType.CONNECTION_ERROR,
  'ConnectionRateLimitReached': RealtimeErrorType.RATE_LIMIT_ERROR,
  'ChannelRateLimitReached': RealtimeErrorType.RATE_LIMIT_ERROR,
  'ClientJoinRateLimitReached': RealtimeErrorType.RATE_LIMIT_ERROR,
  'UnableToSetPolicies': RealtimeErrorType.AUTHENTICATION_ERROR,
  'TenantNotFound': RealtimeErrorType.CONFIGURATION_ERROR,
  'InvalidJWTExpiration': RealtimeErrorType.AUTHENTICATION_ERROR,
  'JwtSignatureError': RealtimeErrorType.AUTHENTICATION_ERROR,
  'Unauthorized': RealtimeErrorType.AUTHENTICATION_ERROR,
  'MalformedJWT': RealtimeErrorType.AUTHENTICATION_ERROR,
  'DatabaseConnectionIssue': RealtimeErrorType.CONNECTION_ERROR,
  'TimeoutOnRpcCall': RealtimeErrorType.TIMEOUT_ERROR
};

// 🎯 CONFIGURAÇÃO PADRÃO DE RETRY POR TIPO DE ERRO
export const DEFAULT_RETRY_CONFIGS: Record<RealtimeErrorType, RetryConfig> = {
  [RealtimeErrorType.CONNECTION_ERROR]: {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [RealtimeErrorType.CONNECTION_ERROR]
  },
  [RealtimeErrorType.RATE_LIMIT_ERROR]: {
    maxRetries: 3,
    baseDelay: 5000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [RealtimeErrorType.RATE_LIMIT_ERROR]
  },
  [RealtimeErrorType.AUTHENTICATION_ERROR]: {
    maxRetries: 1,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 1,
    jitter: false,
    retryableErrors: []
  },
  [RealtimeErrorType.CONFIGURATION_ERROR]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
    retryableErrors: []
  },
  [RealtimeErrorType.FETCH_ERROR]: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 1.5,
    jitter: true,
    retryableErrors: [RealtimeErrorType.FETCH_ERROR, RealtimeErrorType.NETWORK_ERROR]
  },
  [RealtimeErrorType.POLLING_ERROR]: {
    maxRetries: 2,
    baseDelay: 3000,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
    jitter: true,
    retryableErrors: [RealtimeErrorType.POLLING_ERROR]
  },
  [RealtimeErrorType.SUBSCRIPTION_ERROR]: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 20000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [RealtimeErrorType.SUBSCRIPTION_ERROR]
  },
  [RealtimeErrorType.NETWORK_ERROR]: {
    maxRetries: 4,
    baseDelay: 1500,
    maxDelay: 25000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [RealtimeErrorType.NETWORK_ERROR]
  },
  [RealtimeErrorType.TIMEOUT_ERROR]: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 1.8,
    jitter: true,
    retryableErrors: [RealtimeErrorType.TIMEOUT_ERROR]
  },
  [RealtimeErrorType.VALIDATION_ERROR]: {
    maxRetries: 0,
    baseDelay: 0,
    maxDelay: 0,
    backoffMultiplier: 1,
    jitter: false,
    retryableErrors: []
  },
  [RealtimeErrorType.UNKNOWN_ERROR]: {
    maxRetries: 2,
    baseDelay: 3000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [RealtimeErrorType.UNKNOWN_ERROR]
  }
};