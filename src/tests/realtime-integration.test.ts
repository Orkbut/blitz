/**
 * 🧪 TESTES DE INTEGRAÇÃO PARA REALTIME FUNCTIONALITY
 * 
 * Testes que verificam a integração entre o hook unificado e o RealtimeManager real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeManager } from '../core/infrastructure/services/RealtimeManager';
import { configValidator } from '../hooks/utils/config-validator';

describe('Realtime Integration Tests', () => {
  beforeEach(() => {
    // Limpar qualquer estado anterior
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Limpar subscriptions ativas
    const activeChannels = realtimeManager.getActiveChannels();
    activeChannels.forEach(channelId => {
      realtimeManager.unsubscribe(channelId);
    });
  });

  describe('RealtimeManager Integration', () => {
    it('should create and manage subscriptions correctly', () => {
      const subscription = {
        channelId: 'integration-test-1',
        tables: ['operacao'],
        enabled: true
      };

      const success = realtimeManager.subscribe(subscription);
      expect(success).toBe(true);

      const stats = realtimeManager.getChannelStats();
      expect(stats.activeChannels).toBeGreaterThan(0);
      expect(stats.activeSubscriptions).toBeGreaterThan(0);

      // Cleanup
      realtimeManager.unsubscribe('integration-test-1');
      
      const statsAfter = realtimeManager.getChannelStats();
      expect(statsAfter.activeChannels).toBe(stats.activeChannels - 1);
    });

    it('should handle multiple concurrent subscriptions', () => {
      const subscriptions = [
        { channelId: 'multi-1', tables: ['operacao'], enabled: true },
        { channelId: 'multi-2', tables: ['participacao'], enabled: true },
        { channelId: 'multi-3', tables: ['eventos_operacao'], enabled: true }
      ];

      subscriptions.forEach(sub => {
        const success = realtimeManager.subscribe(sub);
        expect(success).toBe(true);
      });

      const stats = realtimeManager.getChannelStats();
      expect(stats.activeChannels).toBeGreaterThanOrEqual(3);

      // Verificar canais ativos
      const activeChannels = realtimeManager.getActiveChannels();
      expect(activeChannels).toContain('multi-1');
      expect(activeChannels).toContain('multi-2');
      expect(activeChannels).toContain('multi-3');
    });

    it('should handle subscription with filters correctly', () => {
      const subscription = {
        channelId: 'filtered-test',
        tables: ['operacao', 'participacao'],
        filters: {
          operacao: 'modalidade.eq.BLITZ',
          participacao: 'estado.neq.CANCELADO'
        },
        enabled: true
      };

      const success = realtimeManager.subscribe(subscription);
      expect(success).toBe(true);

      const activeChannels = realtimeManager.getActiveChannels();
      expect(activeChannels).toContain('filtered-test');
    });

    it('should provide accurate statistics', () => {
      const initialStats = realtimeManager.getChannelStats();
      
      // Criar subscription
      realtimeManager.subscribe({
        channelId: 'stats-test',
        tables: ['operacao'],
        enabled: true
      });

      const newStats = realtimeManager.getChannelStats();
      expect(newStats.activeChannels).toBe(initialStats.activeChannels + 1);
      expect(newStats.activeSubscriptions).toBe(initialStats.activeSubscriptions + 1);
      expect(newStats.lastEventTime).toBeDefined();
      expect(newStats.timeSinceLastEvent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate configuration before creating subscription', () => {
      // Configuração válida
      const validConfig = {
        tables: ['operacao', 'participacao'],
        filters: { operacao: 'modalidade.eq.BLITZ' },
        enableRealtime: true
      };

      expect(() => {
        configValidator.sanitizeConfig(validConfig);
      }).not.toThrow();

      // Configuração inválida
      const invalidConfig = {
        tables: ['invalid_table'],
        filters: { invalid_table: 'some.filter' }
      };

      const sanitized = configValidator.sanitizeConfig(invalidConfig);
      expect(sanitized.tables).toHaveLength(0); // Tabelas inválidas removidas
      expect(sanitized.filters).toBeUndefined(); // Filtros inválidos removidos
    });

    it('should sanitize and normalize table names', () => {
      const config = {
        tables: ['OPERACAO', ' participacao ', 'Eventos_Operacao'],
        enableRealtime: true
      };

      const sanitized = configValidator.sanitizeConfig(config);
      
      expect(sanitized.tables).toContain('operacao');
      expect(sanitized.tables).toContain('participacao');
      expect(sanitized.tables).toContain('eventos_operacao');
      expect(sanitized.tables).not.toContain('OPERACAO');
      expect(sanitized.tables).not.toContain(' participacao ');
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {
        tables: ['operacao']
      };

      const sanitized = configValidator.sanitizeConfig(minimalConfig);
      
      expect(sanitized.enableRealtime).toBe(true);
      expect(sanitized.enablePolling).toBe(true);
      expect(sanitized.enableFetch).toBe(true);
      expect(sanitized.debug).toBe(false);
      expect(sanitized.activeInterval).toBeGreaterThanOrEqual(1000);
      expect(sanitized.inactiveInterval).toBeGreaterThanOrEqual(1000);
    });

    it('should handle date sanitization correctly', () => {
      const testStartDate = new Date('2024-06-15T10:00:00.000Z');
      const testEndDate = new Date('2024-12-31T23:59:59.999Z');
      
      const config = {
        tables: ['operacao'],
        startDate: testStartDate.toISOString(),
        endDate: testEndDate
      };

      const sanitized = configValidator.sanitizeConfig(config);
      
      expect(sanitized.startDate).toBeInstanceOf(Date);
      expect(sanitized.endDate).toBeInstanceOf(Date);
      expect(sanitized.startDate!.getTime()).toBe(testStartDate.getTime());
      expect(sanitized.endDate!.getTime()).toBe(testEndDate.getTime());
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle rate limiting gracefully', () => {
      // Criar muitas subscriptions rapidamente para testar rate limiting
      const subscriptions = [];
      for (let i = 0; i < 10; i++) {
        subscriptions.push({
          channelId: `rate-limit-test-${i}`,
          tables: ['operacao'],
          enabled: true
        });
      }

      let successCount = 0;
      subscriptions.forEach(sub => {
        const success = realtimeManager.subscribe(sub);
        if (success) successCount++;
      });

      // Pelo menos algumas subscriptions devem ter sucesso
      expect(successCount).toBeGreaterThan(0);
    });

    it('should handle invalid table names gracefully', () => {
      const invalidConfig = {
        tables: ['invalid_table_1', 'invalid_table_2', 'operacao'],
        enableRealtime: true
      };

      const sanitized = configValidator.sanitizeConfig(invalidConfig);
      
      // Apenas tabelas válidas devem permanecer
      expect(sanitized.tables).toEqual(['operacao']);
      expect(sanitized.tables).not.toContain('invalid_table_1');
      expect(sanitized.tables).not.toContain('invalid_table_2');
    });

    it('should handle malformed filters gracefully', () => {
      const configWithBadFilters = {
        tables: ['operacao'],
        filters: {
          operacao: '', // Filtro vazio - deve ser removido
          invalid_table: 'some.filter', // Tabela inválida - deve ser removido
          participacao: 'valid.filter.eq.value' // Filtro válido para tabela válida - deve ser mantido
        }
      };

      const sanitized = configValidator.sanitizeConfig(configWithBadFilters);
      
      // Apenas filtros válidos para tabelas válidas devem permanecer
      expect(sanitized.filters).toBeDefined();
      expect(sanitized.filters!.participacao).toBe('valid.filter.eq.value');
      expect(sanitized.filters!.operacao).toBeUndefined(); // Filtro vazio removido
      expect(sanitized.filters!.invalid_table).toBeUndefined(); // Tabela inválida removida
    });
  });

  describe('Performance Integration', () => {
    it('should handle rapid subscription creation and cleanup', () => {
      const startTime = Date.now();
      const channelIds: string[] = [];

      // Criar subscriptions
      for (let i = 0; i < 20; i++) {
        const channelId = `perf-test-${i}`;
        channelIds.push(channelId);
        
        realtimeManager.subscribe({
          channelId,
          tables: ['operacao'],
          enabled: true
        });
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(1000); // Deve criar 20 subscriptions em menos de 1s

      // Limpar subscriptions
      const cleanupStart = Date.now();
      channelIds.forEach(channelId => {
        realtimeManager.unsubscribe(channelId);
      });
      
      const cleanupTime = Date.now() - cleanupStart;
      expect(cleanupTime).toBeLessThan(500); // Deve limpar em menos de 500ms

      // Verificar se foram realmente removidas
      const finalStats = realtimeManager.getChannelStats();
      const activeChannels = realtimeManager.getActiveChannels();
      
      channelIds.forEach(channelId => {
        expect(activeChannels).not.toContain(channelId);
      });
    });

    it('should maintain consistent state under concurrent operations', () => {
      const operations = [];
      
      // Criar operações concorrentes
      for (let i = 0; i < 10; i++) {
        operations.push(() => {
          const channelId = `concurrent-${i}`;
          realtimeManager.subscribe({
            channelId,
            tables: ['operacao'],
            enabled: true
          });
          
          // Imediatamente desinscrever alguns
          if (i % 2 === 0) {
            setTimeout(() => {
              realtimeManager.unsubscribe(channelId);
            }, 10);
          }
        });
      }

      // Executar todas as operações
      operations.forEach(op => op());

      // Aguardar um pouco para as operações assíncronas
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const stats = realtimeManager.getChannelStats();
          
          // Estado deve ser consistente
          expect(stats.activeChannels).toBeGreaterThanOrEqual(0);
          expect(stats.activeSubscriptions).toBeGreaterThanOrEqual(0);
          expect(stats.activeChannels).toBe(stats.activeSubscriptions);
          
          resolve();
        }, 50);
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical operation monitoring scenario', () => {
      const operationMonitoringConfig = {
        tables: ['operacao', 'participacao', 'eventos_operacao'],
        filters: {
          operacao: 'modalidade.in.(BLITZ,EDUCATIVA)',
          participacao: 'estado.neq.CANCELADO'
        },
        enableRealtime: true,
        debug: false
      };

      const sanitized = configValidator.sanitizeConfig(operationMonitoringConfig);
      
      expect(sanitized.tables).toHaveLength(3);
      expect(sanitized.filters).toBeDefined();
      expect(Object.keys(sanitized.filters!)).toHaveLength(2);

      const success = realtimeManager.subscribe({
        channelId: 'operation-monitoring',
        tables: sanitized.tables,
        filters: sanitized.filters,
        enabled: true
      });

      expect(success).toBe(true);
    });

    it('should handle dashboard real-time updates scenario', () => {
      const dashboardConfig = {
        tables: ['operacao', 'servidor'],
        enableRealtime: true,
        enablePolling: true,
        activeInterval: 2000,
        inactiveInterval: 10000,
        debug: true
      };

      const sanitized = configValidator.sanitizeConfig(dashboardConfig);
      
      expect(sanitized.activeInterval).toBe(2000);
      expect(sanitized.inactiveInterval).toBe(10000);
      expect(sanitized.debug).toBe(true);

      const success = realtimeManager.subscribe({
        channelId: 'dashboard-updates',
        tables: sanitized.tables,
        enabled: true
      });

      expect(success).toBe(true);
    });

    it('should handle event tracking scenario', () => {
      const eventTrackingConfig = {
        tables: ['eventos_operacao'],
        filters: {
          eventos_operacao: 'tipo_evento.in.(INICIO,FIM,CANCELAMENTO)'
        },
        enableRealtime: true,
        enablePolling: false // Apenas realtime, sem polling
      };

      const sanitized = configValidator.sanitizeConfig(eventTrackingConfig);
      
      expect(sanitized.tables).toEqual(['eventos_operacao']);
      expect(sanitized.enableRealtime).toBe(true);
      expect(sanitized.enablePolling).toBe(false);

      const success = realtimeManager.subscribe({
        channelId: 'event-tracking',
        tables: sanitized.tables,
        filters: sanitized.filters,
        enabled: true
      });

      expect(success).toBe(true);
    });
  });
});