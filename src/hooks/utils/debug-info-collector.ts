/**
 * 🔍 COLETOR DE INFORMAÇÕES DE DEBUG REALTIME
 * 
 * Coleta e organiza informações detalhadas de debug para troubleshooting,
 * incluindo estatísticas de canal, estado interno e diagnósticos.
 */

import { debugLogger } from './debug-logger';
import { performanceMonitor, PerformanceMetrics } from './performance-monitor';
import { connectionHealthMonitor, ConnectionHealthMetrics } from './connection-health-monitor';

// 🎯 INFORMAÇÕES DE DEBUG COMPLETAS
export interface DebugInfo {
  // Identificação
  channelId: string;
  hookType: string;
  instanceId: string;
  timestamp: number;
  
  // Configuração
  config: {
    tables: string[];
    filters?: Record<string, string>;
    enableRealtime: boolean;
    enablePolling: boolean;
    enableFetch: boolean;
    debug: boolean;
    [key: string]: any;
  };
  
  // Estado atual
  state: {
    isConnected: boolean;
    connectionStatus: string;
    loading: boolean;
    error: string | null;
    dataCount: number;
    lastEventTime: number | null;
    eventsReceived: number;
    reconnectCount: number;
  };
  
  // Estatísticas do canal
  channelStats: {
    subscriptionActive: boolean;
    tablesMonitored: string[];
    filtersApplied: Record<string, string>;
    eventCounts: Record<string, number>;
    lastActivity: number | null;
    connectionDuration: number;
  };
  
  // Estatísticas do manager
  managerStats: {
    totalChannels: number;
    activeSubscriptions: number;
    connectionPoolSize: number;
    globalEventCount: number;
    memoryUsage: number;
    uptime: number;
  };
  
  // Métricas de performance
  performance: PerformanceMetrics;
  
  // Saúde da conexão
  health: ConnectionHealthMetrics | null;
  
  // Polling
  polling: {
    enabled: boolean;
    currentInterval: number;
    isUserActive: boolean;
    isDocumentVisible: boolean;
    executionCount: number;
    lastExecution: number | null;
  };
  
  // Fetch
  fetch: {
    enabled: boolean;
    inProgress: boolean;
    lastFetchTime: number | null;
    lastFetchReason: string | null;
    fromCache: boolean;
    endpoint?: string;
  };
  
  // Logs recentes
  recentLogs: Array<{
    timestamp: number;
    level: string;
    message: string;
    data?: any;
  }>;
  
  // Problemas detectados
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    firstDetected: number;
    occurrences: number;
  }>;
  
  // Recomendações
  recommendations: string[];
  
  // Diagnósticos
  diagnostics: {
    networkConnectivity: 'good' | 'poor' | 'unknown';
    authenticationStatus: 'valid' | 'invalid' | 'unknown';
    rateLimitStatus: 'ok' | 'throttled' | 'unknown';
    dataIntegrity: 'good' | 'issues' | 'unknown';
    performanceIssues: string[];
  };
}

// 🎯 CONFIGURAÇÃO DO COLETOR
export interface DebugInfoCollectorConfig {
  enabled: boolean;
  includePerformanceMetrics: boolean;
  includeHealthMetrics: boolean;
  includeRecentLogs: boolean;
  maxRecentLogs: number;
  includeDiagnostics: boolean;
  enableAutoCollection: boolean;
  collectionInterval: number; // ms
  onInfoCollected?: (info: DebugInfo) => void;
}

/**
 * 🎯 COLETOR DE INFORMAÇÕES DE DEBUG
 */
export class DebugInfoCollector {
  private config: DebugInfoCollectorConfig;
  private collectionTimer: NodeJS.Timeout | null = null;
  private instanceCounter = 0;

  constructor(config: Partial<DebugInfoCollectorConfig> = {}) {
    this.config = {
      enabled: true,
      includePerformanceMetrics: true,
      includeHealthMetrics: true,
      includeRecentLogs: true,
      maxRecentLogs: 50,
      includeDiagnostics: true,
      enableAutoCollection: false,
      collectionInterval: 60000, // 1 minuto
      ...config
    };

    if (this.config.enabled && this.config.enableAutoCollection) {
      this.startAutoCollection();
    }
  }

