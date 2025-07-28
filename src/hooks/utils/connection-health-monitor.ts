/**
 * 🏥 SISTEMA DE MONITORAMENTO DE SAÚDE DA CONEXÃO REALTIME
 * 
 * Monitora a saúde das conexões realtime, detecta problemas,
 * e fornece insights sobre a qualidade da conexão.
 */

import { debugLogger } from './debug-logger';
import { performanceMonitor } from './performance-monitor';

// 🎯 STATUS DE SAÚDE DA CONEXÃO
export enum ConnectionHealthStatus {
  EXCELLENT = 'EXCELLENT',     // < 100ms latência, 99%+ uptime
  GOOD = 'GOOD',              // < 300ms latência, 95%+ uptime
  FAIR = 'FAIR',              // < 500ms latência, 90%+ uptime
  POOR = 'POOR',              // < 1000ms latência, 80%+ uptime
  CRITICAL = 'CRITICAL'       // > 1000ms latência ou < 80% uptime
}

// 🎯 MÉTRICAS DE SAÚDE
export interface ConnectionHealthMetrics {
  status: ConnectionHealthStatus;
  score: number; // 0-100
  
  // Latência
  averageLatency: number;
  currentLatency: number;
  latencyTrend: 'improving' | 'stable' | 'degrading';
  
  // Uptime
  uptime: number; // porcentagem
  totalUptime: number; // ms
  totalDowntime: number; // ms
  
  // Estabilidade
  reconnectCount: number;
  reconnectRate: number; // reconexões por hora
  longestConnection: number; // ms
  averageConnectionDuration: number; // ms
  
  // Qualidade dos dados
  eventLossRate: number; // porcentagem de eventos perdidos
  duplicateEventRate: number; // porcentagem de eventos duplicados
  eventOrderingIssues: number;
  
  // Rede
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  bandwidthUtilization: number; // bytes/s
  packetLoss: number; // porcentagem estimada
  
  // Problemas detectados
  issues: ConnectionIssue[];
  recommendations: string[];
}

// 🎯 PROBLEMA DE CONEXÃO
export interface ConnectionIssue {
  type: 'latency' | 'stability' | 'data_loss' | 'network' | 'authentication' | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  firstDetected: number;
  lastDetected: number;
  occurrences: number;
  resolved: boolean;
  resolutionTime?: number;
}

// 🎯 CONFIGURAÇÃO DO MONITOR DE SAÚDE
export interface ConnectionHealthConfig {
  enabled: boolean;
  checkInterval: number; // ms
  latencyThresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  uptimeThresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  maxIssueHistory: number;
  enableAutoRecovery: boolean;
  onHealthChange?: (metrics: ConnectionHealthMetrics) => void;
  onIssueDetected?: (issue: ConnectionIssue) => void;
  onIssueResolved?: (issue: ConnectionIssue) => void;
}

// 🎯 AMOSTRA DE LATÊNCIA
interface LatencySample {
  timestamp: number;
  latency: number;
  eventType: string;
}

// 🎯 EVENTO DE CONEXÃO
interface ConnectionEvent {
  timestamp: number;
  type: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  duration?: number; // para eventos de conexão/desconexão
  error?: string;
}

// 🎯 EVENTO DE DADOS
interface DataEvent {
  timestamp: number;
  type: 'received' | 'lost' | 'duplicate' | 'out_of_order';
  eventId?: string;
  table?: string;
  size?: number;
}

/**
 * 🎯 MONITOR DE SAÚDE DA CONEXÃO
 */
export class ConnectionHealthMonitor {
  private config: ConnectionHealthConfig;
  private latencySamples: LatencySample[] = [];
  private connectionEvents: ConnectionEvent[] = [];
  private dataEvents: DataEvent[] = [];
  private issues: Map<string, ConnectionIssue> = new Map();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private lastHealthCheck = Date.now();
  private currentConnectionStart = Date.now();
  private isConnected = false;
  
  // Contadores
  private counters = {
    totalConnections: 0,
    totalReconnects: 0,
    totalEvents: 0,
    lostEvents: 0,
    duplicateEvents: 0,
    orderingIssues: 0,
    totalBytes: 0
  };

