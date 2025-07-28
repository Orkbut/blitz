/**
 * Tipos para as ferramentas de migração dos hooks realtime
 */

export interface HookUsagePattern {
  hookName: string;
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  importStatement: string;
  usageContext: string;
  configObject?: Record<string, any>;
  dependencies: string[];
}

export interface HookUsageAnalysis {
  filePath: string;
  totalHookUsages: number;
  hookPatterns: HookUsagePattern[];
  imports: ImportAnalysis[];
  complexity: 'simple' | 'moderate' | 'complex';
  migrationRecommendation: MigrationRecommendation;
}

export interface ImportAnalysis {
  hookName: string;
  importPath: string;
  isDefault: boolean;
  isNamed: boolean;
  lineNumber: number;
}

export interface MigrationRecommendation {
  strategy: 'direct' | 'wrapper' | 'manual';
  confidence: 'high' | 'medium' | 'low';
  estimatedEffort: 'low' | 'medium' | 'high';
  warnings: string[];
  suggestions: string[];
  requiredChanges: RequiredChange[];
}

export interface RequiredChange {
  type: 'import' | 'config' | 'callback' | 'return_value';
  description: string;
  oldCode: string;
  newCode: string;
  lineNumber?: number;
}

export interface MigrationPlan {
  filePath: string;
  analysis: HookUsageAnalysis;
  changes: RequiredChange[];
  backupRequired: boolean;
  testingRequired: boolean;
  dependencies: string[];
}

export interface MigrationResult {
  filePath: string;
  success: boolean;
  changes: AppliedChange[];
  errors: MigrationError[];
  warnings: string[];
  backupPath?: string;
}

export interface AppliedChange {
  type: RequiredChange['type'];
  description: string;
  lineNumber: number;
  oldContent: string;
  newContent: string;
}

export interface MigrationError {
  type: 'syntax' | 'semantic' | 'dependency' | 'backup';
  message: string;
  lineNumber?: number;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
  testResults?: TestResult[];
}

export interface ValidationError {
  type: 'compilation' | 'runtime' | 'type_check' | 'test_failure';
  message: string;
  filePath: string;
  lineNumber?: number;
  severity: 'error' | 'warning';
}

export interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface MigrationConfig {
  // Configurações de análise
  includePatterns: string[];
  excludePatterns: string[];
  
  // Configurações de migração
  createBackups: boolean;
  validateAfterMigration: boolean;
  runTests: boolean;
  
  // Configurações de hooks
  targetHook: string;
  legacyHooks: string[];
  
  // Configurações de output
  outputDir: string;
  reportFormat: 'json' | 'html' | 'markdown';
}

// Mapeamento de hooks legados para configurações do hook unificado
export interface HookMigrationMapping {
  [legacyHookName: string]: {
    targetConfig: Record<string, any>;
    requiredImports: string[];
    configTransformations: ConfigTransformation[];
    callbackMappings: CallbackMapping[];
  };
}

export interface ConfigTransformation {
  from: string;
  to: string;
  transform?: (value: any) => any;
  required: boolean;
}

export interface CallbackMapping {
  from: string;
  to: string;
  transform?: (callback: Function) => Function;
}