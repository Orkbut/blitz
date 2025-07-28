import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  EventBatcher,
  DebouncedStateUpdater,
  MemoizationCache,
  CleanupManager
} from '../hooks/utils/performance-optimizations';

// Mock timers
vi.useFakeTimers();

describe('Performance Optimizations Integration', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it('should integrate event batching with database changes', () => {
    const onBatch = vi.fn();
    const batcher = new EventBatcher(onBatch, 50, 3);

    // Simulate rapid database events
    batcher.addEvent({ table: 'users', type: 'INSERT', id: 1 });
    batcher.addEvent({ table: 'users', type: 'UPDATE', id: 2 });
    batcher.addEvent({ table: 'posts', type: 'INSERT', id: 3 });

    expect(onBatch).toHaveBeenCalledWith([
      { table: 'users', type: 'INSERT', id: 1 },
      { table: 'users', type: 'UPDATE', id: 2 },
      { table: 'posts', type: 'INSERT', id: 3 }
    ]);
  });

  it('should debounce connection status updates', () => {
    const onUpdate = vi.fn();
    const updater = new DebouncedStateUpdater(onUpdate, 100);

    // Simulate rapid connection status changes
    updater.update({ status: 'connecting' });
    updater.update({ status: 'connected' });
    updater.update({ status: 'disconnected' });
    updater.update({ status: 'connected' });

    expect(onUpdate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(onUpdate).toHaveBeenCalledWith({ status: 'connected' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('should cache expensive computations', () => {
    const cache = new MemoizationCache<string, any>(10, 60000);
    const expensiveComputation = vi.fn((key: string) => ({ result: `computed-${key}` }));

    // First call - should compute and cache
    let result1 = cache.get('key1');
    if (!result1) {
      result1 = expensiveComputation('key1');
      cache.set('key1', result1);
    }
    expect(expensiveComputation).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({ result: 'computed-key1' });

    // Second call - should use cache
    let result2 = cache.get('key1');
    if (!result2) {
      result2 = expensiveComputation('key1');
      cache.set('key1', result2);
    }
    expect(expensiveComputation).toHaveBeenCalledTimes(1); // Still 1, not called again
    expect(result2).toEqual({ result: 'computed-key1' });
  });

  it('should manage cleanup resources properly', () => {
    const manager = new CleanupManager();
    const cleanupFn = vi.fn();
    const timer = setTimeout(() => {}, 1000);
    const interval = setInterval(() => {}, 1000);

    manager.addCleanup(cleanupFn);
    manager.addTimer(timer);
    manager.addInterval(interval);

    const stats = manager.getStats();
    expect(stats.cleanupFunctions).toBe(1);
    expect(stats.timers).toBe(1);
    expect(stats.intervals).toBe(1);

    manager.cleanup();

    expect(cleanupFn).toHaveBeenCalled();
    
    const finalStats = manager.getStats();
    expect(finalStats.cleanupFunctions).toBe(0);
    expect(finalStats.timers).toBe(0);
    expect(finalStats.intervals).toBe(0);
  });

  it('should handle performance optimization lifecycle', () => {
    const onBatch = vi.fn();
    const onUpdate = vi.fn();
    
    const batcher = new EventBatcher(onBatch, 100, 5);
    const updater = new DebouncedStateUpdater(onUpdate, 100);
    const cache = new MemoizationCache(10, 60000);
    const manager = new CleanupManager();

    // Add some data
    batcher.addEvent('event1');
    updater.update('value1');
    cache.set('key1', 'value1');
    manager.addCleanup(() => {});

    // Verify they're working
    expect(batcher.getStats().pendingEvents).toBe(1);
    expect(updater.hasPendingUpdate()).toBe(true);
    expect(cache.has('key1')).toBe(true);
    expect(manager.getStats().cleanupFunctions).toBe(1);

    // Cleanup
    batcher.clear();
    updater.cancel();
    cache.clear();
    manager.cleanup();

    // Verify cleanup
    expect(batcher.getStats().pendingEvents).toBe(0);
    expect(updater.hasPendingUpdate()).toBe(false);
    expect(cache.size()).toBe(0);
    expect(manager.getStats().cleanupFunctions).toBe(0);
  });
});