  // Estado atual
  private currentMetrics: ConnectionHealthMetrics | null = null;

  constructor(config: Partial<ConnectionHealthConfig> = {}) {
    this.config = {
      enabled: true,
      checkInterval: 10000, // 10 segundos
      latencyThresholds: {
        excellent: 100,
        good: 300,
        fair: 500,
        poor: 1000
      },
      uptimeThresholds: {
        excellent: 99,
        good: 95,
        fair: 90,
        poor: 80
      },
      maxIssueHistory: 100,
      enableAutoRecovery: true,
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
    // Timer de verificação de saúde
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    debugLogger.debug('Connection health monitor initialized', {
      config: this.config
    });
  }

  /**
   * Registrar evento de conexão
   */
  recordConnectionEvent(
    type: 'connected' | 'disconnected' | 'reconnecting' | 'error',
    error?: string
  ): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const event: ConnectionEvent = {
      timestamp: now,
      type,
      error
    };

    // Calcular duração para eventos de desconexão
    if (type === 'disconnected' && this.isConnected) {
      event.duration = now - this.currentConnectionStart;
    }

    // Atualizar estado
    if (type === 'connected') {
      this.isConnected = true;
      this.currentConnectionStart = now;
      this.counters.totalConnections++;
      
      // Resolver problemas de conectividade
      this.resolveIssue('connection-lost');
      this.resolveIssue('authentication-failed');
      
    } else if (type === 'disconnected') {
      this.isConnected = false;
      
      // Detectar problema de perda de conexão
      this.detectIssue({
        type: 'stability',
        severity: 'medium',
        description: 'Connection lost unexpectedly',
        key: 'connection-lost'
      });
      
    } else if (type === 'reconnecting') {
      this.counters.totalReconnects++;
      
    } else if (type === 'error') {
      // Detectar problemas baseados no erro
      if (error?.includes('auth')) {
        this.detectIssue({
          type: 'authentication',
          severity: 'high',
          description: `Authentication error: ${error}`,
          key: 'authentication-failed'
        });
      } else if (error?.includes('rate')) {
        this.detectIssue({
          type: 'rate_limit',
          severity: 'medium',
          description: `Rate limit exceeded: ${error}`,
          key: 'rate-limit-exceeded'
        });
      }
    }

    this.connectionEvents.push(event);
    this.limitArraySize(this.connectionEvents, 1000);

    debugLogger.debug('Connection event recorded', event);
  }

  /**
   * Registrar latência de evento
   */
  recordEventLatency(eventType: string, latency: number): void {
    if (!this.config.enabled) return;

    const sample: LatencySample = {
      timestamp: Date.now(),
      latency,
      eventType
    };

    this.latencySamples.push(sample);
    this.limitArraySize(this.latencySamples, 1000);

    // Detectar problemas de latência
    if (latency > this.config.latencyThresholds.poor) {
      this.detectIssue({
        type: 'latency',
        severity: latency > 2000 ? 'critical' : 'high',
        description: `High latency detected: ${latency}ms`,
        key: 'high-latency'
      });
    } else if (latency < this.config.latencyThresholds.good) {
      // Resolver problema de latência se melhorou
      this.resolveIssue('high-latency');
    }

    debugLogger.trace('Event latency recorded', sample);
  }

  /**
   * Registrar evento de dados
   */
  recordDataEvent(
    type: 'received' | 'lost' | 'duplicate' | 'out_of_order',
    eventId?: string,
    table?: string,
    size?: number
  ): void {
    if (!this.config.enabled) return;

    const event: DataEvent = {
      timestamp: Date.now(),
      type,
      eventId,
      table,
      size
    };

    this.dataEvents.push(event);
    this.limitArraySize(this.dataEvents, 1000);

    // Atualizar contadores
    this.counters.totalEvents++;
    if (size) {
      this.counters.totalBytes += size;
    }

    switch (type) {
      case 'lost':
        this.counters.lostEvents++;
        this.detectIssue({
          type: 'data_loss',
          severity: 'medium',
          description: `Data event lost: ${eventId || 'unknown'}`,
          key: 'data-loss'
        });
        break;
        
      case 'duplicate':
        this.counters.duplicateEvents++;
        this.detectIssue({
          type: 'data_loss',
          severity: 'low',
          description: `Duplicate event received: ${eventId || 'unknown'}`,
          key: 'duplicate-events'
        });
        break;
        
      case 'out_of_order':
        this.counters.orderingIssues++;
        this.detectIssue({
          type: 'data_loss',
          severity: 'low',
          description: `Event received out of order: ${eventId || 'unknown'}`,
          key: 'ordering-issues'
        });
        break;
    }

    debugLogger.trace('Data event recorded', event);
  }

