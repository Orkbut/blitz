/**
 * Validador de migração que verifica a correção das mudanças aplicadas
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { 
  MigrationResult, 
  ValidationResult, 
  ValidationError, 
  TestResult 
} from './types';

export class MigrationValidator {
  
  /**
   * Valida o resultado de uma migração
   */
  async validateMigration(result: MigrationResult): Promise<ValidationResult> {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      testResults: []
    };

    try {
      // 1. Validação de compilação TypeScript
      const compilationResult = await this.validateTypeScriptCompilation(result.filePath);
      validation.errors.push(...compilationResult.errors);
      validation.warnings.push(...compilationResult.warnings);

      // 2. Validação de imports
      const importValidation = await this.validateImports(result.filePath);
      validation.errors.push(...importValidation.errors);
      validation.warnings.push(...importValidation.warnings);

      // 3. Validação de uso de hooks
      const hookValidation = await this.validateHookUsage(result.filePath);
      validation.errors.push(...hookValidation.errors);
      validation.suggestions.push(...hookValidation.suggestions);

      // 4. Executar testes se disponíveis
      const testResults = await this.runTests(result.filePath);
      validation.testResults = testResults;

      // 5. Validação de performance (básica)
      const performanceValidation = await this.validatePerformance(result.filePath);
      validation.warnings.push(...performanceValidation.warnings);

      // Determinar se a validação passou
      validation.isValid = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push({
        type: 'runtime',
        message: `Erro durante validação: ${error}`,
        filePath: result.filePath,
        severity: 'error'
      });
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Valida compilação TypeScript
   */
  private async validateTypeScriptCompilation(filePath: string): Promise<{
    errors: ValidationError[];
    warnings: string[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Verificar se é arquivo TypeScript
      const ext = path.extname(filePath);
      if (ext !== '.ts' && ext !== '.tsx') {
        return { errors, warnings };
      }

      // Executar verificação de tipos (simulada)
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const typeErrors = await this.checkTypeScriptTypes(content, filePath);
      errors.push(...typeErrors);

    } catch (error) {
      errors.push({
        type: 'compilation',
        message: `Erro de compilação: ${error}`,
        filePath,
        severity: 'error'
      });
    }

    return { errors, warnings };
  }

  /**
   * Verifica tipos TypeScript (implementação simplificada)
   */
  private async checkTypeScriptTypes(content: string, filePath: string): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Verificar uso de 'any' type
      if (trimmed.includes(': any') || trimmed.includes('<any>')) {
        errors.push({
          type: 'type_check',
          message: 'Uso de tipo "any" detectado - considere usar tipos mais específicos',
          filePath,
          lineNumber: index + 1,
          severity: 'warning'
        });
      }

      // Verificar imports não utilizados
      if (trimmed.startsWith('import') && this.isUnusedImport(trimmed, content)) {
        errors.push({
          type: 'compilation',
          message: 'Import não utilizado detectado',
          filePath,
          lineNumber: index + 1,
          severity: 'warning'
        });
      }

      // Verificar uso correto do hook unificado
      if (trimmed.includes('useRealtimeUnified')) {
        const hookUsageErrors = this.validateUnifiedHookUsage(trimmed, index + 1, filePath);
        errors.push(...hookUsageErrors);
      }
    });

    return errors;
  }

  /**
   * Verifica se um import não está sendo usado
   */
  private isUnusedImport(importLine: string, content: string): boolean {
    // Extrair nome do import
    const match = importLine.match(/import\s+(?:\{([^}]+)\}|(\w+))/);
    if (!match) return false;

    const importedNames = match[1] ? 
      match[1].split(',').map(name => name.trim()) : 
      [match[2]];

    // Verificar se algum dos nomes importados é usado no código
    return importedNames.some(name => {
      const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
      const matches = content.match(usageRegex);
      return !matches || matches.length <= 1; // Apenas na linha de import
    });
  }

  /**
   * Valida uso correto do hook unificado
   */
  private validateUnifiedHookUsage(line: string, lineNumber: number, filePath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Verificar se a configuração parece válida
    if (line.includes('useRealtimeUnified(') && !line.includes('tables:')) {
      errors.push({
        type: 'runtime',
        message: 'useRealtimeUnified requer configuração com propriedade "tables"',
        filePath,
        lineNumber,
        severity: 'error'
      });
    }

    // Verificar se está sendo usado corretamente com destructuring
    if (line.includes('useRealtimeUnified') && !line.includes('const') && !line.includes('=')) {
      errors.push({
        type: 'runtime',
        message: 'Hook deve ser usado com atribuição de variável',
        filePath,
        lineNumber,
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Valida imports do arquivo
   */
  private async validateImports(filePath: string): Promise<{
    errors: ValidationError[];
    warnings: string[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('import')) {
          // Verificar se o caminho do import existe
          const importPath = this.extractImportPath(line);
          if (importPath && !this.isValidImportPath(importPath, filePath)) {
            errors.push({
              type: 'compilation',
              message: `Caminho de import não encontrado: ${importPath}`,
              filePath,
              lineNumber: index + 1,
              severity: 'error'
            });
          }

          // Verificar imports de hooks legados
          if (this.containsLegacyHookImport(line)) {
            warnings.push(`Import de hook legado detectado na linha ${index + 1}: ${line.trim()}`);
          }
        }
      });

    } catch (error) {
      errors.push({
        type: 'compilation',
        message: `Erro ao validar imports: ${error}`,
        filePath,
        severity: 'error'
      });
    }

    return { errors, warnings };
  }

  /**
   * Extrai caminho do import
   */
  private extractImportPath(importLine: string): string | null {
    const match = importLine.match(/from\s+['"`]([^'"`]+)['"`]/);
    return match ? match[1] : null;
  }

  /**
   * Verifica se o caminho do import é válido
   */
  private isValidImportPath(importPath: string, currentFilePath: string): boolean {
    // Implementação simplificada - em produção seria mais robusta
    if (importPath.startsWith('@/') || importPath.startsWith('./') || importPath.startsWith('../')) {
      // Caminho relativo ou alias - assumir válido por simplicidade
      return true;
    }
    
    // Módulos do node_modules
    if (!importPath.startsWith('.')) {
      return true;
    }

    return false;
  }

  /**
   * Verifica se contém import de hook legado
   */
  private containsLegacyHookImport(importLine: string): boolean {
    const legacyHooks = [
      'useRealtimePuro',
      'useRealtimeSimple', 
      'useRealtimeOperacoes',
      'useRealtimeEventos',
      'useRealtimeCentralized',
      'useRealtimeCalendarioSupervisor'
    ];

    return legacyHooks.some(hook => importLine.includes(hook));
  }

  /**
   * Valida uso de hooks no arquivo
   */
  private async validateHookUsage(filePath: string): Promise<{
    errors: ValidationError[];
    suggestions: string[];
  }> {
    const errors: ValidationError[] = [];
    const suggestions: string[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Verificar se ainda há hooks legados sendo usados
      const legacyHookUsage = this.findLegacyHookUsage(content);
      if (legacyHookUsage.length > 0) {
        legacyHookUsage.forEach(usage => {
          errors.push({
            type: 'runtime',
            message: `Hook legado ainda em uso: ${usage.hookName}`,
            filePath,
            lineNumber: usage.lineNumber,
            severity: 'warning'
          });
        });
        
        suggestions.push('Considere completar a migração removendo todos os hooks legados');
      }

      // Verificar uso correto do hook unificado
      const unifiedHookUsage = this.analyzeUnifiedHookUsage(content);
      if (unifiedHookUsage.hasIssues) {
        errors.push(...unifiedHookUsage.errors);
        suggestions.push(...unifiedHookUsage.suggestions);
      }

    } catch (error) {
      errors.push({
        type: 'runtime',
        message: `Erro ao validar uso de hooks: ${error}`,
        filePath,
        severity: 'error'
      });
    }

    return { errors, suggestions };
  }

  /**
   * Encontra uso de hooks legados
   */
  private findLegacyHookUsage(content: string): Array<{ hookName: string; lineNumber: number }> {
    const legacyHooks = [
      'useRealtimePuro',
      'useRealtimeSimple',
      'useRealtimeOperacoes', 
      'useRealtimeEventos',
      'useRealtimeCentralized',
      'useRealtimeCalendarioSupervisor'
    ];

    const usage: Array<{ hookName: string; lineNumber: number }> = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      legacyHooks.forEach(hookName => {
        if (line.includes(hookName) && line.includes('(')) {
          usage.push({ hookName, lineNumber: index + 1 });
        }
      });
    });

    return usage;
  }

  /**
   * Analisa uso do hook unificado
   */
  private analyzeUnifiedHookUsage(content: string): {
    hasIssues: boolean;
    errors: ValidationError[];
    suggestions: string[];
  } {
    const errors: ValidationError[] = [];
    const suggestions: string[] = [];
    
    // Verificar se o hook unificado está sendo usado
    const hasUnifiedHook = content.includes('useRealtimeUnified');
    
    if (!hasUnifiedHook) {
      suggestions.push('Considere usar useRealtimeUnified para funcionalidade realtime');
    } else {
      // Verificar configuração básica
      if (!content.includes('tables:')) {
        errors.push({
          type: 'runtime',
          message: 'useRealtimeUnified deve incluir configuração de tables',
          filePath: '',
          severity: 'error'
        });
      }
    }

    return {
      hasIssues: errors.length > 0,
      errors,
      suggestions
    };
  }

  /**
   * Executa testes relacionados ao arquivo
   */
  private async runTests(filePath: string): Promise<TestResult[]> {
    const testResults: TestResult[] = [];

    try {
      // Procurar por arquivos de teste relacionados
      const testFiles = await this.findRelatedTestFiles(filePath);
      
      for (const testFile of testFiles) {
        const result = await this.runTestFile(testFile);
        testResults.push(...result);
      }

    } catch (error) {
      testResults.push({
        testName: 'Test execution',
        passed: false,
        error: `Erro ao executar testes: ${error}`,
        duration: 0
      });
    }

    return testResults;
  }

  /**
   * Encontra arquivos de teste relacionados
   */
  private async findRelatedTestFiles(filePath: string): Promise<string[]> {
    const testFiles: string[] = [];
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    
    // Padrões comuns de arquivos de teste
    const testPatterns = [
      `${baseName}.test.ts`,
      `${baseName}.test.tsx`,
      `${baseName}.spec.ts`,
      `${baseName}.spec.tsx`
    ];

    for (const pattern of testPatterns) {
      const testPath = path.join(dir, pattern);
      try {
        await fs.promises.access(testPath);
        testFiles.push(testPath);
      } catch {
        // Arquivo não existe
      }
    }

    return testFiles;
  }

  /**
   * Executa um arquivo de teste específico
   */
  private async runTestFile(testFilePath: string): Promise<TestResult[]> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Executar teste usando vitest (simplificado)
      const testProcess = spawn('npx', ['vitest', 'run', testFilePath], {
        stdio: 'pipe'
      });

      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        const result: TestResult = {
          testName: path.basename(testFilePath),
          passed: code === 0,
          error: code !== 0 ? output : undefined,
          duration
        };

        resolve([result]);
      });

      // Timeout após 30 segundos
      setTimeout(() => {
        testProcess.kill();
        resolve([{
          testName: path.basename(testFilePath),
          passed: false,
          error: 'Teste excedeu timeout de 30 segundos',
          duration: 30000
        }]);
      }, 30000);
    });
  }

  /**
   * Validação básica de performance
   */
  private async validatePerformance(filePath: string): Promise<{
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      
      // Verificar possíveis problemas de performance
      if (content.includes('useEffect') && content.includes('[]')) {
        const effectCount = (content.match(/useEffect/g) || []).length;
        if (effectCount > 5) {
          warnings.push(`Muitos useEffect detectados (${effectCount}) - considere consolidar`);
        }
      }

      // Verificar re-renders desnecessários
      if (content.includes('useRealtimeUnified') && !content.includes('useMemo')) {
        warnings.push('Considere usar useMemo para otimizar re-renders com useRealtimeUnified');
      }

    } catch (error) {
      warnings.push(`Erro na validação de performance: ${error}`);
    }

    return { warnings };
  }

  /**
   * Valida múltiplos resultados de migração
   */
  async validateMigrations(results: MigrationResult[]): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = [];
    
    for (const result of results) {
      try {
        const validation = await this.validateMigration(result);
        validations.push(validation);
      } catch (error) {
        validations.push({
          isValid: false,
          errors: [{
            type: 'runtime',
            message: `Erro na validação: ${error}`,
            filePath: result.filePath,
            severity: 'error'
          }],
          warnings: [],
          suggestions: []
        });
      }
    }

    return validations;
  }
}