'use client';

import { useCallback, useRef, useMemo } from 'react';

// 🎯 EVENT BATCHING UTILITY
export class EventBatcher<T> {
  private events: T[] = [];
  private batchTimeout: number | null = null;
  private readonly batchDelay: number;
  private readonly maxBatchSize: number;
  private readonly onBatch: (events: T[]) => void;

  constructor(
    onBatch: (events: T[]) => void,
    batchDelay: number = 16, // ~60fps
    maxBatchSize: number = 10
  ) {
    this.onBatch = onBatch;
    this.batchDelay = batchDelay;
    this.maxBatchSize = maxBatchSize;
  }

  addEvent(event: T): void {
    this.events.push(event);

    // If we've reached max batch size, flush immediately
    if (this.events.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Otherwise, schedule a flush if not already scheduled
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flush();
      }, this.batchDelay) as unknown as number;
    }
  }

  flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.events.length > 0) {
      const eventsToProcess = [...this.events];
      this.events = [];
      this.onBatch(eventsToProcess);
    }
  }

  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.events = [];
  }

  getStats(): { pendingEvents: number; hasPendingBatch: boolean } {
    return {
      pendingEvents: this.events.length,
      hasPendingBatch: this.batchTimeout !== null
    };
  }
}

// 🎯 DEBOUNCED STATE UPDATER
export class DebouncedStateUpdater<T> {
  private pendingUpdate: T | null = null;
  private debounceTimeout: number | null = null;
  private readonly debounceDelay: number;
  private readonly onUpdate: (value: T) => void;

  constructor(onUpdate: (value: T) => void, debounceDelay: number = 100) {
    this.onUpdate = onUpdate;
    this.debounceDelay = debounceDelay;
  }

  update(value: T): void {
    this.pendingUpdate = value;

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      if (this.pendingUpdate !== null) {
        this.onUpdate(this.pendingUpdate);
        this.pendingUpdate = null;
      }
      this.debounceTimeout = null;
    }, this.debounceDelay) as unknown as number;
  }

  flush(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    if (this.pendingUpdate !== null) {
      this.onUpdate(this.pendingUpdate);
      this.pendingUpdate = null;
    }
  }

  cancel(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    this.pendingUpdate = null;
  }

  hasPendingUpdate(): boolean {
    return this.pendingUpdate !== null;
  }
}

// 🎯 MEMOIZATION CACHE
export class MemoizationCache<K, V> {
  private cache = new Map<string, { value: V; timestamp: number; accessCount: number }>();
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  private getKey(key: K): string {
    if (typeof key === 'string') return key;
    if (typeof key === 'number') return key.toString();
    return JSON.stringify(key);
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.ttl;
  }

  private evictExpired(): void {
    const now = Date.now();
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    });
  }

  private evictLRU(): void {
    if (this.cache.size < this.maxSize) return;

    // Find the least recently used entry (lowest accessCount)
    let lruKey: string | null = null;
    let minAccessCount = Infinity;

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        lruKey = key;
      }
    });

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  get(key: K): V | undefined {
    const keyStr = this.getKey(key);
    const entry = this.cache.get(keyStr);

    if (!entry) return undefined;

    if (this.isExpired(entry.timestamp)) {
      this.cache.delete(keyStr);
      return undefined;
    }

    // Update access count for LRU
    entry.accessCount++;
    return entry.value;
  }

  set(key: K, value: V): void {
    const keyStr = this.getKey(key);

    // Clean up expired entries periodically
    if (this.cache.size > this.maxSize * 0.8) {
      this.evictExpired();
    }

    // Evict LRU if needed
    this.evictLRU();

    this.cache.set(keyStr, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  has(key: K): boolean {
    const keyStr = this.getKey(key);
    const entry = this.cache.get(keyStr);
    return entry !== undefined && !this.isExpired(entry.timestamp);
  }

  delete(key: K): boolean {
    const keyStr = this.getKey(key);
    return this.cache.delete(keyStr);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    this.evictExpired();
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    this.evictExpired();
    const totalAccess = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.accessCount, 0);
    const hitRate = totalAccess > 0 ? this.cache.size / totalAccess : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate
    };
  }
}

