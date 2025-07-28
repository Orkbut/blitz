/**
 * 🧪 TESTES PARA RATE LIMITER
 * 
 * Testa funcionalidades de rate limiting para operações realtime
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RateLimiter,
  RateLimitStrategy,
  checkRateLimit,
  recordRequest,
  recordError,
  withRateLimit,
  rateLimiter
} from '../hooks/utils/rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    limiter.reset();
  });

  describe('Fixed Window Strategy', () => {
    beforeEach(() => {
      limiter.setRateLimit('test_fixed', {
        maxRequests: 5,
        windowMs: 60000, // 1 minuto
        strategy: RateLimitStrategy.FIXED_WINDOW
      });
    });

    it('deve permitir requisições dentro do limite', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit('test_fixed');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(5 - i);
        
        if (result.allowed) {
          limiter.recordRequest('test_fixed');
        }
      }
    });

    it('deve bloquear requisições após limite', () => {
      // Usar todas as requisições
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('test_fixed');
        limiter.recordRequest('test_fixed');
      }

      const result = limiter.checkLimit('test_fixed');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('deve resetar na próxima janela', () => {
      // Usar todas as requisições
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit('test_fixed');
        limiter.recordRequest('test_fixed');
      }

      expect(limiter.checkLimit('test_fixed').allowed).toBe(false);

      // Avançar para próxima janela
      vi.advanceTimersByTime(60000);

      const result = limiter.checkLimit('test_fixed');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
  });

  describe('Sliding Window Strategy', () => {
    beforeEach(() => {
      limiter.setRateLimit('test_sliding', {
        maxRequests: 3,
        windowMs: 30000, // 30 segundos
        strategy: RateLimitStrategy.SLIDING_WINDOW
      });
    });

    it('deve permitir requisições dentro da janela deslizante', () => {
      // Primeira requisição
      expect(limiter.checkLimit('test_sliding').allowed).toBe(true);
      limiter.recordRequest('test_sliding');

      // Avançar 10 segundos
      vi.advanceTimersByTime(10000);

      // Segunda requisição
      expect(limiter.checkLimit('test_sliding').allowed).toBe(true);
      limiter.recordRequest('test_sliding');

      // Avançar mais 10 segundos
      vi.advanceTimersByTime(10000);

      // Terceira requisição
      expect(limiter.checkLimit('test_sliding').allowed).toBe(true);
      limiter.recordRequest('test_sliding');

      // Quarta requisição deve ser bloqueada
      expect(limiter.checkLimit('test_sliding').allowed).toBe(false);
    });

    it('deve liberar requisições antigas da janela', () => {
      // Fazer 3 requisições
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit('test_sliding');
        limiter.recordRequest('test_sliding');
        vi.advanceTimersByTime(5000);
      }

      // Deve estar no limite
      expect(limiter.checkLimit('test_sliding').allowed).toBe(false);

      // Avançar tempo suficiente para primeira requisição sair da janela
      vi.advanceTimersByTime(20000); // Total: 35s, primeira req foi há 30s+

      // Agora deve permitir nova requisição
      expect(limiter.checkLimit('test_sliding').allowed).toBe(true);
    });
  });

  describe('Token Bucket Strategy', () => {
    beforeEach(() => {
      limiter.setRateLimit('test_bucket', {
        maxRequests: 10, // 10 tokens no bucket
        windowMs: 60000, // Refill completo em 1 minuto
        strategy: RateLimitStrategy.TOKEN_BUCKET
      });
    });

    it('deve permitir rajadas até o limite do bucket', () => {
      // Deve permitir 10 requisições imediatas
      for (let i = 0; i < 10; i++) {
        const result = limiter.checkLimit('test_bucket');
        expect(result.allowed).toBe(true);
        limiter.recordRequest('test_bucket');
      }

      // 11ª requisição deve ser bloqueada
      expect(limiter.checkLimit('test_bucket').allowed).toBe(false);
    });

    it('deve refill tokens ao longo do tempo', () => {
      // Usar todos os tokens
      for (let i = 0; i < 10; i++) {
        limiter.checkLimit('test_bucket');
        limiter.recordRequest('test_bucket');
      }

      expect(limiter.checkLimit('test_bucket').allowed).toBe(false);

      // Avançar metade do tempo de refill
      vi.advanceTimersByTime(30000);

      // Deve ter ~5 tokens disponíveis
      const result = limiter.checkLimit('test_bucket');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('Exponential Backoff Strategy', () => {
    beforeEach(() => {
      limiter.setRateLimit('test_backoff', {
        maxRequests: 5,
        windowMs: 60000,
        strategy: RateLimitStrategy.EXPONENTIAL_BACKOFF,
        backoffMultiplier: 2,
        maxBackoffMs: 60000
      });
    });

    it('deve permitir requisições normalmente sem erros', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.checkLimit('test_backoff');
        expect(result.allowed).toBe(true);
        limiter.recordRequest('test_backoff');
      }
    });

    it('deve aplicar backoff após erros', () => {
      // Registrar um erro
      limiter.recordError('test_backoff');

      // Primeira tentativa após erro deve ser bloqueada
      const result = limiter.checkLimit('test_backoff');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Backoff');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('deve aumentar backoff com erros consecutivos', () => {
      // Primeiro erro
      limiter.recordError('test_backoff');
      const result1 = limiter.checkLimit('test_backoff');
      const firstBackoff = result1.retryAfter || 0;

      // Avançar tempo e registrar segundo erro
      vi.advanceTimersByTime(firstBackoff + 1000);
      limiter.recordError('test_backoff');
      
      const result2 = limiter.checkLimit('test_backoff');
      const secondBackoff = result2.retryAfter || 0;

      expect(secondBackoff).toBeGreaterThan(firstBackoff);
    });

    it('deve resetar backoff após sucesso', () => {
      // Registrar erro
      limiter.recordError('test_backoff');
      expect(limiter.checkLimit('test_backoff').allowed).toBe(false);

      // Avançar tempo suficiente
      vi.advanceTimersByTime(10000);

      // Registrar sucesso
      limiter.recordRequest('test_backoff');

      // Próxima verificação deve ser permitida
      expect(limiter.checkLimit('test_backoff').allowed).toBe(true);
    });
  });

  describe('Identificadores únicos', () => {
    beforeEach(() => {
      limiter.setRateLimit('test_id', {
        maxRequests: 2,
        windowMs: 60000,
        strategy: RateLimitStrategy.SLIDING_WINDOW
      });
    });

    it('deve manter limites separados por identificador', () => {
      // User A faz 2 requisições
      limiter.checkLimit('test_id', 'userA');
      limiter.recordRequest('test_id', 'userA');
      limiter.checkLimit('test_id', 'userA');
      limiter.recordRequest('test_id', 'userA');

      // User A deve estar no limite
      expect(limiter.checkLimit('test_id', 'userA').allowed).toBe(false);

      // User B deve ainda ter limite disponível
      expect(limiter.checkLimit('test_id', 'userB').allowed).toBe(true);
    });
  });

  describe('Estatísticas', () => {
    beforeEach(() => {
      limiter.setRateLimit('test_stats', {
        maxRequests: 5,
        windowMs: 60000,
        strategy: RateLimitStrategy.SLIDING_WINDOW
      });
    });

    it('deve fornecer estatísticas precisas', () => {
      // Fazer algumas requisições
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit('test_stats');
        limiter.recordRequest('test_stats');
      }

      const stats = limiter.getStats('test_stats');
      expect(stats).toBeTruthy();
      expect(stats!.requests).toBe(3);
      expect(stats!.remaining).toBe(2);
    });

    it('deve retornar null para operação inexistente', () => {
      const stats = limiter.getStats('nonexistent');
      expect(stats).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('deve limpar estados antigos', () => {
      limiter.setRateLimit('test_cleanup', {
        maxRequests: 5,
        windowMs: 1000,
        strategy: RateLimitStrategy.SLIDING_WINDOW
      });

      // Fazer requisição
      limiter.checkLimit('test_cleanup');
      limiter.recordRequest('test_cleanup');

      // Verificar que estado existe
      expect(limiter.getStats('test_cleanup')).toBeTruthy();

      // Avançar muito tempo
      vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 horas

      // Cleanup deve remover estado antigo
      limiter.cleanup();

      // Estado deve ter sido limpo (retorna null quando não existe)
      const stats = limiter.getStats('test_cleanup');
      expect(stats).toBeNull();
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    rateLimiter.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('deve usar configuração padrão para operações conhecidas', () => {
      const result = checkRateLimit('realtime_connection');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('deve permitir operações desconhecidas', () => {
      const result = checkRateLimit('unknown_operation');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });
  });

  describe('withRateLimit', () => {
    it('deve executar operação quando permitida', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await withRateLimit('test_operation', mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('deve lançar erro quando rate limit excedido', async () => {
      // Configurar limite muito baixo
      rateLimiter.setRateLimit('test_limit', {
        maxRequests: 1,
        windowMs: 60000,
        strategy: RateLimitStrategy.FIXED_WINDOW
      });

      const mockOperation = vi.fn().mockResolvedValue('success');

      // Primeira chamada deve funcionar
      await withRateLimit('test_limit', mockOperation);

      // Segunda chamada deve falhar
      await expect(
        withRateLimit('test_limit', mockOperation)
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('deve registrar erro quando operação falha', async () => {
      // Configurar rate limit para test_error
      rateLimiter.setRateLimit('test_error', {
        maxRequests: 5,
        windowMs: 60000,
        strategy: RateLimitStrategy.SLIDING_WINDOW
      });

      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(
        withRateLimit('test_error', mockOperation)
      ).rejects.toThrow('Operation failed');

      // Verificar se erro foi registrado (para backoff)
      const stats = rateLimiter.getStats('test_error');
      expect(stats).toBeTruthy();
    });
  });
});

describe('Integration with Error System', () => {
  beforeEach(() => {
    rateLimiter.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve integrar com sistema de recuperação de erros', async () => {
    // Configurar limite baixo para error recovery
    rateLimiter.setRateLimit('error_recovery', {
      maxRequests: 2,
      windowMs: 60000,
      strategy: RateLimitStrategy.SLIDING_WINDOW
    });

    // Simular múltiplas tentativas de recuperação
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit('error_recovery', 'test-channel');
      
      if (i < 2) {
        expect(result.allowed).toBe(true);
        recordRequest('error_recovery', 'test-channel');
      } else {
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeGreaterThan(0);
      }
    }
  });

  it('deve aplicar backoff após erros consecutivos', () => {
    rateLimiter.setRateLimit('error_recovery', {
      maxRequests: 10,
      windowMs: 60000,
      strategy: RateLimitStrategy.EXPONENTIAL_BACKOFF,
      backoffMultiplier: 2,
      maxBackoffMs: 60000
    });

    // Registrar erro
    recordError('error_recovery', 'test-channel');

    // Deve estar em backoff
    const result = checkRateLimit('error_recovery', 'test-channel');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Backoff');
  });
});