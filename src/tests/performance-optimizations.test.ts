import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { JSDOM } from 'jsdom';
import {
  EventBatcher,
  DebouncedStateUpdater,
  MemoizationCache,
  CleanupManager,
  useEventBatcher,
  useDebouncedStateUpdater,
  useMemoizationCache,
  useCleanupManager,
  throttle,
  debounce,
  createRAFScheduler
} from '../hooks/utils/performance-optimizations';

// Setup DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

Object.defineProperty(global, 'window', {
  value: dom.window,
  writable: true
});

Object.defineProperty(global, 'document', {
  value: dom.window.document,
  writable: true
});

Object.defineProperty(global, 'navigator', {
  value: dom.window.navigator,
  writable: true
});

Object.defineProperty(global, 'HTMLElement', {
  value: dom.window.HTMLElement,
  writable: true
});

// Mock timers
vi.useFakeTimers();

describe('Performance Optimizations', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  describe('EventBatcher', () => {
    it('should batch events within delay period', () => {
      const onBatch = vi.fn();
      const batcher = new EventBatcher(onBatch, 100, 5);

      batcher.addEvent('event1');
      batcher.addEvent('event2');
      batcher.addEvent('event3');

      expect(onBatch).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onBatch).toHaveBeenCalledWith(['event1', 'event2', 'event3']);
    });

    it('should flush immediately when max batch size is reached', () => {
      const onBatch = vi.fn();
      const batcher = new EventBatcher(onBatch, 100, 3);

      batcher.addEvent('event1');
      batcher.addEvent('event2');
      batcher.addEvent('event3');

      expect(onBatch).toHaveBeenCalledWith(['event1', 'event2', 'event3']);
    });

    it('should provide accurate stats', () => {
      const onBatch = vi.fn();
      const batcher = new EventBatcher(onBatch, 100, 5);

      batcher.addEvent('event1');
      batcher.addEvent('event2');

      const stats = batcher.getStats();
      expect(stats.pendingEvents).toBe(2);
      expect(stats.hasPendingBatch).toBe(true);
    });

    it('should clear pending events', () => {
      const onBatch = vi.fn();
      const batcher = new EventBatcher(onBatch, 100, 5);

      batcher.addEvent('event1');
      batcher.clear();

      const stats = batcher.getStats();
      expect(stats.pendingEvents).toBe(0);
      expect(stats.hasPendingBatch).toBe(false);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onBatch).not.toHaveBeenCalled();
    });
  });

  describe('DebouncedStateUpdater', () => {
    it('should debounce state updates', () => {
      const onUpdate = vi.fn();
      const updater = new DebouncedStateUpdater(onUpdate, 100);

      updater.update('value1');
      updater.update('value2');
      updater.update('value3');

      expect(onUpdate).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onUpdate).toHaveBeenCalledWith('value3');
      expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it('should flush immediately when requested', () => {
      const onUpdate = vi.fn();
      const updater = new DebouncedStateUpdater(onUpdate, 100);

      updater.update('value1');
      updater.flush();

      expect(onUpdate).toHaveBeenCalledWith('value1');
    });

    it('should cancel pending updates', () => {
      const onUpdate = vi.fn();
      const updater = new DebouncedStateUpdater(onUpdate, 100);

      updater.update('value1');
      updater.cancel();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('should track pending updates', () => {
      const onUpdate = vi.fn();
      const updater = new DebouncedStateUpdater(onUpdate, 100);

      expect(updater.hasPendingUpdate()).toBe(false);

      updater.update('value1');
      expect(updater.hasPendingUpdate()).toBe(true);

      updater.flush();
      expect(updater.hasPendingUpdate()).toBe(false);
    });
  });

  describe('MemoizationCache', () => {
    it('should cache and retrieve values', () => {
      const cache = new MemoizationCache<string, number>(10, 1000);

      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
      expect(cache.has('key1')).toBe(true);
    });

    it('should handle TTL expiration', () => {
      const cache = new MemoizationCache<string, number>(10, 100);

      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.has('key1')).toBe(false);
    });

    it('should evict LRU entries when max size is reached', () => {
      const cache = new MemoizationCache<string, number>(2, 1000);

      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300); // Should evict key1

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });

    it('should provide accurate stats', () => {
      const cache = new MemoizationCache<string, number>(10, 1000);

      cache.set('key1', 100);
      cache.set('key2', 200);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
    });

    it('should clear all entries', () => {
      const cache = new MemoizationCache<string, number>(10, 1000);

      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.clear();

      expect(cache.size()).toBe(0);
    });
  });

  describe('CleanupManager', () => {
    it('should manage timers and cleanup', () => {
      const manager = new CleanupManager();
      const cleanupFn = vi.fn();

      const timer = setTimeout(() => {}, 1000);
      const interval = setInterval(() => {}, 1000);

      manager.addTimer(timer);
      manager.addInterval(interval);
      manager.addCleanup(cleanupFn);

      const stats = manager.getStats();
      expect(stats.timers).toBe(1);
      expect(stats.intervals).toBe(1);
      expect(stats.cleanupFunctions).toBe(1);

      manager.cleanup();

      expect(cleanupFn).toHaveBeenCalled();

      const finalStats = manager.getStats();
      expect(finalStats.timers).toBe(0);
      expect(finalStats.intervals).toBe(0);
      expect(finalStats.cleanupFunctions).toBe(0);
    });

    it('should manage event listeners', () => {
      const manager = new CleanupManager();
      const mockTarget = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as unknown as EventTarget;

      const listener = vi.fn();

      manager.addEventListener(mockTarget, 'click', listener);

      expect(mockTarget.addEventListener).toHaveBeenCalledWith('click', listener, undefined);

      manager.cleanup();

      expect(mockTarget.removeEventListener).toHaveBeenCalledWith('click', listener);
    });
  });

  describe('useEventBatcher hook', () => {
    it('should create and manage event batcher', () => {
      const onBatch = vi.fn();
      const { result } = renderHook(() => useEventBatcher(onBatch, 100, 5));

      act(() => {
        result.current.addEvent('event1');
        result.current.addEvent('event2');
      });

      const stats = result.current.getStats();
      expect(stats.pendingEvents).toBe(2);

      act(() => {
        result.current.flush();
      });

      expect(onBatch).toHaveBeenCalledWith(['event1', 'event2']);
    });
  });

  describe('useDebouncedStateUpdater hook', () => {
    it('should create and manage debounced updater', () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() => useDebouncedStateUpdater(onUpdate, 100));

      act(() => {
        result.current.update('value1');
        result.current.update('value2');
      });

      expect(result.current.hasPendingUpdate()).toBe(true);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(onUpdate).toHaveBeenCalledWith('value2');
    });
  });

  describe('useMemoizationCache hook', () => {
    it('should create and manage memoization cache', () => {
      const { result } = renderHook(() => useMemoizationCache<string, number>());

      act(() => {
        result.current.set('key1', 100);
      });

      expect(result.current.get('key1')).toBe(100);
      expect(result.current.has('key1')).toBe(true);

      const computed = result.current.compute('key2', () => 200);
      expect(computed).toBe(200);
      expect(result.current.get('key2')).toBe(200);
    });
  });

  describe('useCleanupManager hook', () => {
    it('should create and manage cleanup', () => {
      const { result } = renderHook(() => useCleanupManager());
      const cleanupFn = vi.fn();

      act(() => {
        result.current.addCleanup(cleanupFn);
      });

      const stats = result.current.getStats();
      expect(stats.cleanupFunctions).toBe(1);

      act(() => {
        result.current.cleanup();
      });

      expect(cleanupFn).toHaveBeenCalled();
    });
  });

  describe('throttle utility', () => {
    it('should throttle function calls', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('arg3');
    });

    it('should cancel throttled calls', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn.cancel();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('debounce utility', () => {
    it('should debounce function calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(fn).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3');
    });

    it('should flush debounced calls immediately', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1');
      debouncedFn.flush();

      expect(fn).toHaveBeenCalledWith('arg1');
    });

    it('should cancel debounced calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1');
      debouncedFn.cancel();

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('createRAFScheduler', () => {
    beforeEach(() => {
      // Mock requestAnimationFrame and cancelAnimationFrame
      global.requestAnimationFrame = vi.fn((cb) => {
        return setTimeout(cb, 16) as unknown as number;
      });
      global.cancelAnimationFrame = vi.fn((id) => {
        clearTimeout(id as unknown as NodeJS.Timeout);
      });
    });

    it('should schedule callbacks with RAF', () => {
      const scheduler = createRAFScheduler();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      scheduler.schedule(callback1);
      scheduler.schedule(callback2);

      expect(scheduler.hasPendingCallbacks()).toBe(true);

      act(() => {
        vi.advanceTimersByTime(16);
      });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(scheduler.hasPendingCallbacks()).toBe(false);
    });

    it('should cancel scheduled callbacks', () => {
      const scheduler = createRAFScheduler();
      const callback = vi.fn();

      scheduler.schedule(callback);
      scheduler.cancel();

      act(() => {
        vi.advanceTimersByTime(16);
      });

      expect(callback).not.toHaveBeenCalled();
      expect(scheduler.hasPendingCallbacks()).toBe(false);
    });
  });
});