// 🎯 CLEANUP MANAGER
export class CleanupManager {
  private cleanupFunctions: (() => void)[] = [];
  private timers: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private listeners: Map<EventTarget, { event: string; listener: EventListener }[]> = new Map();

  addCleanup(cleanup: () => void): void {
    this.cleanupFunctions.push(cleanup);
  }

  addTimer(timer: number): void {
    this.timers.add(timer);
  }

  addInterval(interval: number): void {
    this.intervals.add(interval);
  }

  addEventListener(target: EventTarget, event: string, listener: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(event, listener, options);
    
    if (!this.listeners.has(target)) {
      this.listeners.set(target, []);
    }
    this.listeners.get(target)!.push({ event, listener });
  }

  removeTimer(timer: number): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  removeInterval(interval: number): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  cleanup(): void {
    // Clear all timers
    Array.from(this.timers).forEach(timer => {
      clearTimeout(timer);
    });
    this.timers.clear();

    // Clear all intervals
    Array.from(this.intervals).forEach(interval => {
      clearInterval(interval);
    });
    this.intervals.clear();

    // Remove all event listeners
    Array.from(this.listeners.entries()).forEach(([target, listeners]) => {
      listeners.forEach(({ event, listener }) => {
        target.removeEventListener(event, listener);
      });
    });
    this.listeners.clear();

    // Execute custom cleanup functions
    for (const cleanup of this.cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    }
    this.cleanupFunctions = [];
  }

  getStats(): { timers: number; intervals: number; listeners: number; cleanupFunctions: number } {
    const totalListeners = Array.from(this.listeners.values()).reduce((sum, listeners) => sum + listeners.length, 0);
    
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      listeners: totalListeners,
      cleanupFunctions: this.cleanupFunctions.length
    };
  }
}

// 🎯 PERFORMANCE HOOKS

/**
 * Hook para criar um event batcher otimizado
 */
export function useEventBatcher<T>(
  onBatch: (events: T[]) => void,
  batchDelay: number = 16,
  maxBatchSize: number = 10
) {
  const batcherRef = useRef<EventBatcher<T> | null>(null);

  if (!batcherRef.current) {
    batcherRef.current = new EventBatcher(onBatch, batchDelay, maxBatchSize);
  }

  const addEvent = useCallback((event: T) => {
    batcherRef.current?.addEvent(event);
  }, []);

  const flush = useCallback(() => {
    batcherRef.current?.flush();
  }, []);

  const clear = useCallback(() => {
    batcherRef.current?.clear();
  }, []);

  const getStats = useCallback(() => {
    return batcherRef.current?.getStats() || { pendingEvents: 0, hasPendingBatch: false };
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (batcherRef.current) {
      batcherRef.current.clear();
      batcherRef.current = null;
    }
  }, []);

  return {
    addEvent,
    flush,
    clear,
    getStats,
    cleanup
  };
}

/**
 * Hook para criar um debounced state updater
 */
export function useDebouncedStateUpdater<T>(
  onUpdate: (value: T) => void,
  debounceDelay: number = 100
) {
  const updaterRef = useRef<DebouncedStateUpdater<T> | null>(null);

  if (!updaterRef.current) {
    updaterRef.current = new DebouncedStateUpdater(onUpdate, debounceDelay);
  }

  const update = useCallback((value: T) => {
    updaterRef.current?.update(value);
  }, []);

  const flush = useCallback(() => {
    updaterRef.current?.flush();
  }, []);

  const cancel = useCallback(() => {
    updaterRef.current?.cancel();
  }, []);

  const hasPendingUpdate = useCallback(() => {
    return updaterRef.current?.hasPendingUpdate() || false;
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (updaterRef.current) {
      updaterRef.current.cancel();
      updaterRef.current = null;
    }
  }, []);

  return {
    update,
    flush,
    cancel,
    hasPendingUpdate,
    cleanup
  };
}

/**
 * Hook para memoização com cache inteligente
 */
