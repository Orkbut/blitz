/**
 * 📊 SISTEMA DE MONITORAMENTO DE PERFORMANCE REALTIME
 * 
 * Coleta métricas detalhadas de performance para hooks realtime,
 * incluindo timing, uso de memória, e estatísticas de rede.
 */

import { debugLogger } from './debug-logger';

// 🎯 MÉTRICAS DE PERFORMANCE
export interface PerformanceMetrics {
  // Timing
  connectionTime: number;
  averageEventLatency: number;
  lastEventLatency: number;
  fetchDuration: number;
  averageFetchDuration: number;
  
  // Network
  totalNetworkRequests: number;
  failedNetworkRequests: number;
  networkSuccessRate: number;
  totalBytesTransferred: number;
  
  // Events
  totalEventsReceived: number;
  eventsPerSecond: number;
  eventProcessingTime: number;
  
  // Memory
  memoryUsage: number;
  peakMemoryUsage: number;
  memoryLeaks: number;
  
  // Rendering
  rerenderCount: number;
  averageRerenderTime: number;
  skippedRerenders: number;
  
  // Connection
  reconnectCount: number;
  connectionUptime: number;
  connectionStability: number;
  
  // Polling
  pollingExecutions: number;
  pollingEfficiency: number;
  adaptiveIntervalChanges: number;
}

// 🎯 CONFIGURAÇÃO DO MONITOR
export interface PerformanceMonitorConfig {
  enabled: boolean;
  collectMemoryMetrics: boolean;
  collectNetworkMetrics: boolean;
  collectRenderMetrics: boolean;
  sampleRate: number; // 0-1, porcentagem de eventos para amostrar
  maxSamples: number;
  reportInterval: number; // ms
  enableReporting: boolean;
  onReport?: (metrics: PerformanceMetrics) => void;
}

// 🎯 AMOSTRA DE TIMING
interface TimingSample {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

// 🎯 AMOSTRA DE EVENTO
interface EventSample {
  timestamp: number;
  type: string;
  latency: number;
  size?: number;
  processed: boolean;
}

// 🎯 AMOSTRA DE REDE
interface NetworkSample {
  timestamp: number;
  url: string;
  method: string;
  duration: number;
  success: boolean;
  size: number;
  cached: boolean;
}

// 🎯 AMOSTRA DE RENDER
interface RenderSample {
  timestamp: number;
  componentName: string;
  duration: number;
  reason: string;
  skipped: boolean;
}

/**
 * 🎯 MONITOR DE PERFORMANCE REALTIME
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private timingSamples: TimingSample[] = [];
  private eventSamples: EventSample[] = [];
  private networkSamples: NetworkSample[] = [];
  private renderSamples: RenderSample[] = [];
  private activeTimers: Map<string, number> = new Map();
  private reportTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private lastReportTime = Date.now();
  
  // Contadores
  private counters = {
    totalEvents: 0,
    totalNetworkRequests: 0,
    failedNetworkRequests: 0,
    totalRerenders: 0,
    skippedRerenders: 0,
    reconnects: 0,
    pollingExecutions: 0,
    adaptiveChanges: 0,
    memoryLeaks: 0
  };

  // Métricas de memória
  private memoryBaseline = 0;
  private peakMemory = 0;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = {
      enabled: true,
      collectMemoryMetrics: true,
      collectNetworkMetrics: true,
      collectRenderMetrics: true,
      sampleRate: 1.0,
      maxSamples: 1000,
      reportInterval: 30000, // 30 segundos
      enableReporting: false,
      ...config
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Inicializar monitor
   */
  private initialize(): void {
    // Baseline de memória
    if (this.config.collectMemoryMetrics && typeof performance !== 'undefined' && (performance as any).memory) {
      this.memoryBaseline = (performance as any).memory.usedJSHeapSize;
      this.peakMemory = this.memoryBaseline;
    }

    // Timer de relatório
    if (this.config.enableReporting && this.config.reportInterval > 0) {
      this.reportTimer = setInterval(() => {
        this.generateReport();
      }, this.config.reportInterval);
    }

    debugLogger.debug('Performance monitor initialized', {
      config: this.config,
      memoryBaseline: this.memoryBaseline
    });
  }

