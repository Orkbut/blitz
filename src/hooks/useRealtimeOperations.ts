'use client';

import { useMemo } from 'react';
import { 
  useRealtimeUnified, 
  type UseRealtimeUnifiedConfig, 
  type UseRealtimeUnifiedReturn 
} from './useRealtimeUnified';

/**
 * 🎯 CONFIGURAÇÃO ESPECÍFICA PARA OPERAÇÕES
 */
export interface UseRealtimeOperationsConfig {
  // Configurações específicas para operações
  operationTypes?: string[];           // Tipos de operações a monitorar
  statusFilter?: string[];            // Filtros por status (pending, completed, failed)
  userFilter?: string;                // Filtrar por usuário específico
  dateRange?: {
    start: Date | string;
    end: Date | string;
  };

  // Configurações de endpoint para operações
  operationsEndpoint?: string;        // Endpoint específico para operações
  
  // Callbacks específicos para operações
  onOperationCreated?: (operation: any) => void;
  onOperationUpdated?: (operation: any) => void;
  onOperationCompleted?: (operation: any) => void;
  onOperationFailed?: (operation: any) => void;

  // Configurações herdadas (opcionais)
  channelId?: string;
  enablePolling?: boolean;
  activeInterval?: number;
  inactiveInterval?: number;
  debug?: boolean;
}

/**
 * 🎯 INTERFACE DE RETORNO ESPECÍFICA PARA OPERAÇÕES
 */
export interface UseRealtimeOperationsReturn<T = any> extends Omit<UseRealtimeUnifiedReturn<T>, 'debugInfo'> {
  // Dados específicos para operações
  operations: T[];
  pendingOperations: T[];
  completedOperations: T[];
  failedOperations: T[];
  
  // Estatísticas específicas
  operationStats: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    successRate: number;
  };

  // Ações específicas para operações
  refreshOperations: () => Promise<void>;
  filterByStatus: (status: string) => T[];
  filterByType: (type: string) => T[];
  
  // Debug info específico
  debugInfo: {
    channelId: string;
    tablesMonitored: string[];
    operationTypes: string[];
    statusFilter: string[];
    userFilter?: string;
    managerStats: Record<string, any>;
    pollingInterval: number;
  };
}

/**
 * 🎯 HOOK ESPECIALIZADO PARA OPERAÇÕES
 * 
 * Hook de conveniência que utiliza o useRealtimeUnified internamente
 * para casos de uso específicos de operações.
 */
