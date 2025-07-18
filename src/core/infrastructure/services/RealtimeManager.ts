/**
 * 🚀 REALTIME MANAGER - CORE SINGLETON
 * 
 * Implementação baseada na documentação oficial do Supabase Realtime:
 * - Um canal por contexto funcional (não por hook)
 * - Rate limiting respeitado (TENANT_MAX_JOINS_PER_SECOND: 100)
 * - Error handling com códigos oficiais
 * - Health monitoring adequado
 * - Event bus pattern para desacoplamento
 * 
 * REDUÇÃO ESTIMADA: 8 hooks → 1 manager = 87% menos arquivos
 */

import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// 🎯 TIPOS BASEADOS NA DOCUMENTAÇÃO OFICIAL
export interface RealtimeManagerConfig {
  maxChannelsPerClient: number;     // TENANT_MAX_CHANNELS_PER_CLIENT (padrão: 100)
  maxEventsPerSecond: number;       // TENANT_MAX_EVENTS_PER_SECOND (padrão: 100)  
  maxJoinsPerSecond: number;        // TENANT_MAX_JOINS_PER_SECOND (padrão: 100)
  healthCheckInterval: number;      // Health check personalizado (padrão: 30s)
  maxReconnectAttempts: number;     // Limite de tentativas de reconexão
  reconnectBackoffMs: number;       // Backoff entre reconexões
}

export interface DatabaseChangeEvent {
  channelId: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: RealtimePostgresChangesPayload<any>;
  timestamp: number;
}

export interface ChannelSubscription {
  channelId: string;
  tables: string[];
  filters?: Record<string, string>;
  onDatabaseChange?: (event: DatabaseChangeEvent) => void;
  onConnectionStatusChange?: (status: 'connected' | 'disconnected' | 'error', error?: string) => void;
  enabled: boolean;
}

// 🚨 CÓDIGOS DE ERRO OFICIAIS (da documentação)
export const REALTIME_ERROR_CODES = {
  'UnableToConnectToProject': 'Erro de conexão com projeto',
  'RealtimeRestarting': 'Realtime reiniciando',
  'ConnectionRateLimitReached': 'Rate limit de conexões atingido',
  'ChannelRateLimitReached': 'Rate limit de canais atingido', 
  'ClientJoinRateLimitReached': 'Rate limit de joins atingido',
  'UnableToSetPolicies': 'Erro ao configurar políticas RLS',
  'TenantNotFound': 'Tenant não encontrado',
  'InvalidJWTExpiration': 'JWT expirado ou inválido',
  'JwtSignatureError': 'Erro de assinatura JWT',
  'Unauthorized': 'Acesso não autorizado ao canal',
  'MalformedJWT': 'Token JWT mal formado',
  'DatabaseConnectionIssue': 'Problema de conexão com banco',
  'TimeoutOnRpcCall': 'Timeout em chamada RPC interna'
} as const;

/**
 * 🎯 REALTIME MANAGER SINGLETON
 * 
 * Centraliza TODA comunicação WebSocket seguindo documentação oficial:
 * - Singleton pattern para evitar múltiplas instâncias
 * - Event bus para desacoplamento total dos consumidores  
 * - Rate limiting automático baseado nos limites do servidor
 * - Health monitoring com códigos de erro oficiais
 * - Channel pooling para reutilização eficiente
 */
export class RealtimeManager {
  private static instance: RealtimeManager | null = null;
  
  // 🔧 CORE STATE
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, ChannelSubscription> = new Map();
  private eventBus: EventTarget = new EventTarget();
  private config: RealtimeManagerConfig;
  
  // 🔧 RATE LIMITING (baseado na documentação)
  private joinAttempts: number = 0;
  private lastJoinReset: number = Date.now();
  private reconnectAttempts: Map<string, number> = new Map();
  
  // 🔧 HEALTH MONITORING
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastEventTime: number = Date.now();
  private isShuttingDown: boolean = false;
  
  private constructor(config: RealtimeManagerConfig) {
    this.config = config;
    this.startHealthMonitoring();
    this.setupGlobalErrorHandling();
    
    // Manager inicializado
  }
  
  /**
   * 🎯 SINGLETON INSTANCE
   * Baseado no padrão da documentação oficial
   */
  public static getInstance(config?: RealtimeManagerConfig): RealtimeManager {
    if (!RealtimeManager.instance) {
      const defaultConfig: RealtimeManagerConfig = {
        maxChannelsPerClient: 100,      // Padrão oficial
        maxEventsPerSecond: 100,        // Padrão oficial  
        maxJoinsPerSecond: 50,          // Conservador (oficial: 100)
        healthCheckInterval: 30000,     // 30s
        maxReconnectAttempts: 5,        // Limite razoável
        reconnectBackoffMs: 2000       // 2s backoff
      };
      
      RealtimeManager.instance = new RealtimeManager(config || defaultConfig);
    }
    
    return RealtimeManager.instance;
  }
  
