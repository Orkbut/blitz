/**
 * Testes para o executor de migração
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { MigrationExecutor } from '../migration-executor';
import { MigrationPlan, RequiredChange } from '../types';

// Mock do fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn()
  }
}));

describe('MigrationExecutor', () => {
  let executor: MigrationExecutor;

  beforeEach(() => {
    executor = new MigrationExecutor();
    vi.clearAllMocks();
  });

  describe('executeMigrationPlan', () => {
    it('deve executar plano de migração simples', async () => {
      const mockPlan: MigrationPlan = {
        filePath: './test-component.tsx',
        analysis: {} as any,
        changes: [
          {
            type: 'import',
            description: 'Migrar import de useRealtimePuro',
            oldCode: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
            newCode: "import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';",
            lineNumber: 1
          },
          {
            type: 'config',
            description: 'Migrar configuração do hook',
            oldCode: 'const result = useRealtimePuro({ tables: ["operacao"] });',
            newCode: 'const result = useRealtimeUnified({ tables: ["operacao"], enableRealtime: true });',
            lineNumber: 5
          }
        ],
        backupRequired: false,
        testingRequired: true,
        dependencies: ['useRealtimeUnified']
      };

      const originalContent = `import React from 'react';
import { useRealtimePuro } from '@/hooks/useRealtimePuro';

function TestComponent() {
  const result = useRealtimePuro({ tables: ["operacao"] });
  return <div>Test</div>;
}`;

      (fs.promises.readFile as any).mockResolvedValue(originalContent);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await executor.executeMigrationPlan(mockPlan);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('deve criar backup quando necessário', async () => {
      const mockPlan: MigrationPlan = {
        filePath: './test-component.tsx',
        analysis: {} as any,
        changes: [{
          type: 'import',
          description: 'Test change',
          oldCode: 'old',
          newCode: 'new',
          lineNumber: 1
        }],
        backupRequired: true,
        testingRequired: false,
        dependencies: []
      };

      (fs.promises.readFile as any).mockResolvedValue('test content');
      (fs.promises.writeFile as any).mockResolvedValue(undefined);
      (fs.promises.copyFile as any).mockResolvedValue(undefined);

      const result = await executor.executeMigrationPlan(mockPlan);

      expect(result.backupPath).toBeDefined();
      expect(result.backupPath).toContain('.backup.');
      expect(fs.promises.copyFile).toHaveBeenCalled();
    });

    it('deve lidar com erros de sintaxe', async () => {
      const mockPlan: MigrationPlan = {
        filePath: './test-component.tsx',
        analysis: {} as any,
        changes: [{
          type: 'config',
          description: 'Mudança que causa erro de sintaxe',
          oldCode: 'const result = useRealtimePuro({});',
          newCode: 'const result = useRealtimeUnified({ // sintaxe inválida',
          lineNumber: 5
        }],
        backupRequired: false,
        testingRequired: false,
        dependencies: []
      };

      const originalContent = `import React from 'react';
function TestComponent() {
  const result = useRealtimePuro({});
  return <div>Test</div>;
}`;

      (fs.promises.readFile as any).mockResolvedValue(originalContent);

      const result = await executor.executeMigrationPlan(mockPlan);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('syntax');
    });

    it('deve aplicar mudanças em ordem reversa', async () => {
      const mockPlan: MigrationPlan = {
        filePath: './test-component.tsx',
        analysis: {} as any,
        changes: [
          {
            type: 'config',
            description: 'Primeira mudança',
            oldCode: 'linha 3',
            newCode: 'nova linha 3',
            lineNumber: 3
          },
          {
            type: 'import',
            description: 'Segunda mudança',
            oldCode: 'linha 1',
            newCode: 'nova linha 1',
            lineNumber: 1
          },
          {
            type: 'config',
            description: 'Terceira mudança',
            oldCode: 'linha 5',
            newCode: 'nova linha 5',
            lineNumber: 5
          }
        ],
        backupRequired: false,
        testingRequired: false,
        dependencies: []
      };

      const originalContent = `linha 1
linha 2
linha 3
linha 4
linha 5`;

      (fs.promises.readFile as any).mockResolvedValue(originalContent);
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const result = await executor.executeMigrationPlan(mockPlan);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(3);
      
      // Verificar que as mudanças foram aplicadas na ordem correta (linha 5, 3, 1)
      expect(result.changes[0].lineNumber).toBe(5);
      expect(result.changes[1].lineNumber).toBe(3);
      expect(result.changes[2].lineNumber).toBe(1);
    });
  });

  describe('applyChange', () => {
    it('deve aplicar mudança de import', async () => {
      const lines = [
        "import React from 'react';",
        "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
        "",
        "function Component() {"
      ];

      const change: RequiredChange = {
        type: 'import',
        description: 'Migrar import',
        oldCode: "import { useRealtimePuro } from '@/hooks/useRealtimePuro';",
        newCode: "import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';",
        lineNumber: 2
      };

      const result = await executor['applyImportChange'](lines, change);

      expect(result.type).toBe('import');
      expect(result.lineNumber).toBe(2);
      expect(result.newContent).toContain('useRealtimeUnified');
    });

    it('deve aplicar mudança de configuração', async () => {
      const lines = [
        "function Component() {",
        "  const result = useRealtimePuro({ tables: ['test'] });",
        "  return <div>Test</div>;",
        "}"
      ];

      const change: RequiredChange = {
        type: 'config',
        description: 'Migrar configuração',
        oldCode: "useRealtimePuro({ tables: ['test'] })",
        newCode: "useRealtimeUnified({ tables: ['test'], enableRealtime: true })",
        lineNumber: 2
      };

      const result = await executor['applyConfigChange'](lines, change);

      expect(result.type).toBe('config');
      expect(result.newContent).toContain('useRealtimeUnified');
      expect(result.newContent).toContain('enableRealtime: true');
    });

    it('deve aplicar mudança de callback', async () => {
      const lines = [
        "const config = {",
        "  tables: ['test'],",
        "  onOperationChange: handleChange",
        "};"
      ];

      const change: RequiredChange = {
        type: 'callback',
        description: 'Migrar callback',
        oldCode: 'onOperationChange: handleChange',
        newCode: 'onDatabaseChange: handleChange',
        lineNumber: 3
      };

      const result = await executor['applyCallbackChange'](lines, change);

      expect(result.type).toBe('callback');
      expect(result.newContent).toContain('onDatabaseChange');
    });
  });

  describe('validateSyntax', () => {
    it('deve validar sintaxe TypeScript básica', async () => {
      const validContent = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function Component() {
  const result = useRealtimeUnified({ tables: ['test'] });
  return <div>Test</div>;
}
`;

      const result = await executor['validateSyntax'](validContent, './test.tsx');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve detectar imports malformados', async () => {
      const invalidContent = `
import React from 'react'
import { useRealtimeUnified } '@/hooks/useRealtimeUnified';

function Component() {
  return <div>Test</div>;
}
`;

      const result = await executor['validateSyntax'](invalidContent, './test.tsx');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Import statement malformado');
    });

    it('deve verificar parênteses balanceados', async () => {
      const invalidContent = `
function Component() {
  const result = useRealtimeUnified({ tables: ['test'] );
  return <div>Test</div>;
`;

      const result = await executor['validateSyntax'](invalidContent, './test.tsx');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('desbalanceados'))).toBe(true);
    });
  });

  describe('executeMigrationPlans', () => {
    it('deve executar múltiplos planos', async () => {
      const plans: MigrationPlan[] = [
        {
          filePath: './component1.tsx',
          analysis: {} as any,
          changes: [{
            type: 'import',
            description: 'Test',
            oldCode: 'old',
            newCode: 'new',
            lineNumber: 1
          }],
          backupRequired: false,
          testingRequired: false,
          dependencies: []
        },
        {
          filePath: './component2.tsx',
          analysis: {} as any,
          changes: [{
            type: 'config',
            description: 'Test',
            oldCode: 'old',
            newCode: 'new',
            lineNumber: 1
          }],
          backupRequired: false,
          testingRequired: false,
          dependencies: []
        }
      ];

      (fs.promises.readFile as any).mockResolvedValue('test content');
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const results = await executor.executeMigrationPlans(plans);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('deve continuar execução mesmo com falhas', async () => {
      const plans: MigrationPlan[] = [
        {
          filePath: './good.tsx',
          analysis: {} as any,
          changes: [{
            type: 'import',
            description: 'Test',
            oldCode: 'old',
            newCode: 'new',
            lineNumber: 1
          }],
          backupRequired: false,
          testingRequired: false,
          dependencies: []
        },
        {
          filePath: './bad.tsx',
          analysis: {} as any,
          changes: [{
            type: 'config',
            description: 'Test',
            oldCode: 'old',
            newCode: 'new',
            lineNumber: 1
          }],
          backupRequired: false,
          testingRequired: false,
          dependencies: []
        }
      ];

      (fs.promises.readFile as any)
        .mockResolvedValueOnce('good content')
        .mockRejectedValueOnce(new Error('File not found'));
      (fs.promises.writeFile as any).mockResolvedValue(undefined);

      const results = await executor.executeMigrationPlans(plans);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].errors[0].message).toContain('File not found');
    });
  });

  describe('createBackup', () => {
    it('deve criar backup com timestamp', async () => {
      const filePath = './test-component.tsx';
      
      (fs.promises.copyFile as any).mockResolvedValue(undefined);

      const backupPath = await executor['createBackup'](filePath);

      expect(backupPath).toContain('.backup.');
      expect(backupPath).toContain('test-component.tsx');
      expect(fs.promises.copyFile).toHaveBeenCalledWith(filePath, backupPath);
    });
  });
});