'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  realtimeManager,
  type DatabaseChangeEvent,
  type ChannelSubscription
} from '../core/infrastructure/services/RealtimeManager';
import { configValidator, validateConfigOrThrow } from './utils/config-validator';
import { 
  realtimeErrorHandler,
  handleRealtimeError,
  handleRealtimeErrorWithRetry,
  handleRealtimeErrorWithFallback
} from './utils/error-handler';
import { RealtimeError, RealtimeErrorType } from './types/error-types';
import {
  useEventBatcher,
  useDebouncedStateUpdater,
  useMemoizationCache,
  useCleanupManager,
  debounce,
  createRAFScheduler
} from './utils/performance-optimizations';
import {
  debugLogger,
  performanceMonitor,
  connectionHealthMonitor,
  debugInfoCollector,
  realtimeDebugger
} from './utils';

// 🎯 INTERFACE PRINCIPAL DE CONFIGURAÇÃO
export interface UseRealtimeUnifiedConfig {
  // 📋 CONFIGURAÇÃO BÁSICA
  channelId?: string;                    // Auto-generated if not provided
  tables: string[];                      // Tables to monitor
  filters?: Record<string, string>;     // Table-specific filters

  // 🎛️ FEATURE FLAGS
  enableRealtime?: boolean;             // Enable/disable realtime (default: true)
  enablePolling?: boolean;              // Enable smart polling (default: true)
  enableFetch?: boolean;                // Enable data fetching (default: true)

  // 📊 DATA FETCHING (for unified hooks like useRealtimeUnificado)
  startDate?: Date | string;
  endDate?: Date | string;
  apiEndpoint?: string;
  fetchConfig?: FetchConfig;
  initialFetch?: boolean;              // Fetch data on mount (default: true when enableFetch is true)
  cacheTimeout?: number;               // Cache timeout in milliseconds (default: 5 minutes)

  // ⏱️ POLLING CONFIGURATION
  activeInterval?: number;              // Polling when active (default: 5000ms)
  inactiveInterval?: number;            // Polling when inactive (default: 30000ms)
  focusInterval?: number;               // Polling when focused (default: 5000ms)
  blurInterval?: number;                // Polling when blurred (default: 60000ms)

  // 🔄 CALLBACKS
  onDatabaseChange?: (event: DatabaseChangeEvent) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onDataUpdate?: (data: any[]) => void;
  onError?: (error: Error) => void;

  // 🐛 DEBUG
  debug?: boolean;
}

// 🎯 CONNECTION STATUS TYPE
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// 🎯 FETCH CONFIGURATION
export interface FetchConfig {
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  cacheTimeout?: number; // Cache validity in milliseconds
}

// 🎯 FETCH RESULT
export interface FetchResult<T = any> {
  data: T[];
  success: boolean;
  error?: string;
  timestamp: number;
  fromCache: boolean;
  reason?: string;
}

// 🎯 INTERFACE DE RETORNO
export interface UseRealtimeUnifiedReturn<T = any> {
  // 📊 DATA STATE
  data: T[];
  loading: boolean;
  error: string | null;

  // 🔌 CONNECTION STATE
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  lastEventTime: number | null;

  // 📈 STATISTICS
  eventsReceived: number;
  reconnectCount: number;

  // 🎯 ACTIVITY STATE (for smart polling)
  isActive: boolean;
  isVisible: boolean;

  // 🎛️ ACTIONS
  refetch: (reason?: string) => Promise<void>;
  reconnect: () => void;
  disconnect: () => void;
  forceExecute: () => void;

  // 📊 FETCH STATE
  fetchInProgress: boolean;
  lastFetchTime: number | null;
  lastFetchReason: string | null;
  fromCache: boolean;

  // 🚀 CACHE CONTROL METHODS
  clearCache: () => void;
  invalidateCacheForTables: (tables: string[]) => void;
  getCacheStats: () => {
    size: number;
    keys: string[];
    pendingRequests: number;
    hitRate: number;
    memoryUsage: number;
  };

  // 🐛 DEBUG INFO
  debugInfo: {
    channelId: string;
    tablesMonitored: string[];
    managerStats: Record<string, any>;
    pollingInterval: number;
  };
}

// 🎯 INTERNAL STATE INTERFACE
interface RealtimeHookState {
  data: any[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  lastEventTime: number | null;
  eventsReceived: number;
  reconnectCount: number;
  refetchCounter: number;
  isUserActive: boolean;
  isDocumentVisible: boolean;
  lastActivityTime: number;
  currentPollingInterval: number;
  pollingEnabled: boolean;
  // Data fetching state
  lastFetchTime: number | null;
  lastFetchReason: string | null;
  fetchInProgress: boolean;
  cacheTimestamp: number | null;
  fromCache: boolean;
}

// 🎯 ACTIVITY TRACKER CLASS
class ActivityTracker {
  private lastActivityTime: number = Date.now();
  private isUserActive: boolean = true;
  private isDocumentVisible: boolean = true;
  private inactivityTimeout: number;
  private activityListeners: (() => void)[] = [];
  private visibilityListeners: (() => void)[] = [];

  constructor(inactivityTimeout: number = 60000) {
    this.inactivityTimeout = inactivityTimeout;
    this.setupActivityListeners();
    this.setupVisibilityListeners();
  }

  private setupActivityListeners(): void {
    if (typeof window === 'undefined') return;

    const updateActivity = () => {
      this.lastActivityTime = Date.now();
      if (!this.isUserActive) {
        this.isUserActive = true;
        this.notifyActivityChange();
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });
  }

  private setupVisibilityListeners(): void {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      if (this.isDocumentVisible !== isVisible) {
        this.isDocumentVisible = isVisible;
        this.notifyVisibilityChange();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  public updateActivity(): void {
    this.lastActivityTime = Date.now();
    if (!this.isUserActive) {
      this.isUserActive = true;
      this.notifyActivityChange();
    }
  }

  public checkInactivity(): boolean {
    const now = Date.now();
    const isInactive = (now - this.lastActivityTime) > this.inactivityTimeout;

    if (this.isUserActive && isInactive) {
      this.isUserActive = false;
      this.notifyActivityChange();
    }

    return isInactive;
  }

  public getCurrentInterval(config: UseRealtimeUnifiedConfig): number {
    if (!this.isDocumentVisible) {
      return config.blurInterval || 60000;
    }

    if (!this.isUserActive) {
      return config.inactiveInterval || 30000;
    }

    return config.activeInterval || 5000;
  }

  public addActivityListener(listener: () => void): void {
    this.activityListeners.push(listener);
  }

  public addVisibilityListener(listener: () => void): void {
    this.visibilityListeners.push(listener);
  }

  public removeActivityListener(listener: () => void): void {
    const index = this.activityListeners.indexOf(listener);
    if (index > -1) {
      this.activityListeners.splice(index, 1);
    }
  }

  public removeVisibilityListener(listener: () => void): void {
    const index = this.visibilityListeners.indexOf(listener);
    if (index > -1) {
      this.visibilityListeners.splice(index, 1);
    }
  }

  private notifyActivityChange(): void {
    this.activityListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        // Silent error handling
      }
    });
  }

