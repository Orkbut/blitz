/**
 * 🎯 TESTES UNITÁRIOS PARA VALIDADOR DE CONFIGURAÇÃO
 * 
 * Testes abrangentes para todas as funcionalidades do config-validator.
 * Implementa os requisitos 1.1 e 4.2 da especificação.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RealtimeConfigValidator,
  configValidator,
  validateConfigOrThrow,
  createConfigurationError,
  isConfigurationError,
  isValidRealtimeConfig,
  isValidTablesArray,
  isValidFiltersObject,
  isValidPollingInterval,
  getValidTables,
  getPollingLimits,
  getDefaultConfig,
  validateConfigWithDetails
} from '../hooks/utils/config-validator';
import { RealtimeErrorType } from '../hooks/types/realtime-unified.types';

describe('RealtimeConfigValidator', () => {
  let validator: RealtimeConfigValidator;

  beforeEach(() => {
    validator = new RealtimeConfigValidator();
  });

  describe('validateTables', () => {
    it('deve aceitar tabelas válidas', () => {
      expect(validator.validateTables(['operacao'])).toBe(true);
      expect(validator.validateTables(['operacao', 'participacao'])).toBe(true);
      expect(validator.validateTables(['eventos_operacao', 'servidor', 'modalidade'])).toBe(true);
    });

    it('deve rejeitar array vazio', () => {
      expect(validator.validateTables([])).toBe(false);
    });

    it('deve rejeitar tabelas inválidas', () => {
      expect(validator.validateTables(['tabela_inexistente'])).toBe(false);
      expect(validator.validateTables(['operacao', 'tabela_inexistente'])).toBe(false);
    });

    it('deve rejeitar valores não-string', () => {
      expect(validator.validateTables([123 as any])).toBe(false);
      expect(validator.validateTables([null as any])).toBe(false);
      expect(validator.validateTables([undefined as any])).toBe(false);
    });

    it('deve rejeitar strings vazias', () => {
      expect(validator.validateTables([''])).toBe(false);
      expect(validator.validateTables(['   '])).toBe(false);
    });

    it('deve rejeitar tabelas duplicadas', () => {
      expect(validator.validateTables(['operacao', 'operacao'])).toBe(false);
      expect(validator.validateTables(['operacao', 'OPERACAO'])).toBe(false);
    });

    it('deve ser case-insensitive', () => {
      expect(validator.validateTables(['OPERACAO'])).toBe(true);
      expect(validator.validateTables(['Participacao'])).toBe(true);
    });
  });

  describe('validateFilters', () => {
    it('deve aceitar filtros undefined/null (opcionais)', () => {
      expect(validator.validateFilters(undefined as any)).toBe(true);
      expect(validator.validateFilters(null as any)).toBe(true);
    });

    it('deve aceitar filtros válidos', () => {
      expect(validator.validateFilters({
        'operacao': 'id.eq.123'
      })).toBe(true);

      expect(validator.validateFilters({
        'operacao': 'data_operacao.gte.2024-01-01',
        'participacao': 'estado_visual.eq.aprovado'
      })).toBe(true);
    });

    it('deve rejeitar tabelas inválidas nos filtros', () => {
      expect(validator.validateFilters({
        'tabela_inexistente': 'id.eq.123'
      })).toBe(false);
    });

    it('deve rejeitar filtros vazios', () => {
      expect(validator.validateFilters({
        'operacao': ''
      })).toBe(false);

      expect(validator.validateFilters({
        'operacao': '   '
      })).toBe(false);
    });

    it('deve rejeitar arrays como filtros', () => {
      expect(validator.validateFilters(['operacao'] as any)).toBe(false);
    });

    it('deve aceitar filtros com sintaxe alternativa', () => {
      expect(validator.validateFilters({
        'operacao': 'id=123'
      })).toBe(true);

      expect(validator.validateFilters({
        'operacao': 'data_operacao.gte'
      })).toBe(true);
    });
  });

  describe('validateIntervals', () => {
    it('deve aceitar intervalos válidos', () => {
      expect(validator.validateIntervals({
        activeInterval: 5000,
        inactiveInterval: 30000
      })).toBe(true);
    });

    it('deve aceitar intervalos undefined (opcionais)', () => {
      expect(validator.validateIntervals({})).toBe(true);
      expect(validator.validateIntervals({
        activeInterval: undefined,
        inactiveInterval: undefined
      })).toBe(true);
    });

    it('deve rejeitar intervalos muito pequenos', () => {
      expect(validator.validateIntervals({
        activeInterval: 500
      })).toBe(false);
    });

    it('deve rejeitar intervalos muito grandes', () => {
      expect(validator.validateIntervals({
        activeInterval: 400000
      })).toBe(false);
    });

    it('deve rejeitar valores não-numéricos', () => {
      expect(validator.validateIntervals({
        activeInterval: '5000' as any
      })).toBe(false);

      expect(validator.validateIntervals({
        activeInterval: null as any
      })).toBe(false);
    });
  });

  describe('sanitizeConfig', () => {
    it('deve sanitizar tabelas corretamente', () => {
      const config = {
        tables: ['  OPERACAO  ', 'participacao', 'tabela_inexistente'],
        enableRealtime: true
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.tables).toEqual(['operacao', 'participacao']);
    });

    it('deve remover tabelas duplicadas', () => {
      const config = {
        tables: ['operacao', 'OPERACAO', 'participacao'],
        enableRealtime: true
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.tables).toEqual(['operacao', 'participacao']);
    });

    it('deve aplicar valores padrão para intervalos', () => {
      const config = {
        tables: ['operacao'],
        activeInterval: undefined
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.activeInterval).toBe(5000);
      expect(sanitized.inactiveInterval).toBe(30000);
    });

    it('deve corrigir intervalos inválidos', () => {
      const config = {
        tables: ['operacao'],
        activeInterval: 500, // Muito pequeno
        inactiveInterval: 400000 // Muito grande
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.activeInterval).toBe(1000); // MIN_POLLING_INTERVAL
      expect(sanitized.inactiveInterval).toBe(300000); // MAX_POLLING_INTERVAL
    });

    it('deve sanitizar filtros corretamente', () => {
      const config = {
        tables: ['operacao'],
        filters: {
          '  OPERACAO  ': '  id.eq.123  ',
          'tabela_inexistente': 'id.eq.456',
          'participacao': ''
        }
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.filters).toEqual({
        'operacao': 'id.eq.123'
      });
    });

    it('deve aplicar valores padrão para feature flags', () => {
      const config = {
        tables: ['operacao']
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.enableRealtime).toBe(true);
      expect(sanitized.enablePolling).toBe(true);
      expect(sanitized.enableFetch).toBe(true);
      expect(sanitized.debug).toBe(false);
    });

    it('deve sanitizar datas corretamente', () => {
      const validDate = new Date('2024-01-01');
      const config = {
        tables: ['operacao'],
        startDate: '2024-01-01' as any, // Permitir string para teste de sanitização
        endDate: validDate
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.startDate).toBeInstanceOf(Date);
      expect(sanitized.endDate).toBe(validDate);
    });

    it('deve trocar datas se estiverem na ordem errada', () => {
      const config = {
        tables: ['operacao'],
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01')
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.startDate?.getTime()).toBe(new Date('2024-01-01').getTime());
      expect(sanitized.endDate?.getTime()).toBe(new Date('2024-12-31').getTime());
    });

    it('deve remover datas inválidas', () => {
      const config = {
        tables: ['operacao'],
        startDate: 'data-invalida' as any,
        endDate: 123 as any
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.startDate).toBeUndefined();
      expect(sanitized.endDate).toBeUndefined();
    });

    it('deve sanitizar API endpoint', () => {
      const config1 = {
        tables: ['operacao'],
        apiEndpoint: '  https://api.example.com  '
      };

      const config2 = {
        tables: ['operacao'],
        apiEndpoint: 'endpoint-invalido'
      };

      const sanitized1 = validator.sanitizeConfig(config1);
      const sanitized2 = validator.sanitizeConfig(config2);

      expect(sanitized1.apiEndpoint).toBe('https://api.example.com');
      expect(sanitized2.apiEndpoint).toBeUndefined();
    });

    it('deve remover callbacks inválidos', () => {
      const validCallback = () => {};
      const config = {
        tables: ['operacao'],
        onDatabaseChange: validCallback,
        onConnectionChange: 'not-a-function' as any,
        onError: null as any
      };

      const sanitized = validator.sanitizeConfig(config);
      expect(sanitized.onDatabaseChange).toBe(validCallback);
      expect(sanitized.onConnectionChange).toBeUndefined();
      expect(sanitized.onError).toBeUndefined();
    });

    it('deve sanitizar channelId', () => {
      const config1 = {
        tables: ['operacao'],
        channelId: '  valid-channel-123  '
      };

      const config2 = {
        tables: ['operacao'],
        channelId: 'invalid channel!'
      };

      const sanitized1 = validator.sanitizeConfig(config1);
      const sanitized2 = validator.sanitizeConfig(config2);

      expect(sanitized1.channelId).toBe('valid-channel-123');
      expect(sanitized2.channelId).toBeUndefined();
    });
  });
});

describe('Funções utilitárias', () => {
  describe('createConfigurationError', () => {
    it('deve criar erro de configuração corretamente', () => {
      const error = createConfigurationError('Test error', { test: true });
      
      expect(error.message).toBe('Test error');
      expect(error.type).toBe(RealtimeErrorType.CONFIGURATION_ERROR);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ test: true });
    });
  });

  describe('isConfigurationError', () => {
    it('deve identificar erros de configuração', () => {
      const configError = createConfigurationError('Test');
      const regularError = new Error('Regular error');
      
      expect(isConfigurationError(configError)).toBe(true);
      expect(isConfigurationError(regularError)).toBe(false);
      expect(isConfigurationError(null)).toBe(false);
    });
  });

  describe('validateConfigOrThrow', () => {
    it('deve passar para configuração válida', () => {
      const validConfig = {
        tables: ['operacao'],
        activeInterval: 5000
      };

      expect(() => validateConfigOrThrow(validConfig)).not.toThrow();
    });

    it('deve lançar erro para tabelas inválidas', () => {
      const invalidConfig = {
        tables: ['tabela_inexistente']
      };

      expect(() => validateConfigOrThrow(invalidConfig)).toThrow();
    });

    it('deve lançar erro para filtros inválidos', () => {
      const invalidConfig = {
        tables: ['operacao'],
        filters: {
          'tabela_inexistente': 'id.eq.123'
        }
      };

      expect(() => validateConfigOrThrow(invalidConfig)).toThrow();
    });

    it('deve lançar erro para intervalos inválidos', () => {
      const invalidConfig = {
        tables: ['operacao'],
        activeInterval: 500
      };

      expect(() => validateConfigOrThrow(invalidConfig)).toThrow();
    });
  });
});

describe('Type Guards', () => {
  describe('isValidRealtimeConfig', () => {
    it('deve validar configuração completa', () => {
      const validConfig = {
        tables: ['operacao', 'participacao'],
        activeInterval: 5000,
        enableRealtime: true
      };

      expect(isValidRealtimeConfig(validConfig)).toBe(true);
    });

    it('deve rejeitar configuração inválida', () => {
      expect(isValidRealtimeConfig(null)).toBe(false);
      expect(isValidRealtimeConfig({})).toBe(false);
      expect(isValidRealtimeConfig({ tables: [] })).toBe(false);
    });
  });

  describe('isValidTablesArray', () => {
    it('deve validar array de tabelas válidas', () => {
      expect(isValidTablesArray(['operacao'])).toBe(true);
      expect(isValidTablesArray(['operacao', 'participacao'])).toBe(true);
    });

    it('deve rejeitar arrays inválidos', () => {
      expect(isValidTablesArray([])).toBe(false);
      expect(isValidTablesArray(['tabela_inexistente'])).toBe(false);
      expect(isValidTablesArray('not-array')).toBe(false);
    });
  });

  describe('isValidFiltersObject', () => {
    it('deve validar objeto de filtros válido', () => {
      expect(isValidFiltersObject({
        'operacao': 'id.eq.123'
      })).toBe(true);
    });

    it('deve rejeitar objetos inválidos', () => {
      expect(isValidFiltersObject(null)).toBe(false);
      expect(isValidFiltersObject([])).toBe(false);
      expect(isValidFiltersObject({
        'tabela_inexistente': 'id.eq.123'
      })).toBe(false);
    });
  });

  describe('isValidPollingInterval', () => {
    it('deve validar intervalos válidos', () => {
      expect(isValidPollingInterval(5000)).toBe(true);
      expect(isValidPollingInterval(1000)).toBe(true);
      expect(isValidPollingInterval(300000)).toBe(true);
    });

    it('deve rejeitar intervalos inválidos', () => {
      expect(isValidPollingInterval(500)).toBe(false);
      expect(isValidPollingInterval(400000)).toBe(false);
      expect(isValidPollingInterval('5000')).toBe(false);
    });
  });
});

describe('Funções de utilidade', () => {
  describe('getValidTables', () => {
    it('deve retornar lista de tabelas válidas', () => {
      const tables = getValidTables();
      expect(tables).toContain('operacao');
      expect(tables).toContain('participacao');
      expect(tables).toContain('eventos_operacao');
    });
  });

  describe('getPollingLimits', () => {
    it('deve retornar limites de polling', () => {
      const limits = getPollingLimits();
      expect(limits.min).toBe(1000);
      expect(limits.max).toBe(300000);
    });
  });

  describe('getDefaultConfig', () => {
    it('deve retornar configuração padrão', () => {
      const defaults = getDefaultConfig();
      expect(defaults.enableRealtime).toBe(true);
      expect(defaults.enablePolling).toBe(true);
      expect(defaults.activeInterval).toBe(5000);
    });
  });

  describe('validateConfigWithDetails', () => {
    it('deve retornar detalhes para configuração válida', () => {
      const result = validateConfigWithDetails({
        tables: ['operacao'],
        activeInterval: 5000
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve retornar erros detalhados', () => {
      const result = validateConfigWithDetails({
        tables: [],
        activeInterval: 500
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('deve retornar warnings para problemas menores', () => {
      const result = validateConfigWithDetails({
        tables: ['operacao', 'operacao'], // Duplicata
        startDate: 'not-a-date'
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('Singleton configValidator', () => {
  it('deve ser uma instância de RealtimeConfigValidator', () => {
    expect(configValidator).toBeInstanceOf(RealtimeConfigValidator);
  });

  it('deve funcionar corretamente', () => {
    expect(configValidator.validateTables(['operacao'])).toBe(true);
  });
});