/**
 * 🚦 RATE LIMITER PARA OPERAÇÕES REALTIME
 * 
 * Implementa rate limiting inteligente para evitar sobrecarga do Supabase
 * e outros serviços, com suporte a diferentes estratégias de limitação.
 */

import { RealtimeErrorType } from '../types/error-types';

// 🎯 CONFIGURAÇÃO DE RATE LIMITING
export interface RateLimitConfig {
  maxRequests: number;        // Máximo de requisições
  windowMs: number;           // Janela de tempo em ms
  strategy: RateLimitStrategy; // Estratégia de limitação
  burstAllowance?: number;    // Permitir rajadas até N requisições
  backoffMultiplier?: number; // Multiplicador para backoff
  maxBackoffMs?: number;      // Máximo tempo de backoff
}

// 🎯 ESTRATÉGIAS DE RATE LIMITING
export enum RateLimitStrategy {
  FIXED_WINDOW = 'FIXED_WINDOW',           // Janela fixa
  SLIDING_WINDOW = 'SLIDING_WINDOW',       // Janela deslizante
  TOKEN_BUCKET = 'TOKEN_BUCKET',           // Balde de tokens
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF' // Backoff exponencial
}

// 🎯 RESULTADO DE VERIFICAÇÃO DE RATE LIMIT
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

// 🎯 ESTADO DE RATE LIMITING
interface RateLimitState {
  requests: number[];         // Timestamps das requisições
  tokens: number;            // Tokens disponíveis (para TOKEN_BUCKET)
  lastRefill: number;        // Último refill de tokens
  backoffUntil: number;      // Backoff até este timestamp
  consecutiveErrors: number;  // Erros consecutivos
}

// 🎯 CONFIGURAÇÕES PADRÃO POR TIPO DE OPERAÇÃO
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Supabase Realtime
  'realtime_connection': {
    maxRequests: 100,
    windowMs: 60000, // 1 minuto
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    burstAllowance: 10
  },
  'realtime_subscription': {
    maxRequests: 50,
    windowMs: 60000,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    burstAllowance: 5
  },
  
  // API Calls
  'api_fetch': {
    maxRequests: 200,
    windowMs: 60000,
    strategy: RateLimitStrategy.TOKEN_BUCKET,
    burstAllowance: 20
  },
  'api_mutation': {
    maxRequests: 100,
    windowMs: 60000,
    strategy: RateLimitStrategy.SLIDING_WINDOW,
    burstAllowance: 10
  },
  
  // Polling
  'polling': {
    maxRequests: 60,
    windowMs: 60000, // 1 por segundo em média
    strategy: RateLimitStrategy.FIXED_WINDOW
  },
  
  // Error Recovery
  'error_recovery': {
    maxRequests: 10,
    windowMs: 60000,
    strategy: RateLimitStrategy.EXPONENTIAL_BACKOFF,
    backoffMultiplier: 2,
    maxBackoffMs: 300000 // 5 minutos
  }
};

/**
 * 🎯 RATE LIMITER PRINCIPAL
 */
export class RateLimiter {
  private states = new Map<string, RateLimitState>();
  private configs = new Map<string, RateLimitConfig>();

  constructor() {
    // Inicializar configurações padrão
    Object.entries(DEFAULT_RATE_LIMITS).forEach(([key, config]) => {
      this.configs.set(key, config);
    });
  }

  /**
   * Verifica se uma operação pode ser executada
   */
  checkLimit(operationType: string, identifier?: string): RateLimitResult {
    const key = identifier ? `${operationType}:${identifier}` : operationType;
    const config = this.configs.get(operationType);
    
    if (!config) {
      // Se não há configuração, permitir
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: Date.now() + 60000
      };
    }

    const state = this.getOrCreateState(key);
    const now = Date.now();