  /**
   * Coletar informações de debug para um hook
   */
  collectDebugInfo(params: {
    channelId: string;
    hookType: string;
    config: {
      tables: string[];
      filters?: Record<string, string>;
      enableRealtime?: boolean;
      enablePolling?: boolean;
      enableFetch?: boolean;
      debug?: boolean;
      [key: string]: any;
    };
    state: any;
    channelStats?: any;
    managerStats?: any;
    polling?: any;
    fetch?: any;
  }): DebugInfo {
    if (!this.config.enabled) {
      return this.createEmptyDebugInfo(params.channelId, params.hookType);
    }

    const instanceId = `${params.hookType}-${++this.instanceCounter}`;
    const timestamp = Date.now();

    // Coletar métricas de performance
    let performance: PerformanceMetrics = {
      connectionTime: 0,
      averageEventLatency: 0,
      lastEventLatency: 0,
      fetchDuration: 0,
      averageFetchDuration: 0,
      totalNetworkRequests: 0,
      failedNetworkRequests: 0,
      networkSuccessRate: 1,
      totalBytesTransferred: 0,
      totalEventsReceived: 0,
      eventsPerSecond: 0,
      eventProcessingTime: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      memoryLeaks: 0,
      rerenderCount: 0,
      averageRerenderTime: 0,
      skippedRerenders: 0,
      reconnectCount: 0,
      connectionUptime: 0,
      connectionStability: 1,
      pollingExecutions: 0,
      pollingEfficiency: 0,
      adaptiveIntervalChanges: 0
    };

    if (this.config.includePerformanceMetrics) {
      try {
        performance = performanceMonitor.getMetrics();
      } catch (error) {
        debugLogger.warn('Failed to collect performance metrics', error);
      }
    }

    // Coletar métricas de saúde
    let health: ConnectionHealthMetrics | null = null;
    if (this.config.includeHealthMetrics) {
      try {
        health = connectionHealthMonitor.getHealthMetrics();
      } catch (error) {
        debugLogger.warn('Failed to collect health metrics', error);
      }
    }

    // Coletar logs recentes
    let recentLogs: any[] = [];
    if (this.config.includeRecentLogs) {
      try {
        const logs = debugLogger.getLogs({
          channelId: params.channelId,
          since: timestamp - 300000 // últimos 5 minutos
        });
        
        recentLogs = logs
          .slice(-this.config.maxRecentLogs)
          .map(log => ({
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            data: log.data
          }));
      } catch (error) {
        debugLogger.warn('Failed to collect recent logs', error);
      }
    }

    // Coletar problemas
    const issues = health?.issues.map(issue => ({
      type: issue.type,
      severity: issue.severity,
      description: issue.description,
      firstDetected: issue.firstDetected,
      occurrences: issue.occurrences
    })) || [];

    // Gerar recomendações
    const recommendations = this.generateRecommendations(params, performance, health);

    // Executar diagnósticos
    let diagnostics: DebugInfo['diagnostics'] = {
      networkConnectivity: 'unknown',
      authenticationStatus: 'unknown',
      rateLimitStatus: 'unknown',
      dataIntegrity: 'unknown',
      performanceIssues: []
    };

    if (this.config.includeDiagnostics) {
      diagnostics = this.runDiagnostics(params, performance, health);
    }

    // Construir informações de debug
    const debugInfo: DebugInfo = {
      channelId: params.channelId,
      hookType: params.hookType,
      instanceId,
      timestamp,
      
      config: {
        tables: params.config.tables || [],
        filters: params.config.filters,
        enableRealtime: params.config.enableRealtime !== false,
        enablePolling: params.config.enablePolling !== false,
        enableFetch: params.config.enableFetch !== false,
        debug: params.config.debug || false,
        ...this.sanitizeConfig(params.config)
      },
      
      state: {
        isConnected: params.state.isConnected || false,
        connectionStatus: params.state.connectionStatus || 'disconnected',
        loading: params.state.loading || false,
        error: params.state.error || null,
        dataCount: Array.isArray(params.state.data) ? params.state.data.length : 0,
        lastEventTime: params.state.lastEventTime || null,
        eventsReceived: params.state.eventsReceived || 0,
        reconnectCount: params.state.reconnectCount || 0
      },
      
      channelStats: {
        subscriptionActive: params.channelStats?.subscriptionActive || false,
        tablesMonitored: params.channelStats?.tablesMonitored || params.config.tables || [],
        filtersApplied: params.channelStats?.filtersApplied || params.config.filters || {},
        eventCounts: params.channelStats?.eventCounts || {},
        lastActivity: params.channelStats?.lastActivity || null,
        connectionDuration: params.channelStats?.connectionDuration || 0
      },
      
      managerStats: {
        totalChannels: params.managerStats?.totalChannels || 0,
        activeSubscriptions: params.managerStats?.activeSubscriptions || 0,
        connectionPoolSize: params.managerStats?.connectionPoolSize || 0,
        globalEventCount: params.managerStats?.globalEventCount || 0,
        memoryUsage: params.managerStats?.memoryUsage || 0,
        uptime: params.managerStats?.uptime || 0
      },
      
      performance,
      health,
      
      polling: {
        enabled: params.polling?.enabled || false,
        currentInterval: params.polling?.currentInterval || 0,
        isUserActive: params.polling?.isUserActive || true,
        isDocumentVisible: params.polling?.isDocumentVisible || true,
        executionCount: params.polling?.executionCount || 0,
        lastExecution: params.polling?.lastExecution || null
      },
      
      fetch: {
        enabled: params.fetch?.enabled || false,
        inProgress: params.fetch?.inProgress || false,
        lastFetchTime: params.fetch?.lastFetchTime || null,
        lastFetchReason: params.fetch?.lastFetchReason || null,
        fromCache: params.fetch?.fromCache || false,
        endpoint: params.fetch?.endpoint
      },
      
      recentLogs,
      issues,
      recommendations,
      diagnostics
    };

    // Callback de coleta
    if (this.config.onInfoCollected) {
      try {
        this.config.onInfoCollected(debugInfo);
      } catch (error) {
        debugLogger.error('Error in info collected callback', error);
      }
    }

    debugLogger.debug('Debug info collected', {
      channelId: params.channelId,
      hookType: params.hookType,
      instanceId,
      issueCount: issues.length,
      recommendationCount: recommendations.length
    });

    return debugInfo;
  }