export function useMemoizationCache<K, V>(
  maxSize: number = 100,
  ttl: number = 300000
) {
  const cacheRef = useRef<MemoizationCache<K, V> | null>(null);

  if (!cacheRef.current) {
    cacheRef.current = new MemoizationCache(maxSize, ttl);
  }

  const get = useCallback((key: K): V | undefined => {
    return cacheRef.current?.get(key);
  }, []);

  const set = useCallback((key: K, value: V) => {
    cacheRef.current?.set(key, value);
  }, []);

  const has = useCallback((key: K): boolean => {
    return cacheRef.current?.has(key) || false;
  }, []);

  const deleteKey = useCallback((key: K): boolean => {
    return cacheRef.current?.delete(key) || false;
  }, []);

  const clear = useCallback(() => {
    cacheRef.current?.clear();
  }, []);

  const size = useCallback(() => {
    return cacheRef.current?.size() || 0;
  }, []);

  const getStats = useCallback(() => {
    return cacheRef.current?.getStats() || { size: 0, maxSize, hitRate: 0 };
  }, [maxSize]);

  // Memoized compute function
  const compute = useCallback((key: K, computeFn: () => V): V => {
    const cached = get(key);
    if (cached !== undefined) {
      return cached;
    }

    const computed = computeFn();
    set(key, computed);
    return computed;
  }, [get, set]);

  return {
    get,
    set,
    has,
    delete: deleteKey,
    clear,
    size,
    getStats,
    compute
  };
}

/**
 * Hook para gerenciamento de cleanup
 */
export function useCleanupManager() {
  const managerRef = useRef<CleanupManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new CleanupManager();
  }

  const addCleanup = useCallback((cleanup: () => void) => {
    managerRef.current?.addCleanup(cleanup);
  }, []);

  const addTimer = useCallback((timer: number) => {
    managerRef.current?.addTimer(timer);
  }, []);

  const addInterval = useCallback((interval: number) => {
    managerRef.current?.addInterval(interval);
  }, []);

  const addEventListener = useCallback((
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ) => {
    managerRef.current?.addEventListener(target, event, listener, options);
  }, []);

  const removeTimer = useCallback((timer: number) => {
    managerRef.current?.removeTimer(timer);
  }, []);

  const removeInterval = useCallback((interval: number) => {
    managerRef.current?.removeInterval(interval);
  }, []);

  const getStats = useCallback(() => {
    return managerRef.current?.getStats() || { timers: 0, intervals: 0, listeners: 0, cleanupFunctions: 0 };
  }, []);

  // Auto cleanup on unmount
  const cleanup = useCallback(() => {
    managerRef.current?.cleanup();
  }, []);

  return {
    addCleanup,
    addTimer,
    addInterval,
    addEventListener,
    removeTimer,
    removeInterval,
    getStats,
    cleanup
  };
}

// 🎯 PERFORMANCE UTILITIES

/**
 * Utilitário para throttling de funções
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: number | null = null;
  let lastExecTime = 0;
  let lastArgs: Parameters<T> | null = null;

  const throttledFunc = ((...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    if (now - lastExecTime >= delay) {
      lastExecTime = now;
      return func(...args);
    }

    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        timeoutId = null;
        if (lastArgs) {
          func(...lastArgs);
        }
      }, delay - (now - lastExecTime)) as unknown as number;
    }
  }) as T & { cancel: () => void };

  throttledFunc.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  return throttledFunc;
}

/**
 * Utilitário para debouncing de funções
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debouncedFunc = ((...args: Parameters<T>) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs) {
        func(...lastArgs);
        lastArgs = null;
      }
    }, delay) as unknown as number;
  }) as T & { cancel: () => void; flush: () => void };

  debouncedFunc.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debouncedFunc.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs) {
      func(...lastArgs);
      lastArgs = null;
    }
  };

  return debouncedFunc;
}

/**
 * Utilitário para criar um RAF (RequestAnimationFrame) scheduler
 */
export function createRAFScheduler() {
  let rafId: number | null = null;
  let callbacks: (() => void)[] = [];

  const schedule = (callback: () => void) => {
    callbacks.push(callback);

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        const callbacksToExecute = [...callbacks];
        callbacks = [];
        rafId = null;

        for (const cb of callbacksToExecute) {
          try {
            cb();
          } catch (error) {
            console.warn('Error in RAF callback:', error);
          }
        }
      });
    }
  };

  const cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    callbacks = [];
  };

  const hasPendingCallbacks = () => callbacks.length > 0;

  return {
    schedule,
    cancel,
    hasPendingCallbacks
  };
}