    // Verificar backoff primeiro
    if (state.backoffUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.backoffUntil,
        retryAfter: state.backoffUntil - now,
        reason: 'Backoff ativo'
      };
    }

    switch (config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
        return this.checkFixedWindow(state, config, now);
      
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.checkSlidingWindow(state, config, now);
      
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.checkTokenBucket(state, config, now);
      
      case RateLimitStrategy.EXPONENTIAL_BACKOFF:
        return this.checkExponentialBackoff(state, config, now);
      
      default:
        return this.checkSlidingWindow(state, config, now);
    }
  }

  /**
   * Registra uma requisição (quando permitida)
   */
  recordRequest(operationType: string, identifier?: string): void {
    const key = identifier ? `${operationType}:${identifier}` : operationType;
    const config = this.configs.get(operationType);
    
    if (!config) return;

    const state = this.getOrCreateState(key);
    const now = Date.now();

    switch (config.strategy) {
      case RateLimitStrategy.FIXED_WINDOW:
      case RateLimitStrategy.SLIDING_WINDOW:
        state.requests.push(now);
        break;
      
      case RateLimitStrategy.TOKEN_BUCKET:
        state.tokens = Math.max(0, state.tokens - 1);
        break;
      
      case RateLimitStrategy.EXPONENTIAL_BACKOFF:
        state.requests.push(now);
        state.consecutiveErrors = 0; // Reset em sucesso
        break;
    }
  }

  /**
   * Registra um erro (para backoff exponencial)
   */
  recordError(operationType: string, identifier?: string): void {
    const key = identifier ? `${operationType}:${identifier}` : operationType;
    const config = this.configs.get(operationType);
    
    if (!config || config.strategy !== RateLimitStrategy.EXPONENTIAL_BACKOFF) {
      return;
    }

    const state = this.getOrCreateState(key);
    state.consecutiveErrors++;

    // Calcular backoff
    const backoffMs = Math.min(
      1000 * Math.pow(config.backoffMultiplier || 2, state.consecutiveErrors - 1),
      config.maxBackoffMs || 300000
    );

    state.backoffUntil = Date.now() + backoffMs;
  }

  /**
   * Verifica janela fixa
   */
  private checkFixedWindow(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: number
  ): RateLimitResult {
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const windowEnd = windowStart + config.windowMs;
    
    // Filtrar requisições da janela atual
    const windowRequests = state.requests.filter(
      timestamp => timestamp >= windowStart && timestamp < windowEnd
    );

    const remaining = Math.max(0, config.maxRequests - windowRequests.length);
    const allowed = remaining > 0;

    return {
      allowed,
      remaining,
      resetTime: windowEnd,
      retryAfter: allowed ? undefined : windowEnd - now
    };
  }

  /**
   * Verifica janela deslizante
   */
  private checkSlidingWindow(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: number
  ): RateLimitResult {
    const windowStart = now - config.windowMs;
    
    // Filtrar requisições da janela deslizante
    state.requests = state.requests.filter(timestamp => timestamp > windowStart);
    
    const remaining = Math.max(0, config.maxRequests - state.requests.length);
    const allowed = remaining > 0;

    // Para janela deslizante, resetTime é quando a requisição mais antiga expira
    const oldestRequest = state.requests[0];
    const resetTime = oldestRequest ? oldestRequest + config.windowMs : now + config.windowMs;

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? undefined : Math.max(0, resetTime - now)
    };
  }

  /**
   * Verifica token bucket
   */
  private checkTokenBucket(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: number
  ): RateLimitResult {
    // Refill tokens baseado no tempo passado
    const timeSinceRefill = now - state.lastRefill;
    const tokensToAdd = Math.floor(timeSinceRefill / config.windowMs * config.maxRequests);
    
    if (tokensToAdd > 0) {
      state.tokens = Math.min(config.maxRequests, state.tokens + tokensToAdd);
      state.lastRefill = now;
    }

    const allowed = state.tokens > 0;
    const remaining = state.tokens;

    // Calcular quando próximo token estará disponível
    const msPerToken = config.windowMs / config.maxRequests;
    const nextTokenTime = state.lastRefill + msPerToken;

    return {
      allowed,
      remaining,
      resetTime: nextTokenTime,
      retryAfter: allowed ? undefined : Math.max(0, nextTokenTime - now)
    };
  }

  /**
   * Verifica backoff exponencial
   */
  private checkExponentialBackoff(
    state: RateLimitState, 
    config: RateLimitConfig, 
    now: number
  ): RateLimitResult {
    // Se estamos em backoff, não permitir
    if (state.backoffUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: state.backoffUntil,
        retryAfter: state.backoffUntil - now,
        reason: 'Backoff exponencial ativo'
      };
    }

    // Verificar limite básico de requisições
    const windowStart = now - config.windowMs;
    state.requests = state.requests.filter(timestamp => timestamp > windowStart);
    
    const remaining = Math.max(0, config.maxRequests - state.requests.length);
    const allowed = remaining > 0;

    return {
      allowed,
      remaining,
      resetTime: now + config.windowMs,
      retryAfter: allowed ? undefined : config.windowMs
    };
  }

  /**
   * Obtém ou cria estado para uma chave
   */
  private getOrCreateState(key: string): RateLimitState {
    if (!this.states.has(key)) {
      const config = this.configs.get(key.split(':')[0]);
      this.states.set(key, {
        requests: [],
        tokens: config?.maxRequests || 0,
        lastRefill: Date.now(),
        backoffUntil: 0,
        consecutiveErrors: 0
      });
    }
    return this.states.get(key)!;
  }

  /**
   * Configura rate limit personalizado
   */
  setRateLimit(operationType: string, config: RateLimitConfig): void {
    this.configs.set(operationType, config);
  }

  /**
   * Obtém configuração atual
   */
  getRateLimit(operationType: string): RateLimitConfig | undefined {
    return this.configs.get(operationType);
  }

  /**
   * Obtém estatísticas de uso
   */
  getStats(operationType: string, identifier?: string): {
    requests: number;
    remaining: number;
    resetTime: number;
    backoffUntil: number;
    consecutiveErrors: number;
  } | null {
    const key = identifier ? `${operationType}:${identifier}` : operationType;
    const state = this.states.get(key);
    const config = this.configs.get(operationType);
    
    if (!state || !config) return null;

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const activeRequests = state.requests.filter(timestamp => timestamp > windowStart);

    return {
      requests: activeRequests.length,
      remaining: Math.max(0, config.maxRequests - activeRequests.length),
      resetTime: now + config.windowMs,
      backoffUntil: state.backoffUntil,
      consecutiveErrors: state.consecutiveErrors
    };
  }

  /**
   * Limpa estado antigo (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    for (const [key, state] of this.states.entries()) {
      // Remover requisições antigas
      state.requests = state.requests.filter(timestamp => now - timestamp < maxAge);
      
      // Remover estados vazios e antigos
      if (state.requests.length === 0 && 
          state.backoffUntil < now && 
          now - state.lastRefill > maxAge) {
        this.states.delete(key);
      }
    }
  }

  /**
   * Reset completo (para testes)
   */
  reset(): void {
    this.states.clear();
  }
}

