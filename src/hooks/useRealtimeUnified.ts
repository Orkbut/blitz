"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface FetchConfig {
  endpoint: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  cacheTimeout?: number;
}

export interface UseRealtimeUnifiedConfig {
  channelId?: string;
  tables?: string[];
  filters?: Record<string, string>;
  enableRealtime?: boolean;
  enablePolling?: boolean;
  enableFetch?: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  apiEndpoint?: string;
  fetchConfig?: FetchConfig;
  initialFetch?: boolean;
  cacheTimeout?: number;
  activeInterval?: number;
  inactiveInterval?: number;
  focusInterval?: number;
  blurInterval?: number;
  onDatabaseChange?: (event: any) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onDataUpdate?: (data: any[]) => void;
  onError?: (error: Error) => void;
  debug?: boolean;
}

export function useRealtimeUnified<T = any>(_config?: UseRealtimeUnifiedConfig) {
  const config = _config || {};
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastEventTime, setLastEventTime] = useState<number | null>(null);
  const [eventsReceived, setEventsReceived] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const [lastFetchReason, setLastFetchReason] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const pollingInterval = useRef<number>(config.activeInterval || 5000);
  const sseRef = useRef<EventSource | null>(null);
  const retryRef = useRef<number>(0);
  const timers = useRef<{ polling?: any } >({});

  // Tabela principal inferida pelo endpoint selecionado
  const primaryTable = useMemo(() => {
    if (config.tables?.includes('evento_calendario')) return 'evento_calendario';
    if (config.tables?.includes('operacao')) return 'operacao';
    if (config.tables?.includes('participacao')) return 'participacao';
    return 'operacao';
  }, [JSON.stringify(config.tables || [])]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (config.startDate) params.set('startDate', typeof config.startDate === 'string' ? config.startDate : config.startDate.toISOString().split('T')[0]);
    if (config.endDate) params.set('endDate', typeof config.endDate === 'string' ? config.endDate : config.endDate.toISOString().split('T')[0]);
    if (config.tables?.includes('operacao')) {
      params.set('portal', 'supervisor');
      params.set('includeParticipantes', 'true');
    }
    if (config.activeInterval) params.set('intervalMs', String(config.activeInterval));

    // Mapear filtros conhecidos para parâmetros do endpoint
    // Ex.: participacao: "membro_id.eq.123" -> membroId=123
    const participacaoFilter = config.filters?.['participacao'];
    if (participacaoFilter && typeof participacaoFilter === 'string') {
      const m = participacaoFilter.match(/^membro_id\.eq\.(\d+)$/);
      if (m) {
        params.set('membroId', m[1]);
      }
    }
    return params.toString();
  };

  const resolveSseEndpoint = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Heurística simples baseada nas tabelas
    if (config.tables?.includes('evento_calendario')) {
      return `${origin}/api/sse/eventos-calendario`;
    }
    return `${origin}/api/sse/operacoes`;
  };

  const performFetch = async (reason: string = 'manual') => {
    if (!config.enableFetch) return;
    const endpoint = config.fetchConfig?.endpoint || config.apiEndpoint;
    if (!endpoint) return;
    const retries = config.fetchConfig?.retries ?? 0;
    const timeout = config.fetchConfig?.timeout ?? 10000;

    setLoading(true);
    setFetchInProgress(true);
    setLastFetchReason(reason);
    setError(null);

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const signal = (AbortSignal as any).timeout ? (AbortSignal as any).timeout(timeout) : undefined;
        const res = await fetch(endpoint, {
          method: config.fetchConfig?.method || 'GET',
          headers: { 'Content-Type': 'application/json', ...(config.fetchConfig?.headers || {}) },
          body: config.fetchConfig?.body ? JSON.stringify(config.fetchConfig.body) : undefined,
          signal,
        } as any);
        const json = await res.json();
        const nextData = Array.isArray(json) ? json : (json?.data ?? []);
        setData(nextData);
        setError(null);
        setFromCache(false);
        if (config.onDataUpdate) {
          try { config.onDataUpdate(nextData); } catch {}
        }
        if (config.onDatabaseChange) {
          try { config.onDatabaseChange({ table: primaryTable, eventType: 'fetch', new: nextData }); } catch {}
        }
        break;
      } catch (err: any) {
        attempt += 1;
        if (attempt > retries) {
          setError(err?.message || 'Network error');
          setData([]);
        }
      }
    }
    setLoading(false);
    setFetchInProgress(false);
    setLastFetchTime(Date.now());
  };

  // SSE setup
  useEffect(() => {
    const enabledByEnv = process.env.NEXT_PUBLIC_ENABLE_SSE !== 'false';
    const hasEventSource = typeof window !== 'undefined' && (window as any).EventSource;
    if (!config.enableRealtime || typeof window === 'undefined' || !enabledByEnv || !hasEventSource) return;

    const sseUrl = `${resolveSseEndpoint()}?${buildQuery()}`;
    setConnectionStatus('connecting');
    if (config.onConnectionChange) {
      try { config.onConnectionChange('connecting'); } catch {}
    }
    const es = new EventSource(sseUrl);
    sseRef.current = es;

    es.addEventListener('ready', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      if (config.onConnectionChange) {
        try { config.onConnectionChange('connected'); } catch {}
      }
    });

    es.addEventListener('snapshot', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        const nextData = payload || [];
        setData(nextData);
        setEventsReceived(v => v + 1);
        setLastEventTime(Date.now());
        if (config.onDataUpdate) {
          try { config.onDataUpdate(nextData); } catch {}
        }
        if (config.onDatabaseChange) {
          try { config.onDatabaseChange({ table: primaryTable, eventType: 'snapshot', new: nextData }); } catch {}
        }
      } catch {}
    });

    es.addEventListener('upsert', (ev: MessageEvent) => {
      try {
        const item = JSON.parse(ev.data);
        setData(prev => {
          const idx = (prev as any[]).findIndex((x: any) => x.id === item.id);
          if (idx >= 0) {
            const next = [...prev];
            (next as any[])[idx] = item;
            return next as T[];
          }
          return ([...prev as any[], item]) as T[];
        });
        setEventsReceived(v => v + 1);
        setLastEventTime(Date.now());
        if (config.onDatabaseChange) {
          try { config.onDatabaseChange({ table: primaryTable, eventType: 'upsert', new: item }); } catch {}
        }
      } catch {}
    });

    es.addEventListener('delete', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        const id = payload?.id;
        if (id != null) {
          setData(prev => (prev as any[]).filter((x: any) => x.id !== id) as T[]);
          setEventsReceived(v => v + 1);
          setLastEventTime(Date.now());
          if (config.onDatabaseChange) {
            try { config.onDatabaseChange({ table: primaryTable, eventType: 'delete', old: { id } }); } catch {}
          }
        }
      } catch {}
    });

    es.addEventListener('error', (ev: MessageEvent) => {
      setConnectionStatus('error');
      setIsConnected(false);
      setEventsReceived(v => v + 1);
      setLastEventTime(Date.now());
      setReconnectCount(v => v + 1);
      if (config.onConnectionChange) {
        try { config.onConnectionChange('error'); } catch {}
      }
      if (config.onError) config.onError(new Error('SSE error'));
      // Fallback para polling se habilitado
      if (config.enablePolling) {
        if (!timers.current.polling) {
          timers.current.polling = setInterval(() => performFetch('sse-fallback'), pollingInterval.current);
        }
      }
    });

    return () => {
      try { es.close(); } catch {}
      sseRef.current = null;
      if (timers.current.polling) {
        clearInterval(timers.current.polling);
        timers.current.polling = undefined;
      }
      setIsConnected(false);
      setConnectionStatus('disconnected');
      if (config.onConnectionChange) {
        try { config.onConnectionChange('disconnected'); } catch {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enableRealtime, config.startDate, config.endDate, config.activeInterval, JSON.stringify(config.tables || [])]);

  // Polling ativo opcional (sem SSE)
  useEffect(() => {
    if (!config.enablePolling || typeof window === 'undefined') return;
    timers.current.polling = setInterval(() => performFetch('polling'), pollingInterval.current);
    return () => {
      if (timers.current.polling) {
        clearInterval(timers.current.polling);
        timers.current.polling = undefined;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enablePolling, config.activeInterval, config.apiEndpoint, config.fetchConfig?.endpoint]);

  // Fetch inicial se solicitado
  useEffect(() => {
    if (config.enableFetch) performFetch('initial_load');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.enableFetch, config.apiEndpoint, config.fetchConfig?.endpoint]);

  const refetch = async (reason?: string) => {
    await performFetch(reason || 'manual');
  };

  const reconnect = () => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch {}
      sseRef.current = null;
    }
    setReconnectCount(v => v + 1);
    // Recriar ao mudar dependências principais
    // Dispara uma alteração fictícia para re-executar o useEffect em cenários controlados
    pollingInterval.current = pollingInterval.current;
  };

  const disconnect = () => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch {}
      sseRef.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
      if (config.onConnectionChange) {
        try { config.onConnectionChange('disconnected'); } catch {}
      }
    }
  };

  const forceExecute = () => {
    // Força um ciclo de polling ou uma atualização manual
    performFetch('forceExecute');
  };

  const debugInfo = useMemo(() => ({
    channelId: config.channelId || 'unified',
    tablesMonitored: config.tables || [],
    managerStats: {},
    pollingInterval: pollingInterval.current,
  }), [config.channelId, JSON.stringify(config.tables || [])]);

  return {
    data,
    loading,
    error,
    isConnected,
    connectionStatus,
    lastEventTime,
    eventsReceived,
    reconnectCount,
    isActive: true,
    isVisible: true,
    fetchInProgress,
    lastFetchTime,
    lastFetchReason,
    fromCache,
    refetch,
    reconnect,
    disconnect,
    forceExecute,
    debugInfo,
  };
}

export default useRealtimeUnified;