  /**
   * 🎯 SUBSCRIBE TO CHANNEL
   * 
   * API principal para componentes se conectarem ao realtime.
   * Implementa pooling de canais - reutiliza se já existe.
   */
  public subscribe(subscription: ChannelSubscription): boolean {
    if (!subscription.enabled) {
      return false;
    }
    
    // 🔐 RATE LIMITING CHECK
    if (!this.checkRateLimit()) {
      return false;
    }
    
    // 📋 ARMAZENAR SUBSCRIPTION
    this.subscriptions.set(subscription.channelId, subscription);
    
    // 🔄 CRIAR OU REUTILIZAR CANAL
    if (!this.channels.has(subscription.channelId)) {
      this.createChannel(subscription);
    } else {
      // Canal reutilizado
    }
    
    return true;
  }
  
  /**
   * 🎯 UNSUBSCRIBE FROM CHANNEL
   */
  public unsubscribe(channelId: string): void {
    this.subscriptions.delete(channelId);
    
    // 🧹 REMOVER CANAL SE NÃO HÁ MAIS SUBSCRIPTIONS
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelId);
      this.reconnectAttempts.delete(channelId);
    }
  }
  
  /**
   * 🎯 CRIAR CANAL BASEADO NA DOCUMENTAÇÃO
   */
  private createChannel(subscription: ChannelSubscription): void {
    try {
      const channel = supabase.channel(subscription.channelId);
      
      // 📋 CONFIGURAR LISTENERS PARA CADA TABELA
      subscription.tables.forEach(table => {
        const filter = subscription.filters?.[table];
        
        channel.on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table,
            ...(filter ? { filter } : {})
          },
          (payload) => this.handleDatabaseChange(subscription.channelId, table, payload)
        );
      });
      
      // 🏥 HEALTH MONITORING
      this.setupChannelHealthMonitoring(channel, subscription.channelId);
      
      // 🔌 SUBSCRIPTION COM ERROR HANDLING
      channel.subscribe((status) => {
        this.handleSubscriptionStatus(subscription.channelId, status);
      });
      
      this.channels.set(subscription.channelId, channel);
      
    } catch (error) {
      this.notifyConnectionError(subscription.channelId, 'Erro ao criar canal');
    }
  }
  
  /**
   * 🎯 HANDLER PARA MUDANÇAS NO BANCO
   * Event bus pattern para total desacoplamento
   */
  private handleDatabaseChange(
    channelId: string, 
    table: string, 
    payload: RealtimePostgresChangesPayload<any>
  ): void {
    this.lastEventTime = Date.now();
    
    const event: DatabaseChangeEvent = {
      channelId,
      table,
      eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      payload,
      timestamp: this.lastEventTime
    };
    
    // Evento recebido
    
    // 🎯 EVENT BUS DISPATCH
    const customEvent = new CustomEvent('database_change', { detail: event });
    this.eventBus.dispatchEvent(customEvent);
    
    // 🎯 CALLBACK DIRETO (se configurado)
    const subscription = this.subscriptions.get(channelId);
    if (subscription?.onDatabaseChange) {
      try {
        subscription.onDatabaseChange(event);
      } catch (error) {
        // Erro silencioso
      }
    }
  }
  
  /**
   * 🎯 RATE LIMITING BASEADO NA DOCUMENTAÇÃO
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset contador a cada segundo
    if (now - this.lastJoinReset >= 1000) {
      this.joinAttempts = 0;
      this.lastJoinReset = now;
    }
    
    // Verificar limite
    if (this.joinAttempts >= this.config.maxJoinsPerSecond) {
      return false;
    }
    
    this.joinAttempts++;
    return true;
  }
  
  /**
   * 🎯 HEALTH MONITORING GLOBAL
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.isShuttingDown) return;
      
      const now = Date.now();
      const timeSinceLastEvent = now - this.lastEventTime;
      
      // ⚠️ ALERTA: >60s sem eventos com canais ativos
      if (timeSinceLastEvent > 60000 && this.channels.size > 0) {
        // 🔄 RECONEXÃO PREVENTIVA após 90s
        if (timeSinceLastEvent > 90000) {
          this.preventiveReconnect();
        }
      }
      
    }, this.config.healthCheckInterval);
    
    // Health monitoring iniciado
  }
  
  /**
   * 🎯 RECONEXÃO PREVENTIVA
   */
  private preventiveReconnect(): void {
    const channelIds = Array.from(this.channels.keys());
    
    channelIds.forEach(channelId => {
      const subscription = this.subscriptions.get(channelId);
      if (subscription) {
        // Recriar canal
        this.unsubscribe(channelId);
        setTimeout(() => {
          this.subscribe(subscription);
        }, 1000); // Delay entre reconexões
      }
    });
  }
  
  /**
   * 🎯 SETUP ERROR HANDLING POR CANAL
   */
  private setupChannelHealthMonitoring(channel: RealtimeChannel, channelId: string): void {
    // Monitorar eventos do sistema
    channel.on('system', {}, (status) => {
      if (status.error) {
        this.handleChannelError(channelId, status.error);
      }
    });
  }
  
  /**
   * 🎯 HANDLER PARA STATUS DE SUBSCRIPTION
   */
  private handleSubscriptionStatus(channelId: string, status: string): void {
    const subscription = this.subscriptions.get(channelId);
    
    switch (status) {
      case 'SUBSCRIBED':
        this.reconnectAttempts.set(channelId, 0); // Reset tentativas
        this.notifyConnectionStatus(channelId, 'connected');
        break;
        
      case 'CHANNEL_ERROR':
        this.notifyConnectionStatus(channelId, 'error', 'Erro no canal');
        this.scheduleReconnect(channelId);
        break;
        
      case 'TIMED_OUT':
        this.notifyConnectionStatus(channelId, 'error', 'Timeout na conexão');
        this.scheduleReconnect(channelId);
        break;
        
      case 'CLOSED':
        this.notifyConnectionStatus(channelId, 'disconnected');
        break;
    }
  }
  
  /**
   * 🎯 HANDLER PARA ERROS DE CANAL
   */
  private handleChannelError(channelId: string, error: any): void {
    const errorCode = error.code || error.type || 'UnknownError';
    const errorMessage = REALTIME_ERROR_CODES[errorCode as keyof typeof REALTIME_ERROR_CODES] || error.message || 'Erro desconhecido';
    
    // Erro no canal
    
    this.notifyConnectionError(channelId, errorMessage);
    
    // 🔄 RECONEXÃO BASEADA NO TIPO DE ERRO
    if (this.shouldReconnectOnError(errorCode)) {
      this.scheduleReconnect(channelId);
    }
  }
  
  /**
   * 🎯 DECIDIR SE DEVE RECONECTAR BASEADO NO ERRO
   */
  private shouldReconnectOnError(errorCode: string): boolean {
    const reconnectableErrors = [
      'DatabaseConnectionIssue',
      'RealtimeRestarting', 
      'TimeoutOnRpcCall',
      'UnableToConnectToProject'
    ];
    
    return reconnectableErrors.includes(errorCode);
  }
  
  /**
   * 🎯 AGENDAR RECONEXÃO COM BACKOFF
   */
  private scheduleReconnect(channelId: string): void {
    const attempts = this.reconnectAttempts.get(channelId) || 0;
    
    if (attempts >= this.config.maxReconnectAttempts) {
      return;
    }
    
    const backoffTime = this.config.reconnectBackoffMs * Math.pow(2, attempts); // Exponential backoff
    
    setTimeout(() => {
      const subscription = this.subscriptions.get(channelId);
      if (subscription) {
        this.reconnectAttempts.set(channelId, attempts + 1);
        this.unsubscribe(channelId);
        this.subscribe(subscription);
      }
    }, backoffTime);
  }
  
  /**
   * 🎯 NOTIFICAR STATUS DE CONEXÃO
   */
  private notifyConnectionStatus(channelId: string, status: 'connected' | 'disconnected' | 'error', error?: string): void {
    const subscription = this.subscriptions.get(channelId);
    
    if (subscription?.onConnectionStatusChange) {
      subscription.onConnectionStatusChange(status, error);
    }
    
    // Event bus também
    const event = new CustomEvent('connection_status_change', {
      detail: { channelId, status, error }
    });
    this.eventBus.dispatchEvent(event);
  }
  
  private notifyConnectionError(channelId: string, errorMessage: string): void {
    this.notifyConnectionStatus(channelId, 'error', errorMessage);
  }
  
  /**
   * 🎯 SETUP GLOBAL ERROR HANDLING
   */
  private setupGlobalErrorHandling(): void {
    // Capturar erros não tratados do Supabase
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.message?.includes('realtime') || event.reason?.message?.includes('websocket')) {
          event.preventDefault(); // Prevenir crash da aplicação
        }
      });
    }
  }
  
  /**
   * 🎯 APIs PÚBLICAS PARA DEBUGGING
   */
  public getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }
  
  public getChannelStats(): Record<string, any> {
    return {
      activeChannels: this.channels.size,
      activeSubscriptions: this.subscriptions.size,
      joinAttempts: this.joinAttempts,
      lastEventTime: new Date(this.lastEventTime).toISOString(),
      timeSinceLastEvent: Date.now() - this.lastEventTime
    };
  }
  
  /**
   * 🎯 SHUTDOWN GRACEFUL
   */
  public shutdown(): void {
    this.isShuttingDown = true;
    
    // Parar health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Desconectar todos os canais
    this.channels.forEach((channel, channelId) => {
      channel.unsubscribe();
    });
    
    // Limpar state
    this.channels.clear();
    this.subscriptions.clear();
    this.reconnectAttempts.clear();
  }
  
  /**
   * 🎯 EVENT BUS PÚBLICO
   * Para componentes que preferem eventos ao invés de callbacks
   */
  public addEventListener(type: string, listener: EventListener): void {
    this.eventBus.addEventListener(type, listener);
  }
  
  public removeEventListener(type: string, listener: EventListener): void {
    this.eventBus.removeEventListener(type, listener);
  }
}

/**
 * 🎯 INSTÂNCIA GLOBAL SINGLETON
 * Disponível para toda a aplicação
 */
export const realtimeManager = RealtimeManager.getInstance();

/**
 * 🎯 SHUTDOWN AUTOMÁTICO NO UNLOAD
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    realtimeManager.shutdown();
  });
} 