  private notifyVisibilityChange(): void {
    this.visibilityListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        // Silent error handling
      }
    });
  }

  public getState() {
    return {
      isActive: this.isUserActive,
      isVisible: this.isDocumentVisible,
      lastActivityTime: this.lastActivityTime
    };
  }
}

// 🎯 GLOBAL ACTIVITY TRACKER INSTANCE
let globalActivityTracker: ActivityTracker | null = null;

function getActivityTracker(): ActivityTracker {
  if (!globalActivityTracker) {
    globalActivityTracker = new ActivityTracker();
  }
  return globalActivityTracker;
}

// 🎯 DATA FETCHING UTILITIES
class DataFetcher {
  private cache = new Map<string, { data: any[], timestamp: number, reason: string, hash: string }>();
  private pendingRequests = new Map<string, Promise<FetchResult<any>>>();
  private maxCacheSize = 50; // Limite de entradas no cache
  private cacheAccessOrder = new Map<string, number>(); // Para LRU

  private getCacheKey(config: UseRealtimeUnifiedConfig): string {
    const key = {
      endpoint: config.apiEndpoint || config.fetchConfig?.endpoint,
      startDate: config.startDate,
      endDate: config.endDate,
      tables: [...config.tables].sort(), // Cria nova array para evitar mutação
      filters: config.filters
    };
    return JSON.stringify(key);
  }

  private getDataHash(data: any[]): string {
    // Hash simples baseado no tamanho e primeiro/último item
    if (!data.length) return '0';
    const first = JSON.stringify(data[0]);
    const last = data.length > 1 ? JSON.stringify(data[data.length - 1]) : first;
    return `${data.length}-${first.length}-${last.length}`;
  }

  private isCacheValid(timestamp: number, cacheTimeout: number): boolean {
    return (Date.now() - timestamp) < cacheTimeout;
  }

  private evictLRU(): void {
    if (this.cache.size <= this.maxCacheSize) return;
    
    // Encontra a entrada menos recentemente usada
    let oldestKey = '';
    let oldestTime = Date.now();
    
    Array.from(this.cacheAccessOrder.entries()).forEach(([key, accessTime]) => {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheAccessOrder.delete(oldestKey);
    }
  }

  private updateCacheAccess(key: string): void {
    this.cacheAccessOrder.set(key, Date.now());
  }

  async fetchData<T = any>(
    config: UseRealtimeUnifiedConfig,
    reason: string = 'manual',
    abortController?: AbortController
  ): Promise<FetchResult<T>> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(config);
    const cacheTimeout = config.cacheTimeout || 300000; // 5 minutes default

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached.timestamp, cacheTimeout)) {
      this.updateCacheAccess(cacheKey);
      return {
        data: cached.data,
        success: true,
        timestamp: cached.timestamp,
        fromCache: true,
        reason: cached.reason
      };
    }

    // Deduplicação: verifica se já existe uma requisição pendente para a mesma chave
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Cria a promise da requisição e adiciona à lista de pendentes
    const fetchPromise = this.performActualFetch(config, reason, abortController, cacheKey, cached, startTime);
    this.pendingRequests.set(cacheKey, fetchPromise);
    
    return fetchPromise;
  }

  private async performActualFetch<T = any>(
    config: UseRealtimeUnifiedConfig,
    reason: string,
    abortController: AbortController | undefined,
    cacheKey: string,
    cached: any,
    startTime: number
  ): Promise<FetchResult<T>> {
    try {
      let fetchConfig: FetchConfig;

      // Use provided fetchConfig or build from legacy properties
      if (config.fetchConfig) {
        fetchConfig = config.fetchConfig;
      } else if (config.apiEndpoint) {
        fetchConfig = {
          endpoint: config.apiEndpoint,
          method: 'GET',
          timeout: 10000,
          retries: 3
        };
      } else {
        throw new Error('No fetch configuration provided');
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (config.startDate) {
        params.append('startDate', typeof config.startDate === 'string' ? config.startDate : config.startDate.toISOString());
      }
      if (config.endDate) {
        params.append('endDate', typeof config.endDate === 'string' ? config.endDate : config.endDate.toISOString());
      }
      if (config.filters) {
        Object.entries(config.filters).forEach(([key, value]) => {
          params.append(key, value);
        });
      }

      const url = params.toString() ? `${fetchConfig.endpoint}?${params.toString()}` : fetchConfig.endpoint;

      // Perform fetch with retries
      const response = await this.fetchWithRetry(url, {
        method: fetchConfig.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...fetchConfig.headers
        },
        body: fetchConfig.body ? JSON.stringify(fetchConfig.body) : undefined,
        signal: abortController?.signal
      }, fetchConfig.retries || 3, fetchConfig.timeout || 10000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const result = Array.isArray(data) ? data : [data];
      const dataHash = this.getDataHash(result);

      // Verifica se os dados realmente mudaram
      const hasDataChanged = !cached || cached.hash !== dataHash;
      
      if (hasDataChanged) {
        // Evita cache muito grande
        this.evictLRU();
        
        // Cache the result
        this.cache.set(cacheKey, {
          data: result,
          timestamp: startTime,
          reason,
          hash: dataHash
        });
        this.updateCacheAccess(cacheKey);
      }

      // Remove da lista de requisições pendentes
      this.pendingRequests.delete(cacheKey);

      return {
        data: result,
        success: true,
        timestamp: startTime,
        fromCache: false,
        reason
      };

    } catch (error) {
      // Remove da lista de requisições pendentes em caso de erro
      this.pendingRequests.delete(cacheKey);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';

      return {
        data: [],
        success: false,
        error: errorMessage,
        timestamp: startTime,
        fromCache: false,
        reason
      };
    }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number,
    timeout: number = 10000
  ): Promise<Response> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout);
        });

        // Race between fetch and timeout
        const response = await Promise.race([
          fetch(url, options),
          timeoutPromise
        ]);

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < retries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheAccessOrder.clear();
    this.pendingRequests.clear();
  }

  // Invalidação inteligente baseada em tabelas afetadas
  invalidateCacheForTables(tables: string[]): void {
    const keysToDelete: string[] = [];
    
    Array.from(this.cache.keys()).forEach(key => {
      try {
        const parsedKey = JSON.parse(key);
        const keyTables = parsedKey.tables || [];
        
        // Se alguma tabela do cache coincide com as tabelas afetadas
        if (tables.some(table => keyTables.includes(table))) {
          keysToDelete.push(key);
        }
      } catch (error) {
        // Se não conseguir parsear a chave, remove por segurança
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheAccessOrder.delete(key);
    });
  }

  // Invalidação baseada em endpoint
  invalidateCacheForEndpoint(endpoint: string): void {
    const keysToDelete: string[] = [];
    
    Array.from(this.cache.keys()).forEach(key => {
      try {
        const parsedKey = JSON.parse(key);
        if (parsedKey.endpoint === endpoint) {
          keysToDelete.push(key);
        }
      } catch (error) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheAccessOrder.delete(key);
    });
  }

  getCacheStats(): { 
    size: number; 
    keys: string[]; 
    pendingRequests: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const totalRequests = this.cacheAccessOrder.size;
    const cacheHits = Array.from(this.cacheAccessOrder.values()).length;
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      pendingRequests: this.pendingRequests.size,
      hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;
    Array.from(this.cache.entries()).forEach(([key, value]) => {
      totalSize += key.length * 2; // Aproximação para string UTF-16
      totalSize += JSON.stringify(value.data).length * 2;
    });
    return totalSize;
  }
}

