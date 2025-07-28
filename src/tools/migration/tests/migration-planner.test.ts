/**
 * Testes para o planejador de migração
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationPlanner } from '../migration-planner';
import { HookUsageAnalysis, HookUsagePattern, ImportAnalysis, MigrationRecommendation } from '../types';

describe('MigrationPlanner', () => {
  let planner: MigrationPlanner;

  beforeEach(() => {
    planner = new MigrationPlanner();
  });

  describe('generateMigrationPlan', () => {
    it('deve gerar plano para useRealtimePuro', () => {
      const mockAnalysis: HookUsageAnalysis = {
        filePath: './test-component.tsx',
        totalHookUsages: 1,
        hookPatterns: [{
          hookName: 'useRealtimePuro',
          filePath: './test-component.tsx',
          lineNumber: 5,
          columnNumber: 10,
          importStatement: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
          usageContext: 'const result = useRealtimePuro({ tables: ["operacao"] });',
          configObject: { tables: '["operacao"]' },
          dependencies: []
        }],
        imports: [{
          hookName: 'useRealtimePuro',
          importPath: '@/hooks/useRealtimePuro',
          isDefault: false,
          isNamed: true,
          lineNumber: 1
        }],
        complexity: 'simple',
        migrationRecommendation: {
          strategy: 'direct',
          confidence: 'high',
          estimatedEffort: 'low',
          warnings: [],
          suggestions: [],
          requiredChanges: []
        }
      };

      const plan = planner.generateMigrationPlan(mockAnalysis);

      expect(plan.filePath).toBe('./test-component.tsx');
      expect(plan.changes).toHaveLength(2); // Import + hook usage
      expect(plan.backupRequired).toBe(false); // Simple migration
      expect(plan.testingRequired).toBe(true);
      expect(plan.dependencies).toContain('useRealtimeUnified');

      // Verificar mudança de import
      const importChange = plan.changes.find(c => c.type === 'import');
      expect(importChange).toBeDefined();
      expect(importChange?.newCode).toContain('useRealtimeUnified');

      // Verificar mudança de configuração
      const configChange = plan.changes.find(c => c.type === 'config');
      expect(configChange).toBeDefined();
      expect(configChange?.description).toContain('useRealtimeUnified');
    });

    it('deve gerar plano para useRealtimeOperacoes', () => {
      const mockAnalysis: HookUsageAnalysis = {
        filePath: './operations-component.tsx',
        totalHookUsages: 1,
        hookPatterns: [{
          hookName: 'useRealtimeOperacoes',
          filePath: './operations-component.tsx',
          lineNumber: 8,
          columnNumber: 15,
          importStatement: "import { useRealtimeOperacoes } from '@/hooks/useRealtimeOperacoes';",
          usageContext: 'const result = useRealtimeOperacoes({ operationIds: [1, 2, 3] });',
          configObject: { 
            operationIds: '[1, 2, 3]',
            startDate: 'new Date("2024-01-01")',
            onOperationChange: 'handleOperationChange'
          },
          dependencies: []
        }],
        imports: [{
          hookName: 'useRealtimeOperacoes',
          importPath: '@/hooks/useRealtimeOperacoes',
          isDefault: false,
          isNamed: true,
          lineNumber: 2
        }],
        complexity: 'moderate',
        migrationRecommendation: {
          strategy: 'direct',
          confidence: 'medium',
          estimatedEffort: 'medium',
          warnings: [],
          suggestions: [],
          requiredChanges: []
        }
      };

      const plan = planner.generateMigrationPlan(mockAnalysis);

      expect(plan.changes).toHaveLength(3); // Import + config + callback
      expect(plan.backupRequired).toBe(true); // Moderate complexity

      // Verificar transformação de configuração
      const configChange = plan.changes.find(c => c.type === 'config');
      expect(configChange?.newCode).toContain('tables');
      expect(configChange?.newCode).toContain('operacao');
      expect(configChange?.newCode).toContain('participacao');

      // Verificar mapeamento de callback
      const callbackChange = plan.changes.find(c => c.type === 'callback');
      expect(callbackChange).toBeDefined();
      expect(callbackChange?.description).toContain('onOperationChange');
    });

    it('deve gerar plano para múltiplos hooks', () => {
      const mockAnalysis: HookUsageAnalysis = {
        filePath: './complex-component.tsx',
        totalHookUsages: 3,
        hookPatterns: [
          {
            hookName: 'useRealtimePuro',
            filePath: './complex-component.tsx',
            lineNumber: 5,
            columnNumber: 10,
            importStatement: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
            usageContext: 'const puro = useRealtimePuro({ tables: ["operacao"] });',
            configObject: { tables: '["operacao"]' },
            dependencies: []
          },
          {
            hookName: 'useRealtimeSimple',
            filePath: './complex-component.tsx',
            lineNumber: 6,
            columnNumber: 10,
            importStatement: "import { useRealtimeSimple } from '@/hooks/useRealtimeSimple';",
            usageContext: 'const simple = useRealtimeSimple({ tables: ["participacao"] });',
            configObject: { tables: '["participacao"]' },
            dependencies: []
          },
          {
            hookName: 'useRealtimeEventos',
            filePath: './complex-component.tsx',
            lineNumber: 7,
            columnNumber: 10,
            importStatement: "import { useRealtimeEventos } from '@/hooks/useRealtimeEventos';",
            usageContext: 'const eventos = useRealtimeEventos({ operationIds: [1] });',
            configObject: { operationIds: '[1]' },
            dependencies: []
          }
        ],
        imports: [
          {
            hookName: 'useRealtimePuro',
            importPath: '@/hooks/useRealtimePuro',
            isDefault: false,
            isNamed: true,
            lineNumber: 1
          },
          {
            hookName: 'useRealtimeSimple',
            importPath: '@/hooks/useRealtimeSimple',
            isDefault: false,
            isNamed: true,
            lineNumber: 2
          },
          {
            hookName: 'useRealtimeEventos',
            importPath: '@/hooks/useRealtimeEventos',
            isDefault: false,
            isNamed: true,
            lineNumber: 3
          }
        ],
        complexity: 'complex',
        migrationRecommendation: {
          strategy: 'manual',
          confidence: 'low',
          estimatedEffort: 'high',
          warnings: ['Múltiplos hooks detectados'],
          suggestions: ['Consolidar em uma única instância'],
          requiredChanges: []
        }
      };

      const plan = planner.generateMigrationPlan(mockAnalysis);

      expect(plan.changes.length).toBeGreaterThan(3); // Múltiplas mudanças
      expect(plan.backupRequired).toBe(true); // Complex migration
      expect(plan.dependencies).toContain('useRealtimeUnified');

      // Verificar que todos os imports são migrados
      const importChanges = plan.changes.filter(c => c.type === 'import');
      expect(importChanges).toHaveLength(3);
    });

    it('deve determinar necessidade de backup corretamente', () => {
      const simpleAnalysis: HookUsageAnalysis = {
        filePath: './simple.tsx',
        totalHookUsages: 1,
        hookPatterns: [{
          hookName: 'useRealtimePuro',
          filePath: './simple.tsx',
          lineNumber: 5,
          columnNumber: 10,
          importStatement: '',
          usageContext: '',
          dependencies: []
        }],
        imports: [],
        complexity: 'simple',
        migrationRecommendation: {
          strategy: 'direct',
          confidence: 'high',
          estimatedEffort: 'low',
          warnings: [],
          suggestions: [],
          requiredChanges: []
        }
      };

      const complexAnalysis: HookUsageAnalysis = {
        ...simpleAnalysis,
        totalHookUsages: 5,
        complexity: 'complex'
      };

      const simplePlan = planner.generateMigrationPlan(simpleAnalysis);
      const complexPlan = planner.generateMigrationPlan(complexAnalysis);

      expect(simplePlan.backupRequired).toBe(false);
      expect(complexPlan.backupRequired).toBe(true);
    });

    it('deve extrair dependências corretamente', () => {
      const mockAnalysis: HookUsageAnalysis = {
        filePath: './test.tsx',
        totalHookUsages: 1,
        hookPatterns: [{
          hookName: 'useRealtimeUnificado',
          filePath: './test.tsx',
          lineNumber: 5,
          columnNumber: 10,
          importStatement: '',
          usageContext: '',
          configObject: {
            enablePolling: 'true',
            enableFetch: 'true'
          },
          dependencies: []
        }],
        imports: [],
        complexity: 'simple',
        migrationRecommendation: {
          strategy: 'direct',
          confidence: 'high',
          estimatedEffort: 'low',
          warnings: [],
          suggestions: [],
          requiredChanges: []
        }
      };

      const plan = planner.generateMigrationPlan(mockAnalysis);

      expect(plan.dependencies).toContain('useRealtimeUnified');
      expect(plan.dependencies).toContain('useSmartPolling');
      expect(plan.dependencies).toContain('data fetching utilities');
    });
  });

  describe('hook mappings', () => {
    it('deve ter mapeamentos para todos os hooks legados', () => {
      const legacyHooks = [
        'useRealtimePuro',
        'useRealtimeSimple',
        'useRealtimeOperacoes',
        'useRealtimeEventos',
        'useRealtimeUnificado',
        'useRealtimeCentralized',
        'useRealtimeCalendarioSupervisor'
      ];

      const mappings = planner['hookMappings'];

      legacyHooks.forEach(hook => {
        expect(mappings[hook]).toBeDefined();
        expect(mappings[hook].targetConfig).toBeDefined();
        expect(mappings[hook].requiredImports).toContain('useRealtimeUnified');
        expect(mappings[hook].configTransformations).toBeDefined();
        expect(mappings[hook].callbackMappings).toBeDefined();
      });
    });

    it('deve transformar configuração corretamente', () => {
      const mapping = planner['hookMappings']['useRealtimeOperacoes'];
      const oldConfig = {
        operationIds: [1, 2, 3],
        startDate: new Date('2024-01-01'),
        onOperationChange: () => {}
      };

      const newConfig = planner['transformConfig'](oldConfig, mapping);

      expect(newConfig.tables).toEqual(['operacao', 'participacao']);
      expect(newConfig.enableRealtime).toBe(true);
      expect(newConfig.enablePolling).toBe(true);
      expect(newConfig.enableFetch).toBe(true);
      expect(newConfig.filters).toBeDefined();
      expect(newConfig.startDate).toEqual(oldConfig.startDate);
    });
  });

  describe('change generation', () => {
    it('deve gerar mudanças de import corretamente', () => {
      const mockAnalysis: HookUsageAnalysis = {
        filePath: './test.tsx',
        totalHookUsages: 1,
        hookPatterns: [],
        imports: [{
          hookName: 'useRealtimePuro',
          importPath: '@/hooks/useRealtimePuro',
          isDefault: false,
          isNamed: true,
          lineNumber: 1
        }],
        complexity: 'simple',
        migrationRecommendation: {
          strategy: 'direct',
          confidence: 'high',
          estimatedEffort: 'low',
          warnings: [],
          suggestions: [],
          requiredChanges: []
        }
      };

      const changes = planner['generateImportChanges'](mockAnalysis);

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('import');
      expect(changes[0].oldCode).toContain('useRealtimePuro');
      expect(changes[0].newCode).toContain('useRealtimeUnified');
      expect(changes[0].lineNumber).toBe(1);
    });

    it('deve reconstruir statements de import corretamente', () => {
      const namedImport = {
        hookName: 'useRealtimePuro',
        importPath: '@/hooks/useRealtimePuro',
        isDefault: false,
        isNamed: true,
        lineNumber: 1
      };

      const defaultImport = {
        hookName: 'useRealtimeOperacoes',
        importPath: '@/hooks/useRealtimeOperacoes',
        isDefault: true,
        isNamed: false,
        lineNumber: 2
      };

      const namedStatement = planner['reconstructImportStatement'](namedImport);
      const defaultStatement = planner['reconstructImportStatement'](defaultImport);

      expect(namedStatement).toBe("import { useRealtimePuro } from '@/hooks/useRealtimePuro';");
      expect(defaultStatement).toBe("import useRealtimeOperacoes from '@/hooks/useRealtimeOperacoes';");
    });
  });
});