/**
 * 🐛 SISTEMA DE DEBUG E LOGGING REALTIME
 * 
 * Sistema abrangente de logging com níveis configuráveis,
 * formatação consistente e capacidades de debug avançadas.
 */

import { RealtimeError, RealtimeErrorType } from '../types/error-types';

// 🎯 NÍVEIS DE LOG
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// 🎯 CONFIGURAÇÃO DO LOGGER
export interface DebugLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
  includeTimestamp: boolean;
  includeStackTrace: boolean;
  includeContext: boolean;
  maxLogEntries: number;
  persistLogs: boolean;
  colorOutput: boolean;
  groupLogs: boolean;
}

// 🎯 ENTRADA DE LOG
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
  context?: Record<string, any>;
  stack?: string;
  channelId?: string;
  operation?: string;
}

// 🎯 ESTATÍSTICAS DE LOG
export interface LogStats {
  totalEntries: number;
  entriesByLevel: Record<LogLevel, number>;
  oldestEntry: number | null;
  newestEntry: number | null;
  memoryUsage: number;
}

/**
 * 🎯 LOGGER DE DEBUG REALTIME
 */
export class DebugLogger {
  private config: DebugLoggerConfig;
  private logs: LogEntry[] = [];
  private logCounter = 0;
  private colors = {
    [LogLevel.ERROR]: '\x1b[31m',   // Red
    [LogLevel.WARN]: '\x1b[33m',    // Yellow
    [LogLevel.INFO]: '\x1b[36m',    // Cyan
    [LogLevel.DEBUG]: '\x1b[35m',   // Magenta
    [LogLevel.TRACE]: '\x1b[37m',   // White
    reset: '\x1b[0m'
  };

  constructor(config: Partial<DebugLoggerConfig> = {}) {
    this.config = {
      enabled: true,
      level: LogLevel.INFO,
      prefix: '[RealtimeDebug]',
      includeTimestamp: true,
      includeStackTrace: false,
      includeContext: true,
      maxLogEntries: 1000,
      persistLogs: false,
      colorOutput: true,
      groupLogs: true,
      ...config
    };

    // Carregar logs persistidos se habilitado
    if (this.config.persistLogs && typeof localStorage !== 'undefined') {
      this.loadPersistedLogs();
    }
  }