// 🎯 GLOBAL DATA FETCHER INSTANCE
let globalDataFetcher: DataFetcher | null = null;

function getDataFetcher(): DataFetcher {
  if (!globalDataFetcher) {
    globalDataFetcher = new DataFetcher();
  }
  return globalDataFetcher;
}

/**
 * 🎯 HOOK REALTIME UNIFICADO
 * 
 * Consolida todos os hooks de realtime existentes em uma única implementação
 * que utiliza o RealtimeManager para gerenciamento eficiente de conexões.
 */
export const useRealtimeUnified = <T = any>(
  config: UseRealtimeUnifiedConfig
): UseRealtimeUnifiedReturn<T> => {

  // 🔧 VALIDATE AND SANITIZE CONFIG
  let sanitizedConfig: UseRealtimeUnifiedConfig;
  try {
    validateConfigOrThrow(config);
    sanitizedConfig = configValidator.sanitizeConfig(config);
  } catch (error) {
    // Handle configuration error through error handler
    const configError = error instanceof Error ? error : new Error('Configuration error');
    handleRealtimeError(configError, {
      operation: 'config_validation',
      channelId: config.channelId,
      timestamp: Date.now()
    });

    // Return error state immediately for invalid config
    return {
      data: [],
      loading: false,
      error: configError.message,
      isConnected: false,
      connectionStatus: 'error',
      lastEventTime: null,
      eventsReceived: 0,
      reconnectCount: 0,
      isActive: true,
      isVisible: true,
      refetch: async () => { },
      reconnect: () => { },
      disconnect: () => { },
      forceExecute: () => { },
      fetchInProgress: false,
      lastFetchTime: null,
      lastFetchReason: null,
      fromCache: false,
      clearCache: () => { },
      invalidateCacheForTables: () => { },
      getCacheStats: () => ({ size: 0, keys: [], pendingRequests: 0, hitRate: 0, memoryUsage: 0 }),
      debugInfo: {
        channelId: 'invalid',
        tablesMonitored: [],
        managerStats: {},
        pollingInterval: 0
      }
    };
  }

  // 🔧 GENERATE CHANNEL ID IF NOT PROVIDED
  const channelId = sanitizedConfig.channelId || `unified-${sanitizedConfig.tables.join('-')}-${Date.now()}`;

  // 📊 DETERMINE INITIAL LOADING STATE
  const shouldFetchInitially = sanitizedConfig.enableFetch !== false &&
    (sanitizedConfig.initialFetch !== false) &&
    Boolean(sanitizedConfig.apiEndpoint || sanitizedConfig.fetchConfig);

  const shouldConnectRealtime = sanitizedConfig.enableRealtime !== false && sanitizedConfig.tables.length > 0;

  // 📊 INITIAL STATE
  const [state, setState] = useState<RealtimeHookState>({
    data: [],
    loading: shouldFetchInitially || shouldConnectRealtime, // Loading if we will fetch OR connect to realtime
    error: null,
    isConnected: false,
    connectionStatus: 'disconnected',
    lastEventTime: null,
    eventsReceived: 0,
    reconnectCount: 0,
    refetchCounter: 0,
    isUserActive: true,
    isDocumentVisible: true,
    lastActivityTime: Date.now(),
    currentPollingInterval: sanitizedConfig.activeInterval || 5000,
    pollingEnabled: sanitizedConfig.enablePolling !== false,
    // Data fetching state
    lastFetchTime: null,
    lastFetchReason: null,
    fetchInProgress: shouldFetchInitially, // Only start fetch progress if we will fetch
    cacheTimestamp: null,
    fromCache: false
  });

  // 🎯 PERFORMANCE OPTIMIZATIONS
  const cleanupManager = useCleanupManager();
  const memoCache = useMemoizationCache<string, any>(50, 300000); // 5 minutes TTL
  
  // RAF scheduler for batching state updates
  const rafSchedulerRef = useRef(createRAFScheduler());
  
  // Debounced connection status updater to prevent excessive re-renders
  const debouncedConnectionUpdater = useDebouncedStateUpdater<Partial<RealtimeHookState>>(
    (updates) => {
      rafSchedulerRef.current.schedule(() => {
        setState(prev => {
          // Only update if values actually changed to prevent unnecessary re-renders
          const hasChanges = Object.keys(updates).some(key => 
            prev[key as keyof RealtimeHookState] !== updates[key as keyof RealtimeHookState]
          );
          return hasChanges ? { ...prev, ...updates } : prev;
        });
      });
    },
    50 // 50ms debounce for connection status
  );

  // Event batcher for database changes to reduce re-renders
  const eventBatcher = useEventBatcher<DatabaseChangeEvent>(
    (events) => {
      // Process batched events
      const eventTime = Date.now();
      const eventCount = events.length;
      
      // Use optimized state updater
      updateStateOptimized({
        lastEventTime: eventTime,
        eventsReceived: state.eventsReceived + eventCount,
        error: null // Clear any previous errors on successful events
      });

      // Call user callback for each event (but batched)
      if (configRef.current.onDatabaseChange) {
        // Use requestIdleCallback for non-critical callback processing
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            events.forEach(event => {
              try {
                configRef.current.onDatabaseChange!(event);
              } catch (error) {
                handleRealtimeError(error instanceof Error ? error : new Error('Database change callback error'), {
                  operation: 'database_change_callback',
                  channelId: event.channelId,
                  table: event.table,
                  timestamp: Date.now()
                });
              }
            });
          });
        } else {
          // Fallback for environments without requestIdleCallback
          setTimeout(() => {
            events.forEach(event => {
              try {
                configRef.current.onDatabaseChange!(event);
              } catch (error) {
                handleRealtimeError(error instanceof Error ? error : new Error('Database change callback error'), {
                  operation: 'database_change_callback',
                  channelId: event.channelId,
                  table: event.table,
                  timestamp: Date.now()
                });
              }
            });
          }, 0);
        }
      }

      // Debug logging for batched events (only in development)
      if (configRef.current.debug && process.env.NODE_ENV === 'development') {
        console.log(`[useRealtimeUnified] Processed ${eventCount} batched database events:`, {
          channelId,
          events: events.map(e => ({ table: e.table, eventType: e.eventType })),
          timestamp: new Date(eventTime).toISOString()
        });
      }

      // Trigger refetch on database changes if fetch is enabled (debounced)
      if (configRef.current.enableFetch !== false &&
        (configRef.current.apiEndpoint || configRef.current.fetchConfig)) {
        debouncedRefetch('database_change');
      }
    },
    16, // ~60fps batching
    5   // Max 5 events per batch
  );

  // 🔧 REFS FOR STABLE REFERENCES
  const configRef = useRef(sanitizedConfig);
  const subscriptionRef = useRef<ChannelSubscription | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activityTrackerRef = useRef<ActivityTracker | null>(null);
  const dataFetcherRef = useRef<DataFetcher | null>(null);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  
  // Performance optimization refs
  const lastStateUpdateRef = useRef<number>(0);
  const pendingStateUpdatesRef = useRef<Partial<RealtimeHookState>[]>([]);

  // Update config ref
  configRef.current = sanitizedConfig;

  // 🎯 INITIALIZE DATA FETCHER
  if (!dataFetcherRef.current) {
    dataFetcherRef.current = getDataFetcher();
  }

  // 🎯 DEBOUNCED REFETCH FUNCTION
  const debouncedRefetch = useMemo(() => {
    const debouncedFn = debounce((reason: string) => {
      // Check if component is still mounted and fetch is enabled
      if (configRef.current.enableFetch === false) return;
      
      performFetch(reason).catch(error => {
        handleRealtimeError(error instanceof Error ? error : new Error('Debounced refetch failed'), {
          operation: 'debounced_refetch',
          channelId,
          timestamp: Date.now()
        });
      });
    }, 100); // 100ms debounce for refetch
    
    // Cleanup function for the debounced refetch
    cleanupManager.addCleanup(() => {
      debouncedFn.cancel();
    });
    
    return debouncedFn;
  }, [channelId, cleanupManager]);

  // 🎯 MEMOIZED STATE UPDATER
  const updateStateOptimized = useCallback((updates: Partial<RealtimeHookState>) => {
    const now = Date.now();
    
    // Batch state updates to prevent excessive re-renders
    if (now - lastStateUpdateRef.current < 16) { // ~60fps throttling
      pendingStateUpdatesRef.current.push(updates);
      return;
    }
    
    // Apply all pending updates at once
    const allUpdates = [...pendingStateUpdatesRef.current, updates];
    pendingStateUpdatesRef.current = [];
    lastStateUpdateRef.current = now;
    
    const mergedUpdates = allUpdates.reduce((acc, update) => ({ ...acc, ...update }), {});
    
    rafSchedulerRef.current.schedule(() => {
      setState(prev => {
        // Shallow comparison to prevent unnecessary re-renders
        const hasChanges = Object.keys(mergedUpdates).some(key => {
          const newValue = mergedUpdates[key as keyof RealtimeHookState];
          const oldValue = prev[key as keyof RealtimeHookState];
          
          // Deep comparison for arrays and objects
          if (Array.isArray(newValue) && Array.isArray(oldValue)) {
            return JSON.stringify(newValue) !== JSON.stringify(oldValue);
          }
          
          return newValue !== oldValue;
        });
        
        return hasChanges ? { ...prev, ...mergedUpdates } : prev;
      });
    });
  }, []);

  // 🎯 DATA FETCHING FUNCTION
  const performFetch = useCallback(async (reason: string = 'manual'): Promise<void> => {
    if (!dataFetcherRef.current || sanitizedConfig.enableFetch === false) {
      return;
    }

    const fetchStartTime = Date.now();
    const endpoint = sanitizedConfig.apiEndpoint || sanitizedConfig.fetchConfig?.endpoint || 'unknown';
    
    // Iniciar timing de performance
    performanceMonitor.startTiming('fetch', { reason, endpoint });
    
    // Debug logging
    if (sanitizedConfig.debug) {
      debugLogger.info('Starting data fetch', { channelId, reason, endpoint });
      
      if (debugSessionRef.current) {
        realtimeDebugger.addEvent(
          debugSessionRef.current,
          'data',
          'fetch_start',
          `Starting fetch: ${reason}`,
          { reason, endpoint },
          'low'
        );
      }
    }

    // Abort any ongoing fetch
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    fetchAbortControllerRef.current = new AbortController();

    updateStateOptimized({
      fetchInProgress: true,
      error: null,
      loading: true
    });

    try {
      const result = await dataFetcherRef.current.fetchData(configRef.current, reason, fetchAbortControllerRef.current || undefined);

      if (result.success) {
        updateStateOptimized({
          data: result.data,
          loading: false,
          error: null,
          lastFetchTime: result.timestamp,
          lastFetchReason: reason,
          fetchInProgress: false,
          cacheTimestamp: result.timestamp,
          fromCache: result.fromCache
        });

        // Call onDataUpdate callback (non-blocking)
        if (configRef.current.onDataUpdate) {
          // Use requestIdleCallback for non-critical callback processing
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(() => {
              try {
                configRef.current.onDataUpdate!(result.data);
              } catch (error) {
                handleRealtimeError(error instanceof Error ? error : new Error('Callback error'), {
                  operation: 'data_update_callback',
                  channelId,
                  timestamp: Date.now()
                });
              }
            });
          } else {
            // Fallback for environments without requestIdleCallback
            setTimeout(() => {
              try {
                configRef.current.onDataUpdate!(result.data);
              } catch (error) {
                handleRealtimeError(error instanceof Error ? error : new Error('Callback error'), {
                  operation: 'data_update_callback',
                  channelId,
                  timestamp: Date.now()
                });
              }
            }, 0);
          }
        }

        // Finalizar timing de performance
        const fetchDuration = Date.now() - fetchStartTime;
        performanceMonitor.endTiming('fetch', true, { 
          reason, 
          dataCount: result.data.length, 
          fromCache: result.fromCache,
          duration: fetchDuration
        });
        
        // Registrar requisição de rede
        performanceMonitor.recordNetworkRequest(
          endpoint,
          'GET',
          fetchDuration,
          true,
          JSON.stringify(result.data).length,
          result.fromCache
        );
        
        // Debug logging
        if (configRef.current.debug) {
          debugLogger.logDataFetch(
            channelId,
            endpoint,
            true,
            fetchDuration,
            result.data.length,
            result.fromCache
          );
          
          if (debugSessionRef.current) {
            realtimeDebugger.addEvent(
              debugSessionRef.current,
              'data',
              'fetch_success',
              `Fetch completed successfully: ${reason}`,
              { 
                reason, 
                dataCount: result.data.length, 
                fromCache: result.fromCache,
                duration: fetchDuration
              },
              'low'
            );
          }
        }
      } else {
        const fetchError = new Error(result.error || 'Fetch failed');
        
        // Handle fetch error through error handler with retry
        const recoveryResult = await handleRealtimeErrorWithRetry(
          fetchError,
          () => dataFetcherRef.current!.fetchData(configRef.current, reason, fetchAbortControllerRef.current || undefined),
          {
            operation: 'data_fetch',
            channelId,
            endpoint: configRef.current.apiEndpoint || configRef.current.fetchConfig?.endpoint,
            timestamp: Date.now()
          }
        );

        if (recoveryResult.success) {
          // Recovery was successful, don't update error state
          return;
        }

        updateStateOptimized({
          loading: false,
          error: result.error || 'Fetch failed',
          fetchInProgress: false,
          lastFetchTime: result.timestamp,
          lastFetchReason: reason
        });

        // Call error callback
        if (configRef.current.onError) {
          try {
            configRef.current.onError(fetchError);
          } catch (callbackError) {
            handleRealtimeError(callbackError instanceof Error ? callbackError : new Error('Error callback failed'), {
              operation: 'error_callback',
              channelId,
              timestamp: Date.now()
            });
          }
        }

        // Finalizar timing de performance com erro
        const fetchDuration = Date.now() - fetchStartTime;
        performanceMonitor.endTiming('fetch', false, { 
          reason, 
          error: result.error,
          duration: fetchDuration
        });
        
        // Registrar requisição de rede falhada
        performanceMonitor.recordNetworkRequest(
          endpoint,
          'GET',
          fetchDuration,
          false,
          0,
          false
        );
        
        // Debug logging
        if (configRef.current.debug) {
          debugLogger.logDataFetch(
            channelId,
            endpoint,
            false,
            fetchDuration,
            0,
            false,
            result.error
          );
          
          if (debugSessionRef.current) {
            realtimeDebugger.addEvent(
              debugSessionRef.current,
              'error',
              'fetch_failed',
              `Fetch failed: ${result.error}`,
              { 
                reason, 
                error: result.error,
                duration: fetchDuration
              },
              'high'
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Fetch was aborted, don't update state
        return;
      }

      const fetchError = error instanceof Error ? error : new Error('Unknown fetch error');
      
      // Handle fetch error through error handler with fallback
      const recoveryResult = await handleRealtimeErrorWithFallback(
        fetchError,
        () => {
          // Fallback: clear loading state and set error
          updateStateOptimized({
            loading: false,
            error: fetchError.message,
            fetchInProgress: false,
            lastFetchTime: Date.now(),
            lastFetchReason: reason
          });
          return Promise.resolve();
        },
        {
          operation: 'data_fetch',
          channelId,
          endpoint: configRef.current.apiEndpoint || configRef.current.fetchConfig?.endpoint,
          timestamp: Date.now()
        }
      );

      // Call error callback
      if (configRef.current.onError) {
        try {
          configRef.current.onError(fetchError);
        } catch (callbackError) {
          handleRealtimeError(callbackError instanceof Error ? callbackError : new Error('Error callback failed'), {
            operation: 'error_callback',
            channelId,
            timestamp: Date.now()
          });
        }
      }

      // Finalizar timing de performance com erro
      const fetchDuration = Date.now() - fetchStartTime;
      performanceMonitor.endTiming('fetch', false, { 
        reason, 
        error: fetchError.message,
        duration: fetchDuration
      });
      
      // Registrar requisição de rede falhada
      performanceMonitor.recordNetworkRequest(
        endpoint,
        'GET',
        fetchDuration,
        false,
        0,
        false
      );
      
      // Debug logging
      if (configRef.current.debug) {
        debugLogger.error('Data fetch error', fetchError, { channelId, reason, duration: fetchDuration });
        
        if (debugSessionRef.current) {
          realtimeDebugger.addEvent(
            debugSessionRef.current,
            'error',
            'fetch_exception',
            `Fetch exception: ${fetchError.message}`,
            { 
              reason, 
              error: fetchError.message,
              duration: fetchDuration,
              stack: fetchError.stack
            },
            'critical'
          );
        }
      }
    }
  }, [channelId, sanitizedConfig.enableFetch, sanitizedConfig.debug]);

  // 🎯 ACTIVITY TRACKER SETUP
  useEffect(() => {
    if (sanitizedConfig.enablePolling !== false) {
      activityTrackerRef.current = getActivityTracker();

      const handleActivityChange = () => {
        const tracker = activityTrackerRef.current;
        if (tracker) {
          const activityState = tracker.getState();
          const newInterval = tracker.getCurrentInterval(configRef.current);
          
          // Use optimized state updater for activity changes
          updateStateOptimized({
            isUserActive: activityState.isActive,
            isDocumentVisible: activityState.isVisible,
            lastActivityTime: activityState.lastActivityTime,
            currentPollingInterval: newInterval
          });
        }
      };

      const tracker = activityTrackerRef.current;
      tracker.addActivityListener(handleActivityChange);
      tracker.addVisibilityListener(handleActivityChange);

      return () => {
        tracker.removeActivityListener(handleActivityChange);
        tracker.removeVisibilityListener(handleActivityChange);
      };
    }
  }, [sanitizedConfig.enablePolling]);

  // 🎯 INITIAL DATA FETCH
  useEffect(() => {
    const shouldFetchInitially = sanitizedConfig.enableFetch !== false &&
      (sanitizedConfig.initialFetch !== false) &&
      Boolean(sanitizedConfig.apiEndpoint || sanitizedConfig.fetchConfig);

    if (shouldFetchInitially) {
      performFetch('initial_load');
    } else {
      // If fetch is disabled or no endpoint, clear fetch-related loading state
      updateStateOptimized({
        loading: shouldConnectRealtime, // Keep loading only if realtime is connecting
        fetchInProgress: false
      });
    }
  }, [
    sanitizedConfig.enableFetch,
    sanitizedConfig.initialFetch,
    sanitizedConfig.apiEndpoint,
    sanitizedConfig.fetchConfig?.endpoint,
    performFetch,
    shouldConnectRealtime
  ]);

  // 🎯 DATABASE CHANGE HANDLER (OPTIMIZED WITH BATCHING)
  const handleDatabaseChange = useCallback((event: DatabaseChangeEvent) => {
    const eventStartTime = Date.now();
    
    // Registrar latência do evento
    const eventLatency = eventStartTime - (event.timestamp || eventStartTime);
    connectionHealthMonitor.recordEventLatency(event.eventType, eventLatency);
    
    // Registrar evento de dados
    const eventId = `${event.table}-${event.eventType}-${event.timestamp}`;
    connectionHealthMonitor.recordDataEvent('received', eventId, event.table, event.payload ? JSON.stringify(event.payload).length : undefined);
    
    // 🚀 INVALIDAÇÃO INTELIGENTE DO CACHE
    // Invalida cache para tabelas afetadas quando há mudanças significativas
    if (dataFetcherRef.current && ['INSERT', 'UPDATE', 'DELETE'].includes(event.eventType)) {
      dataFetcherRef.current.invalidateCacheForTables([event.table]);
      
      // Se a configuração tem endpoint específico, também invalida por endpoint
      const endpoint = configRef.current.apiEndpoint || configRef.current.fetchConfig?.endpoint;
      if (endpoint) {
        dataFetcherRef.current.invalidateCacheForEndpoint(endpoint);
      }
      
      // Debug logging para invalidação de cache
      if (configRef.current.debug) {
        debugLogger.info('Cache invalidated for database change', {
          table: event.table,
          eventType: event.eventType,
          endpoint
        });
      }
    }
    
    // Debug logging
    if (configRef.current.debug) {
      debugLogger.logDatabaseEvent(channelId, event.table, event.eventType, event.payload);
      
      // Adicionar evento à sessão de debug
      if (debugSessionRef.current) {
        realtimeDebugger.addEvent(
          debugSessionRef.current,
          'data',
          'database_change',
          `${event.eventType} on ${event.table}`,
          { 
            table: event.table, 
            eventType: event.eventType, 
            latency: eventLatency,
            payloadSize: event.payload ? JSON.stringify(event.payload).length : 0
          },
          'low'
        );
      }
    }
    
    // Registrar no monitor de performance
    performanceMonitor.recordDatabaseEvent(event.eventType, eventLatency, event.payload ? JSON.stringify(event.payload).length : undefined);
    
    // Add event to batcher for optimized processing
    eventBatcher.addEvent(event);
  }, [eventBatcher, channelId]);

  // 🎯 CONNECTION STATUS HANDLER (OPTIMIZED WITH DEBOUNCING)
  const handleConnectionChange = useCallback((status: 'connected' | 'disconnected' | 'error', error?: string) => {
    const connectionStatus: ConnectionStatus = status === 'connected' ? 'connected' :
      status === 'error' ? 'error' : 'disconnected';

    // Use memoization to avoid unnecessary state updates for same status
    const cacheKey = `connection-${status}-${error || ''}`;
    const cached = memoCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - 1000) { // 1 second cache
      return; // Skip duplicate connection status updates
    }

    memoCache.set(cacheKey, { timestamp: Date.now() });

    // Get current state to calculate reconnect count
    setState(prev => {
      const isNewConnection = status === 'connected' && prev.connectionStatus !== 'connected';
      const newReconnectCount = isNewConnection ? prev.reconnectCount + 1 : prev.reconnectCount;

      const updates = {
        isConnected: status === 'connected',
        connectionStatus,
        error: status === 'error' ? (error || 'Connection error') :
          status === 'connected' ? null : prev.error, // Clear error on successful connection
        reconnectCount: newReconnectCount
      };

      // Use debounced updater for connection status to prevent rapid re-renders
      debouncedConnectionUpdater.update(updates);
      
      return prev; // Return previous state, updates will be applied via debounced updater
    });

    // Debug logging e monitoramento
    if (configRef.current.debug) {
      debugLogger.logConnection(channelId, status, { error, timestamp: Date.now() });
      
      // Adicionar evento à sessão de debug
      if (debugSessionRef.current) {
        realtimeDebugger.addEvent(
          debugSessionRef.current,
          'connection',
          'status_change',
          `Connection ${status}${error ? `: ${error}` : ''}`,
          { status, error, connectionStatus },
          status === 'error' ? 'high' : 'medium'
        );
      }
    }

    // Registrar evento no monitor de saúde
    connectionHealthMonitor.recordConnectionEvent(status, error);

    // Call user callback with error handling
    if (configRef.current.onConnectionChange) {
      try {
        configRef.current.onConnectionChange(connectionStatus);
      } catch (callbackError) {
        handleRealtimeError(callbackError instanceof Error ? callbackError : new Error('Connection change callback error'), {
          operation: 'connection_change_callback',
          channelId,
          timestamp: Date.now()
        });
      }
    }

    // Handle connection error through error handler
    if (status === 'error') {
      const connectionError = new Error(error || 'Connection error');
      
      // Handle connection error with automatic recovery
      handleRealtimeErrorWithRetry(
        connectionError,
        () => {
          // Retry connection by recreating subscription
          if (subscriptionRef.current) {
            realtimeManager.unsubscribe(channelId);
            setTimeout(() => {
              if (subscriptionRef.current) {
                realtimeManager.subscribe(subscriptionRef.current);
              }
            }, 1000);
          }
          return Promise.resolve();
        },
        {
          operation: 'connection_recovery',
          channelId,
          timestamp: Date.now()
        }
      );

      // Call error callback
      if (configRef.current.onError) {
        try {
          configRef.current.onError(connectionError);
        } catch (callbackError) {
          handleRealtimeError(callbackError instanceof Error ? callbackError : new Error('Error callback failed'), {
            operation: 'error_callback',
            channelId,
            timestamp: Date.now()
          });
        }
      }
    }
  }, [channelId]);

  // 🎯 SETUP REALTIME SUBSCRIPTION
  useEffect(() => {
    if (sanitizedConfig.enableRealtime === false || sanitizedConfig.tables.length === 0) {
      updateStateOptimized({
        connectionStatus: 'disconnected',
        isConnected: false
      });
      return;
    }

    // Set connecting status
    updateStateOptimized({
      connectionStatus: 'connecting',
      loading: true,
      error: null
    });

    const subscription: ChannelSubscription = {
      channelId,
      tables: [...sanitizedConfig.tables],
      filters: sanitizedConfig.filters ? { ...sanitizedConfig.filters } : undefined,
      onDatabaseChange: handleDatabaseChange,
      onConnectionStatusChange: handleConnectionChange,
      enabled: true
    };

    subscriptionRef.current = subscription;

    // Debug logging
    if (sanitizedConfig.debug) {
      console.log(`[useRealtimeUnified] Setting up subscription:`, {
        channelId,
        tables: subscription.tables,
        filters: subscription.filters,
        timestamp: new Date().toISOString()
      });
    }

    const success = realtimeManager.subscribe(subscription);

    if (!success) {
      // Obter status detalhado do rate limiting
      const rateLimitStatus = realtimeManager.getRateLimitStatus();
      const managerStats = realtimeManager.getStats();
      
      const subscriptionError = new Error(
        `Subscription failed - Rate limit: ${rateLimitStatus.joinAttempts}/${rateLimitStatus.maxJoinsPerSecond}, ` +
        `Active channels: ${managerStats.activeChannels}, Time until reset: ${rateLimitStatus.timeUntilReset}ms`
      );
      
      // Log detalhado para debugging
      console.warn('[useRealtimeUnified] Subscription failed:', {
        channelId,
        rateLimitStatus,
        managerStats,
        tables: sanitizedConfig.tables
      });
      
      // Handle subscription error through error handler
      handleRealtimeError(subscriptionError, {
        operation: 'subscription',
        channelId,
        tables: sanitizedConfig.tables,
        timestamp: Date.now()
      });

      // Não definir como erro imediatamente - o RealtimeManager vai tentar novamente
      setState(prev => ({
        ...prev,
        error: null, // Não mostrar erro ainda, aguardar retry
        connectionStatus: 'connecting', // Manter como connecting
        loading: true // Manter loading durante retry
      }));

      // Tentar novamente após o reset do rate limit
      setTimeout(() => {
        if (subscriptionRef.current === null) { // Só se ainda não conectou
          const retrySuccess = realtimeManager.subscribe(subscription);
          if (!retrySuccess) {
            // Agora sim, definir como erro
            setState(prev => ({
              ...prev,
              error: 'Failed to connect after retry',
              connectionStatus: 'error',
              loading: false
            }));
            
            // Call error callback apenas após retry falhar
            if (sanitizedConfig.onError) {
              try {
                sanitizedConfig.onError(subscriptionError);
              } catch (callbackError) {
                handleRealtimeError(callbackError instanceof Error ? callbackError : new Error('Error callback failed'), {
                  operation: 'error_callback',
                  channelId,
                  timestamp: Date.now()
                });
              }
            }
          }
        }
      }, rateLimitStatus.timeUntilReset + 100); // Aguardar reset + buffer

      return; // Early return on subscription failure
    } else {
      // Subscription successful, but still connecting
      if (sanitizedConfig.debug) {
        console.log(`[useRealtimeUnified] Subscription created successfully for channel: ${channelId}`);
      }
    }

    return () => {
      if (subscriptionRef.current) {
        if (sanitizedConfig.debug) {
          console.log(`[useRealtimeUnified] Cleaning up subscription for channel: ${channelId}`);
        }

        realtimeManager.unsubscribe(channelId);
        subscriptionRef.current = null;
      }
    };
  }, [
    channelId,
    sanitizedConfig.enableRealtime,
    JSON.stringify(sanitizedConfig.tables.sort()),
    JSON.stringify(sanitizedConfig.filters),
    sanitizedConfig.debug,
    handleDatabaseChange,
    handleConnectionChange
  ]);

  // 🎯 ACTIONS
  const refetch = useCallback(async (reason?: string): Promise<void> => {
    updateStateOptimized({
      refetchCounter: state.refetchCounter + 1
    });

    await performFetch(reason || 'manual');
  }, [performFetch, state.refetchCounter, updateStateOptimized]);

  const reconnect = useCallback(() => {
    if (subscriptionRef.current) {
      realtimeManager.unsubscribe(channelId);
      setTimeout(() => {
        if (subscriptionRef.current) {
          realtimeManager.subscribe(subscriptionRef.current);
        }
      }, 100);
    }
  }, [channelId]);

  const disconnect = useCallback(() => {
    realtimeManager.unsubscribe(channelId);
    updateStateOptimized({
      isConnected: false,
      connectionStatus: 'disconnected'
    });
  }, [channelId, updateStateOptimized]);

  const forceExecute = useCallback(() => {
    refetch('force_execute').catch(error => {
      console.error('[useRealtimeUnified] Force execute failed:', error);
    });
  }, [refetch]);

  // 🎯 DEBUG SESSION MANAGEMENT
  const debugSessionRef = useRef<string | null>(null);
  
  // Inicializar sessão de debug se habilitado
  useEffect(() => {
    if (sanitizedConfig.debug && !debugSessionRef.current) {
      debugSessionRef.current = realtimeDebugger.startSession(channelId, 'useRealtimeUnified');
      
      debugLogger.info('Debug session started for unified hook', {
        channelId,
        sessionId: debugSessionRef.current,
        config: sanitizedConfig
      });
    }
    
    return () => {
      if (debugSessionRef.current) {
        realtimeDebugger.endSession(debugSessionRef.current);
        debugSessionRef.current = null;
      }
    };
  }, [sanitizedConfig.debug, channelId]);

  // 🎯 DEBUG INFO WITH COMPREHENSIVE MONITORING
  const debugInfo = useMemo(() => {
    if (!sanitizedConfig.debug) {
      // Versão simplificada quando debug está desabilitado
      return {
        channelId,
        tablesMonitored: sanitizedConfig.tables,
        managerStats: {},
        pollingInterval: state.currentPollingInterval
      };
    }

    // Coletar informações completas de debug
    const fullDebugInfo = debugInfoCollector.collect({
      channelId,
      hookType: 'useRealtimeUnified',
      config: sanitizedConfig,
      state,
      channelStats: {
        subscriptionActive: subscriptionRef.current !== null,
        tablesMonitored: sanitizedConfig.tables,
        filtersApplied: sanitizedConfig.filters || {},
        eventCounts: {}, // Seria preenchido pelo RealtimeManager
        lastActivity: state.lastEventTime,
        connectionDuration: state.isConnected ? Date.now() - (state.lastEventTime || Date.now()) : 0
      },
      managerStats: realtimeManager.getChannelStats(),
      polling: {
        enabled: sanitizedConfig.enablePolling !== false,
        currentInterval: state.currentPollingInterval,
        isUserActive: state.isUserActive,
        isDocumentVisible: state.isDocumentVisible,
        executionCount: 0, // Seria rastreado pelo polling manager
        lastExecution: null
      },
      fetch: {
        enabled: sanitizedConfig.enableFetch !== false,
        inProgress: state.fetchInProgress,
        lastFetchTime: state.lastFetchTime,
        lastFetchReason: state.lastFetchReason,
        fromCache: state.fromCache,
        endpoint: sanitizedConfig.apiEndpoint || sanitizedConfig.fetchConfig?.endpoint
      }
    });

    // Adicionar métricas de performance internas
    const internalMetrics = {
      eventBatcher: eventBatcher.getStats(),
      memoCache: memoCache.getStats(),
      cleanupManager: cleanupManager.getStats(),
      hasPendingConnectionUpdate: debouncedConnectionUpdater.hasPendingUpdate(),
      rafSchedulerActive: rafSchedulerRef.current.hasPendingCallbacks(),
      pendingStateUpdates: pendingStateUpdatesRef.current.length,
      lastStateUpdate: lastStateUpdateRef.current
    };

    return {
      ...fullDebugInfo,
      internalMetrics,
      // Manter compatibilidade com versão anterior
      channelId: fullDebugInfo.channelId,
      tablesMonitored: fullDebugInfo.channelStats.tablesMonitored,
      managerStats: fullDebugInfo.managerStats,
      pollingInterval: fullDebugInfo.polling.currentInterval
    };
  }, [
    sanitizedConfig.debug,
    channelId,
    sanitizedConfig.tables,
    sanitizedConfig.filters,
    sanitizedConfig.enablePolling,
    sanitizedConfig.enableFetch,
    sanitizedConfig.apiEndpoint,
    state,
    eventBatcher,
    memoCache,
    cleanupManager,
    debouncedConnectionUpdater
  ]);

  // 🎯 COMPREHENSIVE CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      // Abort any ongoing fetch
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }

      // Clear polling timer
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }

      // Cleanup performance optimizations
      eventBatcher.cleanup();
      debouncedConnectionUpdater.cleanup();
      debouncedRefetch.cancel();
      rafSchedulerRef.current.cancel();
      cleanupManager.cleanup();
      memoCache.clear();

      // Flush any pending state updates
      if (pendingStateUpdatesRef.current.length > 0) {
        pendingStateUpdatesRef.current = [];
      }

      // Debug logging e cleanup de monitoramento
      if (configRef.current.debug) {
        debugLogger.info('Comprehensive cleanup completed', { channelId });
        
        // Finalizar sessão de debug
        if (debugSessionRef.current) {
          realtimeDebugger.addEvent(
            debugSessionRef.current,
            'user_action',
            'cleanup',
            'Hook cleanup completed',
            { channelId },
            'low'
          );
          
          // Capturar snapshot final
          realtimeDebugger.captureSnapshot(debugSessionRef.current, {
            channelId,
            hookType: 'useRealtimeUnified',
            config: configRef.current,
            state: {
              ...state,
              isConnected: false,
              connectionStatus: 'disconnected'
            }
          });
        }
      }
      
      // Verificar vazamentos de memória
      performanceMonitor.checkMemoryLeak();
    };
  }, [channelId, eventBatcher, debouncedConnectionUpdater, debouncedRefetch, cleanupManager, memoCache]);

  // 🎯 RETURN API
  return {
    // Data state
    data: state.data,
    loading: state.loading,
    error: state.error,

    // Connection state
    isConnected: state.isConnected,
    connectionStatus: state.connectionStatus,
    lastEventTime: state.lastEventTime,

    // Statistics
    eventsReceived: state.eventsReceived,
    reconnectCount: state.reconnectCount,

    // Activity state
    isActive: state.isUserActive,
    isVisible: state.isDocumentVisible,

    // Fetch state
    fetchInProgress: state.fetchInProgress,
    lastFetchTime: state.lastFetchTime,
    lastFetchReason: state.lastFetchReason,
    fromCache: state.fromCache,

    // Actions
    refetch,
    reconnect,
    disconnect,
    forceExecute,

    // 🚀 CACHE CONTROL METHODS
    clearCache: useCallback(() => {
      if (dataFetcherRef.current) {
        dataFetcherRef.current.clearCache();
        if (configRef.current.debug) {
          debugLogger.info('Cache cleared manually', { channelId });
        }
      }
    }, [channelId]),
    
    invalidateCacheForTables: useCallback((tables: string[]) => {
      if (dataFetcherRef.current) {
        dataFetcherRef.current.invalidateCacheForTables(tables);
        if (configRef.current.debug) {
          debugLogger.info('Cache invalidated for tables', { channelId, tables });
        }
      }
    }, [channelId]),
    
    getCacheStats: useCallback(() => {
      return dataFetcherRef.current?.getCacheStats() || {
        size: 0,
        keys: [],
        pendingRequests: 0,
        hitRate: 0,
        memoryUsage: 0
      };
    }, []),

    // Debug
    debugInfo
  };
};

export default useRealtimeUnified;