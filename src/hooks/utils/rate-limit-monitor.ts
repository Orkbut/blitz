/**
 * 🚨 MONITOR DE RATE LIMITING REALTIME
 * 
 * Monitora e reporta problemas de rate limiting do RealtimeManager
 * para ajudar no debugging e otimização.
 */

import { debugLogger } from './debug-logger';

// 🎯 INTERFACE DE ESTATÍSTICAS
export interface RateLimitStats {
  timestamp: number;
  joinAttempts: number;
  maxJoinsPerSecond: number;
  activeChannels: number;
  activeSubscriptions: number;
  timeUntilReset: number;
  canJoin: boolean;
  timeSinceLastEvent: number;
}

// 🎯 INTERFACE DE ALERTA
export interface RateLimitAlert {
  type: 'warning' | 'error' | 'recovery';
  message: string;
  stats: RateLimitStats;
  timestamp: number;
}

/**
 * 🎯 MONITOR DE RATE LIMITING
 */
export class RateLimitMonitor {
  private static instance: RateLimitMonitor | null = null;
  private alerts: RateLimitAlert[] = [];
  private statsHistory: RateLimitStats[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: ((alert: RateLimitAlert) => void)[] = [];
  
  private constructor() {}

  public static getInstance(): RateLimitMonitor {
    if (!RateLimitMonitor.instance) {
      RateLimitMonitor.instance = new RateLimitMonitor();
    }
    return RateLimitMonitor.instance;
  }

  /**
   * Iniciar monitoramento
   */
  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      return; // Já está monitorando
    }

    this.monitoringInterval = setInterval(() => {
      this.collectStats();
    }, intervalMs);

