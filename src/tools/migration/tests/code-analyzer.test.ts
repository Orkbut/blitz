/**
 * Testes para o analisador de código
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { CodeAnalyzer } from '../code-analyzer';
import { MigrationConfig } from '../types';

// Mock do fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn()
  }
}));

describe('CodeAnalyzer', () => {
  let analyzer: CodeAnalyzer;
  let mockConfig: MigrationConfig;

  beforeEach(() => {
    mockConfig = {
      includePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/*.test.*'],
      createBackups: true,
      validateAfterMigration: true,
      runTests: false,
      targetHook: 'useRealtimeUnified',
      legacyHooks: ['useRealtimePuro', 'useRealtimeSimple'],
      outputDir: './test-reports',
      reportFormat: 'json'
    };

    analyzer = new CodeAnalyzer(mockConfig);
  });

  describe('analyzeFile', () => {
    it('deve analisar arquivo com hook legado', async () => {
      const mockFileContent = `
import React from 'react';
import { useRealtimePuro } from '@/hooks/useRealtimePuro';

function TestComponent() {
  const { isConnected, eventsReceived } = useRealtimePuro({
    tables: ['operacao'],
    onDatabaseChange: (payload) => {
      console.log('Change:', payload);
    }
  });

  return <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.filePath).toBe('./test-component.tsx');
      expect(result.totalHookUsages).toBe(1);
      expect(result.hookPatterns).toHaveLength(1);
      expect(result.hookPatterns[0].hookName).toBe('useRealtimePuro');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].hookName).toBe('useRealtimePuro');
      expect(result.complexity).toBe('simple');
    });

    it('deve analisar arquivo sem hooks legados', async () => {
      const mockFileContent = `
import React from 'react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function TestComponent() {
  const { isConnected } = useRealtimeUnified({
    tables: ['operacao']
  });

  return <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.totalHookUsages).toBe(0);
      expect(result.hookPatterns).toHaveLength(0);
      expect(result.complexity).toBe('simple');
    });

    it('deve detectar múltiplos hooks legados', async () => {
      const mockFileContent = `
import React from 'react';
import { useRealtimePuro } from '@/hooks/useRealtimePuro';
import { useRealtimeSimple } from '@/hooks/useRealtimeSimple';

function TestComponent() {
  const puro = useRealtimePuro({ tables: ['operacao'] });
  const simple = useRealtimeSimple({ tables: ['participacao'] });

  return <div>Multiple hooks</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.totalHookUsages).toBe(2);
      expect(result.hookPatterns).toHaveLength(2);
      expect(result.complexity).toBe('moderate');
      expect(result.migrationRecommendation.warnings).toContain(
        'Múltiplos tipos de hooks detectados - migração pode requerer consolidação'
      );
    });

    it('deve avaliar complexidade corretamente', async () => {
      const mockFileContent = `
import React from 'react';
import { useRealtimePuro } from '@/hooks/useRealtimePuro';

function TestComponent() {
  const hook1 = useRealtimePuro({ 
    tables: ['operacao'],
    onDatabaseChange: () => {},
    pollingInterval: 5000,
    enableDebug: true,
    customConfig: { complex: true }
  });
  const hook2 = useRealtimePuro({ tables: ['participacao'] });
  const hook3 = useRealtimePuro({ tables: ['eventos'] });
  const hook4 = useRealtimePuro({ tables: ['logs'] });
  const hook5 = useRealtimePuro({ tables: ['audit'] });

  return <div>Complex component</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.complexity).toBe('complex');
      expect(result.migrationRecommendation.strategy).toBe('manual');
      expect(result.migrationRecommendation.confidence).toBe('low');
      expect(result.migrationRecommendation.estimatedEffort).toBe('high');
    });

    it('deve extrair configuração de hooks', async () => {
      const mockFileContent = `
import { useRealtimePuro } from '@/hooks/useRealtimePuro';

function TestComponent() {
  const result = useRealtimePuro({
    tables: ['operacao'],
    onDatabaseChange: handleChange,
    pollingInterval: 5000
  });

  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.hookPatterns[0].configObject).toBeDefined();
      expect(result.hookPatterns[0].configObject?.tables).toBe("['operacao']");
    });
  });

  describe('analyzeDirectory', () => {
    it('deve analisar múltiplos arquivos em diretório', async () => {
      const mockFiles = [
        { name: 'component1.tsx', isFile: () => true, isDirectory: () => false },
        { name: 'component2.ts', isFile: () => true, isDirectory: () => false },
        { name: 'utils.js', isFile: () => true, isDirectory: () => false }
      ];

      (fs.promises.readdir as any).mockResolvedValue(mockFiles);
      
      const mockFileContent = `
import { useRealtimePuro } from '@/hooks/useRealtimePuro';
function Component() {
  const result = useRealtimePuro({ tables: ['test'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const results = await analyzer.analyzeDirectory('./test-dir');

      expect(results).toHaveLength(2); // Apenas .tsx e .ts
      expect(results[0].totalHookUsages).toBe(1);
      expect(results[1].totalHookUsages).toBe(1);
    });

    it('deve pular arquivos excluídos', async () => {
      const mockFiles = [
        { name: 'component.tsx', isFile: () => true, isDirectory: () => false },
        { name: 'component.test.tsx', isFile: () => true, isDirectory: () => false }
      ];

      (fs.promises.readdir as any).mockResolvedValue(mockFiles);
      
      const mockFileContent = `
import { useRealtimePuro } from '@/hooks/useRealtimePuro';
function Component() {
  const result = useRealtimePuro({ tables: ['test'] });
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const results = await analyzer.analyzeDirectory('./test-dir');

      expect(results).toHaveLength(1); // Arquivo .test.tsx deve ser excluído
    });
  });

  describe('import analysis', () => {
    it('deve detectar imports nomeados', async () => {
      const mockFileContent = `
import React from 'react';
import { useRealtimePuro, useRealtimeSimple } from '@/hooks/realtime';
import useRealtimeOperacoes from '@/hooks/useRealtimeOperacoes';

function Component() {
  return <div>Test</div>;
}
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.imports).toHaveLength(3);
      
      const puroImport = result.imports.find(imp => imp.hookName === 'useRealtimePuro');
      expect(puroImport?.isNamed).toBe(true);
      expect(puroImport?.isDefault).toBe(false);
      
      const operacoesImport = result.imports.find(imp => imp.hookName === 'useRealtimeOperacoes');
      expect(operacoesImport?.isDefault).toBe(true);
      expect(operacoesImport?.isNamed).toBe(false);
    });

    it('deve extrair caminhos de import corretamente', async () => {
      const mockFileContent = `
import { useRealtimePuro } from '@/hooks/useRealtimePuro';
import { useRealtimeSimple } from '../hooks/useRealtimeSimple';
import useRealtimeOperacoes from './useRealtimeOperacoes';
`;

      (fs.promises.readFile as any).mockResolvedValue(mockFileContent);

      const result = await analyzer.analyzeFile('./test-component.tsx');

      expect(result.imports[0].importPath).toBe('@/hooks/useRealtimePuro');
      expect(result.imports[1].importPath).toBe('../hooks/useRealtimeSimple');
      expect(result.imports[2].importPath).toBe('./useRealtimeOperacoes');
    });
  });

  describe('pattern matching', () => {
    it('deve usar padrões de inclusão/exclusão', () => {
      const analyzer = new CodeAnalyzer({
        ...mockConfig,
        includePatterns: ['**/components/**/*.tsx'],
        excludePatterns: ['**/*.test.*', '**/node_modules/**']
      });

      // Testes para verificar se os padrões são aplicados corretamente
      expect(analyzer['shouldIncludeFile']('./src/components/Calendar.tsx')).toBe(true);
      expect(analyzer['shouldIncludeFile']('./src/utils/helper.ts')).toBe(false);
      expect(analyzer['shouldExcludePath']('./node_modules/react')).toBe(true);
      expect(analyzer['shouldExcludePath']('./src/components/Calendar.test.tsx')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('deve lidar com erros de leitura de arquivo', async () => {
      (fs.promises.readFile as any).mockRejectedValue(new Error('File not found'));

      await expect(analyzer.analyzeFile('./non-existent.tsx')).rejects.toThrow('File not found');
    });

    it('deve continuar análise mesmo com arquivos problemáticos', async () => {
      const mockFiles = [
        { name: 'good.tsx', isFile: () => true, isDirectory: () => false },
        { name: 'bad.tsx', isFile: () => true, isDirectory: () => false }
      ];

      (fs.promises.readdir as any).mockResolvedValue(mockFiles);
      
      (fs.promises.readFile as any)
        .mockResolvedValueOnce('import { useRealtimePuro } from "@/hooks"; const x = useRealtimePuro({tables: ["test"]});')
        .mockRejectedValueOnce(new Error('Read error'));

      const results = await analyzer.analyzeDirectory('./test-dir');

      expect(results).toHaveLength(1); // Apenas o arquivo válido
      expect(results[0].totalHookUsages).toBe(1);
    });
  });
});