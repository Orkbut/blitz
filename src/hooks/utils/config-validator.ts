/**
 * 🎯 VALIDADOR DE CONFIGURAÇÃO
 * 
 * Utilitários para validação e sanitização de configurações do hook unificado.
 * Implementa validações robustas conforme especificado no design.
 */

import { ConfigValidator, PollingConfig, RealtimeError, RealtimeErrorType } from '../types/realtime-unified.types';

// 🎯 LOCAL TYPE DEFINITIONS TO AVOID CIRCULAR IMPORTS
interface UseRealtimeUnifiedConfig {
  channelId?: string;
  tables: string[];
  filters?: Record<string, string>;
  enableRealtime?: boolean;
  enablePolling?: boolean;
  enableFetch?: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  apiEndpoint?: string;
  activeInterval?: number;
  inactiveInterval?: number;
  focusInterval?: number;
  blurInterval?: number;
  debug?: boolean;
  onDatabaseChange?: (event: any) => void;
  onConnectionChange?: (status: any) => void;
  onDataUpdate?: (data: any[]) => void;
  onError?: (error: Error) => void;
}

// 🎯 CONSTANTES DE VALIDAÇÃO
const VALID_TABLES = [
  'operacao',
  'participacao', 
  'eventos_operacao',
  'servidor',
  'modalidade'
];

const MIN_POLLING_INTERVAL = 1000; // 1 segundo
const MAX_POLLING_INTERVAL = 300000; // 5 minutos
const DEFAULT_ACTIVE_INTERVAL = 5000;
const DEFAULT_INACTIVE_INTERVAL = 30000;
const DEFAULT_FOCUS_INTERVAL = 5000;
const DEFAULT_BLUR_INTERVAL = 60000;

// 🎯 PADRÕES DE VALIDAÇÃO
const CHANNEL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const FILTER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*\.(eq|neq|gt|gte|lt|lte|like|ilike|in|is|not)\./;
const URL_PATTERN = /^https?:\/\/.+/;

/**
 * 🎯 IMPLEMENTAÇÃO DO VALIDADOR DE CONFIGURAÇÃO
 */
export class RealtimeConfigValidator implements ConfigValidator {
  
  /**
   * Valida se as tabelas especificadas são válidas
   */
  validateTables(tables: string[]): boolean {
    if (!Array.isArray(tables) || tables.length === 0) {
      return false;
    }
    
    // Verificar se todos os elementos são strings antes de processar
    if (!tables.every(table => typeof table === 'string')) {
      return false;
    }
    
    // Verificar duplicatas
    const uniqueTables = new Set(tables.map(t => t.trim().toLowerCase()));
    if (uniqueTables.size !== tables.length) {
      return false;
    }
    
    return tables.every(table => {
      if (typeof table !== 'string' || table.trim().length === 0) {
        return false;
      }
      
      const cleanTable = table.trim().toLowerCase();
      return VALID_TABLES.includes(cleanTable);
    });
  }
  
  /**
   * Valida filtros de tabela
   */
  validateFilters(filters: Record<string, string>): boolean {
    if (!filters || typeof filters !== 'object') {
      return true; // Filtros são opcionais
    }
    
    // Verificar se é um objeto válido (não array)
    if (Array.isArray(filters)) {
      return false;
    }
    
    return Object.entries(filters).every(([table, filter]) => {
      // Validar nome da tabela
      if (!VALID_TABLES.includes(table.toLowerCase())) {
        return false;
      }
      
      // Validar formato do filtro (básico)
      if (typeof filter !== 'string' || filter.trim().length === 0) {
        return false;
      }
      
      // Validar sintaxe básica do filtro PostgREST
      return FILTER_PATTERN.test(filter) || filter.includes('=') || filter.includes('.');
    });
  }
  
  /**
   * Valida intervalos de polling
   */
  validateIntervals(config: PollingConfig): boolean {
    const intervals = [
      config.activeInterval,
      config.inactiveInterval,
      config.focusInterval,
      config.blurInterval
    ];
    
    return intervals.every(interval => {
      if (interval === undefined) return true; // Opcionais
      
      return typeof interval === 'number' && 
             interval >= MIN_POLLING_INTERVAL && 
             interval <= MAX_POLLING_INTERVAL;
    });
  }
  