  /**
   * Registrar uso de largura de banda
   */
  recordBandwidthUsage(bytes: number): void {
    if (!this.config.enabled) return;

    this.counters.totalBytes += bytes;
  }

  /**
   * Realizar verificação de saúde
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const timeSinceStart = now - this.startTime;
    const timeSinceLastCheck = now - this.lastHealthCheck;

    // Calcular métricas de latência
    const recentLatency = this.latencySamples.filter(s => s.timestamp > now - 60000); // último minuto
    const averageLatency = recentLatency.length > 0
      ? recentLatency.reduce((sum, s) => sum + s.latency, 0) / recentLatency.length
      : 0;
    
    const currentLatency = recentLatency.length > 0
      ? recentLatency[recentLatency.length - 1].latency
      : 0;

    // Calcular tendência de latência
    const oldLatency = this.latencySamples.filter(s => s.timestamp > now - 120000 && s.timestamp <= now - 60000);
    const oldAverageLatency = oldLatency.length > 0
      ? oldLatency.reduce((sum, s) => sum + s.latency, 0) / oldLatency.length
      : averageLatency;

    let latencyTrend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (averageLatency < oldAverageLatency * 0.9) {
      latencyTrend = 'improving';
    } else if (averageLatency > oldAverageLatency * 1.1) {
      latencyTrend = 'degrading';
    }

    // Calcular uptime
    const connectionDurations = this.connectionEvents
      .filter(e => e.type === 'disconnected' && e.duration)
      .map(e => e.duration!);
    
    const totalConnectionTime = connectionDurations.reduce((sum, d) => sum + d, 0);
    const currentConnectionTime = this.isConnected ? now - this.currentConnectionStart : 0;
    const totalUptime = totalConnectionTime + currentConnectionTime;
    const uptime = timeSinceStart > 0 ? (totalUptime / timeSinceStart) * 100 : 100;

    // Calcular métricas de reconexão
    const reconnectRate = timeSinceStart > 0 
      ? (this.counters.totalReconnects / (timeSinceStart / 3600000)) // por hora
      : 0;

    const longestConnection = Math.max(...connectionDurations, currentConnectionTime);
    const averageConnectionDuration = connectionDurations.length > 0
      ? connectionDurations.reduce((sum, d) => sum + d, 0) / connectionDurations.length
      : currentConnectionTime;

    // Calcular taxas de perda de dados
    const eventLossRate = this.counters.totalEvents > 0
      ? (this.counters.lostEvents / this.counters.totalEvents) * 100
      : 0;

    const duplicateEventRate = this.counters.totalEvents > 0
      ? (this.counters.duplicateEvents / this.counters.totalEvents) * 100
      : 0;

    // Calcular qualidade da rede
    let networkQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (averageLatency > this.config.latencyThresholds.poor || eventLossRate > 5) {
      networkQuality = 'poor';
    } else if (averageLatency > this.config.latencyThresholds.fair || eventLossRate > 2) {
      networkQuality = 'fair';
    } else if (averageLatency > this.config.latencyThresholds.good || eventLossRate > 0.5) {
      networkQuality = 'good';
    }

    // Calcular utilização de largura de banda
    const bandwidthUtilization = timeSinceLastCheck > 0
      ? this.counters.totalBytes / (timeSinceLastCheck / 1000) // bytes/s
      : 0;

    // Estimar perda de pacotes
    const packetLoss = Math.min(eventLossRate, 10); // máximo 10%

    // Determinar status de saúde
    let status = ConnectionHealthStatus.EXCELLENT;
    let score = 100;

    // Penalizar por latência
    if (averageLatency > this.config.latencyThresholds.excellent) {
      score -= Math.min(30, (averageLatency - this.config.latencyThresholds.excellent) / 10);
    }

    // Penalizar por uptime
    if (uptime < this.config.uptimeThresholds.excellent) {
      score -= Math.min(40, (this.config.uptimeThresholds.excellent - uptime) * 2);
    }

    // Penalizar por perda de dados
    score -= Math.min(20, eventLossRate * 4);

    // Penalizar por reconexões
    score -= Math.min(10, reconnectRate * 2);

    // Determinar status baseado no score
    if (score >= 90) {
      status = ConnectionHealthStatus.EXCELLENT;
    } else if (score >= 75) {
      status = ConnectionHealthStatus.GOOD;
    } else if (score >= 60) {
      status = ConnectionHealthStatus.FAIR;
    } else if (score >= 40) {
      status = ConnectionHealthStatus.POOR;
    } else {
      status = ConnectionHealthStatus.CRITICAL;
    }

    // Gerar recomendações
    const recommendations: string[] = [];
    if (averageLatency > this.config.latencyThresholds.good) {
      recommendations.push('Consider checking network connection quality');
    }
    if (reconnectRate > 2) {
      recommendations.push('High reconnection rate detected - check connection stability');
    }
    if (eventLossRate > 1) {
      recommendations.push('Data loss detected - verify network reliability');
    }
    if (uptime < 95) {
      recommendations.push('Low uptime detected - investigate connection issues');
    }

    // Criar métricas
    this.currentMetrics = {
      status,
      score: Math.max(0, Math.round(score)),
      averageLatency,
      currentLatency,
      latencyTrend,
      uptime,
      totalUptime,
      totalDowntime: timeSinceStart - totalUptime,
      reconnectCount: this.counters.totalReconnects,
      reconnectRate,
      longestConnection,
      averageConnectionDuration,
      eventLossRate,
      duplicateEventRate,
      eventOrderingIssues: this.counters.orderingIssues,
      networkQuality,
      bandwidthUtilization,
      packetLoss,
      issues: Array.from(this.issues.values()).filter(issue => !issue.resolved),
      recommendations
    };

    this.lastHealthCheck = now;

    // Callback de mudança de saúde
    if (this.config.onHealthChange) {
      try {
        this.config.onHealthChange(this.currentMetrics);
      } catch (error) {
        debugLogger.error('Error in health change callback', error);
      }
    }

    debugLogger.debug('Health check completed', {
      status,
      score,
      averageLatency,
      uptime,
      issues: this.currentMetrics.issues.length
    });

    // Registrar métricas no monitor de performance
    performanceMonitor.recordRender('ConnectionHealthMonitor', Date.now() - now, 'health_check');
  }

  /**
   * Detectar problema
   */
  private detectIssue(params: {
    type: ConnectionIssue['type'];
    severity: ConnectionIssue['severity'];
    description: string;
    key: string;
  }): void {
    const now = Date.now();
    const existingIssue = this.issues.get(params.key);

    if (existingIssue && !existingIssue.resolved) {
      // Atualizar problema existente
      existingIssue.lastDetected = now;
      existingIssue.occurrences++;
    } else {
      // Criar novo problema
      const issue: ConnectionIssue = {
        type: params.type,
        severity: params.severity,
        description: params.description,
        firstDetected: now,
        lastDetected: now,
        occurrences: 1,
        resolved: false
      };

      this.issues.set(params.key, issue);

      // Callback de problema detectado
      if (this.config.onIssueDetected) {
        try {
          this.config.onIssueDetected(issue);
        } catch (error) {
          debugLogger.error('Error in issue detected callback', error);
        }
      }

      debugLogger.warn('Connection issue detected', issue);
    }

    // Limitar histórico de problemas
    if (this.issues.size > this.config.maxIssueHistory) {
      const oldestKey = Array.from(this.issues.keys())[0];
      this.issues.delete(oldestKey);
    }
  }