    debugLogger.info('Rate limit monitoring started', { intervalMs });
  }

  /**
   * Parar monitoramento
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      debugLogger.info('Rate limit monitoring stopped');
    }
  }

  /**
   * Coletar estatísticas do RealtimeManager
   */
  private async collectStats(): Promise<void> {
    try {
      // Importação dinâmica para evitar circular dependency
      const { realtimeManager } = await import('../../core/infrastructure/services/RealtimeManager');
      
      const managerStats = realtimeManager.getStats();
      const rateLimitStatus = managerStats.rateLimitStatus;

      const stats: RateLimitStats = {
        timestamp: Date.now(),
        joinAttempts: rateLimitStatus.joinAttempts,
        maxJoinsPerSecond: rateLimitStatus.maxJoinsPerSecond,
        activeChannels: managerStats.activeChannels,
        activeSubscriptions: managerStats.activeSubscriptions,
        timeUntilReset: rateLimitStatus.timeUntilReset,
        canJoin: rateLimitStatus.canJoin,
        timeSinceLastEvent: managerStats.timeSinceLastEvent
      };

      this.statsHistory.push(stats);
      
      // Manter apenas últimas 100 entradas
      if (this.statsHistory.length > 100) {
        this.statsHistory.shift();
      }

      // Verificar condições de alerta
      this.checkAlertConditions(stats);

    } catch (error) {
      debugLogger.error('Error collecting rate limit stats', error);
    }
  }

  /**
   * Verificar condições de alerta
   */
  private checkAlertConditions(stats: RateLimitStats): void {
    const now = Date.now();

    // Alerta: Rate limit próximo do limite
    if (stats.joinAttempts >= stats.maxJoinsPerSecond * 0.8 && stats.canJoin) {
      this.createAlert('warning', 
        `Rate limit approaching threshold: ${stats.joinAttempts}/${stats.maxJoinsPerSecond}`,
        stats
      );
    }

    // Alerta: Rate limit atingido
    if (!stats.canJoin) {
      this.createAlert('error',
        `Rate limit exceeded: ${stats.joinAttempts}/${stats.maxJoinsPerSecond}. Reset in ${stats.timeUntilReset}ms`,
        stats
      );
    }

    // Alerta: Muitos canais ativos
    if (stats.activeChannels > 20) {
      this.createAlert('warning',
        `High number of active channels: ${stats.activeChannels}`,
        stats
      );
    }

    // Alerta: Sem eventos há muito tempo
    if (stats.timeSinceLastEvent > 120000 && stats.activeChannels > 0) { // 2 minutos
      this.createAlert('warning',
        `No events received for ${Math.round(stats.timeSinceLastEvent / 1000)}s with ${stats.activeChannels} active channels`,
        stats
      );
    }

    // Alerta: Recuperação após rate limit
    const lastStats = this.statsHistory[this.statsHistory.length - 2];
    if (lastStats && !lastStats.canJoin && stats.canJoin) {
      this.createAlert('recovery',
        `Rate limit recovered. Can join again.`,
        stats
      );
    }
  }

  /**
   * Criar alerta
   */
  private createAlert(type: RateLimitAlert['type'], message: string, stats: RateLimitStats): void {
    const alert: RateLimitAlert = {
      type,
      message,
      stats,
      timestamp: Date.now()
    };

    this.alerts.push(alert);
    
    // Manter apenas últimos 50 alertas
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Log do alerta
    const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
    debugLogger[logLevel](`[RateLimitMonitor] ${message}`, stats);

    // Notificar callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        debugLogger.error('Error in rate limit alert callback', error);
      }
    });
  }

  /**
   * Adicionar callback de alerta
   */
  public onAlert(callback: (alert: RateLimitAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    // Retornar função para remover callback
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Obter estatísticas atuais
   */
  public getCurrentStats(): RateLimitStats | null {
    return this.statsHistory[this.statsHistory.length - 1] || null;
  }

  /**
   * Obter histórico de estatísticas
   */
  public getStatsHistory(): RateLimitStats[] {
    return [...this.statsHistory];
  }

  /**
   * Obter alertas recentes
   */
  public getRecentAlerts(limit: number = 10): RateLimitAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Limpar histórico
   */
  public clearHistory(): void {
    this.statsHistory = [];
    this.alerts = [];
    debugLogger.info('Rate limit monitor history cleared');
  }

  /**
   * Gerar relatório de status
   */
  public generateStatusReport(): {
    currentStats: RateLimitStats | null;
    recentAlerts: RateLimitAlert[];
    summary: {
      totalAlerts: number;
      errorAlerts: number;
      warningAlerts: number;
      recoveryAlerts: number;
      averageJoinAttempts: number;
      peakJoinAttempts: number;
      averageActiveChannels: number;
      peakActiveChannels: number;
    };
  } {
    const currentStats = this.getCurrentStats();
    const recentAlerts = this.getRecentAlerts();
    
    const errorAlerts = this.alerts.filter(a => a.type === 'error').length;
    const warningAlerts = this.alerts.filter(a => a.type === 'warning').length;
    const recoveryAlerts = this.alerts.filter(a => a.type === 'recovery').length;

    const joinAttempts = this.statsHistory.map(s => s.joinAttempts);
    const activeChannels = this.statsHistory.map(s => s.activeChannels);

    const summary = {
      totalAlerts: this.alerts.length,
      errorAlerts,
      warningAlerts,
      recoveryAlerts,
      averageJoinAttempts: joinAttempts.length > 0 
        ? joinAttempts.reduce((sum, val) => sum + val, 0) / joinAttempts.length 
        : 0,
      peakJoinAttempts: joinAttempts.length > 0 ? Math.max(...joinAttempts) : 0,
      averageActiveChannels: activeChannels.length > 0 
        ? activeChannels.reduce((sum, val) => sum + val, 0) / activeChannels.length 
        : 0,
      peakActiveChannels: activeChannels.length > 0 ? Math.max(...activeChannels) : 0
    };

    return {
      currentStats,
      recentAlerts,
      summary
    };
  }
}

/**
 * 🎯 INSTÂNCIA GLOBAL DO MONITOR
 */
export const rateLimitMonitor = RateLimitMonitor.getInstance();

/**
 * 🎯 HOOK PARA USAR O MONITOR EM COMPONENTES REACT
 */
export function useRateLimitMonitor() {
  const [currentStats, setCurrentStats] = React.useState<RateLimitStats | null>(null);
  const [recentAlerts, setRecentAlerts] = React.useState<RateLimitAlert[]>([]);

  React.useEffect(() => {
    // Iniciar monitoramento
    rateLimitMonitor.startMonitoring();

    // Callback para alertas
    const unsubscribe = rateLimitMonitor.onAlert((alert) => {
      setRecentAlerts(prev => [...prev.slice(-9), alert]); // Manter últimos 10
    });

    // Atualizar stats periodicamente
    const interval = setInterval(() => {
      setCurrentStats(rateLimitMonitor.getCurrentStats());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      rateLimitMonitor.stopMonitoring();
    };
  }, []);

  return {
    currentStats,
    recentAlerts,
    generateReport: () => rateLimitMonitor.generateStatusReport(),
    clearHistory: () => rateLimitMonitor.clearHistory()
  };
}

// Importação condicional do React para evitar erro em ambiente Node.js
let React: any;
try {
  React = require('react');
} catch {
  // React não disponível (ambiente Node.js)
}