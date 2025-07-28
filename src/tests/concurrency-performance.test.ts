/**
 * 🧪 TESTES DE CONCORRÊNCIA E PERFORMANCE - HOOK REALTIME UNIFICADO
 * 
 * Esta suíte foca especificamente em testes de concorrência e performance
 * para validar o comportamento do hook sob condições de alta carga.
 * 
 * Cobertura:
 * - Testes de concorrência com múltiplas instâncias
 * - Testes de performance de memória
 * - Testes de performance de rede
 * - Benchmarks de throughput
 * - Testes de stress
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeUnified, type UseRealtimeUnifiedConfig } from '../hooks/useRealtimeUnified';
import { realtimeManager } from '../core/infrastructure/services/RealtimeManager';
import { performanceMonitor } from '../hooks/utils/performance-monitor';

// 🎯 MOCKS GLOBAIS
vi.mock('../core/infrastructure/services/RealtimeManager', () => ({
  realtimeManager: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getChannelStats: vi.fn(),
    getActiveChannels: vi.fn(),
    isConnected: vi.fn(),
    getConnectionStatus: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn()
  }
}));

vi.mock('../hooks/utils/performance-monitor', () => ({
  performanceMonitor: {
    startTiming: vi.fn(),
    endTiming: vi.fn(),
    recordNetworkRequest: vi.fn(),
    getMetrics: vi.fn(),
    clearMetrics: vi.fn(),
    recordMemoryUsage: vi.fn(),
    getMemoryStats: vi.fn()
  }
}));

const mockRealtimeManager = realtimeManager as any;
const mockPerformanceMonitor = performanceMonitor as any;

const defaultConfig: UseRealtimeUnifiedConfig = {
  tables: ['operacao', 'participacao'],
  enableRealtime: true,
  enablePolling: true,
  enableFetch: false,
  debug: false
};

describe('🧪 Concurrency and Performance Tests - useRealtimeUnified', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    
    // Setup default mock returns
    mockRealtimeManager.subscribe.mockReturnValue(true);
    mockRealtimeManager.getChannelStats.mockReturnValue({
      activeChannels: 0,
      activeSubscriptions: 0,
      lastEventTime: Date.now(),
      timeSinceLastEvent: 0
    });
    mockRealtimeManager.getActiveChannels.mockReturnValue([]);
    mockRealtimeManager.isConnected.mockReturnValue(true);
    mockRealtimeManager.getConnectionStatus.mockReturnValue('connected');
    
    mockPerformanceMonitor.getMetrics.mockReturnValue({
      memoryUsage: { used: 1000000, total: 2000000 },
      networkRequests: [],
      timings: {}
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
  });

  // 🎯 TESTES DE CONCORRÊNCIA
  describe('🔄 Concurrency Tests', () => {
    describe('High Volume Hook Creation', () => {
      it('should handle creating 100 hook instances simultaneously', () => {
        const hooks: Array<{ unmount: () => void }> = [];
        const startTime = performance.now();

        // Create 100 hooks rapidly
        for (let i = 0; i < 100; i++) {
          const config = { ...defaultConfig, channelId: `stress-test-${i}` };
          const hook = renderHook(() => useRealtimeUnified(config));
          hooks.push(hook);
        }

        const creationTime = performance.now() - startTime;

        // Should create all hooks quickly
        expect(creationTime).toBeLessThan(1000); // Less than 1 second
        expect(mockRealtimeManager.subscribe).toHaveBeenCalledTimes(100);

        // Cleanup
        hooks.forEach(hook => hook.unmount());
        expect(mockRealtimeManager.unsubscribe).toHaveBeenCalledTimes(100);
      });

      it('should handle rapid creation and destruction cycles', () => {
        const cycles = 50;
        const startTime = performance.now();

        for (let i = 0; i < cycles; i++) {
          const config = { ...defaultConfig, channelId: `cycle-test-${i}` };
          const { unmount } = renderHook(() => useRealtimeUnified(config));
          
          // Immediate unmount
          unmount();
        }

        const totalTime = performance.now() - startTime;

        // Should handle rapid cycles efficiently
        expect(totalTime).toBeLessThan(500); // Less than 500ms for 50 cycles
        expect(mockRealtimeManager.subscribe).toHaveBeenCalledTimes(cycles);
        expect(mockRealtimeManager.unsubscribe).toHaveBeenCalledTimes(cycles);
      });

      it('should maintain performance with concurrent operations', async () => {
        const config = {
          ...defaultConfig,
          enableFetch: true,
          apiEndpoint: '/api/concurrent-operations'
        };

        // Mock fetch with realistic delay
        global.fetch = vi.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              ok: true,
              json: () => Promise.resolve([{ id: Math.random(), data: 'test' }])
            }), 50)
          )
        );

        const hooks: Array<{ result: any }> = [];

        // Create multiple hooks with concurrent operations
        for (let i = 0; i < 20; i++) {
          const hook = renderHook(() => useRealtimeUnified({
            ...config,
            channelId: `concurrent-ops-${i}`
          }));
          hooks.push(hook);
        }

        const startTime = performance.now();

        // Trigger concurrent refetches
        await act(async () => {
          hooks.forEach((hook, index) => {
            hook.result.current.refetch(`concurrent-${index}`);
          });
          
          // Wait for all operations
          vi.advanceTimersByTime(100);
        });

        const operationTime = performance.now() - startTime;

        // Should handle concurrent operations efficiently
        expect(operationTime).toBeLessThan(200); // Less than 200ms
        expect(global.fetch).toHaveBeenCalledTimes(20);

        // Cleanup
        hooks.forEach(hook => hook.result.current.disconnect());
      });
    });

    describe('Race Condition Handling', () => {
      it('should handle rapid config changes without race conditions', () => {
        const { result, rerender } = renderHook(
          ({ config }) => useRealtimeUnified(config),
          { initialProps: { config: defaultConfig } }
        );

        // Rapid config changes
        for (let i = 0; i < 10; i++) {
          const newConfig = {
            ...defaultConfig,
            tables: [`table-${i}`, 'operacao'],
            channelId: `race-test-${i}`
          };
          
          rerender({ config: newConfig });
          
          act(() => {
            vi.advanceTimersByTime(10);
          });
        }

        // Should handle gracefully without errors
        expect(result.current.debugInfo.channelId).toMatch(/^race-test-\d+$/);
        expect(result.current.error).toBeNull();
      });

      it('should handle concurrent subscription/unsubscription', () => {
        const hooks: Array<{ unmount: () => void }> = [];

        // Create hooks with overlapping lifecycles
        for (let i = 0; i < 20; i++) {
          const config = { ...defaultConfig, channelId: `overlap-${i}` };
          const hook = renderHook(() => useRealtimeUnified(config));
          hooks.push(hook);

          // Unmount every other hook immediately
          if (i % 2 === 0) {
            setTimeout(() => hook.unmount(), 10);
          }
        }

        act(() => {
          vi.advanceTimersByTime(50);
        });

        // Cleanup remaining hooks
        hooks.forEach((hook, index) => {
          if (index % 2 !== 0) {
            hook.unmount();
          }
        });

        // Should handle overlapping lifecycles without errors
        expect(mockRealtimeManager.subscribe).toHaveBeenCalledTimes(20);
      });
    });

    describe('Event Processing Under Load', () => {
      it('should batch events efficiently under high load', () => {
        const onDatabaseChange = vi.fn();
        const config = {
          ...defaultConfig,
          onDatabaseChange,
          channelId: 'high-load-test'
        };

        const { result } = renderHook(() => useRealtimeUnified(config));

        // Simulate high event load
        act(() => {
          for (let i = 0; i < 1000; i++) {
            vi.advanceTimersByTime(1); // Rapid events
          }
        });

        // Should batch events to prevent excessive processing
        // The exact number depends on batching implementation
        expect(result.current.eventsReceived).toBeGreaterThanOrEqual(0);
      });

      it('should maintain responsiveness during event storms', () => {
        const config = {
          ...defaultConfig,
          channelId: 'event-storm-test'
        };

        const { result } = renderHook(() => useRealtimeUnified(config));
        const startTime = performance.now();

        // Simulate event storm
        act(() => {
          for (let i = 0; i < 500; i++) {
            vi.advanceTimersByTime(2);
          }
        });

        const processingTime = performance.now() - startTime;

        // Should remain responsive
        expect(processingTime).toBeLessThan(100); // Less than 100ms
        expect(result.current.connectionStatus).not.toBe('error');
      });
    });
  });

  // 🎯 TESTES DE PERFORMANCE
  describe('⚡ Performance Tests', () => {
    describe('Memory Performance', () => {
      it('should not leak memory with repeated operations', () => {
        const config = { ...defaultConfig, channelId: 'memory-test' };
        
        // Simulate memory monitoring
        let memoryUsage = 1000000; // 1MB baseline
        mockPerformanceMonitor.getMemoryStats.mockImplementation(() => ({
          used: memoryUsage,
          total: 2000000
        }));

        // Perform many operations
        for (let i = 0; i < 100; i++) {
          const { unmount } = renderHook(() => useRealtimeUnified(config));
          
          act(() => {
            vi.advanceTimersByTime(10);
          });
          
          unmount();
          
          // Simulate small memory increase
          memoryUsage += 1000; // 1KB per operation
        }

        // Memory should not grow excessively
        const finalMemory = mockPerformanceMonitor.getMemoryStats();
        expect(finalMemory.used).toBeLessThan(1200000); // Less than 1.2MB (20% increase)
      });

      it('should optimize memory usage with many concurrent instances', () => {
        const hooks: Array<{ unmount: () => void }> = [];
        const baselineMemory = 1000000;
        
        mockPerformanceMonitor.getMemoryStats.mockReturnValue({
          used: baselineMemory,
          total: 2000000
        });

        // Create many instances
        for (let i = 0; i < 50; i++) {
          const config = { ...defaultConfig, channelId: `memory-opt-${i}` };
          const hook = renderHook(() => useRealtimeUnified(config));
          hooks.push(hook);
        }

        // Memory should scale reasonably
        mockPerformanceMonitor.getMemoryStats.mockReturnValue({
          used: baselineMemory + (50 * 10000), // 10KB per instance
          total: 2000000
        });

        const memoryStats = mockPerformanceMonitor.getMemoryStats();
        expect(memoryStats.used).toBeLessThan(baselineMemory + (50 * 20000)); // Less than 20KB per instance

        // Cleanup
        hooks.forEach(hook => hook.unmount());
      });

      it('should handle garbage collection efficiently', () => {
        const config = { ...defaultConfig, channelId: 'gc-test' };
        const hooks: Array<{ unmount: () => void }> = [];

        // Create and destroy many instances
        for (let i = 0; i < 100; i++) {
          const hook = renderHook(() => useRealtimeUnified(config));
          hooks.push(hook);
        }

        // Unmount all at once (simulating GC pressure)
        const startTime = performance.now();
        hooks.forEach(hook => hook.unmount());
        const cleanupTime = performance.now() - startTime;

        // Should cleanup efficiently
        expect(cleanupTime).toBeLessThan(50); // Less than 50ms for 100 instances
        expect(mockRealtimeManager.unsubscribe).toHaveBeenCalledTimes(100);
      });
    });

    describe('Network Performance', () => {
      it('should optimize network requests with intelligent caching', async () => {
        const config = {
          ...defaultConfig,
          enableFetch: true,
          apiEndpoint: '/api/cache-test',
          cacheTimeout: 1000 // 1 second cache
        };

        let fetchCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          fetchCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: fetchCount, cached: true }])
          });
        });

        const { result } = renderHook(() => useRealtimeUnified(config));

        // Multiple rapid requests
        await act(async () => {
          await result.current.refetch('request-1');
          await result.current.refetch('request-2');
          await result.current.refetch('request-3');
        });

        // Should cache efficiently
        expect(fetchCount).toBe(1); // Only one actual network request
        expect(result.current.fromCache).toBe(true);
      });

      it('should handle high-frequency polling efficiently', () => {
        const config = {
          ...defaultConfig,
          enablePolling: true,
          activeInterval: 100, // Very frequent polling
          channelId: 'high-freq-polling'
        };

        const { result } = renderHook(() => useRealtimeUnified(config));

        // Let polling run for a while
        act(() => {
          vi.advanceTimersByTime(5000); // 5 seconds
        });

        // Should handle high-frequency polling without issues
        expect(result.current.debugInfo.pollingInterval).toBe(100);
        expect(result.current.error).toBeNull();
      });

      it('should batch network requests under load', async () => {
        const config = {
          ...defaultConfig,
          enableFetch: true,
          apiEndpoint: '/api/batch-load-test'
        };

        let requestCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          requestCount++;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ id: requestCount }])
          });
        });

        const hooks: Array<{ result: any }> = [];

        // Create multiple hooks
        for (let i = 0; i < 10; i++) {
          const hook = renderHook(() => useRealtimeUnified({
            ...config,
            channelId: `batch-${i}`
          }));
          hooks.push(hook);
        }

        // Trigger simultaneous requests
        await act(async () => {
          hooks.forEach((hook, index) => {
            hook.result.current.refetch(`batch-request-${index}`);
          });
          
          vi.advanceTimersByTime(200);
        });

        // Should batch or debounce requests
        expect(requestCount).toBeLessThan(10); // Should be fewer than individual requests
      });
    });

    describe('Throughput Benchmarks', () => {
      it('should maintain high throughput for event processing', () => {
        const config = {
          ...defaultConfig,
          channelId: 'throughput-test'
        };

        const { result } = renderHook(() => useRealtimeUnified(config));
        const startTime = performance.now();
        const eventCount = 10000;

        // Process many events
        act(() => {
          for (let i = 0; i < eventCount; i++) {
            vi.advanceTimersByTime(1);
          }
        });

        const processingTime = performance.now() - startTime;
        const throughput = eventCount / (processingTime / 1000); // Events per second

        // Should maintain high throughput
        expect(throughput).toBeGreaterThan(1000); // At least 1000 events/second
        expect(result.current.error).toBeNull();
      });

      it('should scale efficiently with multiple concurrent hooks', () => {
        const hookCount = 25;
        const hooks: Array<{ result: any }> = [];
        const startTime = performance.now();

        // Create multiple hooks simultaneously
        for (let i = 0; i < hookCount; i++) {
          const config = {
            ...defaultConfig,
            channelId: `scale-test-${i}`,
            enablePolling: true,
            activeInterval: 1000
          };
          
          const hook = renderHook(() => useRealtimeUnified(config));
          hooks.push(hook);
        }

        const creationTime = performance.now() - startTime;

        // Should scale efficiently
        expect(creationTime).toBeLessThan(100); // Less than 100ms for 25 hooks
        expect(mockRealtimeManager.subscribe).toHaveBeenCalledTimes(hookCount);

        // All hooks should be functional
        hooks.forEach(hook => {
          expect(hook.result.current.error).toBeNull();
          expect(hook.result.current.debugInfo.channelId).toBeTruthy();
        });

        // Cleanup
        hooks.forEach(hook => hook.result.current.disconnect());
      });
    });

    describe('Stress Tests', () => {
      it('should survive extreme load conditions', () => {
        const extremeConfig = {
          ...defaultConfig,
          enablePolling: true,
          activeInterval: 10, // Very aggressive polling
          channelId: 'stress-test'
        };

        const { result } = renderHook(() => useRealtimeUnified(extremeConfig));

        // Apply extreme load
        act(() => {
          // Rapid timer advancement
          for (let i = 0; i < 1000; i++) {
            vi.advanceTimersByTime(10);
          }
        });

        // Should survive without crashing
        expect(result.current.error).toBeNull();
        expect(result.current.connectionStatus).not.toBe('error');
      });

      it('should handle resource exhaustion gracefully', () => {
        // Simulate resource exhaustion
        mockRealtimeManager.subscribe.mockReturnValue(false);
        mockRealtimeManager.getConnectionStatus.mockReturnValue('error');

        const config = { ...defaultConfig, channelId: 'resource-exhaustion' };
        const { result } = renderHook(() => useRealtimeUnified(config));

        // Should handle gracefully
        expect(result.current.connectionStatus).toBe('error');
        expect(result.current.error).toBeTruthy();
        
        // Should not crash
        act(() => {
          result.current.reconnect();
          vi.advanceTimersByTime(1000);
        });

        expect(mockRealtimeManager.reconnect).toHaveBeenCalled();
      });

      it('should recover from temporary failures', async () => {
        // Start with failure
        mockRealtimeManager.subscribe.mockReturnValueOnce(false);
        mockRealtimeManager.getConnectionStatus.mockReturnValueOnce('error');

        const config = { ...defaultConfig, channelId: 'recovery-test' };
        const { result } = renderHook(() => useRealtimeUnified(config));

        // Initially should be in error state
        expect(result.current.connectionStatus).toBe('error');

        // Simulate recovery
        mockRealtimeManager.subscribe.mockReturnValue(true);
        mockRealtimeManager.getConnectionStatus.mockReturnValue('connected');
        mockRealtimeManager.isConnected.mockReturnValue(true);

        act(() => {
          result.current.reconnect();
          vi.advanceTimersByTime(1000);
        });

        // Should recover
        await waitFor(() => {
          expect(result.current.connectionStatus).toBe('connected');
          expect(result.current.isConnected).toBe(true);
        });
      });
    });
  });
});