  /**
   * Sanitiza e aplica valores padrão à configuração
   */
  sanitizeConfig(config: UseRealtimeUnifiedConfig): UseRealtimeUnifiedConfig {
    const sanitized: UseRealtimeUnifiedConfig = { ...config };
    
    // 🆔 SANITIZAR CHANNEL ID
    if (sanitized.channelId) {
      if (typeof sanitized.channelId === 'string') {
        const trimmedChannelId = sanitized.channelId.trim();
        if (CHANNEL_ID_PATTERN.test(trimmedChannelId)) {
          sanitized.channelId = trimmedChannelId;
        } else {
          delete sanitized.channelId; // Será gerado automaticamente
        }
      } else {
        delete sanitized.channelId; // Será gerado automaticamente
      }
    }
    
    // 📋 SANITIZAR TABELAS
    if (sanitized.tables) {
      const uniqueTables = new Set();
      sanitized.tables = sanitized.tables
        .map(table => table.trim().toLowerCase())
        .filter(table => {
          if (VALID_TABLES.includes(table) && !uniqueTables.has(table)) {
            uniqueTables.add(table);
            return true;
          }
          return false;
        });
    }
    
    // 🔍 SANITIZAR FILTROS
    if (sanitized.filters) {
      const cleanFilters: Record<string, string> = {};
      
      Object.entries(sanitized.filters).forEach(([table, filter]) => {
        const cleanTable = table.trim().toLowerCase();
        if (VALID_TABLES.includes(cleanTable) && typeof filter === 'string') {
          const cleanFilter = filter.trim();
          if (cleanFilter.length > 0) {
            cleanFilters[cleanTable] = cleanFilter;
          }
        }
      });
      
      sanitized.filters = Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined;
    }
    
    // ⏱️ APLICAR VALORES PADRÃO PARA INTERVALOS
    sanitized.activeInterval = this.sanitizeInterval(sanitized.activeInterval, DEFAULT_ACTIVE_INTERVAL);
    sanitized.inactiveInterval = this.sanitizeInterval(sanitized.inactiveInterval, DEFAULT_INACTIVE_INTERVAL);
    sanitized.focusInterval = this.sanitizeInterval(sanitized.focusInterval, DEFAULT_FOCUS_INTERVAL);
    sanitized.blurInterval = this.sanitizeInterval(sanitized.blurInterval, DEFAULT_BLUR_INTERVAL);
    
    // 🎛️ APLICAR VALORES PADRÃO PARA FEATURE FLAGS
    sanitized.enableRealtime = sanitized.enableRealtime !== false;
    sanitized.enablePolling = sanitized.enablePolling !== false;
    sanitized.enableFetch = sanitized.enableFetch !== false;
    sanitized.debug = sanitized.debug === true;
    
    // 📊 VALIDAR E SANITIZAR DATAS
    if (sanitized.startDate) {
      if (sanitized.startDate instanceof Date && !isNaN(sanitized.startDate.getTime())) {
        // Data válida, manter
      } else if (typeof sanitized.startDate === 'string') {
        const parsedDate = new Date(sanitized.startDate);
        if (!isNaN(parsedDate.getTime())) {
          sanitized.startDate = parsedDate;
        } else {
          delete sanitized.startDate;
        }
      } else {
        delete sanitized.startDate;
      }
    }
    
    if (sanitized.endDate) {
      if (sanitized.endDate instanceof Date && !isNaN(sanitized.endDate.getTime())) {
        // Data válida, manter
      } else if (typeof sanitized.endDate === 'string') {
        const parsedDate = new Date(sanitized.endDate);
        if (!isNaN(parsedDate.getTime())) {
          sanitized.endDate = parsedDate;
        } else {
          delete sanitized.endDate;
        }
      } else {
        delete sanitized.endDate;
      }
    }
    
    // Validar ordem das datas
    if (sanitized.startDate && sanitized.endDate && sanitized.startDate > sanitized.endDate) {
      // Trocar as datas se estiverem na ordem errada
      const temp = sanitized.startDate;
      sanitized.startDate = sanitized.endDate;
      sanitized.endDate = temp;
    }
    
    // 🔗 VALIDAR E SANITIZAR API ENDPOINT
    if (sanitized.apiEndpoint) {
      if (typeof sanitized.apiEndpoint === 'string') {
        const cleanEndpoint = sanitized.apiEndpoint.trim();
        if (URL_PATTERN.test(cleanEndpoint)) {
          sanitized.apiEndpoint = cleanEndpoint;
        } else {
          delete sanitized.apiEndpoint;
        }
      } else {
        delete sanitized.apiEndpoint;
      }
    }
    
    // 🔄 VALIDAR CALLBACKS
    const callbackKeys = ['onDatabaseChange', 'onConnectionChange', 'onDataUpdate', 'onError'] as const;
    callbackKeys.forEach(key => {
      if (sanitized[key] !== undefined && typeof sanitized[key] !== 'function') {
        delete sanitized[key];
      }
    });
    
    return sanitized;
  }
  
