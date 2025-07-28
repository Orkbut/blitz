/**
 * Interface de linha de comando para as ferramentas de migração
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeAnalyzer } from './code-analyzer';
import { MigrationPlanner } from './migration-planner';
import { MigrationExecutor } from './migration-executor';
import { MigrationValidator } from './migration-validator';
import { MigrationReporter } from './migration-reporter';
import { 
  MigrationConfig, 
  HookUsageAnalysis, 
  MigrationPlan, 
  MigrationResult,
  ValidationResult 
} from './types';

export class MigrationCLI {
  private analyzer: CodeAnalyzer;
  private planner: MigrationPlanner;
  private executor: MigrationExecutor;
  private validator: MigrationValidator;
  private reporter: MigrationReporter;
  private config: MigrationConfig;

  constructor(config?: Partial<MigrationConfig>) {
    this.config = this.createDefaultConfig(config);
    this.analyzer = new CodeAnalyzer(this.config);
    this.planner = new MigrationPlanner();
    this.executor = new MigrationExecutor();
    this.validator = new MigrationValidator();
    this.reporter = new MigrationReporter();
  }

  /**
   * Comando principal: analisa e migra hooks em um diretório
   */
  async migrate(targetPath: string, options: {
    dryRun?: boolean;
    skipValidation?: boolean;
    skipTests?: boolean;
    force?: boolean;
  } = {}): Promise<void> {
    console.log('🚀 Iniciando migração de hooks realtime...\n');

    try {
      // 1. Análise de código
      console.log('📊 Analisando código...');
      const analyses = await this.analyzeCode(targetPath);
      
      if (analyses.length === 0) {
        console.log('✅ Nenhum hook legado encontrado para migração.');
        return;
      }

      console.log(`📋 Encontrados ${analyses.length} arquivos com hooks legados\n`);

      // 2. Geração de planos de migração
      console.log('📝 Gerando planos de migração...');
      const plans = await this.generatePlans(analyses);
      
      // 3. Relatório de análise
      await this.reporter.generateAnalysisReport(analyses, plans);
      console.log('📄 Relatório de análise gerado em: migration-analysis.html\n');

      if (options.dryRun) {
        console.log('🔍 Modo dry-run ativado - nenhuma mudança será aplicada.');
        return;
      }

      // 4. Confirmação do usuário
      if (!options.force) {
        const shouldProceed = await this.confirmMigration(plans);
        if (!shouldProceed) {
          console.log('❌ Migração cancelada pelo usuário.');
          return;
        }
      }

      // 5. Execução da migração
      console.log('⚡ Executando migração...');
      const results = await this.executeMigration(plans);

      // 6. Validação (se não foi pulada)
      let validations: ValidationResult[] = [];
      if (!options.skipValidation) {
        console.log('✅ Validando migração...');
        validations = await this.validateMigration(results);
      }

      // 7. Relatório final
      await this.reporter.generateMigrationReport(results, validations);
      console.log('📄 Relatório de migração gerado em: migration-report.html\n');

      // 8. Resumo
      this.printSummary(results, validations);

    } catch (error) {
      console.error('❌ Erro durante migração:', error);
      process.exit(1);
    }
  }

  /**
   * Comando: apenas análise sem migração
   */
  async analyze(targetPath: string): Promise<HookUsageAnalysis[]> {
    console.log('📊 Analisando uso de hooks realtime...\n');

    const analyses = await this.analyzeCode(targetPath);
    
    if (analyses.length === 0) {
      console.log('✅ Nenhum hook realtime encontrado.');
      return [];
    }

    // Gerar relatório de análise
    const plans = await this.generatePlans(analyses);
    await this.reporter.generateAnalysisReport(analyses, plans);
    
    console.log(`📋 Análise completa: ${analyses.length} arquivos analisados`);
    console.log('📄 Relatório gerado em: migration-analysis.html');

    return analyses;
  }

  /**
   * Comando: validar migração existente
   */
  async validate(targetPath: string): Promise<ValidationResult[]> {
    console.log('✅ Validando arquivos migrados...\n');

    // Encontrar arquivos que foram migrados (têm backups)
    const migratedFiles = await this.findMigratedFiles(targetPath);
    
    if (migratedFiles.length === 0) {
      console.log('ℹ️ Nenhum arquivo migrado encontrado.');
      return [];
    }

    // Criar resultados simulados para validação
    const mockResults: MigrationResult[] = migratedFiles.map(filePath => ({
      filePath,
      success: true,
      changes: [],
      errors: [],
      warnings: []
    }));

    const validations = await this.validator.validateMigrations(mockResults);
    
    // Gerar relatório de validação
    await this.reporter.generateValidationReport(validations);
    console.log('📄 Relatório de validação gerado em: validation-report.html');

    return validations;
  }

  /**
   * Comando: reverter migração usando backups
   */
  async rollback(targetPath: string): Promise<void> {
    console.log('🔄 Revertendo migração...\n');

    const backupFiles = await this.findBackupFiles(targetPath);
    
    if (backupFiles.length === 0) {
      console.log('ℹ️ Nenhum arquivo de backup encontrado.');
      return;
    }

    console.log(`📋 Encontrados ${backupFiles.length} backups para reverter`);

    for (const backup of backupFiles) {
      try {
        const originalPath = this.getOriginalPathFromBackup(backup);
        await fs.promises.copyFile(backup, originalPath);
        console.log(`✅ Revertido: ${path.basename(originalPath)}`);
      } catch (error) {
        console.error(`❌ Erro ao reverter ${backup}:`, error);
      }
    }

    console.log('\n🔄 Rollback concluído.');
  }

  /**
   * Analisa código em busca de hooks
   */
  private async analyzeCode(targetPath: string): Promise<HookUsageAnalysis[]> {
    const stat = await fs.promises.stat(targetPath);
    
    if (stat.isFile()) {
      const analysis = await this.analyzer.analyzeFile(targetPath);
      return analysis.totalHookUsages > 0 ? [analysis] : [];
    } else {
      return await this.analyzer.analyzeDirectory(targetPath);
    }
  }

  /**
   * Gera planos de migração
   */
  private async generatePlans(analyses: HookUsageAnalysis[]): Promise<MigrationPlan[]> {
    const plans: MigrationPlan[] = [];
    
    for (const analysis of analyses) {
      const plan = this.planner.generateMigrationPlan(analysis);
      plans.push(plan);
    }

    return plans;
  }

  /**
   * Executa migração
   */
  private async executeMigration(plans: MigrationPlan[]): Promise<MigrationResult[]> {
    return await this.executor.executeMigrationPlans(plans);
  }

  /**
   * Valida migração
   */
  private async validateMigration(results: MigrationResult[]): Promise<ValidationResult[]> {
    return await this.validator.validateMigrations(results);
  }

  /**
   * Confirma migração com o usuário
   */
  private async confirmMigration(plans: MigrationPlan[]): Promise<boolean> {
    const totalChanges = plans.reduce((sum, plan) => sum + plan.changes.length, 0);
    const filesWithBackup = plans.filter(p => p.backupRequired).length;
    
    console.log(`📊 Resumo da migração:`);
    console.log(`   • ${plans.length} arquivos serão modificados`);
    console.log(`   • ${totalChanges} mudanças serão aplicadas`);
    console.log(`   • ${filesWithBackup} arquivos terão backup criado`);
    console.log();

    // Em um CLI real, usaria readline para input do usuário
    // Por simplicidade, assumindo confirmação automática
    return true;
  }

  /**
   * Encontra arquivos que foram migrados
   */
  private async findMigratedFiles(targetPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const traverse = async (currentPath: string) => {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile() && this.isMigratedFile(fullPath)) {
          files.push(fullPath);
        }
      }
    };

    const stat = await fs.promises.stat(targetPath);
    if (stat.isFile()) {
      if (this.isMigratedFile(targetPath)) {
        files.push(targetPath);
      }
    } else {
      await traverse(targetPath);
    }

    return files;
  }

  /**
   * Verifica se arquivo foi migrado (tem backup correspondente)
   */
  private isMigratedFile(filePath: string): boolean {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath);
    
    try {
      const files = fs.readdirSync(dir);
      return files.some(file => file.startsWith(`${baseName}.backup.`));
    } catch {
      return false;
    }
  }

  /**
   * Encontra arquivos de backup
   */
  private async findBackupFiles(targetPath: string): Promise<string[]> {
    const backups: string[] = [];
    
    const traverse = async (currentPath: string) => {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (entry.isFile() && entry.name.includes('.backup.')) {
          backups.push(fullPath);
        }
      }
    };

    await traverse(targetPath);
    return backups;
  }

  /**
   * Obtém caminho original a partir do backup
   */
  private getOriginalPathFromBackup(backupPath: string): string {
    return backupPath.replace(/\.backup\.[^.]+$/, '');
  }

  /**
   * Imprime resumo da migração
   */
  private printSummary(results: MigrationResult[], validations: ValidationResult[]): void {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);
    
    console.log('📊 Resumo da Migração:');
    console.log(`   ✅ Arquivos migrados com sucesso: ${successful}`);
    console.log(`   ❌ Arquivos com erro: ${failed}`);
    console.log(`   🔧 Total de mudanças aplicadas: ${totalChanges}`);
    
    if (validations.length > 0) {
      const validFiles = validations.filter(v => v.isValid).length;
      const invalidFiles = validations.length - validFiles;
      
      console.log(`   ✅ Arquivos validados: ${validFiles}`);
      console.log(`   ⚠️ Arquivos com problemas: ${invalidFiles}`);
    }
    
    console.log('\n🎉 Migração concluída!');
  }

  /**
   * Cria configuração padrão
   */
  private createDefaultConfig(config?: Partial<MigrationConfig>): MigrationConfig {
    return {
      includePatterns: ['**/*.ts', '**/*.tsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*'],
      createBackups: true,
      validateAfterMigration: true,
      runTests: false,
      targetHook: 'useRealtimeUnified',
      legacyHooks: [
        'useRealtimePuro',
        'useRealtimeSimple',
        'useRealtimeOperacoes',
        'useRealtimeEventos',
        'useRealtimeCentralized',
        'useRealtimeCalendarioSupervisor',
        'useRealtimeUnificado'
      ],
      outputDir: './migration-reports',
      reportFormat: 'html',
      ...config
    };
  }
}

// Função utilitária para uso direto
export async function migrateLegacyHooks(
  targetPath: string, 
  options: {
    dryRun?: boolean;
    skipValidation?: boolean;
    force?: boolean;
  } = {}
): Promise<void> {
  const cli = new MigrationCLI();
  await cli.migrate(targetPath, options);
}

export async function analyzeLegacyHooks(targetPath: string): Promise<HookUsageAnalysis[]> {
  const cli = new MigrationCLI();
  return await cli.analyze(targetPath);
}