  /**
   * Gerar recomendações baseadas no estado atual
   */
  private generateRecommendations(
    params: any,
    performance: PerformanceMetrics,
    health: ConnectionHealthMetrics | null
  ): string[] {
    const recommendations: string[] = [];

    // Recomendações de performance
    if (performance.averageEventLatency > 500) {
      recommendations.push('High event latency detected - consider optimizing network connection');
    }

    if (performance.rerenderCount > 100) {
      recommendations.push('High rerender count - consider optimizing component updates');
    }

    if (performance.memoryUsage > 50 * 1024 * 1024) { // 50MB
      recommendations.push('High memory usage detected - check for memory leaks');
    }

    if (performance.networkSuccessRate < 0.95) {
      recommendations.push('Low network success rate - verify connection stability');
    }

    // Recomendações de saúde
    if (health) {
      if (health.uptime < 95) {
        recommendations.push('Low connection uptime - investigate connection issues');
      }

      if (health.reconnectRate > 2) {
        recommendations.push('High reconnection rate - check network stability');
      }

      if (health.eventLossRate > 1) {
        recommendations.push('Data loss detected - verify network reliability');
      }

      recommendations.push(...health.recommendations);
    }

    // Recomendações de configuração
    if (params.config.tables?.length > 10) {
      recommendations.push('Monitoring many tables - consider filtering to reduce load');
    }

    if (params.config.enablePolling && params.config.enableRealtime) {
      recommendations.push('Both polling and realtime enabled - consider using only realtime for better performance');
    }

    if (!params.config.debug && (performance.reconnectCount > 5 || health?.issues.length > 0)) {
      recommendations.push('Enable debug mode for better troubleshooting');
    }

    return recommendations;
  }

  /**
   * Executar diagnósticos
   */
  private runDiagnostics(
    params: any,
    performance: PerformanceMetrics,
    health: ConnectionHealthMetrics | null
  ): DebugInfo['diagnostics'] {
    const diagnostics: DebugInfo['diagnostics'] = {
      networkConnectivity: 'unknown',
      authenticationStatus: 'unknown',
      rateLimitStatus: 'unknown',
      dataIntegrity: 'unknown',
      performanceIssues: []
    };

    // Diagnóstico de conectividade
    if (health) {
      if (health.uptime > 95 && health.averageLatency < 300) {
        diagnostics.networkConnectivity = 'good';
      } else if (health.uptime < 80 || health.averageLatency > 1000) {
        diagnostics.networkConnectivity = 'poor';
      }
    }

    // Diagnóstico de autenticação
    const authIssues = health?.issues.filter(i => i.type === 'authentication') || [];
    if (authIssues.length === 0 && params.state.isConnected) {
      diagnostics.authenticationStatus = 'valid';
    } else if (authIssues.length > 0) {
      diagnostics.authenticationStatus = 'invalid';
    }

    // Diagnóstico de rate limit
    const rateLimitIssues = health?.issues.filter(i => i.type === 'rate_limit') || [];
    if (rateLimitIssues.length === 0) {
      diagnostics.rateLimitStatus = 'ok';
    } else {
      diagnostics.rateLimitStatus = 'throttled';
    }

    // Diagnóstico de integridade dos dados
    if (health) {
      if (health.eventLossRate < 0.1 && health.duplicateEventRate < 0.1) {
        diagnostics.dataIntegrity = 'good';
      } else if (health.eventLossRate > 1 || health.duplicateEventRate > 1) {
        diagnostics.dataIntegrity = 'issues';
      }
    }

    // Problemas de performance
    if (performance.averageEventLatency > 500) {
      diagnostics.performanceIssues.push('High event latency');
    }

    if (performance.rerenderCount > 100) {
      diagnostics.performanceIssues.push('Excessive rerenders');
    }

    if (performance.memoryLeaks > 0) {
      diagnostics.performanceIssues.push('Memory leaks detected');
    }

    if (performance.networkSuccessRate < 0.9) {
      diagnostics.performanceIssues.push('Network reliability issues');
    }

    return diagnostics;
  }

