'use client';

import { ActivityTracker, getGlobalActivityTracker, type ActivityState } from './activity-tracker';

/**
 * 🎯 POLLING MANAGER
 * 
 * Gerencia timers de polling com intervalos adaptativos baseados na atividade do usuário.
 * Integra com ActivityTracker para otimizar automaticamente a frequência de polling.
 */

export interface PollingConfig {
  // Intervalos em milissegundos
  activeInterval?: number;    // Quando usuário está ativo (default: 5000ms)
  inactiveInterval?: number;  // Quando usuário está inativo (default: 30000ms)
  focusInterval?: number;     // Quando aba está em foco (default: 5000ms)
  blurInterval?: number;      // Quando aba está em background (default: 60000ms)
  
  // Configurações
  enabled?: boolean;          // Se polling está habilitado (default: true)
  executeOnStart?: boolean;   // Se deve executar callback imediatamente (default: true)
  executeOnFocus?: boolean;   // Se deve executar quando aba ganha foco (default: true)
  
  // Debug
  debug?: boolean;
}

export interface PollingState {
  isRunning: boolean;
  currentInterval: number;
  lastExecutionTime: number | null;
  executionCount: number;
  activityState: ActivityState;
}

export type PollingCallback = () => void | Promise<void>;

/**
 * Classe para gerenciar polling inteligente com intervalos adaptativos
 */
export class PollingManager {
  private callback: PollingCallback;
  private config: Required<PollingConfig>;
  private activityTracker: ActivityTracker;
  
  // Estado interno
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private currentInterval: number;
  private lastExecutionTime: number | null = null;
  private executionCount: number = 0;
  
  // Callbacks para cleanup
  private activityCleanup: (() => void) | null = null;
  private visibilityCleanup: (() => void) | null = null;
  
  constructor(callback: PollingCallback, config: PollingConfig = {}) {
    this.callback = callback;
    this.config = {
      activeInterval: config.activeInterval || 5000,
      inactiveInterval: config.inactiveInterval || 30000,
      focusInterval: config.focusInterval || 5000,
      blurInterval: config.blurInterval || 60000,
      enabled: config.enabled !== false,
      executeOnStart: config.executeOnStart !== false,
      executeOnFocus: config.executeOnFocus !== false,
      debug: config.debug || false
    };
    
    this.activityTracker = getGlobalActivityTracker({
      debug: this.config.debug
    });
    
    this.currentInterval = this.calculateCurrentInterval();
    this.setupActivityListeners();
    
    if (this.config.debug) {
      console.log('[PollingManager] Initialized with config:', this.config);
    }
  }
  
  /**
   * Calcula intervalo atual baseado no estado de atividade
   */
  private calculateCurrentInterval(): number {
    const state = this.activityTracker.getState();
    
    // Se documento não está visível, usar intervalo maior
    if (!state.isVisible) {
      return this.config.blurInterval;
    }
    
    // Se usuário está inativo, usar intervalo maior
    if (!state.isActive) {
      return this.config.inactiveInterval;
    }
    
    // Se documento está visível e usuário ativo, usar intervalo menor
    return state.isVisible ? this.config.focusInterval : this.config.activeInterval;
  }
  
  /**
   * Configura listeners para mudanças de atividade
   */
  private setupActivityListeners(): void {
    const handleActivityChange = (state: ActivityState) => {
      const newInterval = this.calculateCurrentInterval();
      
      if (newInterval !== this.currentInterval) {
        this.currentInterval = newInterval;
        
        if (this.config.debug) {
          console.log('[PollingManager] Interval changed:', {
            oldInterval: this.currentInterval,
            newInterval,
            activityState: state,
            timestamp: new Date().toISOString()
          });
        }
        
        // Reiniciar timer com novo intervalo
        if (this.isRunning) {
          this.restartTimer();
        }
      }
    };
    
    const handleVisibilityChange = (isVisible: boolean) => {
      const newInterval = this.calculateCurrentInterval();
      
      if (newInterval !== this.currentInterval) {
        this.currentInterval = newInterval;
        
        if (this.config.debug) {
          console.log('[PollingManager] Visibility changed:', {
            isVisible,
            newInterval,
            timestamp: new Date().toISOString()
          });
        }
        
        // Se aba ganhou foco e está configurado para executar
        if (isVisible && this.config.executeOnFocus && this.isRunning) {
          this.executeCallback('focus_gained');
        }
        
        // Reiniciar timer com novo intervalo
        if (this.isRunning) {
          this.restartTimer();
        }
      }
    };
    
    this.activityTracker.addActivityListener(handleActivityChange);
    this.activityTracker.addVisibilityListener(handleVisibilityChange);
    
    // Guardar referências para cleanup
    this.activityCleanup = () => {
      this.activityTracker.removeActivityListener(handleActivityChange);
    };
    
    this.visibilityCleanup = () => {
      this.activityTracker.removeVisibilityListener(handleVisibilityChange);
    };
  }
  
