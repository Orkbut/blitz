import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// import { useRealtimeSimple } from '../hooks/useRealtimeSimple';
// import type { UseRealtimeSimpleConfig } from '../hooks/useRealtimeSimple';
import { useRealtimeSimple } from '../hooks/legacy-wrappers';
import type { UseRealtimeSimpleConfig } from '../hooks/legacy-wrappers/useRealtimeSimple.wrapper';

// Mock do hook unificado
vi.mock('../hooks/useRealtimeUnified', () => ({
  useRealtimeUnified: vi.fn()
}));

import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

const mockUseRealtimeUnified = useRealtimeUnified as any;

describe('useRealtimeSimple', () => {
  const mockUnifiedReturn = {
    data: [],
    loading: false,
    error: null,
    isConnected: true,
    connectionStatus: 'connected' as const,
    lastEventTime: null,
    eventsReceived: 0,
    reconnectCount: 0,
    isActive: true,
    isVisible: true,
    fetchInProgress: false,
    lastFetchTime: null,
    lastFetchReason: null,
    fromCache: false,
    refetch: vi.fn(),
    reconnect: vi.fn(),
    disconnect: vi.fn(),
    forceExecute: vi.fn(),
    debugInfo: {
      channelId: 'test-channel',
      tablesMonitored: ['users'],
      managerStats: {},
      pollingInterval: 5000
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRealtimeUnified.mockReturnValue(mockUnifiedReturn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuração básica', () => {
    it('deve configurar o hook unificado com configurações simplificadas', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users', 'posts']
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          tables: ['users', 'posts'],
          enableFetch: false,
          initialFetch: false,
          enableRealtime: true,
          enablePolling: true,
          activeInterval: 5000,
          inactiveInterval: 10000,
          focusInterval: 5000,
          blurInterval: 20000
        })
      );
    });

    it('deve gerar channelId automaticamente se não fornecido', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users']
      };

      renderHook(() => useRealtimeSimple(config));

      const calledConfig = mockUseRealtimeUnified.mock.calls[0][0];
      expect(calledConfig.channelId).toMatch(/^simple-users-\d+$/);
    });

    it('deve usar channelId personalizado quando fornecido', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        channelId: 'custom-simple-channel'
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'custom-simple-channel'
        })
      );
    });

    it('deve configurar filtros quando fornecidos', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        filters: { status: 'active', role: 'admin' }
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { status: 'active', role: 'admin' }
        })
      );
    });

    it('deve usar pollingInterval personalizado', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        pollingInterval: 3000
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          activeInterval: 3000,
          inactiveInterval: 6000,  // 2x
          focusInterval: 3000,
          blurInterval: 12000      // 4x
        })
      );
    });

    it('deve desabilitar polling quando configurado', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        enablePolling: false
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          enablePolling: false
        })
      );
    });
  });

  describe('Validação', () => {
    it('deve lançar erro se tables não for fornecido', () => {
      expect(() => {
        renderHook(() => useRealtimeSimple({} as UseRealtimeSimpleConfig));
      }).toThrow('useRealtimeSimple: tables array is required and cannot be empty');
    });

    it('deve lançar erro se tables for array vazio', () => {
      expect(() => {
        renderHook(() => useRealtimeSimple({ tables: [] }));
      }).toThrow('useRealtimeSimple: tables array is required and cannot be empty');
    });
  });

  describe('Interface simplificada', () => {
    it('deve retornar interface simplificada', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users']
      };

      const { result } = renderHook(() => useRealtimeSimple(config));

      // Verificar propriedades essenciais
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('connected');
      expect(result.current).toHaveProperty('eventsReceived');
      expect(result.current).toHaveProperty('lastUpdate');
      expect(result.current).toHaveProperty('refresh');
      expect(result.current).toHaveProperty('reconnect');

      // Verificar que não tem propriedades complexas
      expect(result.current).not.toHaveProperty('connectionStatus');
      expect(result.current).not.toHaveProperty('fetchInProgress');
      expect(result.current).not.toHaveProperty('lastFetchTime');
    });

    it('deve mapear propriedades corretamente', () => {
      const mockData = [{ id: 1, name: 'Test' }];
      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        data: mockData,
        loading: true,
        error: 'Test error',
        isConnected: false,
        eventsReceived: 5,
        lastEventTime: 1234567890
      });

      const { result } = renderHook(() => useRealtimeSimple({ tables: ['users'] }));

      expect(result.current.data).toBe(mockData);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe('Test error');
      expect(result.current.connected).toBe(false);
      expect(result.current.eventsReceived).toBe(5);
      expect(result.current.lastUpdate).toBe(1234567890);
    });
  });

  describe('Ações simplificadas', () => {
    it('deve implementar refresh como reconnect', () => {
      const mockReconnect = vi.fn();
      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        reconnect: mockReconnect
      });

      const { result } = renderHook(() => useRealtimeSimple({ tables: ['users'] }));

      act(() => {
        result.current.refresh();
      });

      expect(mockReconnect).toHaveBeenCalled();
    });

    it('deve implementar reconnect', () => {
      const mockReconnect = vi.fn();
      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        reconnect: mockReconnect
      });

      const { result } = renderHook(() => useRealtimeSimple({ tables: ['users'] }));

      act(() => {
        result.current.reconnect();
      });

      expect(mockReconnect).toHaveBeenCalled();
    });
  });

  describe('Callbacks simplificados', () => {
    it('deve chamar onDataChange quando dados são atualizados', () => {
      const onDataChange = vi.fn();
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        onDataChange
      };

      renderHook(() => useRealtimeSimple(config));

      const unifiedConfig = mockUseRealtimeUnified.mock.calls[0][0];
      const testData = [{ id: 1, name: 'Test' }];

      act(() => {
        unifiedConfig.onDataUpdate(testData);
      });

      expect(onDataChange).toHaveBeenCalledWith(testData);
    });

    it('deve chamar onConnectionChange com boolean simplificado', () => {
      const onConnectionChange = vi.fn();
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        onConnectionChange
      };

      renderHook(() => useRealtimeSimple(config));

      const unifiedConfig = mockUseRealtimeUnified.mock.calls[0][0];

      act(() => {
        unifiedConfig.onConnectionChange('connected');
      });

      expect(onConnectionChange).toHaveBeenCalledWith(true);

      act(() => {
        unifiedConfig.onConnectionChange('disconnected');
      });

      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });

    it('deve chamar onError com string simplificada', () => {
      const onError = vi.fn();
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        onError
      };

      renderHook(() => useRealtimeSimple(config));

      const unifiedConfig = mockUseRealtimeUnified.mock.calls[0][0];
      const testError = new Error('Test error message');

      act(() => {
        unifiedConfig.onError(testError);
      });

      expect(onError).toHaveBeenCalledWith('Test error message');
    });
  });

  describe('Debug info', () => {
    it('deve não incluir debugInfo por padrão', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users']
      };

      const { result } = renderHook(() => useRealtimeSimple(config));

      expect(result.current.debugInfo).toBeUndefined();
    });

    it('deve incluir debugInfo quando debug=true', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users', 'posts'],
        debug: true
      };

      const { result } = renderHook(() => useRealtimeSimple(config));

      expect(result.current.debugInfo).toEqual({
        channelId: 'test-channel',
        tables: ['users', 'posts'],
        pollingInterval: 5000
      });
    });
  });

  describe('Configuração do hook unificado', () => {
    it('deve desabilitar fetch completamente', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users']
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          enableFetch: false,
          initialFetch: false
        })
      );
    });

    it('deve habilitar realtime', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users']
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          enableRealtime: true
        })
      );
    });

    it('deve não configurar endpoints de API', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users']
      };

      renderHook(() => useRealtimeSimple(config));

      const calledConfig = mockUseRealtimeUnified.mock.calls[0][0];
      expect(calledConfig.apiEndpoint).toBeUndefined();
      expect(calledConfig.fetchConfig).toBeUndefined();
      expect(calledConfig.startDate).toBeUndefined();
      expect(calledConfig.endDate).toBeUndefined();
    });

    it('deve configurar debug corretamente', () => {
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        debug: true
      };

      renderHook(() => useRealtimeSimple(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true
        })
      );
    });
  });

  describe('Imutabilidade de configuração', () => {
    it('deve fazer cópia das tabelas para evitar mutação', () => {
      const originalTables = ['users', 'posts'];
      const config: UseRealtimeSimpleConfig = {
        tables: originalTables
      };

      renderHook(() => useRealtimeSimple(config));

      const calledConfig = mockUseRealtimeUnified.mock.calls[0][0];
      expect(calledConfig.tables).toEqual(originalTables);
      expect(calledConfig.tables).not.toBe(originalTables); // Diferentes referências
    });

    it('deve fazer cópia dos filtros para evitar mutação', () => {
      const originalFilters = { status: 'active' };
      const config: UseRealtimeSimpleConfig = {
        tables: ['users'],
        filters: originalFilters
      };

      renderHook(() => useRealtimeSimple(config));

      const calledConfig = mockUseRealtimeUnified.mock.calls[0][0];
      expect(calledConfig.filters).toEqual(originalFilters);
      expect(calledConfig.filters).not.toBe(originalFilters); // Diferentes referências
    });
  });
});