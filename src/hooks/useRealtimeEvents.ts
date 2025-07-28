'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { 
  useRealtimeUnified, 
  type UseRealtimeUnifiedConfig, 
  type UseRealtimeUnifiedReturn 
} from './useRealtimeUnified';

/**
 * 🎯 CONFIGURAÇÃO ESPECÍFICA PARA EVENTOS
 */
export interface UseRealtimeEventsConfig {
  // Configurações específicas para eventos
  eventTypes?: string[];              // Tipos de eventos a monitorar
  severityFilter?: string[];          // Filtros por severidade (info, warning, error, critical)
  sourceFilter?: string[];           // Filtrar por fonte do evento
  dateRange?: {
    start: Date | string;
    end: Date | string;
  };

  // Configurações de endpoint para eventos
  eventsEndpoint?: string;            // Endpoint específico para eventos
  
  // Configurações de monitoramento
  maxEvents?: number;                 // Máximo de eventos a manter em memória (default: 1000)
  autoAcknowledge?: boolean;          // Auto-reconhecer eventos (default: false)
  
  // Callbacks específicos para eventos
  onEventReceived?: (event: any) => void;
  onCriticalEvent?: (event: any) => void;
  onErrorEvent?: (event: any) => void;
  onWarningEvent?: (event: any) => void;
  onEventAcknowledged?: (event: any) => void;

  // Configurações herdadas (opcionais)
  channelId?: string;
  enablePolling?: boolean;
  activeInterval?: number;
  inactiveInterval?: number;
  debug?: boolean;
}

/**
 * 🎯 INTERFACE DE RETORNO ESPECÍFICA PARA EVENTOS
 */
export interface UseRealtimeEventsReturn<T = any> extends Omit<UseRealtimeUnifiedReturn<T>, 'debugInfo'> {
  // Dados específicos para eventos
  events: T[];
  recentEvents: T[];                  // Eventos das últimas 24h
  unacknowledgedEvents: T[];
  criticalEvents: T[];
  errorEvents: T[];
  warningEvents: T[];
  
  // Estatísticas específicas
  eventStats: {
    total: number;
    unacknowledged: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
    last24h: number;
  };

  // Ações específicas para eventos
  refreshEvents: () => Promise<void>;
  acknowledgeEvent: (eventId: string) => void;
  acknowledgeAll: () => void;
  filterByType: (type: string) => T[];
  filterBySeverity: (severity: string) => T[];
  filterBySource: (source: string) => T[];
  clearOldEvents: (olderThanHours?: number) => void;
  
  // Debug info específico
  debugInfo: {
    channelId: string;
    tablesMonitored: string[];
    eventTypes: string[];
    severityFilter: string[];
    sourceFilter: string[];
    maxEvents: number;
    autoAcknowledge: boolean;
    managerStats: Record<string, any>;
    pollingInterval: number;
  };
}

/**
 * 🎯 HOOK ESPECIALIZADO PARA EVENTOS
 * 
 * Hook de conveniência que utiliza o useRealtimeUnified internamente
 * para casos de uso específicos de monitoramento de eventos.
 */
