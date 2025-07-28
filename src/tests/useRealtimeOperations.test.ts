import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRealtimeOperations } from '../hooks/useRealtimeOperations';
import type { UseRealtimeOperationsConfig } from '../hooks/useRealtimeOperations';

// Mock do hook unificado
vi.mock('../hooks/useRealtimeUnified', () => ({
  useRealtimeUnified: vi.fn()
}));

import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

const mockUseRealtimeUnified = useRealtimeUnified as any;

describe('useRealtimeOperations', () => {
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
      tablesMonitored: ['operacoes'],
      managerStats: {},
      pollingInterval: 3000
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
    it('deve configurar o hook unificado com configurações padrão para operações', () => {
      const config: UseRealtimeOperationsConfig = {};

      renderHook(() => useRealtimeOperations(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          tables: ['operacoes', 'operations'],
          enableFetch: true,
          initialFetch: true,
          enablePolling: true,
          activeInterval: 3000,
          inactiveInterval: 15000
        })
      );
    });

    it('deve usar channelId personalizado quando fornecido', () => {
      const config: UseRealtimeOperationsConfig = {
        channelId: 'custom-operations-channel'
      };

      renderHook(() => useRealtimeOperations(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'custom-operations-channel'
        })
      );
    });

    it('deve configurar filtros baseados na configuração', () => {
      const config: UseRealtimeOperationsConfig = {
        statusFilter: ['pending', 'running'],
        userFilter: 'user123',
        operationTypes: ['backup', 'sync']
      };

      renderHook(() => useRealtimeOperations(config));

      expect(mockUseRealtimeUnified).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: {
            status: 'pending,running',
            user_id: 'user123',
            operation_type: 'backup,sync'
          }
        })
      );
    });
  });

  describe('Processamento de dados', () => {
    it('deve processar operações por status corretamente', () => {
      const mockOperations = [
        { id: '1', status: 'pending', operation_type: 'backup' },
        { id: '2', status: 'completed', operation_type: 'sync' },
        { id: '3', status: 'failed', operation_type: 'backup' },
        { id: '4', status: 'running', operation_type: 'sync' }
      ];

      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        data: mockOperations
      });

      const { result } = renderHook(() => useRealtimeOperations({}));

      expect(result.current.operations).toHaveLength(4);
      expect(result.current.pendingOperations).toHaveLength(2); // pending + running
      expect(result.current.completedOperations).toHaveLength(1);
      expect(result.current.failedOperations).toHaveLength(1);
    });

    it('deve calcular estatísticas corretamente', () => {
      const mockOperations = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'completed' },
        { id: '3', status: 'completed' },
        { id: '4', status: 'failed' }
      ];

      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        data: mockOperations
      });

      const { result } = renderHook(() => useRealtimeOperations({}));

      expect(result.current.operationStats).toEqual({
        total: 4,
        pending: 1,
        completed: 2,
        failed: 1,
        successRate: 50 // 2/4 * 100
      });
    });

    it('deve lidar com dados vazios', () => {
      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        data: []
      });

      const { result } = renderHook(() => useRealtimeOperations({}));

      expect(result.current.operations).toHaveLength(0);
      expect(result.current.operationStats).toEqual({
        total: 0,
        pending: 0,
        completed: 0,
        failed: 0,
        successRate: 0
      });
    });
  });

  describe('Ações específicas', () => {
    it('deve implementar refreshOperations', async () => {
      const mockRefetch = vi.fn().mockResolvedValue(undefined);
      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        refetch: mockRefetch
      });

      const { result } = renderHook(() => useRealtimeOperations({}));

      await act(async () => {
        await result.current.refreshOperations();
      });

      expect(mockRefetch).toHaveBeenCalledWith('operations_refresh');
    });

    it('deve implementar filterByStatus', () => {
      const mockOperations = [
        { id: '1', status: 'pending' },
        { id: '2', status: 'completed' },
        { id: '3', status: 'pending' }
      ];

      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        data: mockOperations
      });

      const { result } = renderHook(() => useRealtimeOperations({}));

      const pendingOps = result.current.filterByStatus('pending');
      expect(pendingOps).toHaveLength(2);
      expect(pendingOps.every(op => op.status === 'pending')).toBe(true);
    });

    it('deve implementar filterByType', () => {
      const mockOperations = [
        { id: '1', operation_type: 'backup' },
        { id: '2', operation_type: 'sync' },
        { id: '3', operation_type: 'backup' }
      ];

      mockUseRealtimeUnified.mockReturnValue({
        ...mockUnifiedReturn,
        data: mockOperations
      });

      const { result } = renderHook(() => useRealtimeOperations({}));

      const backupOps = result.current.filterByType('backup');
      expect(backupOps).toHaveLength(2);
      expect(backupOps.every(op => op.operation_type === 'backup')).toBe(true);
    });
  });

  describe('Callbacks específicos', () => {
    it('deve chamar onOperationCreated para novos registros', () => {
      const onOperationCreated = vi.fn();
      const config: UseRealtimeOperationsConfig = {
        onOperationCreated
      };

      renderHook(() => useRealtimeOperations(config));

      // Simular callback do hook unificado
      const unifiedConfig = mockUseRealtimeUnified.mock.calls[0][0];
      const mockEvent = {
        eventType: 'INSERT',
        new: { id: '1', status: 'pending', operation_type: 'backup' },
        old: null
      };

      act(() => {
        unifiedConfig.onDatabaseChange(mockEvent);
      });

      expect(onOperationCreated).toHaveBeenCalledWith(mockEvent.new);
    });

    it('deve chamar onOperationCompleted quando status muda para completed', () => {
      const onOperationCompleted = vi.fn();
      const onOperationUpdated = vi.fn();
      const config: UseRealtimeOperationsConfig = {
        onOperationCompleted,
        onOperationUpdated
      };

      renderHook(() => useRealtimeOperations(config));

      const unifiedConfig = mockUseRealtimeUnified.mock.calls[0][0];
      const mockEvent = {
        eventType: 'UPDATE',
        new: { id: '1', status: 'completed', operation_type: 'backup' },
        old: { id: '1', status: 'pending', operation_type: 'backup' }
      };

      act(() => {
        unifiedConfig.onDatabaseChange(mockEvent);
      });

      expect(onOperationUpdated).toHaveBeenCalledWith(mockEvent.new);
      expect(onOperationCompleted).toHaveBeenCalledWith(mockEvent.new);
    });

    it('deve chamar onOperationFailed quando status muda para failed', () => {
      const onOperationFailed = vi.fn();
      const onOperationUpdated = vi.fn();
      const config: UseRealtimeOperationsConfig = {
        onOperationFailed,
        onOperationUpdated
      };

      renderHook(() => useRealtimeOperations(config));

      const unifiedConfig = mockUseRealtimeUnified.mock.calls[0][0];
      const mockEvent = {
        eventType: 'UPDATE',
        new: { id: '1', status: 'failed', operation_type: 'backup' },
        old: { id: '1', status: 'pending', operation_type: 'backup' }
      };

      act(() => {
        unifiedConfig.onDatabaseChange(mockEvent);
      });

      expect(onOperationUpdated).toHaveBeenCalledWith(mockEvent.new);
      expect(onOperationFailed).toHaveBeenCalledWith(mockEvent.new);
    });
  });

  describe('Debug info', () => {
    it('deve fornecer debug info específico para operações', () => {
      const config: UseRealtimeOperationsConfig = {
        operationTypes: ['backup', 'sync'],
        statusFilter: ['pending'],
        userFilter: 'user123'
      };

      const { result } = renderHook(() => useRealtimeOperations(config));

      expect(result.current.debugInfo).toEqual({
        channelId: 'test-channel',
        tablesMonitored: ['operacoes'],
        operationTypes: ['backup', 'sync'],
        statusFilter: ['pending'],
        userFilter: 'user123',
        managerStats: {},
        pollingInterval: 3000
      });
    });
  });

  describe('Integração com hook unificado', () => {
    it('deve passar todas as propriedades do hook unificado', () => {
      const { result } = renderHook(() => useRealtimeOperations({}));

      // Verificar propriedades base
      expect(result.current.data).toBe(mockUnifiedReturn.data);
      expect(result.current.loading).toBe(mockUnifiedReturn.loading);
      expect(result.current.error).toBe(mockUnifiedReturn.error);
      expect(result.current.isConnected).toBe(mockUnifiedReturn.isConnected);
      expect(result.current.connectionStatus).toBe(mockUnifiedReturn.connectionStatus);

      // Verificar ações base
      expect(result.current.refetch).toBe(mockUnifiedReturn.refetch);
      expect(result.current.reconnect).toBe(mockUnifiedReturn.reconnect);
      expect(result.current.disconnect).toBe(mockUnifiedReturn.disconnect);
      expect(result.current.forceExecute).toBe(mockUnifiedReturn.forceExecute);
    });
  });
});