  /**
   * Executa o callback com tratamento de erro
   */
  private async executeCallback(reason: string = 'timer'): Promise<void> {
    try {
      this.lastExecutionTime = Date.now();
      this.executionCount++;
      
      if (this.config.debug) {
        console.log('[PollingManager] Executing callback:', {
          reason,
          executionCount: this.executionCount,
          currentInterval: this.currentInterval,
          timestamp: new Date(this.lastExecutionTime).toISOString()
        });
      }
      
      await this.callback();
      
    } catch (error) {
      console.error('[PollingManager] Error executing callback:', error);
      
      // Em caso de erro, não parar o polling
      // mas pode implementar estratégias de backoff aqui
    }
  }
  
  /**
   * Reinicia o timer com o intervalo atual
   */
  private restartTimer(): void {
    this.stopTimer();
    this.startTimer();
  }
  
  /**
   * Inicia o timer
   */
  private startTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    this.timer = setInterval(() => {
      this.executeCallback('timer');
    }, this.currentInterval);
  }
  
  /**
   * Para o timer
   */
  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  
  /**
   * Inicia o polling
   */
  public start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }
    
    this.isRunning = true;
    this.currentInterval = this.calculateCurrentInterval();
    
    if (this.config.debug) {
      console.log('[PollingManager] Starting polling:', {
        currentInterval: this.currentInterval,
        executeOnStart: this.config.executeOnStart
      });
    }
    
    // Executar imediatamente se configurado
    if (this.config.executeOnStart) {
      this.executeCallback('start');
    }
    
    this.startTimer();
  }
  
  /**
   * Para o polling
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    this.stopTimer();
    
    if (this.config.debug) {
      console.log('[PollingManager] Stopped polling');
    }
  }
  
  /**
   * Executa o callback imediatamente e reinicia o timer
   */
  public forceExecute(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.executeCallback('force_execute');
    this.restartTimer();
  }
  
  /**
   * Atualiza configuração do polling
   */
  public updateConfig(newConfig: Partial<PollingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Recalcular intervalo se necessário
    const newInterval = this.calculateCurrentInterval();
    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval;
      
      if (this.isRunning) {
        this.restartTimer();
      }
    }
    
    // Se habilitou/desabilitou polling
    if (oldConfig.enabled !== this.config.enabled) {
      if (this.config.enabled && !this.isRunning) {
        this.start();
      } else if (!this.config.enabled && this.isRunning) {
        this.stop();
      }
    }
    
    if (this.config.debug) {
      console.log('[PollingManager] Config updated:', {
        oldConfig,
        newConfig: this.config,
        currentInterval: this.currentInterval
      });
    }
  }
  
  /**
   * Obtém estado atual do polling
   */
  public getState(): PollingState {
    return {
      isRunning: this.isRunning,
      currentInterval: this.currentInterval,
      lastExecutionTime: this.lastExecutionTime,
      executionCount: this.executionCount,
      activityState: this.activityTracker.getState()
    };
  }
  
  /**
   * Limpa todos os recursos
   */
  public destroy(): void {
    this.stop();
    
    // Limpar listeners de atividade
    if (this.activityCleanup) {
      this.activityCleanup();
      this.activityCleanup = null;
    }
    
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }
    
    if (this.config.debug) {
      console.log('[PollingManager] Destroyed');
    }
  }
}