export const useRealtimeEvents = <T = any>(
  config: UseRealtimeEventsConfig
): UseRealtimeEventsReturn<T> => {
  
  // 🔧 REFS PARA CONTROLE INTERNO
  const acknowledgedEventsRef = useRef<Set<string>>(new Set());
  const maxEvents = config.maxEvents || 1000;
  
  // Estado para forçar re-render quando eventos são reconhecidos
  const [acknowledgeCounter, setAcknowledgeCounter] = useState(0);

  // 🔧 CONFIGURAÇÃO UNIFICADA
  const unifiedConfig: UseRealtimeUnifiedConfig = useMemo(() => {
    // Tabelas padrão para eventos
    const defaultTables = ['eventos', 'events', 'logs', 'audit_logs'];
    
    // Construir filtros baseados na configuração
    const filters: Record<string, string> = {};
    
    if (config.severityFilter && config.severityFilter.length > 0) {
      filters.severity = config.severityFilter.join(',');
    }
    
    if (config.sourceFilter && config.sourceFilter.length > 0) {
      filters.source = config.sourceFilter.join(',');
    }
    
    if (config.eventTypes && config.eventTypes.length > 0) {
      filters.event_type = config.eventTypes.join(',');
    }

    return {
      channelId: config.channelId || `events-${Date.now()}`,
      tables: defaultTables,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      
      // Configurações de fetch
      enableFetch: true,
      apiEndpoint: config.eventsEndpoint,
      startDate: config.dateRange?.start,
      endDate: config.dateRange?.end,
      initialFetch: true,
      
      // Configurações de polling otimizadas para eventos
      enablePolling: config.enablePolling !== false,
      activeInterval: config.activeInterval || 2000,    // Mais frequente para eventos
      inactiveInterval: config.inactiveInterval || 10000,
      
      // Callbacks unificados
      onDatabaseChange: (event) => {
        const { eventType, new: newRecord } = event;
        
        if (eventType === 'INSERT' && newRecord && config.onEventReceived) {
          config.onEventReceived(newRecord);
          
          // Auto-acknowledge se configurado
          if (config.autoAcknowledge) {
            acknowledgedEventsRef.current.add(newRecord.id || newRecord.event_id);
          }
          
          // Callbacks específicos por severidade
          const severity = newRecord.severity || newRecord.level;
          if (severity === 'critical' && config.onCriticalEvent) {
            config.onCriticalEvent(newRecord);
          } else if (severity === 'error' && config.onErrorEvent) {
            config.onErrorEvent(newRecord);
          } else if (severity === 'warning' && config.onWarningEvent) {
            config.onWarningEvent(newRecord);
          }
        }
      },
      
      debug: config.debug
    };
  }, [
    config.channelId,
    config.severityFilter,
    config.sourceFilter,
    config.eventTypes,
    config.eventsEndpoint,
    config.dateRange?.start,
    config.dateRange?.end,
    config.enablePolling,
    config.activeInterval,
    config.inactiveInterval,
    config.autoAcknowledge,
    config.debug
  ]);

  // 🎯 USAR HOOK UNIFICADO
  const unifiedResult = useRealtimeUnified<T>(unifiedConfig);

  // 🎯 DADOS PROCESSADOS ESPECÍFICOS PARA EVENTOS
  const processedData = useMemo(() => {
    let events = unifiedResult.data || [];
    
    // Limitar número de eventos em memória
    if (events.length > maxEvents) {
      events = events.slice(-maxEvents);
    }
    
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentEvents = events.filter((event: any) => {
      const eventDate = new Date(event.created_at || event.timestamp || event.date);
      return eventDate >= last24h;
    });
    
    const unacknowledgedEvents = events.filter((event: any) => {
      const eventId = event.id || event.event_id;
      return !acknowledgedEventsRef.current.has(eventId) && !event.acknowledged;
    });
    
    const criticalEvents = events.filter((event: any) => 
      (event.severity || event.level) === 'critical'
    );
    
    const errorEvents = events.filter((event: any) => 
      (event.severity || event.level) === 'error'
    );
    
    const warningEvents = events.filter((event: any) => 
      (event.severity || event.level) === 'warning'
    );
    
    const infoEvents = events.filter((event: any) => 
      (event.severity || event.level) === 'info'
    );

    return {
      events,
      recentEvents,
      unacknowledgedEvents,
      criticalEvents,
      errorEvents,
      warningEvents,
      eventStats: {
        total: events.length,
        unacknowledged: unacknowledgedEvents.length,
        critical: criticalEvents.length,
        error: errorEvents.length,
        warning: warningEvents.length,
        info: infoEvents.length,
        last24h: recentEvents.length
      }
    };
  }, [unifiedResult.data, maxEvents, acknowledgeCounter]);

  // 🎯 AÇÕES ESPECÍFICAS
  const refreshEvents = useCallback(() => 
    unifiedResult.refetch('events_refresh'),
    [unifiedResult.refetch]
  );

  const acknowledgeEvent = useCallback((eventId: string) => {
    acknowledgedEventsRef.current.add(eventId);
    setAcknowledgeCounter(prev => prev + 1); // Forçar re-render
    
    // Encontrar o evento e chamar callback se configurado
    const event = processedData.events.find((e: any) => 
      (e.id || e.event_id) === eventId
    );
    
    if (event && config.onEventAcknowledged) {
      config.onEventAcknowledged(event);
    }
  }, [processedData.events, config.onEventAcknowledged]);

  const acknowledgeAll = useCallback(() => {
    processedData.unacknowledgedEvents.forEach((event: any) => {
      const eventId = event.id || event.event_id;
      acknowledgedEventsRef.current.add(eventId);
      
      if (config.onEventAcknowledged) {
        config.onEventAcknowledged(event);
      }
    });
    setAcknowledgeCounter(prev => prev + processedData.unacknowledgedEvents.length); // Forçar re-render
  }, [processedData.unacknowledgedEvents, config.onEventAcknowledged]);

  const filterByType = useCallback((type: string) => 
    processedData.events.filter((event: any) => 
      (event.event_type || event.type) === type
    ),
    [processedData.events]
  );

  const filterBySeverity = useCallback((severity: string) => 
    processedData.events.filter((event: any) => 
      (event.severity || event.level) === severity
    ),
    [processedData.events]
  );

  const filterBySource = useCallback((source: string) => 
    processedData.events.filter((event: any) => 
      (event.source || event.origin) === source
    ),
    [processedData.events]
  );

  const clearOldEvents = useCallback((olderThanHours: number = 24) => {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    // Limpar eventos reconhecidos antigos
    const currentEvents = processedData.events;
    const oldEventIds = currentEvents
      .filter((event: any) => {
        const eventDate = new Date(event.created_at || event.timestamp || event.date);
        return eventDate < cutoffTime;
      })
      .map((event: any) => event.id || event.event_id);
    
    oldEventIds.forEach(id => {
      acknowledgedEventsRef.current.delete(id);
    });
  }, [processedData.events]);

  // 🎯 DEBUG INFO ESPECÍFICO
  const debugInfo = useMemo(() => ({
    channelId: unifiedResult.debugInfo.channelId,
    tablesMonitored: unifiedResult.debugInfo.tablesMonitored,
    eventTypes: config.eventTypes || [],
    severityFilter: config.severityFilter || [],
    sourceFilter: config.sourceFilter || [],
    maxEvents,
    autoAcknowledge: config.autoAcknowledge || false,
    managerStats: unifiedResult.debugInfo.managerStats,
    pollingInterval: unifiedResult.debugInfo.pollingInterval
  }), [
    unifiedResult.debugInfo,
    config.eventTypes,
    config.severityFilter,
    config.sourceFilter,
    maxEvents,
    config.autoAcknowledge
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
    
    // Dados específicos para eventos
    events: processedData.events,
    recentEvents: processedData.recentEvents,
    unacknowledgedEvents: processedData.unacknowledgedEvents,
    criticalEvents: processedData.criticalEvents,
    errorEvents: processedData.errorEvents,
    warningEvents: processedData.warningEvents,
    eventStats: processedData.eventStats,
    
    // Ações específicas
    refreshEvents,
    acknowledgeEvent,
    acknowledgeAll,
    filterByType,
    filterBySeverity,
    filterBySource,
    clearOldEvents,
    
    // Debug específico
    debugInfo
  };
};

export default useRealtimeEvents;