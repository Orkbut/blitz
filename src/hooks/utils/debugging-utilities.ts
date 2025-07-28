/**
 * 🛠️ UTILITÁRIOS DE DEBUGGING REALTIME
 * 
 * Conjunto de ferramentas para facilitar o debugging e troubleshooting
 * de hooks realtime, incluindo helpers, formatadores e análises.
 */

import { debugLogger, LogLevel, getDebugLogger } from './debug-logger';
import { performanceMonitor } from './performance-monitor';
import { connectionHealthMonitor } from './connection-health-monitor';
import { debugInfoCollector, DebugInfo } from './debug-info-collector';

// 🎯 CONFIGURAÇÃO DE DEBUGGING
export interface DebuggingConfig {
  enabled: boolean;
  autoStart: boolean;
  logLevel: LogLevel;
  includeStackTrace: boolean;
  enablePerformanceMonitoring: boolean;
  enableHealthMonitoring: boolean;
  enableInfoCollection: boolean;
  consoleOutput: boolean;
  persistLogs: boolean;
}

// 🎯 SESSÃO DE DEBUG
export interface DebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  channelId: string;
  hookType: string;
  events: DebugEvent[];
  snapshots: DebugInfo[];
  summary?: DebugSessionSummary;
}

// 🎯 EVENTO DE DEBUG
export interface DebugEvent {
  timestamp: number;
  type: 'connection' | 'data' | 'error' | 'performance' | 'user_action';
  category: string;
  message: string;
  data?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// 🎯 RESUMO DA SESSÃO
export interface DebugSessionSummary {
  duration: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  errorCount: number;
  performanceIssues: string[];
  recommendations: string[];
  healthScore: number;
}

/**
 * 🎯 CLASSE PRINCIPAL DE DEBUGGING
 */
export class RealtimeDebugger {
  private config: DebuggingConfig;
  private activeSessions: Map<string, DebugSession> = new Map();
  private sessionCounter = 0;

  constructor(config: Partial<DebuggingConfig> = {}) {
    this.config = {
      enabled: true,
      autoStart: false,
      logLevel: LogLevel.DEBUG,
      includeStackTrace: true,
      enablePerformanceMonitoring: true,
      enableHealthMonitoring: true,
      enableInfoCollection: true,
      consoleOutput: true,
      persistLogs: true,
      ...config
    };

    if (this.config.enabled && this.config.autoStart) {
      this.initialize();
    }
  }

  /**
   * Inicializar debugger
   */
  private initialize(): void {
    // Configurar logger
    getDebugLogger().updateConfig({
      enabled: this.config.enabled,
      level: this.config.logLevel,
      includeStackTrace: this.config.includeStackTrace,
      persistLogs: this.config.persistLogs
    });

    debugLogger.info('Realtime debugger initialized', this.config);
  }

  /**
   * Iniciar sessão de debug
   */
  startSession(channelId: string, hookType: string): string {
    if (!this.config.enabled) {
      return 'disabled';
    }

    const sessionId = `debug-session-${++this.sessionCounter}-${Date.now()}`;
    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      channelId,
      hookType,
      events: [],
      snapshots: []
    };

    this.activeSessions.set(sessionId, session);

    debugLogger.info('Debug session started', {
      sessionId,
      channelId,
      hookType
    });

    return sessionId;
  }

