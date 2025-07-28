/**
 * 🔧 UTILITÁRIOS DE MIGRAÇÃO AUTOMATIZADA
 * 
 * Ferramentas para análise e migração automática de código que usa hooks legados.
 */

import * as fs from 'fs';
import * as path from 'path';

// 🎯 TIPOS PARA ANÁLISE DE CÓDIGO
export interface HookUsageAnalysis {
  filePath: string;
  hookName: string;
  lineNumber: number;
  usage: string;
  parameters: Record<string, any>;
  migrationComplexity: 'simple' | 'moderate' | 'complex';
  suggestedReplacement: string;
}

export interface MigrationPlan {
  filePath: string;
  changes: MigrationChange[];
  estimatedEffort: 'low' | 'medium' | 'high';
  dependencies: string[];
  testingRequired: boolean;
}

export interface MigrationChange {
  lineNumber: number;
  oldCode: string;
  newCode: string;
  reason: string;
}

export interface MigrationResult {
  success: boolean;
  filePath: string;
  changesApplied: number;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 🔧 CLASSE PRINCIPAL PARA MIGRAÇÃO
 */
export class MigrationHelper {
  private readonly legacyHooks = [
    'useRealtimeOperacoes',
    'useRealtimePuro',
    'useRealtimeSimple',
    'useRealtimeEventos',
    'useRealtimeCentralized',
    'useRealtimeUnificado',
    'useRealtimeCalendarioSupervisor'
  ];

  /**
   * 📊 ANALISAR USO DE HOOKS EM UM ARQUIVO
   */
  analyzeHookUsage(filePath: string): HookUsageAnalysis[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const analyses: HookUsageAnalysis[] = [];

    lines.forEach((line, index) => {
      this.legacyHooks.forEach(hookName => {
        if (line.includes(hookName)) {
          const analysis = this.analyzeHookLine(line, index + 1, hookName, filePath);
          if (analysis) {
            analyses.push(analysis);
          }
        }
      });
    });

    return analyses;
  }

  /**
   * 🔍 ANALISAR UMA LINHA ESPECÍFICA COM HOOK
   */
  private analyzeHookLine(
    line: string, 
    lineNumber: number, 
    hookName: string, 
    filePath: string
  ): HookUsageAnalysis | null {
    // Regex para capturar uso do hook
    const hookRegex = new RegExp(`const\\s+\\w+\\s*=\\s*${hookName}\\s*\\(([^)]+)\\)`, 'g');
    const match = hookRegex.exec(line);

    if (!match) {
      // Pode ser um import ou uso diferente
      if (line.includes(`import`) && line.includes(hookName)) {
        return {
          filePath,
          hookName,
          lineNumber,
          usage: line.trim(),
          parameters: {},
          migrationComplexity: 'simple',
          suggestedReplacement: this.generateImportReplacement(line, hookName)
        };
      }
      return null;
    }

    const parametersStr = match[1];
    const parameters = this.parseParameters(parametersStr);
    const complexity = this.assessMigrationComplexity(hookName, parameters);
    const replacement = this.generateReplacement(hookName, parameters, line);

    return {
      filePath,
      hookName,
      lineNumber,
      usage: line.trim(),
      parameters,
      migrationComplexity: complexity,
      suggestedReplacement: replacement
    };
  }

  /**
   * 🔧 PARSEAR PARÂMETROS DO HOOK
   */
  private parseParameters(parametersStr: string): Record<string, any> {
    try {
      // Simplificado - em produção seria mais robusto
      const cleanParams = parametersStr.replace(/\s+/g, ' ').trim();
      
      // Se é um objeto literal
      if (cleanParams.startsWith('{') && cleanParams.endsWith('}')) {
        return { objectLiteral: cleanParams };
      }
      
      // Se são parâmetros separados por vírgula
      return { rawParameters: cleanParams };
    } catch (error) {
      return { parseError: parametersStr };
    }
  }

  /**
   * 📊 AVALIAR COMPLEXIDADE DA MIGRAÇÃO
   */
  private assessMigrationComplexity(
    hookName: string, 
    parameters: Record<string, any>
  ): 'simple' | 'moderate' | 'complex' {
    // Hooks mais simples
    if (['useRealtimeSimple', 'useRealtimeEventos'].includes(hookName)) {
      return 'simple';
    }

    // Hooks complexos
    if (['useRealtimeUnificado', 'useRealtimePuro'].includes(hookName)) {
      return 'complex';
    }

    // Verificar complexidade baseada nos parâmetros
    const paramStr = JSON.stringify(parameters);
    if (paramStr.includes('onUpdate') || paramStr.includes('callback')) {
      return 'moderate';
    }

    return 'simple';
  }

  /**
   * 🔄 GERAR SUBSTITUIÇÃO PARA IMPORT
   */
  private generateImportReplacement(line: string, hookName: string): string {
    // Substituir import do hook legado pelo wrapper
    return line.replace(
      new RegExp(`from\\s+['"]([^'"]+)['"]`),
      `from '$1/legacy-wrappers'`
    );
  }

  /**
   * 🔄 GERAR SUBSTITUIÇÃO PARA USO DO HOOK
   */
  private generateReplacement(
    hookName: string, 
    parameters: Record<string, any>, 
    originalLine: string
  ): string {
    // Para agora, manter o mesmo hook mas com aviso de que está usando wrapper
    return `${originalLine} // TODO: Migrar para useRealtimeUnified`;
  }