  /**
   * Resolver problema
   */
  private resolveIssue(key: string): void {
    const issue = this.issues.get(key);
    if (issue && !issue.resolved) {
      issue.resolved = true;
      issue.resolutionTime = Date.now();

      // Callback de problema resolvido
      if (this.config.onIssueResolved) {
        try {
          this.config.onIssueResolved(issue);
        } catch (error) {
          debugLogger.error('Error in issue resolved callback', error);
        }
      }

      debugLogger.info('Connection issue resolved', { key, issue });
    }
  }

  /**
   * Obter métricas atuais
   */
  getHealthMetrics(): ConnectionHealthMetrics | null {
    return this.currentMetrics;
  }

  /**
   * Obter problemas ativos
   */
  getActiveIssues(): ConnectionIssue[] {
    return Array.from(this.issues.values()).filter(issue => !issue.resolved);
  }

  /**
   * Obter histórico de problemas
   */
  getIssueHistory(): ConnectionIssue[] {
    return Array.from(this.issues.values());
  }

  /**
   * Forçar verificação de saúde
   */
  forceHealthCheck(): ConnectionHealthMetrics {
    this.performHealthCheck();
    return this.currentMetrics!;
  }

  /**
   * Limpar dados
   */
  clearData(): void {
    this.latencySamples = [];
    this.connectionEvents = [];
    this.dataEvents = [];
    this.issues.clear();
    this.currentMetrics = null;
    
    // Reset contadores
    Object.keys(this.counters).forEach(key => {
      (this.counters as any)[key] = 0;
    });

    this.startTime = Date.now();
    this.lastHealthCheck = Date.now();
    this.currentConnectionStart = Date.now();

    debugLogger.info('Connection health data cleared');
  }

