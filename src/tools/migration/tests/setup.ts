/**
 * Configuração de testes para as ferramentas de migração
 */

import { vi, beforeEach, afterEach, expect } from 'vitest';

// Mock global do console para testes mais limpos
const originalConsole = global.console;

export const mockConsole = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};

// Configuração global para testes
beforeEach(() => {
  // Limpar todos os mocks antes de cada teste
  vi.clearAllMocks();
  
  // Mock do console para evitar logs durante testes
  global.console = mockConsole as any;
});

afterEach(() => {
  // Restaurar console original
  global.console = originalConsole;
});

// Utilitários para testes
export const TestUtils = {
  /**
   * Cria conteúdo de arquivo mock com hooks legados
   */
  createMockFileContent(hookName: string, config?: Record<string, any>): string {
    const configStr = config ? JSON.stringify(config) : '{ tables: ["test"] }';
    
    return `
import React from 'react';
import { ${hookName} } from '@/hooks/${hookName}';

function TestComponent() {
  const result = ${hookName}(${configStr});
  
  return <div>Test Component</div>;
}

export default TestComponent;
`;
  },

  /**
   * Cria análise mock para testes
   */
  createMockAnalysis(overrides?: Partial<any>): any {
    return {
      filePath: './test-component.tsx',
      totalHookUsages: 1,
      hookPatterns: [{
        hookName: 'useRealtimePuro',
        filePath: './test-component.tsx',
        lineNumber: 5,
        columnNumber: 10,
        importStatement: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
        usageContext: 'const result = useRealtimePuro({ tables: ["test"] });',
        configObject: { tables: '["test"]' },
        dependencies: []
      }],
      imports: [{
        hookName: 'useRealtimePuro',
        importPath: '@/hooks/useRealtimePuro',
        isDefault: false,
        isNamed: true,
        lineNumber: 2
      }],
      complexity: 'simple',
      migrationRecommendation: {
        strategy: 'direct',
        confidence: 'high',
        estimatedEffort: 'low',
        warnings: [],
        suggestions: [],
        requiredChanges: []
      },
      ...overrides
    };
  },

  /**
   * Cria resultado de migração mock
   */
  createMockMigrationResult(overrides?: Partial<any>): any {
    return {
      filePath: './test-component.tsx',
      success: true,
      changes: [{
        type: 'import',
        description: 'Migrar import de useRealtimePuro',
        lineNumber: 2,
        oldContent: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
        newContent: "import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';"
      }],
      errors: [],
      warnings: [],
      ...overrides
    };
  },

  /**
   * Cria resultado de validação mock
   */
  createMockValidationResult(overrides?: Partial<any>): any {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      testResults: [],
      ...overrides
    };
  },

  /**
   * Cria plano de migração mock
   */
  createMockMigrationPlan(overrides?: Partial<any>): any {
    return {
      filePath: './test-component.tsx',
      analysis: this.createMockAnalysis(),
      changes: [{
        type: 'import',
        description: 'Migrar import de useRealtimePuro',
        oldCode: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
        newCode: "import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';",
        lineNumber: 2
      }],
      backupRequired: false,
      testingRequired: true,
      dependencies: ['useRealtimeUnified'],
      ...overrides
    };
  },

  /**
   * Simula estrutura de arquivos para testes
   */
  createMockFileStructure(): any {
    return {
      'component1.tsx': this.createMockFileContent('useRealtimePuro'),
      'component2.tsx': this.createMockFileContent('useRealtimeSimple'),
      'component3.ts': this.createMockFileContent('useRealtimeOperacoes', {
        operationIds: [1, 2, 3],
        startDate: 'new Date()',
        onOperationChange: 'handleChange'
      }),
      'subfolder/component4.tsx': this.createMockFileContent('useRealtimeEventos'),
      'test-file.test.tsx': 'test content', // Deve ser excluído
      'README.md': 'documentation' // Deve ser excluído
    };
  },

  /**
   * Cria configuração mock para testes
   */
  createMockConfig(overrides?: Partial<any>): any {
    return {
      includePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/*.test.*', '**/node_modules/**'],
      createBackups: true,
      validateAfterMigration: true,
      runTests: false,
      targetHook: 'useRealtimeUnified',
      legacyHooks: ['useRealtimePuro', 'useRealtimeSimple'],
      outputDir: './test-reports',
      reportFormat: 'json',
      ...overrides
    };
  },

  /**
   * Simula processo spawn para testes
   */
  createMockSpawnProcess(exitCode: number = 0, output: string = ''): any {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn()
    };

    // Simular eventos do processo
    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 10);
      }
    });

    if (output) {
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(output);
        }
      });
    }

    return mockProcess;
  },

  /**
   * Aguarda um tempo específico (para testes assíncronos)
   */
  async wait(ms: number = 10): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Verifica se uma função foi chamada com argumentos específicos
   */
  expectCalledWith(mockFn: any, ...args: any[]): void {
    expect(mockFn).toHaveBeenCalledWith(...args);
  },

  /**
   * Verifica se uma função foi chamada um número específico de vezes
   */
  expectCalledTimes(mockFn: any, times: number): void {
    expect(mockFn).toHaveBeenCalledTimes(times);
  }
};

// Matchers customizados para testes
expect.extend({
  toBeValidMigrationResult(received: any) {
    const pass = received && 
                 typeof received.filePath === 'string' &&
                 typeof received.success === 'boolean' &&
                 Array.isArray(received.changes) &&
                 Array.isArray(received.errors) &&
                 Array.isArray(received.warnings);

    return {
      message: () => `expected ${received} to be a valid MigrationResult`,
      pass
    };
  },

  toBeValidAnalysis(received: any) {
    const pass = received &&
                 typeof received.filePath === 'string' &&
                 typeof received.totalHookUsages === 'number' &&
                 Array.isArray(received.hookPatterns) &&
                 Array.isArray(received.imports) &&
                 ['simple', 'moderate', 'complex'].includes(received.complexity);

    return {
      message: () => `expected ${received} to be a valid HookUsageAnalysis`,
      pass
    };
  },

  toBeValidValidationResult(received: any) {
    const pass = received &&
                 typeof received.isValid === 'boolean' &&
                 Array.isArray(received.errors) &&
                 Array.isArray(received.warnings) &&
                 Array.isArray(received.suggestions);

    return {
      message: () => `expected ${received} to be a valid ValidationResult`,
      pass
    };
  }
});

// Declarações de tipos para os matchers customizados
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidMigrationResult(): T;
    toBeValidAnalysis(): T;
    toBeValidValidationResult(): T;
  }
  interface AsymmetricMatchersContaining {
    toBeValidMigrationResult(): any;
    toBeValidAnalysis(): any;
    toBeValidValidationResult(): any;
  }
}

export default TestUtils;