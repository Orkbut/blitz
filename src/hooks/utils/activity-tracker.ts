'use client';

/**
 * 🎯 ACTIVITY TRACKER
 * 
 * Utilitário para detectar atividade do usuário e visibilidade do documento.
 * Usado pelo sistema de smart polling para adaptar intervalos automaticamente.
 */

export interface ActivityState {
  isActive: boolean;
  isVisible: boolean;
  lastActivityTime: number;
}

export interface ActivityTrackerConfig {
  inactivityTimeout?: number; // Tempo para considerar usuário inativo (ms)
  checkInterval?: number;     // Intervalo para verificar inatividade (ms)
  debug?: boolean;
}

export type ActivityChangeCallback = (state: ActivityState) => void;
export type VisibilityChangeCallback = (isVisible: boolean) => void;

/**
 * Classe para rastrear atividade do usuário e visibilidade da página
 */
export class ActivityTracker {
  private lastActivityTime: number = Date.now();
  private isUserActive: boolean = true;
  private isDocumentVisible: boolean = !document.hidden;
  private inactivityTimeout: number;
  private checkInterval: number;
  private debug: boolean;
  
  // Timers e listeners
  private inactivityTimer: NodeJS.Timeout | null = null;
  private activityListeners: ActivityChangeCallback[] = [];
  private visibilityListeners: VisibilityChangeCallback[] = [];
  private eventListeners: (() => void)[] = [];
  
  // Eventos que indicam atividade do usuário
  private readonly ACTIVITY_EVENTS = [
    'mousedown', 'mousemove', 'keypress', 'scroll', 
    'touchstart', 'click', 'focus', 'blur'
  ];
  
  constructor(config: ActivityTrackerConfig = {}) {
    this.inactivityTimeout = config.inactivityTimeout || 60000; // 1 minuto
    this.checkInterval = config.checkInterval || 5000; // 5 segundos
    this.debug = config.debug || false;
    
    this.setupActivityListeners();
    this.setupVisibilityListeners();
    this.startInactivityCheck();
    
    if (this.debug) {
      console.log('[ActivityTracker] Initialized with config:', {
        inactivityTimeout: this.inactivityTimeout,
        checkInterval: this.checkInterval
      });
    }
  }
  
  /**
   * Configura listeners para eventos de atividade do usuário
   */
  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;
    
    const updateActivity = () => {
      this.updateActivity();
    };
    
    this.ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
      this.eventListeners.push(() => {
        window.removeEventListener(event, updateActivity);
      });
    });
  }
  
  /**
   * Configura listener para mudanças de visibilidade da página
   */
  private setupVisibilityListeners(): void {
    if (typeof document === 'undefined') return;
    
    const handleVisibilityChange = () => {
      const wasVisible = this.isDocumentVisible;
      this.isDocumentVisible = !document.hidden;
      
      if (wasVisible !== this.isDocumentVisible) {
        this.notifyVisibilityChange();
        
        if (this.debug) {
          console.log('[ActivityTracker] Visibility changed:', {
            isVisible: this.isDocumentVisible,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.eventListeners.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  }
  
  /**
   * Inicia verificação periódica de inatividade
   */
  private startInactivityCheck(): void {
    this.inactivityTimer = setInterval(() => {
      this.checkInactivity();
    }, this.checkInterval);
  }
  
  /**
   * Atualiza timestamp da última atividade
   */
  public updateActivity(): void {
    const now = Date.now();
    const wasActive = this.isUserActive;
    
    this.lastActivityTime = now;
    this.isUserActive = true;
    
    // Notifica mudança se estava inativo
    if (!wasActive) {
      this.notifyActivityChange();
      
      if (this.debug) {
        console.log('[ActivityTracker] User became active:', {
          timestamp: new Date(now).toISOString()
        });
      }
    }
  }
  
  /**
   * Verifica se usuário está inativo baseado no timeout
   */
  public checkInactivity(): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;
    const wasActive = this.isUserActive;
    
    this.isUserActive = timeSinceLastActivity < this.inactivityTimeout;
    
    // Notifica mudança se ficou inativo
    if (wasActive && !this.isUserActive) {
      this.notifyActivityChange();
      
      if (this.debug) {
        console.log('[ActivityTracker] User became inactive:', {
          timeSinceLastActivity,
          inactivityTimeout: this.inactivityTimeout,
          timestamp: new Date(now).toISOString()
        });
      }
    }
    
    return !this.isUserActive;
  }
  
  /**
   * Obtém estado atual da atividade
   */
  public getState(): ActivityState {
    return {
      isActive: this.isUserActive,
      isVisible: this.isDocumentVisible,
      lastActivityTime: this.lastActivityTime
    };
  }
  
  /**
   * Adiciona callback para mudanças de atividade
   */
  public addActivityListener(callback: ActivityChangeCallback): void {
    this.activityListeners.push(callback);
  }
  
  /**
   * Remove callback de mudanças de atividade
   */
  public removeActivityListener(callback: ActivityChangeCallback): void {
    const index = this.activityListeners.indexOf(callback);
    if (index > -1) {
      this.activityListeners.splice(index, 1);
    }
  }
  
  /**
   * Adiciona callback para mudanças de visibilidade
   */
  public addVisibilityListener(callback: VisibilityChangeCallback): void {
    this.visibilityListeners.push(callback);
  }
  
  /**
   * Remove callback de mudanças de visibilidade
   */
  public removeVisibilityListener(callback: VisibilityChangeCallback): void {
    const index = this.visibilityListeners.indexOf(callback);
    if (index > -1) {
      this.visibilityListeners.splice(index, 1);
    }
  }
  
  /**
   * Notifica listeners sobre mudanças de atividade
   */
  private notifyActivityChange(): void {
    const state = this.getState();
    this.activityListeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[ActivityTracker] Error in activity callback:', error);
      }
    });
  }
  
  /**
   * Notifica listeners sobre mudanças de visibilidade
   */
  private notifyVisibilityChange(): void {
    this.visibilityListeners.forEach(callback => {
      try {
        callback(this.isDocumentVisible);
      } catch (error) {
        console.error('[ActivityTracker] Error in visibility callback:', error);
      }
    });
  }
  
  /**
   * Limpa todos os listeners e timers
   */
  public destroy(): void {
    // Limpar timer de inatividade
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    
    // Limpar event listeners
    this.eventListeners.forEach(cleanup => cleanup());
    this.eventListeners = [];
    
    // Limpar callbacks
    this.activityListeners = [];
    this.visibilityListeners = [];
    
    if (this.debug) {
      console.log('[ActivityTracker] Destroyed');
    }
  }
}

/**
 * Instância global do ActivityTracker para compartilhar entre hooks
 */
let globalActivityTracker: ActivityTracker | null = null;

/**
 * Obtém ou cria instância global do ActivityTracker
 */
export function getGlobalActivityTracker(config?: ActivityTrackerConfig): ActivityTracker {
  if (!globalActivityTracker) {
    globalActivityTracker = new ActivityTracker(config);
  }
  return globalActivityTracker;
}

/**
 * Destrói instância global do ActivityTracker
 */
export function destroyGlobalActivityTracker(): void {
  if (globalActivityTracker) {
    globalActivityTracker.destroy();
    globalActivityTracker = null;
  }
}