  /**
   * Destruir monitor
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.clearData();
    debugLogger.info('Connection health monitor destroyed');
  }

  /**
   * Atualizar configuração
   */
  updateConfig(newConfig: Partial<ConnectionHealthConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Reinicializar timer se necessário
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.config.enabled && this.config.checkInterval > 0) {
      this.healthCheckTimer = setInterval(() => {
        this.performHealthCheck();
      }, this.config.checkInterval);
    }

    debugLogger.debug('Connection health monitor config updated', this.config);
  }

  /**
   * Limitar tamanho do array
   */
  private limitArraySize<T>(array: T[], maxSize: number): void {
    while (array.length > maxSize) {
      array.shift();
    }
  }
}

// 🎯 INSTÂNCIA GLOBAL DO MONITOR DE SAÚDE
let globalConnectionHealthMonitor: ConnectionHealthMonitor | null = null;

/**
 * Obter instância global do monitor de saúde
 */
export function getConnectionHealthMonitor(config?: Partial<ConnectionHealthConfig>): ConnectionHealthMonitor {
  if (!globalConnectionHealthMonitor) {
    globalConnectionHealthMonitor = new ConnectionHealthMonitor(config);
  } else if (config) {
    globalConnectionHealthMonitor.updateConfig(config);
  }
  
  return globalConnectionHealthMonitor;
}

/**
 * Funções de conveniência para monitoramento de saúde
 */
export const connectionHealthMonitor = {
  recordConnectionEvent: (type: 'connected' | 'disconnected' | 'reconnecting' | 'error', error?: string) =>
    getConnectionHealthMonitor().recordConnectionEvent(type, error),
  
  recordEventLatency: (eventType: string, latency: number) =>
    getConnectionHealthMonitor().recordEventLatency(eventType, latency),
  
  recordDataEvent: (type: 'received' | 'lost' | 'duplicate' | 'out_of_order', eventId?: string, table?: string, size?: number) =>
    getConnectionHealthMonitor().recordDataEvent(type, eventId, table, size),
  
  recordBandwidthUsage: (bytes: number) =>
    getConnectionHealthMonitor().recordBandwidthUsage(bytes),
  
  getHealthMetrics: () => getConnectionHealthMonitor().getHealthMetrics(),
  
  getActiveIssues: () => getConnectionHealthMonitor().getActiveIssues(),
  
  getIssueHistory: () => getConnectionHealthMonitor().getIssueHistory(),
  
  forceHealthCheck: () => getConnectionHealthMonitor().forceHealthCheck(),
  
  clearData: () => getConnectionHealthMonitor().clearData(),
  
  destroy: () => getConnectionHealthMonitor().destroy()
};