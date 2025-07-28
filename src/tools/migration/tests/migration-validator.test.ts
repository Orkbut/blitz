/**
 * Testes para o validador de migração
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { MigrationValidator } from '../migration-validator';
import { MigrationResult } from '../types';

// Mock do fs e child_process
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn()
  },
  readdirSync: vi.fn()
}));

vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

describe('MigrationValidator', () => {
  let validator: MigrationValidator;

  beforeEach(() => {
    validator = new MigrationValidator();
    vi.clearAllMocks();
  });

  describe('validateMigration', () => {
    it('deve validar migração bem-sucedida', async () => {
      const mockResult: MigrationResult = {
        filePath: './test-component.tsx',
        success: true,
        changes: [{
          type: 'import',
          description: 'Migrar import',
          lineNumber: 1,
          oldContent: 'old import',
          newContent: 'new import'
        }],
        errors: [],
        warnings: []
      };

      const validContent = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function TestComponent() {
  const result = useRealtimeUnified({ tables: ['operacao'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(validContent);

      const validation = await validator.validateMigration(mockResult);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('deve detectar erros de compilação', async () => {
      const mockResult: MigrationResult = {
        filePath: './test-component.tsx',
        success: true,
        changes: [],
        errors: [],
        warnings: []
      };

      const invalidContent = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function TestComponent() {
  const result = useRealtimeUnified(); // Erro: falta configuração obrigatória
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(invalidContent);

      const validation = await validator.validateMigration(mockResult);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.message.includes('tables'))).toBe(true);
    });

    it('deve detectar imports não utilizados', async () => {
      const mockResult: MigrationResult = {
        filePath: './test-component.tsx',
        success: true,
        changes: [],
        errors: [],
        warnings: []
      };

      const contentWithUnusedImport = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { unusedFunction } from '@/utils/unused';

function TestComponent() {
  const result = useRealtimeUnified({ tables: ['operacao'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(contentWithUnusedImport);

      const validation = await validator.validateMigration(mockResult);

      expect(validation.errors.some(e => 
        e.message.includes('Import não utilizado') && e.severity === 'warning'
      )).toBe(true);
    });

    it('deve detectar uso de tipo any', async () => {
      const mockResult: MigrationResult = {
        filePath: './test-component.tsx',
        success: true,
        changes: [],
        errors: [],
        warnings: []
      };

      const contentWithAnyType = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function TestComponent() {
  const result: any = useRealtimeUnified({ tables: ['operacao'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(contentWithAnyType);

      const validation = await validator.validateMigration(mockResult);

      expect(validation.errors.some(e => 
        e.message.includes('any') && e.severity === 'warning'
      )).toBe(true);
    });
  });

  describe('validateImports', () => {
    it('deve validar imports válidos', async () => {
      const content = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { useState } from 'react';
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validateImports']('./test.tsx');

      expect(result.errors).toHaveLength(0);
    });

    it('deve detectar imports de hooks legados', async () => {
      const content = `
import React from 'react';
import { useRealtimePuro } from '@/hooks/useRealtimePuro';
import { useRealtimeSimple } from '@/hooks/useRealtimeSimple';
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validateImports']('./test.tsx');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('useRealtimePuro'))).toBe(true);
      expect(result.warnings.some(w => w.includes('useRealtimeSimple'))).toBe(true);
    });
  });

  describe('validateHookUsage', () => {
    it('deve validar uso correto do hook unificado', async () => {
      const content = `
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function Component() {
  const result = useRealtimeUnified({ 
    tables: ['operacao'],
    enableRealtime: true 
  });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validateHookUsage']('./test.tsx');

      expect(result.errors).toHaveLength(0);
    });

    it('deve detectar hooks legados ainda em uso', async () => {
      const content = `
import { useRealtimePuro } from '@/hooks/useRealtimePuro';

function Component() {
  const result = useRealtimePuro({ tables: ['operacao'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validateHookUsage']('./test.tsx');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('useRealtimePuro');
      expect(result.suggestions).toContain('Considere completar a migração removendo todos os hooks legados');
    });

    it('deve sugerir uso do hook unificado quando não presente', async () => {
      const content = `
import React from 'react';

function Component() {
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validateHookUsage']('./test.tsx');

      expect(result.suggestions).toContain('Considere usar useRealtimeUnified para funcionalidade realtime');
    });
  });

  describe('runTests', () => {
    it('deve encontrar e executar testes relacionados', async () => {
      const mockSpawn = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      };

      (spawn as any).mockReturnValue(mockSpawn);
      (fs.promises.access as any).mockResolvedValue(undefined);

      // Simular teste bem-sucedido
      mockSpawn.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 100); // Exit code 0 = sucesso
        }
      });

      const testResults = await validator['runTests']('./src/components/Calendar.tsx');

      expect(testResults).toHaveLength(1);
      expect(testResults[0].passed).toBe(true);
      expect(testResults[0].testName).toContain('Calendar');
    });

    it('deve lidar com testes que falham', async () => {
      const mockSpawn = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      };

      (spawn as any).mockReturnValue(mockSpawn);
      (fs.promises.access as any).mockResolvedValue(undefined);

      // Simular teste que falha
      mockSpawn.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 100); // Exit code 1 = falha
        }
      });

      mockSpawn.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('Test failed: assertion error');
        }
      });

      const testResults = await validator['runTests']('./src/components/Calendar.tsx');

      expect(testResults).toHaveLength(1);
      expect(testResults[0].passed).toBe(false);
      expect(testResults[0].error).toContain('Test failed');
    });

    it('deve lidar com timeout de testes', async () => {
      const mockSpawn = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
        kill: vi.fn()
      };

      (spawn as any).mockReturnValue(mockSpawn);
      (fs.promises.access as any).mockResolvedValue(undefined);

      // Não chamar callback para simular timeout
      mockSpawn.on.mockImplementation(() => {});

      const testResults = await validator['runTests']('./src/components/Calendar.tsx');

      expect(testResults).toHaveLength(1);
      expect(testResults[0].passed).toBe(false);
      expect(testResults[0].error).toContain('timeout');
      expect(mockSpawn.kill).toHaveBeenCalled();
    });
  });

  describe('findRelatedTestFiles', () => {
    it('deve encontrar arquivos de teste relacionados', async () => {
      (fs.promises.access as any)
        .mockResolvedValueOnce(undefined) // Calendar.test.tsx existe
        .mockRejectedValueOnce(new Error('Not found')) // Calendar.test.ts não existe
        .mockResolvedValueOnce(undefined) // Calendar.spec.tsx existe
        .mockRejectedValueOnce(new Error('Not found')); // Calendar.spec.ts não existe

      const testFiles = await validator['findRelatedTestFiles']('./src/components/Calendar.tsx');

      expect(testFiles).toHaveLength(2);
      expect(testFiles).toContain('./src/components/Calendar.test.tsx');
      expect(testFiles).toContain('./src/components/Calendar.spec.tsx');
    });
  });

  describe('validatePerformance', () => {
    it('deve detectar muitos useEffect', async () => {
      const content = `
import React, { useEffect } from 'react';

function Component() {
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  useEffect(() => {}, []);
  
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validatePerformance']('./test.tsx');

      expect(result.warnings.some(w => w.includes('useEffect'))).toBe(true);
    });

    it('deve sugerir useMemo com useRealtimeUnified', async () => {
      const content = `
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function Component() {
  const result = useRealtimeUnified({ tables: ['operacao'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(content);

      const result = await validator['validatePerformance']('./test.tsx');

      expect(result.warnings.some(w => w.includes('useMemo'))).toBe(true);
    });
  });

  describe('validateMigrations', () => {
    it('deve validar múltiplos resultados', async () => {
      const mockResults: MigrationResult[] = [
        {
          filePath: './component1.tsx',
          success: true,
          changes: [],
          errors: [],
          warnings: []
        },
        {
          filePath: './component2.tsx',
          success: true,
          changes: [],
          errors: [],
          warnings: []
        }
      ];

      (fs.promises.readFile as any).mockResolvedValue(`
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
function Component() {
  const result = useRealtimeUnified({ tables: ['test'] });
  return <div>Test</div>;
}
`);

      const validations = await validator.validateMigrations(mockResults);

      expect(validations).toHaveLength(2);
      expect(validations[0].isValid).toBe(true);
      expect(validations[1].isValid).toBe(true);
    });

    it('deve continuar validação mesmo com erros', async () => {
      const mockResults: MigrationResult[] = [
        {
          filePath: './good.tsx',
          success: true,
          changes: [],
          errors: [],
          warnings: []
        },
        {
          filePath: './bad.tsx',
          success: true,
          changes: [],
          errors: [],
          warnings: []
        }
      ];

      (fs.promises.readFile as any)
        .mockResolvedValueOnce('valid content')
        .mockRejectedValueOnce(new Error('File not found'));

      const validations = await validator.validateMigrations(mockResults);

      expect(validations).toHaveLength(2);
      expect(validations[0].isValid).toBe(true);
      expect(validations[1].isValid).toBe(false);
      expect(validations[1].errors[0].message).toContain('File not found');
    });
  });

  describe('utility methods', () => {
    it('deve verificar se import não está sendo usado', () => {
      const importLine = "import { unusedFunction } from '@/utils/unused';";
      const content = `
import { unusedFunction } from '@/utils/unused';

function Component() {
  return <div>Test</div>;
}
`;

      const isUnused = validator['isUnusedImport'](importLine, content);
      expect(isUnused).toBe(true);
    });

    it('deve detectar import sendo usado', () => {
      const importLine = "import { usedFunction } from '@/utils/used';";
      const content = `
import { usedFunction } from '@/utils/used';

function Component() {
  const result = usedFunction();
  return <div>Test</div>;
}
`;

      const isUnused = validator['isUnusedImport'](importLine, content);
      expect(isUnused).toBe(false);
    });

    it('deve extrair caminho de import', () => {
      const importLine = "import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';";
      const path = validator['extractImportPath'](importLine);
      expect(path).toBe('@/hooks/useRealtimeUnified');
    });

    it('deve detectar imports de hooks legados', () => {
      const legacyImport = "import { useRealtimePuro } from '@/hooks/useRealtimePuro';";
      const modernImport = "import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';";

      expect(validator['containsLegacyHookImport'](legacyImport)).toBe(true);
      expect(validator['containsLegacyHookImport'](modernImport)).toBe(false);
    });
  });
});