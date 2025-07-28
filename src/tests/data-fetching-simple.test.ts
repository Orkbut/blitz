/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

// Mock the config validator
vi.mock('../hooks/utils/config-validator', () => ({
  configValidator: {
    sanitizeConfig: vi.fn((config) => config)
  },
  validateConfigOrThrow: vi.fn()
}));

// Mock the RealtimeManager
vi.mock('../core/infrastructure/services/RealtimeManager', () => ({
  realtimeManager: {
    subscribe: vi.fn(() => true),
    unsubscribe: vi.fn(),
    getChannelStats: vi.fn(() => ({}))
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useRealtimeUnified - Data Fetching Simple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with correct initial state when fetch is enabled', async () => {
    const mockData = [{ id: 1, name: 'Test' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        apiEndpoint: 'https://api.example.com/data',
        enableFetch: true
      })
    );

    // Should start with loading=true and fetchInProgress=true
    expect(result.current.loading).toBe(true);
    expect(result.current.fetchInProgress).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('should start with loading=false when fetch is disabled', () => {
    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableFetch: false,
        enableRealtime: false // Disable realtime too
      })
    );

    // Should start with loading=false when fetch is disabled
    expect(result.current.loading).toBe(false);
    expect(result.current.fetchInProgress).toBe(false);
    expect(result.current.data).toEqual([]);
  });

  it('should start with loading=false when no endpoint is provided', () => {
    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        enableFetch: true,
        enableRealtime: false // Disable realtime to isolate fetch behavior
        // No apiEndpoint or fetchConfig provided
      })
    );

    // Should start with loading=false when no endpoint
    expect(result.current.loading).toBe(false);
    expect(result.current.fetchInProgress).toBe(false);
    expect(result.current.data).toEqual([]);
  });

  it('should complete fetch successfully', async () => {
    const mockData = [{ id: 1, name: 'Test' }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        apiEndpoint: 'https://api.example.com/data',
        enableFetch: true
      })
    );

    // Wait for fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 10000 });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.fetchInProgress).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastFetchReason).toBe('initial_load');
    expect(result.current.fromCache).toBe(false);
  });

  it('should handle fetch errors', async () => {
    const mockError = new Error('Network error');
    mockFetch.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() =>
      useRealtimeUnified({
        tables: ['test_table'],
        apiEndpoint: 'https://api.example.com/data',
        enableFetch: true
      })
    );

    // Wait for fetch to complete with error
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 10000 });

    expect(result.current.data).toEqual([]);
    expect(result.current.fetchInProgress).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.lastFetchReason).toBe('initial_load');
  });
});