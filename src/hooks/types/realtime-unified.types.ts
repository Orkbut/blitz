/**
 * 🎯 TIPOS PARA O HOOK REALTIME UNIFICADO
 * 
 * Definições de tipos centralizadas para o sistema de realtime unificado.
 * Baseado nos requisitos do design document.
 */

// 🎯 CONFIGURATION VALIDATION TYPES
export interface ConfigValidator {
  validateTables(tables: string[]): boolean;
  validateFilters(filters: Record<string, string>): boolean;
  validateIntervals(config: PollingConfig): boolean;
  sanitizeConfig(config: any): any; // Using any to avoid circular dependency
}

export interface PollingConfig {
  activeInterval?: number;
  inactiveInterval?: number;
  focusInterval?: number;
  blurInterval?: number;
}

// 🎯 ERROR HANDLING TYPES
export enum RealtimeErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  FETCH_ERROR = 'FETCH_ERROR',
  POLLING_ERROR = 'POLLING_ERROR'
}

export interface RealtimeError extends Error {
  type: RealtimeErrorType;
  code?: string;
  retryable: boolean;
  context?: Record<string, any>;
}

// 🎯 SPECIALIZED HOOK INTERFACES
export interface UseRealtimeOperationsConfig {
  operationIds?: number[];
  startDate?: Date;
  endDate?: Date;
  onOperationChange?: (operationId: number, eventType: string) => void;
  onParticipationChange?: (operationId: number, eventType: string) => void;
}

export interface UseRealtimeEventsConfig {
  operationIds?: number[];
  onNewEvent?: (event: any) => void;
}

export interface UseRealtimeSimpleConfig {
  tables: string[];
  onDatabaseChange?: (payload: any) => void;
}

// 🎯 PERFORMANCE METRICS TYPES
export interface PerformanceMetrics {
  connectionTime: number;
  eventLatency: number;
  memoryUsage: number;
  rerenderCount: number;
  networkRequests: number;
}

// 🎯 MIGRATION HELPER TYPES
export interface HookUsageAnalysis {
  filePath: string;
  hookType: string;
  usageCount: number;
  migrationComplexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
}

export interface MigrationPlan {
  targetHook: string;
  steps: MigrationStep[];
  estimatedTime: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MigrationStep {
  description: string;
  type: 'replace' | 'add' | 'remove' | 'modify';
  code: string;
  validation: string;
}

export interface MigrationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  filesModified: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MigrationHelper {
  analyzeHookUsage(filePath: string): HookUsageAnalysis;
  generateMigrationPlan(analysis: HookUsageAnalysis): MigrationPlan;
  applyMigration(plan: MigrationPlan): MigrationResult;
  validateMigration(result: MigrationResult): ValidationResult;
}

// 🎯 FORWARD DECLARATIONS TO AVOID CIRCULAR IMPORTS
// Main types are defined in useRealtimeUnified.ts