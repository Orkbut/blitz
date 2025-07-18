// ✅ SISTEMA DE LOGGING INTELIGENTE PARA EVITAR SPAM NO TERMINAL
// Mantém logs importantes mas remove ruído de polling

import { createClient } from '@supabase/supabase-js';

interface LogState {
  lastSolicitacoesCount: number;
  lastLogTime: number;
  suppressUntil: number;
}

const logState: LogState = {
  lastSolicitacoesCount: -1,
  lastLogTime: 0,
  suppressUntil: 0
};

// ✅ CONFIGURAÇÃO DE LOGGER INTELIGENTE
interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

// 🎯 INSPETOR CIRÚRGICO: Clicks vs Renderizações
interface ClickEntry {
  membro: string;
  data: string;
  operacaoId: number;
  acao: 'SOLICITAR' | 'CANCELAR';
  timestamp: number;
}

interface RenderEntry {
  membro: string;
  data: string;
  operacaoId: number;
  status: 'RENDERIZADO';
  timestamp: number;
}

interface InspectorResult {
  membro: string;
  data: string;
  operacaoId: number;
  clicks: number;
  renderizacoes: number;
  discrepancia: boolean;
}

class ClickInspector {
  private clicks: Map<string, ClickEntry[]> = new Map();
  private renders: Map<string, RenderEntry[]> = new Map();
  
  // 🎯 REGISTRAR CLICK
  logClick(membro: string, data: string, operacaoId: number, acao: 'SOLICITAR' | 'CANCELAR') {
    const key = `${membro}-${data}-${operacaoId}`;
    
    if (!this.clicks.has(key)) {
      this.clicks.set(key, []);
    }
    
    this.clicks.get(key)!.push({
      membro,
      data,
      operacaoId,
      acao,
      timestamp: Date.now()
    });
    
    // Log silencioso
  }
  
  // 🎯 REGISTRAR RENDERIZAÇÃO
  logRender(membro: string, data: string, operacaoId: number) {
    const key = `${membro}-${data}-${operacaoId}`;
    
    if (!this.renders.has(key)) {
      this.renders.set(key, []);
    }
    
    this.renders.get(key)!.push({
      membro,
      data,
      operacaoId,
      status: 'RENDERIZADO',
      timestamp: Date.now()
    });
    
    // Log silencioso
  }
  
  // 🎯 INSPEÇÃO CIRÚRGICA
  inspecionar(): InspectorResult[] {
    const resultados: InspectorResult[] = [];
    const chavesUnicas = new Set([...this.clicks.keys(), ...this.renders.keys()]);
    
    for (const key of chavesUnicas) {
      const [membro, data, operacaoIdStr] = key.split('-');
      const operacaoId = parseInt(operacaoIdStr);
      
      const clicksCount = this.clicks.get(key)?.length || 0;
      const rendersCount = this.renders.get(key)?.length || 0;
      
      const discrepancia = clicksCount !== rendersCount;
      
      resultados.push({
        membro,
        data,
        operacaoId,
        clicks: clicksCount,
        renderizacoes: rendersCount,
        discrepancia
      });
      
      // Log silencioso
    }
    
    return resultados;
  }
  
  // 🎯 RELATÓRIO CIRÚRGICO
  relatorioCircurgico() {
    const resultados = this.inspecionar();
    const discrepancias = resultados.filter(r => r.discrepancia);
    
    // Relatório silencioso
    
    return discrepancias;
  }
  
  // 🎯 LIMPAR DADOS ANTIGOS
  limpar() {
    this.clicks.clear();
    this.renders.clear();
    // Log silencioso
  }
  
  // 🧹 LIMPEZA COMPLETA: Remove todos os dados e logs
  limparTudo() {
    this.clicks.clear();
    this.renders.clear();
  }
}

export const clickInspector = new ClickInspector();

// 🧹 FUNÇÃO GLOBAL: Para limpar tudo via chamada externa
export const limparTodosOsLogs = () => {
  clickInspector.limparTudo();
};

// 🎯 RELATÓRIO AUTOMÁTICO A CADA MINUTO
if (typeof window !== 'undefined') {
  setInterval(() => {
    clickInspector.relatorioCircurgico();
  }, 60000); // A cada 60 segundos
}

class SmartLogger {
  private isDev = process.env.NODE_ENV === 'development';
  private isClient = typeof window !== 'undefined';
  
  // ✅ CACHE SIMPLES: Evitar logs repetitivos
  private lastMessages = new Map<string, number>();
  private readonly CACHE_DURATION = 30000; // 30 segundos
  
  private shouldLog(level: keyof LogLevel, message: string): boolean {
    if (!this.isClient) return false;
    
    const key = `${level}:${message}`;
    const now = Date.now();
    const lastLogged = this.lastMessages.get(key);
    
    if (lastLogged && (now - lastLogged) < this.CACHE_DURATION) {
      return false; // Skip duplicate message
    }
    
    this.lastMessages.set(key, now);
    return true;
  }

  private log(level: keyof LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level, message)) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'ERROR':
        console.error(prefix, message, data || '');
        break;
      case 'WARN':
        console.warn(prefix, message, data || '');
        break;
      case 'INFO':
        console.info(prefix, message, data || '');
        break;
      case 'DEBUG':
        if (this.isDev) console.log(prefix, message, data || '');
        break;
    }
  }

  error(message: string, data?: any) {
    this.log('ERROR', message, data);
  }

  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  debug(message: string, data?: any) {
    this.log('DEBUG', message, data);
  }

  success(message: string, data?: any) {
    this.log('INFO', `✅ ${message}`, data);
  }

  // ✅ LOGS ESPECÍFICOS PARA DIFERENTES CONTEXTOS
  realtime(message: string, operacaoId?: number, data?: any) {
    if (operacaoId) {
      this.debug(`🔄 REALTIME [Op ${operacaoId}]: ${message}`, data);
    } else {
      this.debug(`🔄 REALTIME: ${message}`, data);
    }
  }

  api(endpoint: string, status: 'success' | 'error', data?: any) {
    const emoji = status === 'success' ? '✅' : '❌';
    this.debug(`${emoji} API [${endpoint}]: ${status}`, data);
  }

  // ✅ NOVO: Log inteligente para solicitações (não repetir)
  solicitacoes(count: number) {
    const message = `📊 ${count} solicitações carregadas`;
    if (this.shouldLog('DEBUG', message)) {
      this.debug(message);
    }
  }

  performance(operation: string, duration: number) {
    const emoji = duration > 1000 ? '🐌' : duration > 500 ? '⚠️' : '⚡';
    this.debug(`${emoji} PERFORMANCE [${operation}]: ${duration}ms`);
  }
  
  // ✅ LIMPAR CACHE PERIODICAMENTE
  clearCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.lastMessages.entries()) {
      if ((now - timestamp) > this.CACHE_DURATION * 2) {
        this.lastMessages.delete(key);
      }
    }
  }
}

export const smartLogger = new SmartLogger();

// Limpar cache do logger a cada minuto
if (typeof window !== 'undefined') {
  setInterval(() => {
    smartLogger.clearCache();
  }, 60000);
} 