/**
 * Analisador de código para identificar padrões de uso dos hooks realtime
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  HookUsagePattern, 
  HookUsageAnalysis, 
  ImportAnalysis, 
  MigrationRecommendation,
  MigrationConfig 
} from './types';

export class CodeAnalyzer {
  private config: MigrationConfig;
  
  // Hooks legados conhecidos
  private readonly LEGACY_HOOKS = [
    'useRealtime',
    'useRealtimePuro', 
    'useRealtimeSimple',
    'useRealtimeCentralized',
    'useRealtimeOperacoes',
    'useRealtimeEventos',
    'useRealtimeCalendarioSupervisor',
    'useRealtimeUnificado'
  ];

  constructor(config: MigrationConfig) {
    this.config = config;
  }

  /**
   * Analisa um arquivo específico em busca de padrões de uso de hooks
   */
  async analyzeFile(filePath: string): Promise<HookUsageAnalysis> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const imports = this.analyzeImports(lines);
    const hookPatterns = this.analyzeHookUsage(lines, filePath);
    
    const analysis: HookUsageAnalysis = {
      filePath,
      totalHookUsages: hookPatterns.length,
      hookPatterns,
      imports,
      complexity: this.assessComplexity(hookPatterns),
      migrationRecommendation: this.generateRecommendation(hookPatterns, imports)
    };

    return analysis;
  }

  /**
   * Analisa múltiplos arquivos em um diretório
   */
  async analyzeDirectory(dirPath: string): Promise<HookUsageAnalysis[]> {
    const results: HookUsageAnalysis[] = [];
    
    const files = await this.findRelevantFiles(dirPath);
    
    for (const file of files) {
      try {
        const analysis = await this.analyzeFile(file);
        if (analysis.totalHookUsages > 0) {
          results.push(analysis);
        }
      } catch (error) {
        console.warn(`Erro ao analisar arquivo ${file}:`, error);
      }
    }

    return results;
  }

  /**
   * Encontra arquivos relevantes para análise
   */
  private async findRelevantFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const traverse = async (currentPath: string) => {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Pular diretórios excluídos
          if (!this.shouldExcludePath(fullPath)) {
            await traverse(fullPath);
          }
        } else if (entry.isFile()) {
          // Incluir apenas arquivos relevantes
          if (this.shouldIncludeFile(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    };

    await traverse(dirPath);
    return files;
  }

  /**
   * Verifica se um arquivo deve ser incluído na análise
   */
  private shouldIncludeFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    if (!validExtensions.includes(ext)) {
      return false;
    }

    // Verificar padrões de inclusão
    if (this.config.includePatterns.length > 0) {
      return this.config.includePatterns.some(pattern => 
        this.matchesPattern(filePath, pattern)
      );
    }

    return true;
  }

  /**
   * Verifica se um caminho deve ser excluído
   */
  private shouldExcludePath(filePath: string): boolean {
    return this.config.excludePatterns.some(pattern => 
      this.matchesPattern(filePath, pattern)
    );
  }

  /**
   * Verifica se um caminho corresponde a um padrão
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Implementação simples de matching de padrões
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(filePath);
  }

  /**
   * Analisa imports de hooks realtime
   */
  private analyzeImports(lines: string[]): ImportAnalysis[] {
    const imports: ImportAnalysis[] = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Detectar imports de hooks
      if (trimmedLine.startsWith('import') && this.containsRealtimeHook(trimmedLine)) {
        const hookNames = this.extractHookNames(trimmedLine);
        const importPath = this.extractImportPath(trimmedLine);
        
        hookNames.forEach(hookName => {
          imports.push({
            hookName,
            importPath,
            isDefault: this.isDefaultImport(trimmedLine, hookName),
            isNamed: this.isNamedImport(trimmedLine, hookName),
            lineNumber: index + 1
          });
        });
      }
    });

    return imports;
  }

  /**
   * Analisa uso de hooks no código
   */
  private analyzeHookUsage(lines: string[], filePath: string): HookUsagePattern[] {
    const patterns: HookUsagePattern[] = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Detectar uso de hooks realtime
      this.LEGACY_HOOKS.forEach(hookName => {
        if (trimmedLine.includes(hookName) && trimmedLine.includes('=')) {
          const pattern: HookUsagePattern = {
            hookName,
            filePath,
            lineNumber: index + 1,
            columnNumber: line.indexOf(hookName),
            importStatement: this.findImportForHook(lines, hookName),
            usageContext: this.extractUsageContext(lines, index),
            configObject: this.extractConfigObject(lines, index),
            dependencies: this.extractDependencies(lines, index)
          };
          
          patterns.push(pattern);
        }
      });
    });

    return patterns;
  }

  /**
   * Verifica se uma linha contém import de hook realtime
   */
  private containsRealtimeHook(line: string): boolean {
    return this.LEGACY_HOOKS.some(hook => line.includes(hook));
  }

  /**
   * Extrai nomes de hooks de uma linha de import
   */
  private extractHookNames(importLine: string): string[] {
    const hooks: string[] = [];
    
    this.LEGACY_HOOKS.forEach(hook => {
      if (importLine.includes(hook)) {
        hooks.push(hook);
      }
    });

    return hooks;
  }

  /**
   * Extrai o caminho do import
   */
  private extractImportPath(importLine: string): string {
    const match = importLine.match(/from\s+['"`]([^'"`]+)['"`]/);
    return match ? match[1] : '';
  }

  /**
   * Verifica se é um import default
   */
  private isDefaultImport(importLine: string, hookName: string): boolean {
    const beforeFrom = importLine.split('from')[0];
    return beforeFrom.includes(hookName) && !beforeFrom.includes('{');
  }

  /**
   * Verifica se é um import nomeado
   */
  private isNamedImport(importLine: string, hookName: string): boolean {
    const beforeFrom = importLine.split('from')[0];
    return beforeFrom.includes('{') && beforeFrom.includes(hookName);
  }

  /**
   * Encontra o import correspondente a um hook
   */
  private findImportForHook(lines: string[], hookName: string): string {
    for (const line of lines) {
      if (line.includes('import') && line.includes(hookName)) {
        return line.trim();
      }
    }
    return '';
  }

  /**
   * Extrai contexto de uso do hook
   */
  private extractUsageContext(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - 2);
    const end = Math.min(lines.length, lineIndex + 3);
    
    return lines.slice(start, end).join('\n');
  }

  /**
   * Extrai objeto de configuração do hook
   */
  private extractConfigObject(lines: string[], lineIndex: number): Record<string, any> | undefined {
    const line = lines[lineIndex];
    
    // Procurar por objeto de configuração na mesma linha ou linhas seguintes
    const configMatch = line.match(/\{[^}]*\}/);
    if (configMatch) {
      try {
        // Tentar parsear como JSON (simplificado)
        return this.parseConfigObject(configMatch[0]);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Parse simplificado de objeto de configuração
   */
  private parseConfigObject(configStr: string): Record<string, any> {
    // Implementação simplificada - em produção seria mais robusta
    const config: Record<string, any> = {};
    
    // Extrair propriedades simples
    const props = configStr.match(/(\w+):\s*([^,}]+)/g);
    if (props) {
      props.forEach(prop => {
        const [key, value] = prop.split(':').map(s => s.trim());
        config[key] = value;
      });
    }

    return config;
  }

  /**
   * Extrai dependências do hook
   */
  private extractDependencies(lines: string[], lineIndex: number): string[] {
    const dependencies: string[] = [];
    const line = lines[lineIndex];
    
    // Procurar por array de dependências
    const depsMatch = line.match(/\[([^\]]*)\]/);
    if (depsMatch) {
      const depsStr = depsMatch[1];
      dependencies.push(...depsStr.split(',').map(dep => dep.trim()));
    }

    return dependencies;
  }

  /**
   * Avalia a complexidade da migração
   */
  private assessComplexity(patterns: HookUsagePattern[]): 'simple' | 'moderate' | 'complex' {
    if (patterns.length === 0) return 'simple';
    if (patterns.length === 1 && !patterns[0].configObject) return 'simple';
    if (patterns.length <= 3) return 'moderate';
    return 'complex';
  }

  /**
   * Gera recomendação de migração
   */
  private generateRecommendation(
    patterns: HookUsagePattern[], 
    imports: ImportAnalysis[]
  ): MigrationRecommendation {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Analisar complexidade
    const hasComplexConfig = patterns.some(p => p.configObject && Object.keys(p.configObject).length > 3);
    const hasMultipleHooks = new Set(patterns.map(p => p.hookName)).size > 1;
    
    if (hasComplexConfig) {
      warnings.push('Configuração complexa detectada - revisão manual recomendada');
    }
    
    if (hasMultipleHooks) {
      warnings.push('Múltiplos tipos de hooks detectados - migração pode requerer consolidação');
      suggestions.push('Considere consolidar múltiplos hooks em uma única instância do useRealtimeUnified');
    }

    // Determinar estratégia
    let strategy: 'direct' | 'wrapper' | 'manual' = 'direct';
    let confidence: 'high' | 'medium' | 'low' = 'high';
    let effort: 'low' | 'medium' | 'high' = 'low';

    if (hasComplexConfig || hasMultipleHooks) {
      strategy = 'manual';
      confidence = 'medium';
      effort = 'medium';
    }

    if (patterns.length > 5) {
      effort = 'high';
      confidence = 'low';
    }

    return {
      strategy,
      confidence,
      estimatedEffort: effort,
      warnings,
      suggestions,
      requiredChanges: [] // Será preenchido pelo migration planner
    };
  }
}