  /**
   * Sanitizar configuração para debug
   */
  private sanitizeConfig(config: any): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    // Incluir apenas propriedades seguras
    const safeProps = [
      'activeInterval', 'inactiveInterval', 'focusInterval', 'blurInterval',
      'initialFetch', 'cacheTimeout', 'startDate', 'endDate'
    ];

    safeProps.forEach(prop => {
      if (config[prop] !== undefined) {
        sanitized[prop] = config[prop];
      }
    });

    return sanitized;
  }

  /**
   * Criar informações de debug vazias
   */
  private createEmptyDebugInfo(channelId: string, hookType: string): DebugInfo {
    return {
      channelId,
      hookType,
      instanceId: 'disabled',
      timestamp: Date.now(),
      config: {
        tables: [],
        enableRealtime: false,
        enablePolling: false,
        enableFetch: false,
        debug: false
      },
      state: {
        isConnected: false,
        connectionStatus: 'disabled',
        loading: false,
        error: null,
        dataCount: 0,
        lastEventTime: null,
        eventsReceived: 0,
        reconnectCount: 0
      },
      channelStats: {
        subscriptionActive: false,
        tablesMonitored: [],
        filtersApplied: {},
        eventCounts: {},
        lastActivity: null,
        connectionDuration: 0
      },
      managerStats: {
        totalChannels: 0,
        activeSubscriptions: 0,
        connectionPoolSize: 0,
        globalEventCount: 0,
        memoryUsage: 0,
        uptime: 0
      },
      performance: {
        connectionTime: 0,
        averageEventLatency: 0,
        lastEventLatency: 0,
        fetchDuration: 0,
        averageFetchDuration: 0,
        totalNetworkRequests: 0,
        failedNetworkRequests: 0,
        networkSuccessRate: 1,
        totalBytesTransferred: 0,
        totalEventsReceived: 0,
        eventsPerSecond: 0,
        eventProcessingTime: 0,
        memoryUsage: 0,
        peakMemoryUsage: 0,
        memoryLeaks: 0,
        rerenderCount: 0,
        averageRerenderTime: 0,
        skippedRerenders: 0,
        reconnectCount: 0,
        connectionUptime: 0,
        connectionStability: 1,
        pollingExecutions: 0,
        pollingEfficiency: 0,
        adaptiveIntervalChanges: 0
      },
      health: null,
      polling: {
        enabled: false,
        currentInterval: 0,
        isUserActive: true,
        isDocumentVisible: true,
        executionCount: 0,
        lastExecution: null
      },
      fetch: {
        enabled: false,
        inProgress: false,
        lastFetchTime: null,
        lastFetchReason: null,
        fromCache: false
      },
      recentLogs: [],
      issues: [],
      recommendations: ['Debug collection is disabled'],
      diagnostics: {
        networkConnectivity: 'unknown',
        authenticationStatus: 'unknown',
        rateLimitStatus: 'unknown',
        dataIntegrity: 'unknown',
        performanceIssues: []
      }
    };
  }

  /**
   * Iniciar coleta automática
   */
  private startAutoCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }

    this.collectionTimer = setInterval(() => {
      // A coleta automática seria implementada aqui
      // Por enquanto, apenas log de debug
      debugLogger.debug('Auto collection interval triggered');
    }, this.config.collectionInterval);
  }

  /**
   * Parar coleta automática
   */
  stopAutoCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  /**
   * Exportar informações de debug como JSON
   */
  exportDebugInfo(debugInfo: DebugInfo): string {
    return JSON.stringify(debugInfo, null, 2);
  }

  /**
   * Gerar relatório de debug formatado
   */
  generateDebugReport(debugInfo: DebugInfo): string {
    const report = [
      `# Debug Report - ${debugInfo.hookType}`,
      `Generated: ${new Date(debugInfo.timestamp).toISOString()}`,
      `Channel ID: ${debugInfo.channelId}`,
      `Instance ID: ${debugInfo.instanceId}`,
      '',
      '## Configuration',
      `Tables: ${debugInfo.config.tables.join(', ')}`,
      `Realtime: ${debugInfo.config.enableRealtime}`,
      `Polling: ${debugInfo.config.enablePolling}`,
      `Fetch: ${debugInfo.config.enableFetch}`,
      `Debug: ${debugInfo.config.debug}`,
      '',
      '## Current State',
      `Connected: ${debugInfo.state.isConnected}`,
      `Status: ${debugInfo.state.connectionStatus}`,
      `Loading: ${debugInfo.state.loading}`,
      `Error: ${debugInfo.state.error || 'None'}`,
      `Data Count: ${debugInfo.state.dataCount}`,
      `Events Received: ${debugInfo.state.eventsReceived}`,
      `Reconnects: ${debugInfo.state.reconnectCount}`,
      '',
      '## Performance',
      `Average Latency: ${debugInfo.performance.averageEventLatency.toFixed(2)}ms`,
      `Network Success Rate: ${(debugInfo.performance.networkSuccessRate * 100).toFixed(1)}%`,
      `Memory Usage: ${(debugInfo.performance.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      `Rerenders: ${debugInfo.performance.rerenderCount}`,
      '',
      '## Health',
      debugInfo.health ? [
        `Status: ${debugInfo.health.status}`,
        `Score: ${debugInfo.health.score}/100`,
        `Uptime: ${debugInfo.health.uptime.toFixed(1)}%`,
        `Network Quality: ${debugInfo.health.networkQuality}`
      ].join('\n') : 'Health monitoring not available',
      '',
      '## Issues',
      debugInfo.issues.length > 0 
        ? debugInfo.issues.map(issue => `- ${issue.severity.toUpperCase()}: ${issue.description}`).join('\n')
        : 'No issues detected',
      '',
      '## Recommendations',
      debugInfo.recommendations.length > 0
        ? debugInfo.recommendations.map(rec => `- ${rec}`).join('\n')
        : 'No recommendations',
      '',
      '## Diagnostics',
      `Network: ${debugInfo.diagnostics.networkConnectivity}`,
      `Authentication: ${debugInfo.diagnostics.authenticationStatus}`,
      `Rate Limit: ${debugInfo.diagnostics.rateLimitStatus}`,
      `Data Integrity: ${debugInfo.diagnostics.dataIntegrity}`,
      debugInfo.diagnostics.performanceIssues.length > 0
        ? `Performance Issues: ${debugInfo.diagnostics.performanceIssues.join(', ')}`
        : 'No performance issues'
    ].join('\n');

    return report;
  }

  /**
   * Atualizar configuração
   */
  updateConfig(newConfig: Partial<DebugInfoCollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reinicializar coleta automática se necessário
    if (this.config.enableAutoCollection) {
      this.startAutoCollection();
    } else {
      this.stopAutoCollection();
    }

    debugLogger.debug('Debug info collector config updated', this.config);
  }

  /**
   * Destruir coletor
   */
  destroy(): void {
    this.stopAutoCollection();
    debugLogger.info('Debug info collector destroyed');
  }
}

// 🎯 INSTÂNCIA GLOBAL DO COLETOR
let globalDebugInfoCollector: DebugInfoCollector | null = null;

/**
 * Obter instância global do coletor
 */
export function getDebugInfoCollector(config?: Partial<DebugInfoCollectorConfig>): DebugInfoCollector {
  if (!globalDebugInfoCollector) {
    globalDebugInfoCollector = new DebugInfoCollector(config);
  } else if (config) {
    globalDebugInfoCollector.updateConfig(config);
  }
  
  return globalDebugInfoCollector;
}

/**
 * Funções de conveniência para coleta de debug
 */
export const debugInfoCollector = {
  collect: (params: Parameters<DebugInfoCollector['collectDebugInfo']>[0]) =>
    getDebugInfoCollector().collectDebugInfo(params),
  
  export: (debugInfo: DebugInfo) =>
    getDebugInfoCollector().exportDebugInfo(debugInfo),
  
  generateReport: (debugInfo: DebugInfo) =>
    getDebugInfoCollector().generateDebugReport(debugInfo),
  
  destroy: () => getDebugInfoCollector().destroy()
};