/**
 * 🎯 INSTÂNCIA GLOBAL DO RATE LIMITER
 */
export const rateLimiter = new RateLimiter();

/**
 * 🎯 UTILITÁRIOS DE CONVENIÊNCIA
 */

/**
 * Verifica se uma operação pode ser executada
 */
export function checkRateLimit(
  operationType: string, 
  identifier?: string
): RateLimitResult {
  return rateLimiter.checkLimit(operationType, identifier);
}

/**
 * Registra uma requisição bem-sucedida
 */
export function recordRequest(
  operationType: string, 
  identifier?: string
): void {
  rateLimiter.recordRequest(operationType, identifier);
}

/**
 * Registra um erro (para backoff)
 */
export function recordError(
  operationType: string, 
  identifier?: string
): void {
  rateLimiter.recordError(operationType, identifier);
}

/**
 * Wrapper para executar operação com rate limiting
 */
export async function withRateLimit<T>(
  operationType: string,
  operation: () => Promise<T>,
  identifier?: string
): Promise<T> {
  const result = checkRateLimit(operationType, identifier);
  
  if (!result.allowed) {
    const error = new Error(`Rate limit exceeded for ${operationType}`);
    (error as any).type = RealtimeErrorType.RATE_LIMIT_ERROR;
    (error as any).retryAfter = result.retryAfter;
    throw error;
  }

  try {
    const operationResult = await operation();
    recordRequest(operationType, identifier);
    return operationResult;
  } catch (error) {
    recordError(operationType, identifier);
    throw error;
  }
}