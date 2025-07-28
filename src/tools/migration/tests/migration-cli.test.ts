/**
 * Testes para a interface CLI de migração
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import { MigrationCLI, migrateLegacyHooks, analyzeLegacyHooks } from '../migration-cli';
import { HookUsageAnalysis, MigrationResult, ValidationResult } from '../types';

// Mock das dependências
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    readdir: vi.fn(),
    copyFile: vi.fn()
  },
  readdirSync: vi.fn()
}));

vi.mock('../code-analyzer');
vi.mock('../migration-planner');
vi.mock('../migration-executor');
vi.mock('../migration-validator');
vi.mock('../migration-reporter');

describe('MigrationCLI', () => {
  let cli: MigrationCLI;

  beforeEach(() => {
    cli = new MigrationCLI();
    vi.clearAllMocks();
  });

  describe('migrate', () => {
    it('deve executar migração completa', async () => {
      const mockAnalyses: HookUsageAnalysis[] = [{
        filePath: './test-component.tsx',
        totalHookUsages: 1,
        hookPatterns: [{
          hookName: 'useRealtimePuro',
          filePath: './test-component.tsx',
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
      }];

      const mockResults: MigrationResult[] = [{
        filePath: './test-component.tsx',
        success: true,
        changes: [],
        errors: [],
        warnings: []
      }];

      const mockValidations: ValidationResult[] = [{
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      }];

      // Mock dos métodos internos
      vi.spyOn(cli as any, 'analyzeCode').mockResolvedValue(mockAnalyses);
      vi.spyOn(cli as any, 'generatePlans').mockResolvedValue([]);
      vi.spyOn(cli as any, 'executeMigration').mockResolvedValue(mockResults);
      vi.spyOn(cli as any, 'validateMigration').mockResolvedValue(mockValidations);
      vi.spyOn(cli as any, 'confirmMigration').mockResolvedValue(true);

      // Mock do reporter
      const mockReporter = {
        generateAnalysisReport: vi.fn(),
        generateMigrationReport: vi.fn()
      };
      (cli as any).reporter = mockReporter;

      await cli.migrate('./src', { force: true });

      expect(cli['analyzeCode']).toHaveBeenCalledWith('./src');
      expect(cli['generatePlans']).toHaveBeenCalledWith(mockAnalyses);
      expect(cli['executeMigration']).toHaveBeenCalled();
      expect(cli['validateMigration']).toHaveBeenCalledWith(mockResults);
      expect(mockReporter.generateAnalysisReport).toHaveBeenCalled();
      expect(mockReporter.generateMigrationReport).toHaveBeenCalled();
    });

    it('deve parar em dry-run mode', async () => {
      const mockAnalyses: HookUsageAnalysis[] = [{
        filePath: './test-component.tsx',
        totalHookUsages: 1,
        hookPatterns: [],
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
      }];

      vi.spyOn(cli as any, 'analyzeCode').mockResolvedValue(mockAnalyses);
      vi.spyOn(cli as any, 'generatePlans').mockResolvedValue([]);
      vi.spyOn(cli as any, 'executeMigration').mockResolvedValue([]);

      const mockReporter = {
        generateAnalysisReport: vi.fn(),
        generateMigrationReport: vi.fn()
      };
      (cli as any).reporter = mockReporter;

      await cli.migrate('./src', { dryRun: true });

      expect(cli['analyzeCode']).toHaveBeenCalled();
      expect(cli['generatePlans']).toHaveBeenCalled();
      expect(cli['executeMigration']).not.toHaveBeenCalled();
      expect(mockReporter.generateAnalysisReport).toHaveBeenCalled();
      expect(mockReporter.generateMigrationReport).not.toHaveBeenCalled();
    });

    it('deve lidar com nenhum hook legado encontrado', async () => {
      vi.spyOn(cli as any, 'analyzeCode').mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.migrate('./src');

      expect(consoleSpy).toHaveBeenCalledWith('✅ Nenhum hook legado encontrado para migração.');
    });

    it('deve cancelar migração se usuário não confirmar', async () => {
      const mockAnalyses: HookUsageAnalysis[] = [{
        filePath: './test-component.tsx',
        totalHookUsages: 1,
        hookPatterns: [],
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
      }];

      vi.spyOn(cli as any, 'analyzeCode').mockResolvedValue(mockAnalyses);
      vi.spyOn(cli as any, 'generatePlans').mockResolvedValue([]);
      vi.spyOn(cli as any, 'confirmMigration').mockResolvedValue(false);
      vi.spyOn(cli as any, 'executeMigration').mockResolvedValue([]);

      const mockReporter = {
        generateAnalysisReport: vi.fn()
      };
      (cli as any).reporter = mockReporter;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.migrate('./src');

      expect(cli['executeMigration']).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Migração cancelada pelo usuário.');
    });
  });

  describe('analyze', () => {
    it('deve executar apenas análise', async () => {
      const mockAnalyses: HookUsageAnalysis[] = [{
        filePath: './test-component.tsx',
        totalHookUsages: 1,
        hookPatterns: [],
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
      }];

      vi.spyOn(cli as any, 'analyzeCode').mockResolvedValue(mockAnalyses);
      vi.spyOn(cli as any, 'generatePlans').mockResolvedValue([]);

      const mockReporter = {
        generateAnalysisReport: vi.fn()
      };
      (cli as any).reporter = mockReporter;

      const result = await cli.analyze('./src');

      expect(result).toEqual(mockAnalyses);
      expect(cli['analyzeCode']).toHaveBeenCalledWith('./src');
      expect(mockReporter.generateAnalysisReport).toHaveBeenCalled();
    });

    it('deve lidar com nenhum hook encontrado na análise', async () => {
      vi.spyOn(cli as any, 'analyzeCode').mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await cli.analyze('./src');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Nenhum hook realtime encontrado.');
    });
  });

  describe('validate', () => {
    it('deve validar arquivos migrados', async () => {
      const mockValidations: ValidationResult[] = [{
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      }];

      vi.spyOn(cli as any, 'findMigratedFiles').mockResolvedValue(['./test.tsx']);
      vi.spyOn(cli as any, 'validator', 'get').mockReturnValue({
        validateMigrations: vi.fn().mockResolvedValue(mockValidations)
      });

      const mockReporter = {
        generateValidationReport: vi.fn()
      };
      (cli as any).reporter = mockReporter;

      const result = await cli.validate('./src');

      expect(result).toEqual(mockValidations);
      expect(mockReporter.generateValidationReport).toHaveBeenCalledWith(mockValidations);
    });

    it('deve lidar com nenhum arquivo migrado', async () => {
      vi.spyOn(cli as any, 'findMigratedFiles').mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await cli.validate('./src');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('ℹ️ Nenhum arquivo migrado encontrado.');
    });
  });

  describe('rollback', () => {
    it('deve reverter arquivos usando backups', async () => {
      const mockBackups = [
        './test-component.tsx.backup.2024-01-01',
        './other-component.tsx.backup.2024-01-01'
      ];

      vi.spyOn(cli as any, 'findBackupFiles').mockResolvedValue(mockBackups);
      vi.spyOn(cli as any, 'getOriginalPathFromBackup')
        .mockReturnValueOnce('./test-component.tsx')
        .mockReturnValueOnce('./other-component.tsx');

      (fs.promises.copyFile as any).mockResolvedValue(undefined);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.rollback('./src');

      expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Revertido: test-component.tsx');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Revertido: other-component.tsx');
    });

    it('deve lidar com nenhum backup encontrado', async () => {
      vi.spyOn(cli as any, 'findBackupFiles').mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.rollback('./src');

      expect(consoleSpy).toHaveBeenCalledWith('ℹ️ Nenhum arquivo de backup encontrado.');
    });

    it('deve continuar rollback mesmo com erros', async () => {
      const mockBackups = [
        './good.tsx.backup.2024-01-01',
        './bad.tsx.backup.2024-01-01'
      ];

      vi.spyOn(cli as any, 'findBackupFiles').mockResolvedValue(mockBackups);
      vi.spyOn(cli as any, 'getOriginalPathFromBackup')
        .mockReturnValueOnce('./good.tsx')
        .mockReturnValueOnce('./bad.tsx');

      (fs.promises.copyFile as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Permission denied'));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await cli.rollback('./src');

      expect(consoleSpy).toHaveBeenCalledWith('✅ Revertido: good.tsx');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Erro ao reverter'),
        expect.any(Error)
      );
    });
  });

  describe('utility methods', () => {
    it('deve analisar arquivo único', async () => {
      (fs.promises.stat as any).mockResolvedValue({ isFile: () => true });

      const mockAnalyzer = {
        analyzeFile: vi.fn().mockResolvedValue({
          totalHookUsages: 1,
          filePath: './test.tsx'
        })
      };
      (cli as any).analyzer = mockAnalyzer;

      const result = await cli['analyzeCode']('./test.tsx');

      expect(result).toHaveLength(1);
      expect(mockAnalyzer.analyzeFile).toHaveBeenCalledWith('./test.tsx');
    });

    it('deve analisar diretório', async () => {
      (fs.promises.stat as any).mockResolvedValue({ isFile: () => false });

      const mockAnalyzer = {
        analyzeDirectory: vi.fn().mockResolvedValue([
          { totalHookUsages: 1, filePath: './test1.tsx' },
          { totalHookUsages: 1, filePath: './test2.tsx' }
        ])
      };
      (cli as any).analyzer = mockAnalyzer;

      const result = await cli['analyzeCode']('./src');

      expect(result).toHaveLength(2);
      expect(mockAnalyzer.analyzeDirectory).toHaveBeenCalledWith('./src');
    });

    it('deve confirmar migração automaticamente', async () => {
      const mockPlans = [
        { changes: [1, 2, 3], backupRequired: true },
        { changes: [4, 5], backupRequired: false }
      ];

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await cli['confirmMigration'](mockPlans as any);

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('📊 Resumo da migração:');
      expect(consoleSpy).toHaveBeenCalledWith('   • 2 arquivos serão modificados');
      expect(consoleSpy).toHaveBeenCalledWith('   • 5 mudanças serão aplicadas');
      expect(consoleSpy).toHaveBeenCalledWith('   • 1 arquivos terão backup criado');
    });

    it('deve verificar se arquivo foi migrado', () => {
      (fs.readdirSync as any).mockReturnValue([
        'component.tsx',
        'component.tsx.backup.2024-01-01',
        'other.tsx'
      ]);

      const isMigrated = cli['isMigratedFile']('./src/component.tsx');
      const isNotMigrated = cli['isMigratedFile']('./src/other.tsx');

      expect(isMigrated).toBe(true);
      expect(isNotMigrated).toBe(false);
    });

    it('deve obter caminho original do backup', () => {
      const backupPath = './component.tsx.backup.2024-01-01T10-30-00';
      const originalPath = cli['getOriginalPathFromBackup'](backupPath);

      expect(originalPath).toBe('./component.tsx');
    });

    it('deve imprimir resumo da migração', () => {
      const mockResults: MigrationResult[] = [
        { success: true, changes: [1, 2], filePath: '', errors: [], warnings: [] },
        { success: false, changes: [], filePath: '', errors: [], warnings: [] },
        { success: true, changes: [3], filePath: '', errors: [], warnings: [] }
      ];

      const mockValidations: ValidationResult[] = [
        { isValid: true, errors: [], warnings: [], suggestions: [] },
        { isValid: false, errors: [], warnings: [], suggestions: [] }
      ];

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      cli['printSummary'](mockResults, mockValidations);

      expect(consoleSpy).toHaveBeenCalledWith('📊 Resumo da Migração:');
      expect(consoleSpy).toHaveBeenCalledWith('   ✅ Arquivos migrados com sucesso: 2');
      expect(consoleSpy).toHaveBeenCalledWith('   ❌ Arquivos com erro: 1');
      expect(consoleSpy).toHaveBeenCalledWith('   🔧 Total de mudanças aplicadas: 3');
      expect(consoleSpy).toHaveBeenCalledWith('   ✅ Arquivos validados: 1');
      expect(consoleSpy).toHaveBeenCalledWith('   ⚠️ Arquivos com problemas: 1');
    });
  });

  describe('error handling', () => {
    it('deve lidar com erros durante migração', async () => {
      vi.spyOn(cli as any, 'analyzeCode').mockRejectedValue(new Error('Analysis failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await cli.migrate('./src');

      expect(consoleSpy).toHaveBeenCalledWith('❌ Erro durante migração:', expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});

describe('utility functions', () => {
  describe('migrateLegacyHooks', () => {
    it('deve executar migração usando CLI', async () => {
      const mockCLI = {
        migrate: vi.fn().mockResolvedValue(undefined)
      };

      // Mock do constructor
      vi.doMock('../migration-cli', () => ({
        MigrationCLI: vi.fn().mockImplementation(() => mockCLI)
      }));

      await migrateLegacyHooks('./src', { dryRun: true });

      expect(mockCLI.migrate).toHaveBeenCalledWith('./src', { dryRun: true });
    });
  });

  describe('analyzeLegacyHooks', () => {
    it('deve executar análise usando CLI', async () => {
      const mockAnalyses: HookUsageAnalysis[] = [];
      const mockCLI = {
        analyze: vi.fn().mockResolvedValue(mockAnalyses)
      };

      // Mock do constructor
      vi.doMock('../migration-cli', () => ({
        MigrationCLI: vi.fn().mockImplementation(() => mockCLI)
      }));

      const result = await analyzeLegacyHooks('./src');

      expect(result).toEqual(mockAnalyses);
      expect(mockCLI.analyze).toHaveBeenCalledWith('./src');
    });
  });
});