  /**
   * Sanitiza um intervalo individual
   */
  private sanitizeInterval(interval: number | undefined, defaultValue: number): number {
    if (typeof interval !== 'number') {
      return defaultValue;
    }
    
    if (interval < MIN_POLLING_INTERVAL) {
      return MIN_POLLING_INTERVAL;
    }
    
    if (interval > MAX_POLLING_INTERVAL) {
      return MAX_POLLING_INTERVAL;
    }
    
    return interval;
  }
}

/**
 * 🎯 FUNÇÕES UTILITÁRIAS DE VALIDAÇÃO
 */

/**
 * Cria um erro de configuração tipado
 */
export function createConfigurationError(
  message: string, 
  context?: Record<string, any>
): RealtimeError {
  const error = new Error(message) as RealtimeError;
  error.type = RealtimeErrorType.CONFIGURATION_ERROR;
  error.retryable = false;
  error.context = context;
  return error;
}

/**
 * Valida configuração completa e lança erro se inválida
 */
export function validateConfigOrThrow(config: UseRealtimeUnifiedConfig): void {
  const validator = new RealtimeConfigValidator();
  
  // Validar tabelas
  if (!validator.validateTables(config.tables)) {
    throw createConfigurationError(
      'Invalid tables configuration', 
      { 
        tables: config.tables, 
        validTables: VALID_TABLES 
      }
    );
  }
  
  // Validar filtros
  if (config.filters && !validator.validateFilters(config.filters)) {
    throw createConfigurationError(
      'Invalid filters configuration',
      { filters: config.filters }
    );
  }
  
  // Validar intervalos
  if (!validator.validateIntervals(config)) {
    throw createConfigurationError(
      'Invalid polling intervals configuration',
      { 
        intervals: {
          active: config.activeInterval,
          inactive: config.inactiveInterval,
          focus: config.focusInterval,
          blur: config.blurInterval
        },
        limits: {
          min: MIN_POLLING_INTERVAL,
          max: MAX_POLLING_INTERVAL
        }
      }
    );
  }
}

/**
 * Type guard para verificar se um erro é de configuração
 */
export function isConfigurationError(error: any): error is RealtimeError {
  return error !== null && 
         error !== undefined &&
         error.type === RealtimeErrorType.CONFIGURATION_ERROR &&
         typeof error.message === 'string';
}

/**
 * 🎯 TYPE GUARDS PARA VALIDAÇÃO DE CONFIGURAÇÃO
 */

/**
 * Type guard para verificar se um valor é uma configuração válida
 */
export function isValidRealtimeConfig(config: any): config is UseRealtimeUnifiedConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }
  
  // Verificar propriedades obrigatórias
  if (!Array.isArray(config.tables) || config.tables.length === 0) {
    return false;
  }
  
  const validator = new RealtimeConfigValidator();
  
  try {
    // Validar usando o validador
    return validator.validateTables(config.tables) &&
           validator.validateFilters(config.filters) &&
           validator.validateIntervals(config);
  } catch {
    return false;
  }
}

/**
 * Type guard para verificar se um valor é um array de tabelas válidas
 */