  /**
   * 📋 GERAR PLANO DE MIGRAÇÃO
   */
  generateMigrationPlan(analyses: HookUsageAnalysis[]): MigrationPlan[] {
    const plansByFile = new Map<string, MigrationPlan>();

    analyses.forEach(analysis => {
      if (!plansByFile.has(analysis.filePath)) {
        plansByFile.set(analysis.filePath, {
          filePath: analysis.filePath,
          changes: [],
          estimatedEffort: 'low',
          dependencies: ['useRealtimeUnified'],
          testingRequired: true
        });
      }

      const plan = plansByFile.get(analysis.filePath)!;
      
      // Adicionar mudança
      plan.changes.push({
        lineNumber: analysis.lineNumber,
        oldCode: analysis.usage,
        newCode: analysis.suggestedReplacement,
        reason: `Migrar ${analysis.hookName} para useRealtimeUnified`
      });

      // Atualizar esforço estimado
      if (analysis.migrationComplexity === 'complex') {
        plan.estimatedEffort = 'high';
      } else if (analysis.migrationComplexity === 'moderate' && plan.estimatedEffort === 'low') {
        plan.estimatedEffort = 'medium';
      }
    });

    return Array.from(plansByFile.values());
  }

  /**
   * ✅ APLICAR MIGRAÇÃO
   */
  applyMigration(plan: MigrationPlan): MigrationResult {
    const result: MigrationResult = {
      success: false,
      filePath: plan.filePath,
      changesApplied: 0,
      errors: [],
      warnings: []
    };

    try {
      if (!fs.existsSync(plan.filePath)) {
        result.errors.push(`Arquivo não encontrado: ${plan.filePath}`);
        return result;
      }

      const content = fs.readFileSync(plan.filePath, 'utf-8');
      const lines = content.split('\n');

      // Aplicar mudanças (de trás para frente para não afetar números de linha)
      const sortedChanges = plan.changes.sort((a, b) => b.lineNumber - a.lineNumber);
      
      sortedChanges.forEach(change => {
        const lineIndex = change.lineNumber - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          lines[lineIndex] = change.newCode;
          result.changesApplied++;
        } else {
          result.warnings.push(`Linha ${change.lineNumber} não encontrada`);
        }
      });

      // Salvar arquivo modificado
      const newContent = lines.join('\n');
      fs.writeFileSync(plan.filePath, newContent, 'utf-8');

      result.success = true;

    } catch (error) {
      result.errors.push(`Erro ao aplicar migração: ${error}`);
    }

    return result;
  }

  /**
   * ✅ VALIDAR MIGRAÇÃO
   */
  validateMigration(result: MigrationResult): ValidationResult {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      if (!fs.existsSync(result.filePath)) {
        validation.errors.push(`Arquivo não encontrado: ${result.filePath}`);
        validation.isValid = false;
        return validation;
      }

      const content = fs.readFileSync(result.filePath, 'utf-8');

      // Verificar se ainda há hooks legados sem wrapper
      this.legacyHooks.forEach(hookName => {
        const directUsage = new RegExp(`from\\s+['"][^'"]*(?<!legacy-wrappers)['"].*${hookName}`, 'g');
        if (directUsage.test(content)) {
          validation.warnings.push(`Possível uso direto de ${hookName} sem wrapper`);
        }
      });

      // Verificar se imports estão corretos
      if (content.includes('useRealtimeUnified') && !content.includes('legacy-wrappers')) {
        validation.suggestions.push('Considere migrar completamente para useRealtimeUnified');
      }

      // Verificar sintaxe básica
      if (content.includes('TODO: Migrar')) {
        validation.suggestions.push('Há TODOs de migração pendentes');
      }

    } catch (error) {
      validation.errors.push(`Erro na validação: ${error}`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * 📊 GERAR RELATÓRIO DE MIGRAÇÃO
   */
  generateMigrationReport(
    analyses: HookUsageAnalysis[],
    plans: MigrationPlan[],
    results: MigrationResult[]
  ): string {
    const report = [];
    
    report.push('# 📊 RELATÓRIO DE MIGRAÇÃO DE HOOKS REALTIME\n');
    
    // Resumo geral
    report.push('## 📋 Resumo Geral');
    report.push(`- **Arquivos analisados**: ${new Set(analyses.map(a => a.filePath)).size}`);
    report.push(`- **Hooks encontrados**: ${analyses.length}`);
    report.push(`- **Planos de migração**: ${plans.length}`);
    report.push(`- **Migrações aplicadas**: ${results.filter(r => r.success).length}`);
    report.push('');

    // Hooks por complexidade
    const byComplexity = analyses.reduce((acc, a) => {
      acc[a.migrationComplexity] = (acc[a.migrationComplexity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report.push('## 📊 Distribuição por Complexidade');
    Object.entries(byComplexity).forEach(([complexity, count]) => {
      report.push(`- **${complexity}**: ${count} hooks`);
    });
    report.push('');

    // Detalhes por arquivo
    report.push('## 📁 Detalhes por Arquivo');
    plans.forEach(plan => {
      report.push(`### ${plan.filePath}`);
      report.push(`- **Esforço estimado**: ${plan.estimatedEffort}`);
      report.push(`- **Mudanças**: ${plan.changes.length}`);
      report.push(`- **Testes necessários**: ${plan.testingRequired ? 'Sim' : 'Não'}`);
      report.push('');
    });

    return report.join('\n');
  }
}

/**
 * 🏭 FACTORY FUNCTION PARA CRIAR MIGRATION HELPER
 */
export function createMigrationHelper(): MigrationHelper {
  return new MigrationHelper();
}