export const useRealtimeOperations = <T = any>(
  config: UseRealtimeOperationsConfig
): UseRealtimeOperationsReturn<T> => {
  
  // 🔧 CONFIGURAÇÃO UNIFICADA
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => {
    // Tabelas padrão para operações
    const defaultTables = ['operacoes', 'operations'];
    
    // Construir filtros baseados na configuração
    const filters: Record<string, string> = {};
    
    if (config.statusFilter && config.statusFilter.length > 0) {
      filters.status = config.statusFilter.join(',');
    }
    
    if (config.userFilter) {
      filters.user_id = config.userFilter;
    }
    
    if (config.operationTypes && config.operationTypes.length > 0) {
      filters.operation_type = config.operationTypes.join(',');
    }

    return {
      channelId: config.channelId || `operations-${Date.now()}`,
      tables: defaultTables,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      
      // Configurações de fetch
      enableFetch: true,
      apiEndpoint: config.operationsEndpoint,
      startDate: config.dateRange?.start,
      endDate: config.dateRange?.end,
      initialFetch: true,
      
      // Configurações de polling otimizadas para operações
      enablePolling: config.enablePolling !== false,
      activeInterval: config.activeInterval || 3000,    // Mais frequente para operações
      inactiveInterval: config.inactiveInterval || 15000,
      
      // Callbacks unificados
      onDatabaseChange: (event) => {
        const { eventType, new: newRecord, old: oldRecord } = event;
        
        if (eventType === 'INSERT' && newRecord && config.onOperationCreated) {
          config.onOperationCreated(newRecord);
        } else if (eventType === 'UPDATE' && newRecord && config.onOperationUpdated) {
          config.onOperationUpdated(newRecord);
          
          // Verificar se a operação foi completada ou falhou
          if (newRecord.status === 'completed' && config.onOperationCompleted) {
            config.onOperationCompleted(newRecord);
          } else if (newRecord.status === 'failed' && config.onOperationFailed) {
            config.onOperationFailed(newRecord);
          }
        }
      },
      
      debug: config.debug
    };
  }, [
    config.channelId,
    config.statusFilter,
    config.userFilter,
    config.operationTypes,
    config.operationsEndpoint,
    config.dateRange?.start,
    config.dateRange?.end,
    config.enablePolling,
    config.activeInterval,
    config.inactiveInterval,
    config.debug
  ]);

  // 🎯 USAR HOOK UNIFICADO
  const unifiedResult = useRealtimeUnified<T>(unifiedConfig);

  // 🎯 DADOS PROCESSADOS ESPECÍFICOS PARA OPERAÇÕES
  const processedData = useMemo(() => {
    const operations = unifiedResult.data || [];
    
    const pendingOperations = operations.filter((op: any) => 
      op.status === 'pending' || op.status === 'running' || op.status === 'in_progress'
    );
    
    const completedOperations = operations.filter((op: any) => 
      op.status === 'completed' || op.status === 'success'
    );
    
    const failedOperations = operations.filter((op: any) => 
      op.status === 'failed' || op.status === 'error'
    );

    const total = operations.length;
    const successRate = total > 0 ? (completedOperations.length / total) * 100 : 0;

    return {
      operations,
      pendingOperations,
      completedOperations,
      failedOperations,
      operationStats: {
        total,
        pending: pendingOperations.length,
        completed: completedOperations.length,
        failed: failedOperations.length,
        successRate: Math.round(successRate * 100) / 100
      }
    };
  }, [unifiedResult.data]);

  // 🎯 AÇÕES ESPECÍFICAS
  const refreshOperations = useMemo(() => 
    () => unifiedResult.refetch('operations_refresh'),
    [unifiedResult.refetch]
  );

  const filterByStatus = useMemo(() => 
    (status: string) => processedData.operations.filter((op: any) => op.status === status),
    [processedData.operations]
  );

  const filterByType = useMemo(() => 
    (type: string) => processedData.operations.filter((op: any) => op.operation_type === type || op.type === type),
    [processedData.operations]
  );

  // 🎯 DEBUG INFO ESPECÍFICO
  const debugInfo = useMemo(() => ({
    channelId: unifiedResult.debugInfo.channelId,
    tablesMonitored: unifiedResult.debugInfo.tablesMonitored,
    operationTypes: config.operationTypes || [],
    statusFilter: config.statusFilter || [],
    userFilter: config.userFilter,
    managerStats: unifiedResult.debugInfo.managerStats,
    pollingInterval: unifiedResult.debugInfo.pollingInterval
  }), [
    unifiedResult.debugInfo,
    config.operationTypes,
    config.statusFilter,
    config.userFilter
  ]);

  // 🎯 RETORNO ESPECIALIZADO
  return {
    // Dados base do hook unificado
    data: unifiedResult.data,
    loading: unifiedResult.loading,
    error: unifiedResult.error,
    isConnected: unifiedResult.isConnected,
    connectionStatus: unifiedResult.connectionStatus,
    lastEventTime: unifiedResult.lastEventTime,
    eventsReceived: unifiedResult.eventsReceived,
    reconnectCount: unifiedResult.reconnectCount,
    isActive: unifiedResult.isActive,
    isVisible: unifiedResult.isVisible,
    fetchInProgress: unifiedResult.fetchInProgress,
    lastFetchTime: unifiedResult.lastFetchTime,
    lastFetchReason: unifiedResult.lastFetchReason,
    fromCache: unifiedResult.fromCache,
    
    // Ações base
    refetch: unifiedResult.refetch,
    reconnect: unifiedResult.reconnect,
    disconnect: unifiedResult.disconnect,
    forceExecute: unifiedResult.forceExecute,
    
    // Dados específicos para operações
    operations: processedData.operations,
    pendingOperations: processedData.pendingOperations,
    completedOperations: processedData.completedOperations,
    failedOperations: processedData.failedOperations,
    operationStats: processedData.operationStats,
    
    // Ações específicas
    refreshOperations,
    filterByStatus,
    filterByType,
    
    // Debug específico
    debugInfo
  };
};

export default useRealtimeOperations;