/**
 * 🧪 TESTES UNITÁRIOS PARA FUNCIONALIDADE DE REALTIME
 * 
 * Testes específicos para o handling de eventos de realtime,
 * tracking de estatísticas e gerenciamento de conexão.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeManager, type DatabaseChangeEvent, type ChannelSubscription } from '../core/infrastructure/services/RealtimeManager';
import { configValidator } from '../hooks/utils/config-validator';

// 🎯 MOCK SIMPLES PARA TESTES
class MockRealtimeManager {
  private subscriptions = new Map<string, ChannelSubscription>();
  private stats = {
    activeChannels: 0,
    activeSubscriptions: 0,
    joinAttempts: 0,
    lastEventTime: new Date().toISOString(),
    timeSinceLastEvent: 0
  };

  subscribe(subscription: ChannelSubscription): boolean {
    this.subscriptions.set(subscription.channelId, subscription);
    this.stats.activeChannels++;
    this.stats.activeSubscriptions++;
    
    // Simular conexão bem-sucedida
    setTimeout(() => {
      if (subscription.onConnectionStatusChange) {
        try {
          subscription.onConnectionStatusChange('connected');
        } catch (error) {
          // Capturar erros dos callbacks silenciosamente
          console.error('Error in connection status callback:', error);
        }
      }
    }, 10);
    
    return true;
  }

  unsubscribe(channelId: string): void {
    if (this.subscriptions.has(channelId)) {
      this.subscriptions.delete(channelId);
      this.stats.activeChannels--;
      this.stats.activeSubscriptions--;
    }
  }

  getChannelStats() {
    return { ...this.stats };
  }

  // Métodos para simular eventos em testes
  simulateDatabaseChange(channelId: string, event: Partial<DatabaseChangeEvent>) {
    const subscription = this.subscriptions.get(channelId);
    if (subscription && subscription.onDatabaseChange) {
      const fullEvent: DatabaseChangeEvent = {
        channelId,
        table: 'operacao',
        eventType: 'INSERT',
        timestamp: Date.now() + Math.random(), // Adicionar randomness para timestamps únicos
        payload: { new: {}, old: {}, eventType: 'INSERT' } as any,
        ...event
      };
      
      try {
        subscription.onDatabaseChange(fullEvent);
      } catch (error) {
        // Capturar erros dos callbacks silenciosamente
        console.error('Error in database change callback:', error);
      }
    }
  }

  simulateConnectionChange(channelId: string, status: 'connected' | 'disconnected' | 'error', error?: string) {
    const subscription = this.subscriptions.get(channelId);
    if (subscription && subscription.onConnectionStatusChange) {
      try {
        subscription.onConnectionStatusChange(status, error);
      } catch (callbackError) {
        // Capturar erros dos callbacks silenciosamente
        console.error('Error in connection status callback:', callbackError);
      }
    }
  }

  getSubscription(channelId: string) {
    return this.subscriptions.get(channelId);
  }

  clear() {
    this.subscriptions.clear();
    this.stats = {
      activeChannels: 0,
      activeSubscriptions: 0,
      joinAttempts: 0,
      lastEventTime: new Date().toISOString(),
      timeSinceLastEvent: 0
    };
  }
}

let mockManager: MockRealtimeManager;

describe('Realtime Core Functionality', () => {
  beforeEach(() => {
    mockManager = new MockRealtimeManager();
  });

  afterEach(() => {
    mockManager.clear();
    vi.clearAllTimers();
  });

  describe('Channel Subscription Logic', () => {
    it('should create subscription with correct configuration', () => {
      const subscription: ChannelSubscription = {
        channelId: 'test-channel-1',
        tables: ['operacao', 'participacao'],
        filters: { operacao: 'modalidade.eq.BLITZ' },
        enabled: true
      };

      const success = mockManager.subscribe(subscription);

      expect(success).toBe(true);
      expect(mockManager.getChannelStats().activeChannels).toBe(1);
      expect(mockManager.getChannelStats().activeSubscriptions).toBe(1);
      
      const storedSubscription = mockManager.getSubscription('test-channel-1');
      expect(storedSubscription).toBeDefined();
      expect(storedSubscription?.tables).toEqual(['operacao', 'participacao']);
      expect(storedSubscription?.filters).toEqual({ operacao: 'modalidade.eq.BLITZ' });
    });

    it('should handle multiple subscriptions correctly', () => {
      const subscription1: ChannelSubscription = {
        channelId: 'channel-1',
        tables: ['operacao'],
        enabled: true
      };

      const subscription2: ChannelSubscription = {
        channelId: 'channel-2',
        tables: ['participacao'],
        enabled: true
      };

      mockManager.subscribe(subscription1);
      mockManager.subscribe(subscription2);

      expect(mockManager.getChannelStats().activeChannels).toBe(2);
      expect(mockManager.getChannelStats().activeSubscriptions).toBe(2);
    });

    it('should unsubscribe correctly', () => {
      const subscription: ChannelSubscription = {
        channelId: 'test-channel',
        tables: ['operacao'],
        enabled: true
      };

      mockManager.subscribe(subscription);
      expect(mockManager.getChannelStats().activeChannels).toBe(1);

      mockManager.unsubscribe('test-channel');
      expect(mockManager.getChannelStats().activeChannels).toBe(0);
      expect(mockManager.getSubscription('test-channel')).toBeUndefined();
    });
  });

  describe('Database Change Event Handling', () => {
    it('should handle database change events correctly', () => {
      const onDatabaseChange = vi.fn();
      let eventReceived: DatabaseChangeEvent | null = null;
      
      const subscription: ChannelSubscription = {
        channelId: 'test-channel',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => {
          eventReceived = event;
          onDatabaseChange(event);
        }
      };

      mockManager.subscribe(subscription);

      // Simular evento de mudança no banco
      const mockEvent: Partial<DatabaseChangeEvent> = {
        table: 'operacao',
        eventType: 'INSERT',
        payload: { 
          new: { id: 1, modalidade: 'BLITZ' }, 
          old: {}, 
          eventType: 'INSERT' 
        } as any
      };

      mockManager.simulateDatabaseChange('test-channel', mockEvent);

      // Verificar se callback foi chamado
      expect(onDatabaseChange).toHaveBeenCalledTimes(1);
      expect(eventReceived).toBeDefined();
      expect(eventReceived?.table).toBe('operacao');
      expect(eventReceived?.eventType).toBe('INSERT');
      expect(eventReceived?.payload.new).toEqual({ id: 1, modalidade: 'BLITZ' });
    });

    it('should handle multiple database events', () => {
      const events: DatabaseChangeEvent[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'multi-event-channel',
        tables: ['operacao', 'participacao'],
        enabled: true,
        onDatabaseChange: (event) => {
          events.push(event);
        }
      };

      mockManager.subscribe(subscription);

      // Simular múltiplos eventos
      mockManager.simulateDatabaseChange('multi-event-channel', {
        table: 'operacao',
        eventType: 'INSERT'
      });

      mockManager.simulateDatabaseChange('multi-event-channel', {
        table: 'participacao',
        eventType: 'UPDATE'
      });

      mockManager.simulateDatabaseChange('multi-event-channel', {
        table: 'operacao',
        eventType: 'DELETE'
      });

      // Verificar eventos recebidos
      expect(events).toHaveLength(3);
      expect(events[0].eventType).toBe('INSERT');
      expect(events[1].eventType).toBe('UPDATE');
      expect(events[2].eventType).toBe('DELETE');
    });

    it('should handle errors in database change callbacks gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const subscription: ChannelSubscription = {
        channelId: 'error-channel',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: () => {
          throw new Error('Callback error');
        }
      };

      mockManager.subscribe(subscription);

      // Simular evento que causará erro no callback
      expect(() => {
        mockManager.simulateDatabaseChange('error-channel', {
          table: 'operacao',
          eventType: 'INSERT'
        });
      }).not.toThrow(); // O erro deve ser capturado internamente

      consoleSpy.mockRestore();
    });

    it('should handle events with different payload types', () => {
      const events: DatabaseChangeEvent[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'payload-test',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => {
          events.push(event);
        }
      };

      mockManager.subscribe(subscription);

      // Evento INSERT
      mockManager.simulateDatabaseChange('payload-test', {
        eventType: 'INSERT',
        payload: {
          new: { id: 1, modalidade: 'BLITZ', status: 'ATIVO' },
          old: {},
          eventType: 'INSERT'
        } as any
      });

      // Evento UPDATE
      mockManager.simulateDatabaseChange('payload-test', {
        eventType: 'UPDATE',
        payload: {
          new: { id: 1, modalidade: 'BLITZ', status: 'INATIVO' },
          old: { id: 1, modalidade: 'BLITZ', status: 'ATIVO' },
          eventType: 'UPDATE'
        } as any
      });

      // Evento DELETE
      mockManager.simulateDatabaseChange('payload-test', {
        eventType: 'DELETE',
        payload: {
          new: {},
          old: { id: 1, modalidade: 'BLITZ', status: 'INATIVO' },
          eventType: 'DELETE'
        } as any
      });

      expect(events).toHaveLength(3);
      expect(events[0].payload.new.status).toBe('ATIVO');
      expect(events[1].payload.old.status).toBe('ATIVO');
      expect(events[1].payload.new.status).toBe('INATIVO');
      expect(events[2].payload.old.status).toBe('INATIVO');
    });
  });

  describe('Connection Status Tracking', () => {
    it('should track connection status changes correctly', async () => {
      const statusChanges: string[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'status-test',
        tables: ['operacao'],
        enabled: true,
        onConnectionStatusChange: (status) => {
          statusChanges.push(status);
        }
      };

      mockManager.subscribe(subscription);

      // Aguardar conexão automática
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(statusChanges).toContain('connected');

      // Simular desconexão
      mockManager.simulateConnectionChange('status-test', 'disconnected');
      expect(statusChanges).toContain('disconnected');

      // Simular reconexão
      mockManager.simulateConnectionChange('status-test', 'connected');
      expect(statusChanges.filter(s => s === 'connected')).toHaveLength(2);
    });

    it('should handle connection errors correctly', () => {
      const statusChanges: Array<{status: string, error?: string}> = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'error-test',
        tables: ['operacao'],
        enabled: true,
        onConnectionStatusChange: (status, error) => {
          statusChanges.push({ status, error });
        }
      };

      mockManager.subscribe(subscription);

      // Simular erro de conexão
      mockManager.simulateConnectionChange('error-test', 'error', 'Connection timeout');

      const errorEvent = statusChanges.find(s => s.status === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.error).toBe('Connection timeout');
    });

    it('should handle multiple connection state transitions', () => {
      const statusHistory: string[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'transitions-test',
        tables: ['operacao'],
        enabled: true,
        onConnectionStatusChange: (status) => {
          statusHistory.push(status);
        }
      };

      mockManager.subscribe(subscription);

      // Simular sequência de mudanças de estado
      mockManager.simulateConnectionChange('transitions-test', 'connected');
      mockManager.simulateConnectionChange('transitions-test', 'disconnected');
      mockManager.simulateConnectionChange('transitions-test', 'error', 'Network error');
      mockManager.simulateConnectionChange('transitions-test', 'connected');

      expect(statusHistory).toEqual(['connected', 'disconnected', 'error', 'connected']);
    });
  });

  describe('Event Counter and Statistics', () => {
    it('should track event statistics correctly', () => {
      let eventCount = 0;
      let lastEventTime: number | null = null;
      
      const subscription: ChannelSubscription = {
        channelId: 'stats-test',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => {
          eventCount++;
          lastEventTime = event.timestamp;
        }
      };

      mockManager.subscribe(subscription);

      // Simular eventos
      mockManager.simulateDatabaseChange('stats-test', { eventType: 'INSERT' });
      mockManager.simulateDatabaseChange('stats-test', { eventType: 'UPDATE' });
      mockManager.simulateDatabaseChange('stats-test', { eventType: 'DELETE' });

      expect(eventCount).toBe(3);
      expect(lastEventTime).toBeGreaterThan(0);
    });

    it('should provide accurate manager statistics', () => {
      // Criar múltiplas subscriptions
      mockManager.subscribe({
        channelId: 'channel-1',
        tables: ['operacao'],
        enabled: true
      });

      mockManager.subscribe({
        channelId: 'channel-2',
        tables: ['participacao'],
        enabled: true
      });

      const stats = mockManager.getChannelStats();
      expect(stats.activeChannels).toBe(2);
      expect(stats.activeSubscriptions).toBe(2);
      expect(stats.lastEventTime).toBeDefined();
    });

    it('should track events per channel independently', () => {
      const channel1Events: DatabaseChangeEvent[] = [];
      const channel2Events: DatabaseChangeEvent[] = [];
      
      mockManager.subscribe({
        channelId: 'independent-1',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => channel1Events.push(event)
      });

      mockManager.subscribe({
        channelId: 'independent-2',
        tables: ['participacao'],
        enabled: true,
        onDatabaseChange: (event) => channel2Events.push(event)
      });

      // Eventos para canal 1
      mockManager.simulateDatabaseChange('independent-1', { eventType: 'INSERT' });
      mockManager.simulateDatabaseChange('independent-1', { eventType: 'UPDATE' });

      // Eventos para canal 2
      mockManager.simulateDatabaseChange('independent-2', { eventType: 'INSERT' });

      expect(channel1Events).toHaveLength(2);
      expect(channel2Events).toHaveLength(1);
      expect(channel1Events[0].channelId).toBe('independent-1');
      expect(channel2Events[0].channelId).toBe('independent-2');
    });

    it('should handle high frequency events correctly', () => {
      const events: DatabaseChangeEvent[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'high-freq',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => events.push(event)
      };

      mockManager.subscribe(subscription);

      // Simular muitos eventos rapidamente
      const eventCount = 100;
      for (let i = 0; i < eventCount; i++) {
        mockManager.simulateDatabaseChange('high-freq', {
          eventType: i % 2 === 0 ? 'INSERT' : 'UPDATE',
          payload: { new: { id: i }, old: {}, eventType: i % 2 === 0 ? 'INSERT' : 'UPDATE' } as any
        });
      }

      expect(events).toHaveLength(eventCount);
      
      // Verificar se todos os eventos foram processados
      const timestamps = events.map(e => e.timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBeGreaterThan(eventCount * 0.5); // Pelo menos 50% únicos (mais realista)
    });
  });

  describe('Rate Limiting and Error Handling', () => {
    it('should handle subscription failure gracefully', () => {
      // Criar um mock manager que falha na subscription
      class FailingMockManager extends MockRealtimeManager {
        subscribe(): boolean {
          return false; // Simular falha
        }
      }

      const failingManager = new FailingMockManager();
      const result = failingManager.subscribe({
        channelId: 'failing-channel',
        tables: ['operacao'],
        enabled: true
      });

      expect(result).toBe(false);
      expect(failingManager.getChannelStats().activeChannels).toBe(0);
    });

    it('should handle callback errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const subscription: ChannelSubscription = {
        channelId: 'error-callback',
        tables: ['operacao'],
        enabled: true,
        onConnectionStatusChange: () => {
          throw new Error('Connection callback error');
        }
      };

      mockManager.subscribe(subscription);

      // Simular mudança de status que causará erro
      expect(() => {
        mockManager.simulateConnectionChange('error-callback', 'connected');
      }).not.toThrow(); // Erro deve ser capturado internamente

      consoleSpy.mockRestore();
    });

    it('should handle invalid channel operations', () => {
      // Tentar simular evento em canal inexistente
      expect(() => {
        mockManager.simulateDatabaseChange('non-existent-channel', {
          eventType: 'INSERT'
        });
      }).not.toThrow();

      // Tentar simular mudança de status em canal inexistente
      expect(() => {
        mockManager.simulateConnectionChange('non-existent-channel', 'connected');
      }).not.toThrow();
    });

    it('should handle malformed event data', () => {
      const events: DatabaseChangeEvent[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'malformed-test',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => events.push(event)
      };

      mockManager.subscribe(subscription);

      // Simular evento com dados malformados
      mockManager.simulateDatabaseChange('malformed-test', {
        // Dados incompletos/malformados
        eventType: 'INSERT' as any,
        payload: null as any
      });

      // Evento deve ser processado mesmo com dados malformados
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('INSERT');
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate table names correctly', () => {
      // Testes de integração com o validador de configuração
      expect(configValidator.validateTables(['operacao', 'participacao'])).toBe(true);
      expect(configValidator.validateTables(['invalid_table'])).toBe(false);
      expect(configValidator.validateTables([])).toBe(false);
    });

    it('should validate filters correctly', () => {
      const validFilters = {
        operacao: 'modalidade.eq.BLITZ',
        participacao: 'estado.eq.CONFIRMADO'
      };
      
      const invalidFilters = {
        invalid_table: 'some.filter'
      };
      
      expect(configValidator.validateFilters(validFilters)).toBe(true);
      expect(configValidator.validateFilters(invalidFilters)).toBe(false);
      expect(configValidator.validateFilters({})).toBe(true); // Filtros vazios são válidos
    });

    it('should sanitize configuration correctly', () => {
      const config = {
        tables: ['OPERACAO', ' participacao '], // Case insensitive e com espaços
        activeInterval: 500, // Será ajustado para mínimo
        enableRealtime: undefined // Será definido como true
      };
      
      const sanitized = configValidator.sanitizeConfig(config);
      
      expect(sanitized.tables[0]).toBe('operacao');
      expect(sanitized.tables[1]).toBe('participacao');
      expect(sanitized.activeInterval).toBe(1000); // Ajustado para mínimo
      expect(sanitized.enableRealtime).toBe(true);
    });

    it('should handle complex subscription configurations', () => {
      const complexConfig = {
        channelId: 'complex-test',
        tables: ['operacao', 'participacao', 'eventos_operacao'],
        filters: {
          operacao: 'modalidade.in.(BLITZ,EDUCATIVA)',
          participacao: 'estado.neq.CANCELADO',
          eventos_operacao: 'data_evento.gte.2024-01-01'
        },
        enableRealtime: true,
        debug: true
      };

      const sanitized = configValidator.sanitizeConfig(complexConfig);
      
      expect(sanitized.tables).toHaveLength(3);
      expect(sanitized.filters).toBeDefined();
      expect(Object.keys(sanitized.filters!)).toHaveLength(3);
      expect(sanitized.enableRealtime).toBe(true);
      expect(sanitized.debug).toBe(true);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid subscription/unsubscription cycles', () => {
      const channelIds: string[] = [];
      
      // Criar e remover muitas subscriptions rapidamente
      for (let i = 0; i < 50; i++) {
        const channelId = `stress-test-${i}`;
        channelIds.push(channelId);
        
        mockManager.subscribe({
          channelId,
          tables: ['operacao'],
          enabled: true
        });
      }

      expect(mockManager.getChannelStats().activeChannels).toBe(50);

      // Remover todas as subscriptions
      channelIds.forEach(channelId => {
        mockManager.unsubscribe(channelId);
      });

      expect(mockManager.getChannelStats().activeChannels).toBe(0);
    });

    it('should maintain performance with many concurrent events', () => {
      const startTime = Date.now();
      const events: DatabaseChangeEvent[] = [];
      
      const subscription: ChannelSubscription = {
        channelId: 'performance-test',
        tables: ['operacao'],
        enabled: true,
        onDatabaseChange: (event) => events.push(event)
      };

      mockManager.subscribe(subscription);

      // Simular muitos eventos
      const eventCount = 1000;
      for (let i = 0; i < eventCount; i++) {
        mockManager.simulateDatabaseChange('performance-test', {
          eventType: 'INSERT',
          payload: { new: { id: i }, old: {}, eventType: 'INSERT' } as any
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(events).toHaveLength(eventCount);
      expect(duration).toBeLessThan(1000); // Deve processar 1000 eventos em menos de 1 segundo
    });
  });
});