  /**
   * Log de erro
   */
  error(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  /**
   * Log de warning
   */
  warn(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  /**
   * Log de informação
   */
  info(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  /**
   * Log de debug
   */
  debug(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  /**
   * Log de trace
   */
  trace(message: string, data?: any, context?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, data, context);
  }

  /**
   * Log de erro realtime específico
   */
  logError(error: RealtimeError, context?: Record<string, any>): void {
    const errorData = {
      type: error.type,
      code: error.code,
      severity: error.severity,
      retryable: error.retryable,
      retryCount: error.retryCount,
      channelId: error.channelId,
      originalMessage: error.message
    };

    this.error(`Realtime Error: ${error.type}`, errorData, {
      ...context,
      errorContext: error.context
    });
  }

  /**
   * Log de operação com timing
   */
  logOperation(
    operation: string,
    channelId: string,
    startTime: number,
    success: boolean,
    data?: any,
    error?: Error
  ): void {
    const duration = Date.now() - startTime;
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Operation ${operation} ${success ? 'completed' : 'failed'} in ${duration}ms`;

    this.log(level, message, {
      operation,
      channelId,
      duration,
      success,
      data: success ? data : undefined,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }

  /**
   * Log de conexão
   */
  logConnection(
    channelId: string,
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
    details?: any
  ): void {
    const level = status === 'error' ? LogLevel.ERROR : 
                 status === 'connected' ? LogLevel.INFO : LogLevel.DEBUG;
    
    this.log(level, `Connection ${status}`, {
      channelId,
      status,
      ...details
    });
  }

  /**
   * Log de evento de banco de dados
   */
  logDatabaseEvent(
    channelId: string,
    table: string,
    eventType: string,
    payload?: any
  ): void {
    this.debug(`Database event: ${eventType} on ${table}`, {
      channelId,
      table,
      eventType,
      payload
    });
  }

  /**
   * Log de polling
   */
  logPolling(
    channelId: string,
    interval: number,
    reason: string,
    active: boolean,
    visible: boolean
  ): void {
    this.debug(`Polling executed`, {
      channelId,
      interval,
      reason,
      userActive: active,
      documentVisible: visible
    });
  }

  /**
   * Log de fetch de dados
   */
  logDataFetch(
    channelId: string,
    endpoint: string,
    success: boolean,
    duration: number,
    dataCount?: number,
    fromCache?: boolean,
    error?: string
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Data fetch ${success ? 'successful' : 'failed'}`;

    this.log(level, message, {
      channelId,
      endpoint,
      duration,
      dataCount,
      fromCache,
      error
    });
  }

  /**
   * Inicia um grupo de logs
   */
  group(label: string): void {
    if (!this.config.enabled || !this.config.groupLogs) return;

    if (typeof console.group === 'function') {
      console.group(`${this.config.prefix} ${label}`);
    }
  }

  /**
   * Finaliza um grupo de logs
   */
  groupEnd(): void {
    if (!this.config.enabled || !this.config.groupLogs) return;

    if (typeof console.groupEnd === 'function') {
      console.groupEnd();
    }
  }

  /**
   * Log principal
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    context?: Record<string, any>
  ): void {
    if (!this.config.enabled || level > this.config.level) {
      return;
    }

    const entry: LogEntry = {
      id: `log-${++this.logCounter}`,
      timestamp: Date.now(),
      level,
      message,
      data,
      context,
      channelId: context?.channelId,
      operation: context?.operation
    };

    // Adicionar stack trace se habilitado
    if (this.config.includeStackTrace && level <= LogLevel.WARN) {
      entry.stack = new Error().stack;
    }

    // Adicionar à lista de logs
    this.logs.push(entry);

    // Limitar número de logs
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs.shift();
    }

    // Persistir se habilitado
    if (this.config.persistLogs) {
      this.persistLogs();
    }

    // Output no console
    this.outputToConsole(entry);
  }

  /**
   * Output formatado no console
   */
  private outputToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const color = this.config.colorOutput ? this.colors[entry.level] : '';
    const reset = this.config.colorOutput ? this.colors.reset : '';
    
    let output = `${color}${this.config.prefix} [${levelName}]`;
    
    if (this.config.includeTimestamp) {
      output += ` ${new Date(entry.timestamp).toISOString()}`;
    }
    
    output += ` ${entry.message}${reset}`;

    // Dados adicionais
    const logData: any[] = [output];
    
    if (entry.data) {
      logData.push('\nData:', entry.data);
    }
    
    if (this.config.includeContext && entry.context) {
      logData.push('\nContext:', entry.context);
    }
    
    if (entry.stack && this.config.includeStackTrace) {
      logData.push('\nStack:', entry.stack);
    }

    // Output baseado no nível
    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(...logData);
        break;
      case LogLevel.WARN:
        console.warn(...logData);
        break;
      case LogLevel.INFO:
        console.info(...logData);
        break;
      case LogLevel.DEBUG:
        console.debug(...logData);
        break;
      case LogLevel.TRACE:
        console.trace(...logData);
        break;
    }
  }

  /**
   * Obter logs filtrados
   */
  getLogs(filter?: {
    level?: LogLevel;
    channelId?: string;
    operation?: string;
    since?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.level <= filter.level!);
      }
      
      if (filter.channelId) {
        filteredLogs = filteredLogs.filter(log => log.channelId === filter.channelId);
      }
      
      if (filter.operation) {
        filteredLogs = filteredLogs.filter(log => log.operation === filter.operation);
      }
      
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since!);
      }
    }

    return filteredLogs;
  }

  /**
   * Obter estatísticas dos logs
   */
  getStats(): LogStats {
    const entriesByLevel = Object.values(LogLevel)
      .filter(level => typeof level === 'number')
      .reduce((acc, level) => {
        acc[level as LogLevel] = this.logs.filter(log => log.level === level).length;
        return acc;
      }, {} as Record<LogLevel, number>);

    const timestamps = this.logs.map(log => log.timestamp);
    
    return {
      totalEntries: this.logs.length,
      entriesByLevel,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Limpar logs
   */
  clearLogs(): void {
    this.logs = [];
    this.logCounter = 0;
    
    if (this.config.persistLogs && typeof localStorage !== 'undefined') {
      localStorage.removeItem('realtime-debug-logs');
    }
  }

  /**
   * Exportar logs como JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      config: this.config,
      stats: this.getStats(),
      logs: this.logs
    }, null, 2);
  }

  /**
   * Atualizar configuração
   */
  updateConfig(newConfig: Partial<DebugLoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Persistir logs no localStorage
   */
  private persistLogs(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const logsToStore = this.logs.slice(-100); // Manter apenas os últimos 100
      localStorage.setItem('realtime-debug-logs', JSON.stringify(logsToStore));
    } catch (error) {
      // Falha silenciosa se localStorage estiver cheio
    }
  }

  /**
   * Carregar logs persistidos
   */
  private loadPersistedLogs(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem('realtime-debug-logs');
      if (stored) {
        const logs = JSON.parse(stored) as LogEntry[];
        this.logs = logs;
        this.logCounter = Math.max(...logs.map(log => parseInt(log.id.split('-')[1]) || 0), 0);
      }
    } catch (error) {
      // Falha silenciosa se não conseguir carregar
    }
  }

  /**
   * Estimar uso de memória dos logs
   */
  private estimateMemoryUsage(): number {
    return JSON.stringify(this.logs).length * 2; // Aproximação em bytes
  }
}