export function isValidTablesArray(tables: any): tables is string[] {
  if (!Array.isArray(tables) || tables.length === 0) {
    return false;
  }
  
  return tables.every(table => 
    typeof table === 'string' && 
    table.trim().length > 0 &&
    VALID_TABLES.includes(table.trim().toLowerCase())
  );
}

/**
 * Type guard para verificar se um valor é um objeto de filtros válido
 */
export function isValidFiltersObject(filters: any): filters is Record<string, string> {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return false;
  }
  
  return Object.entries(filters).every(([table, filter]) =>
    typeof table === 'string' &&
    typeof filter === 'string' &&
    VALID_TABLES.includes(table.toLowerCase()) &&
    filter.trim().length > 0
  );
}

/**
 * Type guard para verificar se um valor é um intervalo de polling válido
 */
export function isValidPollingInterval(interval: any): interval is number {
  return typeof interval === 'number' &&
         interval >= MIN_POLLING_INTERVAL &&
         interval <= MAX_POLLING_INTERVAL;
}

/**
 * 🎯 FUNÇÕES UTILITÁRIAS ADICIONAIS
 */

/**
 * Obtém as tabelas válidas disponíveis
 */
export function getValidTables(): readonly string[] {
  return [...VALID_TABLES];
}

/**
 * Obtém os limites de intervalo de polling
 */
export function getPollingLimits(): { min: number; max: number } {
  return {
    min: MIN_POLLING_INTERVAL,
    max: MAX_POLLING_INTERVAL
  };
}

/**
 * Obtém os valores padrão de configuração
 */
export function getDefaultConfig(): Partial<UseRealtimeUnifiedConfig> {
  return {
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    debug: false,
    activeInterval: DEFAULT_ACTIVE_INTERVAL,
    inactiveInterval: DEFAULT_INACTIVE_INTERVAL,
    focusInterval: DEFAULT_FOCUS_INTERVAL,
    blurInterval: DEFAULT_BLUR_INTERVAL
  };
}

/**
 * Valida uma configuração e retorna erros detalhados
 */
export function validateConfigWithDetails(config: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { isValid: false, errors, warnings };
  }
  
  // Validar tabelas
  if (!config.tables) {
    errors.push('Tables array is required');
  } else if (!Array.isArray(config.tables)) {
    errors.push('Tables must be an array');
  } else if (config.tables.length === 0) {
    errors.push('At least one table must be specified');
  } else {
    const validator = new RealtimeConfigValidator();
    if (!validator.validateTables(config.tables)) {
      errors.push(`Invalid tables. Valid options: ${VALID_TABLES.join(', ')}`);
    }
    
    // Verificar duplicatas
    const uniqueTables = new Set(config.tables.map((t: string) => t.trim().toLowerCase()));
    if (uniqueTables.size !== config.tables.length) {
      warnings.push('Duplicate tables detected and will be removed');
    }
  }
  
  // Validar filtros
  if (config.filters && !isValidFiltersObject(config.filters)) {
    errors.push('Invalid filters format');
  }
  
  // Validar intervalos
  const intervals = ['activeInterval', 'inactiveInterval', 'focusInterval', 'blurInterval'];
  intervals.forEach(interval => {
    if (config[interval] !== undefined && !isValidPollingInterval(config[interval])) {
      errors.push(`${interval} must be between ${MIN_POLLING_INTERVAL} and ${MAX_POLLING_INTERVAL}ms`);
    }
  });
  
  // Validar datas
  if (config.startDate && !(config.startDate instanceof Date) && typeof config.startDate !== 'string') {
    warnings.push('startDate should be a Date object or ISO string');
  }
  
  if (config.endDate && !(config.endDate instanceof Date) && typeof config.endDate !== 'string') {
    warnings.push('endDate should be a Date object or ISO string');
  }
  
  // Validar API endpoint
  if (config.apiEndpoint && (typeof config.apiEndpoint !== 'string' || !URL_PATTERN.test(config.apiEndpoint))) {
    warnings.push('apiEndpoint should be a valid URL');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Instância singleton do validador
 */
export const configValidator = new RealtimeConfigValidator();