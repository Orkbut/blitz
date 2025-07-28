/**
 * Ponto de entrada principal para as ferramentas de migração
 */

export { CodeAnalyzer } from './code-analyzer';
export { MigrationPlanner } from './migration-planner';
export { MigrationExecutor } from './migration-executor';
export { MigrationValidator } from './migration-validator';
export { MigrationReporter } from './migration-reporter';
export { MigrationCLI, migrateLegacyHooks, analyzeLegacyHooks } from './migration-cli';

export * from './types';

// Configuração padrão para migração
export const DEFAULT_MIGRATION_CONFIG = {
  includePatterns: ['**/*.ts', '**/*.tsx'],
  excludePatterns: [
    '**/node_modules/**', 
    '**/dist/**', 
    '**/*.test.*', 
    '**/*.spec.*',
    '**/migration-reports/**'
  ],
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
  reportFormat: 'html' as const
};

// Utilitários de conveniência
export const MigrationTools = {
  /**
   * Análise rápida de um arquivo
   */
  async analyzeFile(filePath: string) {
    const { CodeAnalyzer } = await import('./code-analyzer');
    const analyzer = new CodeAnalyzer(DEFAULT_MIGRATION_CONFIG);
    return analyzer.analyzeFile(filePath);
  },

  /**
   * Análise rápida de um diretório
   */
  async analyzeDirectory(dirPath: string) {
    const { CodeAnalyzer } = await import('./code-analyzer');
    const analyzer = new CodeAnalyzer(DEFAULT_MIGRATION_CONFIG);
    return analyzer.analyzeDirectory(dirPath);
  },

  /**
   * Migração completa com configuração padrão
   */
  async migrate(targetPath: string, options: {
    dryRun?: boolean;
    skipValidation?: boolean;
    force?: boolean;
  } = {}) {
    const { MigrationCLI } = await import('./migration-cli');
    const cli = new MigrationCLI();
    return cli.migrate(targetPath, options);
  },

  /**
   * Validação de arquivos migrados
   */
  async validate(targetPath: string) {
    const { MigrationCLI } = await import('./migration-cli');
    const cli = new MigrationCLI();
    return cli.validate(targetPath);
  },

  /**
   * Rollback usando backups
   */
  async rollback(targetPath: string) {
    const { MigrationCLI } = await import('./migration-cli');
    const cli = new MigrationCLI();
    return cli.rollback(targetPath);
  }
};