  /**
   * Finalizar sessão de debug
   */
  endSession(sessionId: string): DebugSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      debugLogger.warn('Attempted to end non-existent debug session', { sessionId });
      return null;
    }

    session.endTime = Date.now();
    session.summary = this.generateSessionSummary(session);

    this.activeSessions.delete(sessionId);

    debugLogger.info('Debug session ended', {
      sessionId,
      duration: session.endTime - session.startTime,
      eventCount: session.events.length
    });

    return session;
  }

  /**
   * Adicionar evento à sessão
   */
  addEvent(
    sessionId: string,
    type: DebugEvent['type'],
    category: string,
    message: string,
    data?: any,
    severity: DebugEvent['severity'] = 'low'
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const event: DebugEvent = {
      timestamp: Date.now(),
      type,
      category,
      message,
      data,
      severity
    };

    session.events.push(event);

    // Log baseado na severidade
    switch (severity) {
      case 'critical':
        debugLogger.error(`[${sessionId}] ${message}`, data);
        break;
      case 'high':
        debugLogger.warn(`[${sessionId}] ${message}`, data);
        break;
      case 'medium':
        debugLogger.info(`[${sessionId}] ${message}`, data);
        break;
      default:
        debugLogger.debug(`[${sessionId}] ${message}`, data);
    }
  }

  /**
   * Capturar snapshot de debug
   */
  captureSnapshot(sessionId: string, params: Parameters<typeof debugInfoCollector.collect>[0]): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.enableInfoCollection) return;

    try {
      const debugInfo = debugInfoCollector.collect(params);
      session.snapshots.push(debugInfo);

      debugLogger.debug('Debug snapshot captured', {
        sessionId,
        snapshotCount: session.snapshots.length
      });
    } catch (error) {
      debugLogger.error('Failed to capture debug snapshot', error);
    }
  }

  /**
   * Obter sessão ativa
   */
  getSession(sessionId: string): DebugSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Listar sessões ativas
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Gerar resumo da sessão
   */
  private generateSessionSummary(session: DebugSession): DebugSessionSummary {
    const duration = (session.endTime || Date.now()) - session.startTime;
    const eventsByType = session.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorCount = session.events.filter(e => e.severity === 'critical' || e.severity === 'high').length;

    // Analisar problemas de performance
    const performanceIssues: string[] = [];
    const latestSnapshot = session.snapshots[session.snapshots.length - 1];
    
    if (latestSnapshot) {
      if (latestSnapshot.performance.averageEventLatency > 500) {
        performanceIssues.push('High event latency');
      }
      if (latestSnapshot.performance.rerenderCount > 100) {
        performanceIssues.push('Excessive rerenders');
      }
      if (latestSnapshot.performance.memoryLeaks > 0) {
        performanceIssues.push('Memory leaks detected');
      }
    }

    // Gerar recomendações
    const recommendations: string[] = [];
    if (errorCount > 5) {
      recommendations.push('High error count - investigate connection stability');
    }
    if (performanceIssues.length > 0) {
      recommendations.push('Performance issues detected - optimize hook usage');
    }
    if (session.events.filter(e => e.type === 'connection').length > 10) {
      recommendations.push('Frequent connection events - check network stability');
    }

    // Calcular score de saúde
    let healthScore = 100;
    healthScore -= errorCount * 5;
    healthScore -= performanceIssues.length * 10;
    healthScore = Math.max(0, healthScore);

    return {
      duration,
      totalEvents: session.events.length,
      eventsByType,
      errorCount,
      performanceIssues,
      recommendations,
      healthScore
    };
  }

  /**
   * Exportar sessão como JSON
   */
  exportSession(sessionId: string): string | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    return JSON.stringify(session, null, 2);
  }

  /**
   * Gerar relatório de sessão
   */
  generateSessionReport(sessionId: string): string | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const summary = session.summary || this.generateSessionSummary(session);
    
    const report = [
      `# Debug Session Report`,
      `Session ID: ${session.id}`,
      `Channel: ${session.channelId}`,
      `Hook Type: ${session.hookType}`,
      `Duration: ${summary.duration}ms`,
      `Started: ${new Date(session.startTime).toISOString()}`,
      session.endTime ? `Ended: ${new Date(session.endTime).toISOString()}` : 'Still active',
      '',
      `## Summary`,
      `Total Events: ${summary.totalEvents}`,
      `Error Count: ${summary.errorCount}`,
      `Health Score: ${summary.healthScore}/100`,
      '',
      `## Events by Type`,
      ...Object.entries(summary.eventsByType).map(([type, count]) => `${type}: ${count}`),
      '',
      `## Performance Issues`,
      summary.performanceIssues.length > 0 
        ? summary.performanceIssues.map(issue => `- ${issue}`).join('\n')
        : 'No performance issues detected',
      '',
      `## Recommendations`,
      summary.recommendations.length > 0
        ? summary.recommendations.map(rec => `- ${rec}`).join('\n')
        : 'No recommendations',
      '',
      `## Recent Events`,
      ...session.events.slice(-10).map(event => 
        `[${new Date(event.timestamp).toISOString()}] ${event.severity.toUpperCase()}: ${event.message}`
      )
    ].join('\n');

    return report;
  }

  /**
   * Limpar dados antigos
   */
  cleanup(maxAge: number = 3600000): void { // 1 hora por padrão
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    this.activeSessions.forEach((session, sessionId) => {
      if (session.endTime && (now - session.endTime) > maxAge) {
        sessionsToRemove.push(sessionId);
      }
    });

    sessionsToRemove.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
    });

    if (sessionsToRemove.length > 0) {
      debugLogger.info('Cleaned up old debug sessions', {
        removedCount: sessionsToRemove.length
      });
    }
  }

  /**
   * Atualizar configuração
   */
  updateConfig(newConfig: Partial<DebuggingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.config.enabled) {
      this.initialize();
    }

    debugLogger.debug('Debugger config updated', this.config);
  }

  /**
   * Destruir debugger
   */
  destroy(): void {
    this.activeSessions.clear();
    debugLogger.info('Realtime debugger destroyed');
  }
}