// 🎯 INSTÂNCIA GLOBAL DO LOGGER
let globalDebugLogger: DebugLogger | null = null;

/**
 * Obter instância global do logger
 */
export function getDebugLogger(config?: Partial<DebugLoggerConfig>): DebugLogger {
  if (!globalDebugLogger) {
    globalDebugLogger = new DebugLogger(config);
  } else if (config) {
    globalDebugLogger.updateConfig(config);
  }
  
  return globalDebugLogger;
}

/**
 * Funções de conveniência para logging
 */
export const debugLogger = {
  error: (message: string, data?: any, context?: Record<string, any>) => 
    getDebugLogger().error(message, data, context),
  
  warn: (message: string, data?: any, context?: Record<string, any>) => 
    getDebugLogger().warn(message, data, context),
  
  info: (message: string, data?: any, context?: Record<string, any>) => 
    getDebugLogger().info(message, data, context),
  
  debug: (message: string, data?: any, context?: Record<string, any>) => 
    getDebugLogger().debug(message, data, context),
  
  trace: (message: string, data?: any, context?: Record<string, any>) => 
    getDebugLogger().trace(message, data, context),

  logError: (error: RealtimeError, context?: Record<string, any>) =>
    getDebugLogger().logError(error, context),

  logOperation: (operation: string, channelId: string, startTime: number, success: boolean, data?: any, error?: Error) =>
    getDebugLogger().logOperation(operation, channelId, startTime, success, data, error),

  logConnection: (channelId: string, status: 'connecting' | 'connected' | 'disconnected' | 'error', details?: any) =>
    getDebugLogger().logConnection(channelId, status, details),

  logDatabaseEvent: (channelId: string, table: string, eventType: string, payload?: any) =>
    getDebugLogger().logDatabaseEvent(channelId, table, eventType, payload),

  logPolling: (channelId: string, interval: number, reason: string, active: boolean, visible: boolean) =>
    getDebugLogger().logPolling(channelId, interval, reason, active, visible),

  logDataFetch: (channelId: string, endpoint: string, success: boolean, duration: number, dataCount?: number, fromCache?: boolean, error?: string) =>
    getDebugLogger().logDataFetch(channelId, endpoint, success, duration, dataCount, fromCache, error),

  group: (label: string) => getDebugLogger().group(label),
  groupEnd: () => getDebugLogger().groupEnd(),
  getLogs: (filter?: any) => getDebugLogger().getLogs(filter),
  getStats: () => getDebugLogger().getStats(),
  clearLogs: () => getDebugLogger().clearLogs(),
  exportLogs: () => getDebugLogger().exportLogs()
};