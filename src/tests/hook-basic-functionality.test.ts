import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { JSDOM } from 'jsdom';

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

// Mock requestAnimationFrame and cancelAnimationFrame
Object.defineProperty(global, 'requestAnimationFrame', {
  value: vi.fn((cb) => setTimeout(cb, 16)),
  writable: true
});

Object.defineProperty(global, 'cancelAnimationFrame', {
  value: vi.fn((id) => clearTimeout(id)),
  writable: true
});

// Mock fetch
global.fetch = vi.fn();

// Mock RealtimeManager
vi.mock('../core/infrastructure/services/RealtimeManager', () => ({
  realtimeManager: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getChannelStats: vi.fn(() => ({}))
  }
}));

// Mock config validator
vi.mock('../hooks/utils/config-validator', () => ({
  validateConfigOrThrow: vi.fn(),
  configValidator: {
    sanitizeConfig: vi.fn((config) => config)
  }
}));

// Mock error handler
vi.mock('../hooks/utils/error-handler', () => ({
  handleRealtimeError: vi.fn(),
  handleRealtimeErrorWithRetry: vi.fn(() => Promise.resolve({ success: false })),
  handleRealtimeErrorWithFallback: vi.fn(() => Promise.resolve())
}));

import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

// Mock timers
vi.useFakeTimers();

describe('useRealtimeUnified Basic Functionality', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it('should initialize with basic configuration', () => {
    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableRealtime: false,
        enableFetch: false
      })
    );

    expect(result.current).toBeDefined();
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should have all required API methods', () => {
    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableRealtime: false,
        enableFetch: false
      })
    );

    // Check all API methods exist
    expect(typeof result.current.refetch).toBe('function');
    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.forceExecute).toBe('function');
  });

  it('should have performance metrics in debug info', () => {
    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableRealtime: false,
        enableFetch: false,
        debug: true
      })
    );

    expect(result.current.debugInfo).toBeDefined();
    expect(result.current.debugInfo.performance).toBeDefined();
    
    const { performance } = result.current.debugInfo;
    expect(performance.eventBatcher).toBeDefined();
    expect(performance.memoCache).toBeDefined();
    expect(performance.cleanupManager).toBeDefined();
    expect(typeof performance.hasPendingConnectionUpdate).toBe('boolean');
    expect(typeof performance.rafSchedulerActive).toBe('boolean');
    expect(typeof performance.pendingStateUpdates).toBe('number');
    expect(typeof performance.lastStateUpdate).toBe('number');
  });

  it('should maintain backward compatibility', () => {
    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableRealtime: false,
        enableFetch: false
      })
    );

    // All original properties should exist
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.error === 'string' || result.current.error === null).toBe(true);
    expect(typeof result.current.isConnected).toBe('boolean');
    expect(typeof result.current.connectionStatus).toBe('string');
    expect(typeof result.current.eventsReceived).toBe('number');
    expect(typeof result.current.reconnectCount).toBe('number');
    expect(typeof result.current.isActive).toBe('boolean');
    expect(typeof result.current.isVisible).toBe('boolean');
    expect(typeof result.current.fetchInProgress).toBe('boolean');
    expect(typeof result.current.fromCache).toBe('boolean');
  });

  it('should cleanup properly on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableRealtime: false,
        enableFetch: false
      })
    );

    // Verify hook is working
    expect(result.current).toBeDefined();

    // Unmount should not throw errors
    expect(() => unmount()).not.toThrow();
  });
});