// 🎯 FUNÇÕES UTILITÁRIAS DE DEBUG

/**
 * Formatar dados para exibição
 */
export function formatDebugData(data: any, maxDepth: number = 3): string {
  try {
    return JSON.stringify(data, (key, value) => {
      if (typeof value === 'function') {
        return '[Function]';
      }
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      return value;
    }, 2);
  } catch (error) {
    return '[Unable to format data]';
  }
}

/**
 * Analisar padrões em eventos
 */
export function analyzeEventPatterns(events: DebugEvent[]): {
  patterns: string[];
  anomalies: string[];
  trends: string[];
} {
  const patterns: string[] = [];
  const anomalies: string[] = [];
  const trends: string[] = [];

  // Analisar frequência de eventos
  const eventCounts = events.reduce((acc, event) => {
    const key = `${event.type}-${event.category}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Detectar padrões
  Object.entries(eventCounts).forEach(([key, count]) => {
    if (count > 10) {
      patterns.push(`High frequency of ${key} events (${count})`);
    }
  });

  // Detectar anomalias
  const errorEvents = events.filter(e => e.severity === 'critical' || e.severity === 'high');
  if (errorEvents.length > events.length * 0.1) {
    anomalies.push(`High error rate: ${((errorEvents.length / events.length) * 100).toFixed(1)}%`);
  }

  // Analisar tendências temporais
  const timeWindows = events.reduce((acc, event) => {
    const window = Math.floor(event.timestamp / 60000) * 60000; // janelas de 1 minuto
    acc[window] = (acc[window] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const windowCounts = Object.values(timeWindows);
  if (windowCounts.length > 1) {
    const avgCount = windowCounts.reduce((sum, count) => sum + count, 0) / windowCounts.length;
    const lastCount = windowCounts[windowCounts.length - 1];
    
    if (lastCount > avgCount * 1.5) {
      trends.push('Increasing event frequency');
    } else if (lastCount < avgCount * 0.5) {
      trends.push('Decreasing event frequency');
    }
  }

  return { patterns, anomalies, trends };
}

/**
 * Validar configuração de hook
 */
export function validateHookConfig(config: any): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Validações básicas
  if (!config.tables || !Array.isArray(config.tables) || config.tables.length === 0) {
    issues.push('No tables specified for monitoring');
  }

  if (config.tables && config.tables.length > 20) {
    suggestions.push('Consider reducing the number of monitored tables for better performance');
  }

  if (config.enableRealtime === false && config.enablePolling === false && config.enableFetch === false) {
    issues.push('All data sources disabled - hook will not function');
  }

  if (config.enablePolling && config.activeInterval && config.activeInterval < 1000) {
    suggestions.push('Very short polling interval may cause performance issues');
  }

  if (config.filters && Object.keys(config.filters).length > 10) {
    suggestions.push('Many filters applied - consider optimizing database queries');
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestions
  };
}

/**
 * Comparar snapshots de debug
 */
export function compareDebugSnapshots(
  snapshot1: DebugInfo,
  snapshot2: DebugInfo
): {
  changes: string[];
  improvements: string[];
  regressions: string[];
} {
  const changes: string[] = [];
  const improvements: string[] = [];
  const regressions: string[] = [];

  // Comparar performance
  const perf1 = snapshot1.performance;
  const perf2 = snapshot2.performance;

  if (perf2.averageEventLatency !== perf1.averageEventLatency) {
    const change = perf2.averageEventLatency - perf1.averageEventLatency;
    changes.push(`Event latency changed by ${change.toFixed(2)}ms`);
    
    if (change < 0) {
      improvements.push('Event latency improved');
    } else if (change > 100) {
      regressions.push('Event latency degraded significantly');
    }
  }

  if (perf2.memoryUsage !== perf1.memoryUsage) {
    const change = perf2.memoryUsage - perf1.memoryUsage;
    changes.push(`Memory usage changed by ${(change / 1024 / 1024).toFixed(2)}MB`);
    
    if (change < 0) {
      improvements.push('Memory usage reduced');
    } else if (change > 10 * 1024 * 1024) { // 10MB
      regressions.push('Memory usage increased significantly');
    }
  }

  // Comparar saúde
  if (snapshot1.health && snapshot2.health) {
    if (snapshot2.health.score !== snapshot1.health.score) {
      const change = snapshot2.health.score - snapshot1.health.score;
      changes.push(`Health score changed by ${change}`);
      
      if (change > 0) {
        improvements.push('Health score improved');
      } else if (change < -10) {
        regressions.push('Health score degraded');
      }
    }
  }

  // Comparar problemas
  const issues1 = snapshot1.issues.length;
  const issues2 = snapshot2.issues.length;
  
  if (issues2 !== issues1) {
    changes.push(`Issue count changed from ${issues1} to ${issues2}`);
    
    if (issues2 < issues1) {
      improvements.push('Fewer issues detected');
    } else if (issues2 > issues1) {
      regressions.push('More issues detected');
    }
  }

  return { changes, improvements, regressions };
}

// 🎯 INSTÂNCIA GLOBAL DO DEBUGGER
let globalRealtimeDebugger: RealtimeDebugger | null = null;

/**
 * Obter instância global do debugger
 */
export function getRealtimeDebugger(config?: Partial<DebuggingConfig>): RealtimeDebugger {
  if (!globalRealtimeDebugger) {
    globalRealtimeDebugger = new RealtimeDebugger(config);
  } else if (config) {
    globalRealtimeDebugger.updateConfig(config);
  }
  
  return globalRealtimeDebugger;
}

/**
 * Funções de conveniência para debugging
 */
export const realtimeDebugger = {
  startSession: (channelId: string, hookType: string) =>
    getRealtimeDebugger().startSession(channelId, hookType),
  
  endSession: (sessionId: string) =>
    getRealtimeDebugger().endSession(sessionId),
  
  addEvent: (sessionId: string, type: DebugEvent['type'], category: string, message: string, data?: any, severity?: DebugEvent['severity']) =>
    getRealtimeDebugger().addEvent(sessionId, type, category, message, data, severity),
  
  captureSnapshot: (sessionId: string, params: Parameters<typeof debugInfoCollector.collect>[0]) =>
    getRealtimeDebugger().captureSnapshot(sessionId, params),
  
  getSession: (sessionId: string) =>
    getRealtimeDebugger().getSession(sessionId),
  
  getActiveSessions: () =>
    getRealtimeDebugger().getActiveSessions(),
  
  exportSession: (sessionId: string) =>
    getRealtimeDebugger().exportSession(sessionId),
  
  generateReport: (sessionId: string) =>
    getRealtimeDebugger().generateSessionReport(sessionId),
  
  cleanup: (maxAge?: number) =>
    getRealtimeDebugger().cleanup(maxAge),
  
  destroy: () => getRealtimeDebugger().destroy(),

  // Utilitários
  formatData: formatDebugData,
  analyzePatterns: analyzeEventPatterns,
  validateConfig: validateHookConfig,
  compareSnapshots: compareDebugSnapshots
};