  /**
   * Iniciar timing de operação
   */
  startTiming(operation: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled || !this.shouldSample()) return;

    const timerId = `${operation}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(timerId, Date.now());

    debugLogger.trace(`Started timing: ${operation}`, { timerId, metadata });
  }

  /**
   * Finalizar timing de operação
   */
  endTiming(operation: string, success: boolean = true, metadata?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const timerId = Array.from(this.activeTimers.keys()).find(id => id.startsWith(operation));
    
    if (!timerId) {
      debugLogger.warn(`No active timer found for operation: ${operation}`);
      return;
    }

    const startTime = this.activeTimers.get(timerId)!;
    const duration = now - startTime;
    
    this.activeTimers.delete(timerId);

    const sample: TimingSample = {
      operation,
      startTime,
      endTime: now,
      duration,
      success,
      metadata
    };

    this.addTimingSample(sample);

    debugLogger.trace(`Ended timing: ${operation}`, {
      duration,
      success,
      metadata
    });
  }

  /**
   * Registrar evento de banco de dados
   */
  recordDatabaseEvent(type: string, latency: number, size?: number): void {
    if (!this.config.enabled || !this.shouldSample()) return;

    this.counters.totalEvents++;

    const sample: EventSample = {
      timestamp: Date.now(),
      type,
      latency,
      size,
      processed: true
    };

    this.addEventSample(sample);

    debugLogger.trace('Database event recorded', sample);
  }

  /**
   * Registrar requisição de rede
   */
  recordNetworkRequest(
    url: string,
    method: string,
    duration: number,
    success: boolean,
    size: number = 0,
    cached: boolean = false
  ): void {
    if (!this.config.enabled || !this.config.collectNetworkMetrics) return;

    this.counters.totalNetworkRequests++;
    if (!success) {
      this.counters.failedNetworkRequests++;
    }

    if (this.shouldSample()) {
      const sample: NetworkSample = {
        timestamp: Date.now(),
        url,
        method,
        duration,
        success,
        size,
        cached
      };

      this.addNetworkSample(sample);
    }

    debugLogger.trace('Network request recorded', {
      url,
      method,
      duration,
      success,
      size,
      cached
    });
  }

  /**
   * Registrar render de componente
   */
  recordRender(componentName: string, duration: number, reason: string, skipped: boolean = false): void {
    if (!this.config.enabled || !this.config.collectRenderMetrics) return;

    this.counters.totalRerenders++;
    if (skipped) {
      this.counters.skippedRerenders++;
    }

    if (this.shouldSample()) {
      const sample: RenderSample = {
        timestamp: Date.now(),
        componentName,
        duration,
        reason,
        skipped
      };

      this.addRenderSample(sample);
    }

    debugLogger.trace('Render recorded', {
      componentName,
      duration,
      reason,
      skipped
    });
  }

  /**
   * Registrar reconexão
   */
  recordReconnect(): void {
    if (!this.config.enabled) return;

    this.counters.reconnects++;
    debugLogger.debug('Reconnect recorded', {
      totalReconnects: this.counters.reconnects
    });
  }

  /**
   * Registrar execução de polling
   */
  recordPollingExecution(): void {
    if (!this.config.enabled) return;

    this.counters.pollingExecutions++;
  }

  /**
   * Registrar mudança de intervalo adaptivo
   */
  recordAdaptiveIntervalChange(oldInterval: number, newInterval: number, reason: string): void {
    if (!this.config.enabled) return;

    this.counters.adaptiveChanges++;
    debugLogger.debug('Adaptive interval changed', {
      oldInterval,
      newInterval,
      reason,
      totalChanges: this.counters.adaptiveChanges
    });
  }

  /**
   * Verificar vazamento de memória
   */
  checkMemoryLeak(): void {
    if (!this.config.enabled || !this.config.collectMemoryMetrics) return;

    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const currentMemory = (performance as any).memory.usedJSHeapSize;
      const memoryIncrease = currentMemory - this.memoryBaseline;
      
      // Atualizar pico de memória
      if (currentMemory > this.peakMemory) {
        this.peakMemory = currentMemory;
      }

      // Detectar possível vazamento (aumento > 50MB)
      if (memoryIncrease > 50 * 1024 * 1024) {
        this.counters.memoryLeaks++;
        debugLogger.warn('Potential memory leak detected', {
          baseline: this.memoryBaseline,
          current: currentMemory,
          increase: memoryIncrease,
          leakCount: this.counters.memoryLeaks
        });
      }
    }
  }

  /**
   * Gerar relatório de métricas
   */
  generateReport(): PerformanceMetrics {
    const now = Date.now();
    const uptime = now - this.startTime;
    const reportPeriod = now - this.lastReportTime;

    // Calcular métricas de timing
    const connectionSamples = this.timingSamples.filter(s => s.operation === 'connection');
    const fetchSamples = this.timingSamples.filter(s => s.operation === 'fetch');
    
    const avgConnectionTime = connectionSamples.length > 0 
      ? connectionSamples.reduce((sum, s) => sum + s.duration, 0) / connectionSamples.length 
      : 0;

    const avgFetchDuration = fetchSamples.length > 0
      ? fetchSamples.reduce((sum, s) => sum + s.duration, 0) / fetchSamples.length
      : 0;

    // Calcular métricas de eventos
    const recentEvents = this.eventSamples.filter(e => e.timestamp > now - reportPeriod);
    const eventsPerSecond = recentEvents.length / (reportPeriod / 1000);
    
    const avgEventLatency = this.eventSamples.length > 0
      ? this.eventSamples.reduce((sum, e) => sum + e.latency, 0) / this.eventSamples.length
      : 0;

    const lastEventLatency = this.eventSamples.length > 0
      ? this.eventSamples[this.eventSamples.length - 1].latency
      : 0;

    // Calcular métricas de rede
    const networkSuccessRate = this.counters.totalNetworkRequests > 0
      ? (this.counters.totalNetworkRequests - this.counters.failedNetworkRequests) / this.counters.totalNetworkRequests
      : 1;

    const totalBytesTransferred = this.networkSamples.reduce((sum, s) => sum + s.size, 0);

    // Calcular métricas de render
    const avgRerenderTime = this.renderSamples.length > 0
      ? this.renderSamples.reduce((sum, r) => sum + r.duration, 0) / this.renderSamples.length
      : 0;

    // Calcular métricas de memória
    let currentMemory = 0;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      currentMemory = (performance as any).memory.usedJSHeapSize - this.memoryBaseline;
    }

    // Calcular estabilidade da conexão
    const connectionStability = this.counters.reconnects > 0
      ? Math.max(0, 1 - (this.counters.reconnects / (uptime / 60000))) // reconexões por minuto
      : 1;

    // Calcular eficiência do polling
    const pollingEfficiency = this.counters.pollingExecutions > 0
      ? this.counters.totalEvents / this.counters.pollingExecutions
      : 0;

    const metrics: PerformanceMetrics = {
      // Timing
      connectionTime: avgConnectionTime,
      averageEventLatency: avgEventLatency,
      lastEventLatency,
      fetchDuration: fetchSamples.length > 0 ? fetchSamples[fetchSamples.length - 1].duration : 0,
      averageFetchDuration: avgFetchDuration,
      
      // Network
      totalNetworkRequests: this.counters.totalNetworkRequests,
      failedNetworkRequests: this.counters.failedNetworkRequests,
      networkSuccessRate,
      totalBytesTransferred,
      
      // Events
      totalEventsReceived: this.counters.totalEvents,
      eventsPerSecond,
      eventProcessingTime: avgEventLatency,
      
      // Memory
      memoryUsage: currentMemory,
      peakMemoryUsage: this.peakMemory - this.memoryBaseline,
      memoryLeaks: this.counters.memoryLeaks,
      
      // Rendering
      rerenderCount: this.counters.totalRerenders,
      averageRerenderTime: avgRerenderTime,
      skippedRerenders: this.counters.skippedRerenders,
      
      // Connection
      reconnectCount: this.counters.reconnects,
      connectionUptime: uptime,
      connectionStability,
      
      // Polling
      pollingExecutions: this.counters.pollingExecutions,
      pollingEfficiency,
      adaptiveIntervalChanges: this.counters.adaptiveChanges
    };

    this.lastReportTime = now;

    // Callback de relatório
    if (this.config.onReport) {
      try {
        this.config.onReport(metrics);
      } catch (error) {
        debugLogger.error('Error in performance report callback', error);
      }
    }

    debugLogger.info('Performance report generated', metrics);

    return metrics;
  }

  /**
   * Obter métricas atuais
   */
  getMetrics(): PerformanceMetrics {
    return this.generateReport();
  }

  /**
   * Limpar dados coletados
   */
  clearData(): void {
    this.timingSamples = [];
    this.eventSamples = [];
    this.networkSamples = [];
    this.renderSamples = [];
    this.activeTimers.clear();
    
    // Reset contadores
    Object.keys(this.counters).forEach(key => {
      (this.counters as any)[key] = 0;
    });

    this.startTime = Date.now();
    this.lastReportTime = Date.now();

    debugLogger.info('Performance data cleared');
  }

  /**
   * Destruir monitor
   */
  destroy(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    this.clearData();
    debugLogger.info('Performance monitor destroyed');
  }

  /**
   * Atualizar configuração
   */
  updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinicializar timer de relatório se necessário
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    if (this.config.enableReporting && this.config.reportInterval > 0) {
      this.reportTimer = setInterval(() => {
        this.generateReport();
      }, this.config.reportInterval);
    }

    debugLogger.debug('Performance monitor config updated', this.config);
  }

  /**
   * Verificar se deve amostrar
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Adicionar amostra de timing
   */
  private addTimingSample(sample: TimingSample): void {
    this.timingSamples.push(sample);
    if (this.timingSamples.length > this.config.maxSamples) {
      this.timingSamples.shift();
    }
  }

  /**
   * Adicionar amostra de evento
   */
  private addEventSample(sample: EventSample): void {
    this.eventSamples.push(sample);
    if (this.eventSamples.length > this.config.maxSamples) {
      this.eventSamples.shift();
    }
  }

  /**
   * Adicionar amostra de rede
   */
  private addNetworkSample(sample: NetworkSample): void {
    this.networkSamples.push(sample);
    if (this.networkSamples.length > this.config.maxSamples) {
      this.networkSamples.shift();
    }
  }

  /**
   * Adicionar amostra de render
   */
  private addRenderSample(sample: RenderSample): void {
    this.renderSamples.push(sample);
    if (this.renderSamples.length > this.config.maxSamples) {
      this.renderSamples.shift();
    }
  }
}

// 🎯 INSTÂNCIA GLOBAL DO MONITOR
let globalPerformanceMonitor: PerformanceMonitor | null = null;

/**
 * Obter instância global do monitor
 */
export function getPerformanceMonitor(config?: Partial<PerformanceMonitorConfig>): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor(config);
  } else if (config) {
    globalPerformanceMonitor.updateConfig(config);
  }
  
  return globalPerformanceMonitor;
}

/**
 * Funções de conveniência para monitoramento
 */
export const performanceMonitor = {
  startTiming: (operation: string, metadata?: Record<string, any>) =>
    getPerformanceMonitor().startTiming(operation, metadata),
  
  endTiming: (operation: string, success?: boolean, metadata?: Record<string, any>) =>
    getPerformanceMonitor().endTiming(operation, success, metadata),
  
  recordDatabaseEvent: (type: string, latency: number, size?: number) =>
    getPerformanceMonitor().recordDatabaseEvent(type, latency, size),
  
  recordNetworkRequest: (url: string, method: string, duration: number, success: boolean, size?: number, cached?: boolean) =>
    getPerformanceMonitor().recordNetworkRequest(url, method, duration, success, size, cached),
  
  recordRender: (componentName: string, duration: number, reason: string, skipped?: boolean) =>
    getPerformanceMonitor().recordRender(componentName, duration, reason, skipped),
  
  recordReconnect: () => getPerformanceMonitor().recordReconnect(),
  
  recordPollingExecution: () => getPerformanceMonitor().recordPollingExecution(),
  
  recordAdaptiveIntervalChange: (oldInterval: number, newInterval: number, reason: string) =>
    getPerformanceMonitor().recordAdaptiveIntervalChange(oldInterval, newInterval, reason),
  
  checkMemoryLeak: () => getPerformanceMonitor().checkMemoryLeak(),
  
  getMetrics: () => getPerformanceMonitor().getMetrics(),
  
  clearData: () => getPerformanceMonitor().clearData(),
  
  destroy: () => getPerformanceMonitor().destroy()
};