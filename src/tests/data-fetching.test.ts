/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
  AbortSignal.timeout = vi.fn((timeout: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  });
}

describe('useRealtimeUnified - Data Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial Data Fetch', () => {
    it('should fetch data on mount when enableFetch is true and apiEndpoint is provided', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true,
          debug: true
        })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.fetchInProgress).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.fetchInProgress).toBe(false);
      expect(result.current.lastFetchReason).toBe('initial_load');
      expect(result.current.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should not fetch data when enableFetch is false', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: false
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.fetchInProgress).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not fetch data when no apiEndpoint or fetchConfig is provided', async () => {
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          enableFetch: true
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.fetchInProgress).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Manual Refetch', () => {
    it('should refetch data when refetch is called', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      const updatedData = [{ id: 1, name: 'Updated' }];
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedData)
        });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);

      // Trigger refetch
      await result.current.refetch('manual_test');

      await waitFor(() => {
        expect(result.current.data).toEqual(updatedData);
      });

      expect(result.current.lastFetchReason).toBe('manual_test');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should track refetch reason correctly', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockFetch.mockResolvedValue({
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

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.lastFetchReason).toBe('initial_load');

      // Test different refetch reasons
      await result.current.refetch('user_action');
      await waitFor(() => {
        expect(result.current.lastFetchReason).toBe('user_action');
      });

      await result.current.refetch();
      await waitFor(() => {
        expect(result.current.lastFetchReason).toBe('manual');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const mockError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(mockError);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true,
          onError
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.data).toEqual([]);
      expect(result.current.fetchInProgress).toBe(false);
      expect(onError).toHaveBeenCalledWith(mockError);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('HTTP 404: Not Found');
      expect(result.current.data).toEqual([]);
    });
  });

  describe('Cache Control', () => {
    it('should return cached data when cache is valid', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true,
          cacheTimeout: 60000 // 1 minute
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Refetch immediately - should use cache
      await result.current.refetch('cache_test');

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData);
      });

      expect(result.current.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
    });

    it('should fetch new data when cache expires', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      const updatedData = [{ id: 1, name: 'Updated' }];
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedData)
        });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true,
          cacheTimeout: 1000 // 1 second
        })
      );

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fromCache).toBe(false);

      // Advance time to expire cache
      vi.advanceTimersByTime(1500);

      // Refetch - should fetch new data
      await result.current.refetch('expired_cache_test');

      await waitFor(() => {
        expect(result.current.data).toEqual(updatedData);
      });

      expect(result.current.fromCache).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Fetch Configuration', () => {
    it('should use custom fetchConfig when provided', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          enableFetch: true,
          fetchConfig: {
            endpoint: 'https://custom.api.com/data',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer token123',
              'Custom-Header': 'value'
            },
            body: { filter: 'active' },
            timeout: 5000,
            retries: 2
          }
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.com/data',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123',
            'Custom-Header': 'value'
          }),
          body: JSON.stringify({ filter: 'active' })
        })
      );
    });

    it('should include query parameters from config', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true,
          startDate,
          endDate,
          filters: {
            status: 'active',
            category: 'test'
          }
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const expectedUrl = 'https://api.example.com/data?startDate=2023-01-01T00%3A00%3A00.000Z&endDate=2023-12-31T00%3A00%3A00.000Z&status=active&category=test';
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    });
  });

  describe('Loading States', () => {
    it('should manage loading states correctly during fetch', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      
      // Create a promise that we can control
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockFetch.mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          apiEndpoint: 'https://api.example.com/data',
          enableFetch: true
        })
      );

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.fetchInProgress).toBe(true);

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.fetchInProgress).toBe(false);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests according to configuration', async () => {
      const mockData = [{ id: 1, name: 'Test' }];
      
      // Fail twice, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData)
        });

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          enableFetch: true,
          fetchConfig: {
            endpoint: 'https://api.example.com/data',
            retries: 3,
            timeout: 5000
          }
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after exhausting all retries', async () => {
      const networkError = new Error('Persistent network error');
      mockFetch.mockRejectedValue(networkError);

      const { result } = renderHook(() =>
        useRealtimeUnified({
          tables: ['test_table'],
          enableFetch: true,
          fetchConfig: {
            endpoint: 'https://api.example.com/data',
            retries: 2,
            timeout: 1000
          }
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      }, { timeout: 10000 });

      expect(result.current.error).toBe('Persistent network error');
      expect(result.current.data).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});