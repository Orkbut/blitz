/**
 * Executor de migração que aplica as mudanças planejadas aos arquivos
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  MigrationPlan, 
  MigrationResult, 
  AppliedChange, 
  MigrationError,
  RequiredChange 
} from './types';

export class MigrationExecutor {
  
  /**
   * Executa um plano de migração
   */
  async executeMigrationPlan(plan: MigrationPlan): Promise<MigrationResult> {
    const result: MigrationResult = {
      filePath: plan.filePath,
      success: false,
      changes: [],
      errors: [],
      warnings: []
    };

    try {
      // Criar backup se necessário
      if (plan.backupRequired) {
        result.backupPath = await this.createBackup(plan.filePath);
      }

      // Ler conteúdo do arquivo
      const originalContent = await fs.promises.readFile(plan.filePath, 'utf-8');
      let modifiedContent = originalContent;

      // Aplicar mudanças em ordem reversa (para manter números de linha)
      const sortedChanges = [...plan.changes].sort((a, b) => 
        (b.lineNumber || 0) - (a.lineNumber || 0)
      );

      for (const change of sortedChanges) {
        try {
          const appliedChange = await this.applyChange(modifiedContent, change);
          if (appliedChange) {
            result.changes.push(appliedChange);
            modifiedContent = appliedChange.newContent;
          }
        } catch (error) {
          result.errors.push({
            type: 'semantic',
            message: `Erro ao aplicar mudança: ${error}`,
            lineNumber: change.lineNumber
          });
        }
      }

      // Validar sintaxe do resultado
      const syntaxValidation = await this.validateSyntax(modifiedContent, plan.filePath);
      if (!syntaxValidation.isValid) {
        result.errors.push(...syntaxValidation.errors);
        result.warnings.push('Arquivo modificado contém erros de sintaxe');
      } else {
        // Escrever arquivo modificado
        await fs.promises.writeFile(plan.filePath, modifiedContent, 'utf-8');
        result.success = true;
      }

    } catch (error) {
      result.errors.push({
        type: 'semantic',
        message: `Erro geral na migração: ${error}`
      });
    }

    return result;
  }

  /**
   * Aplica uma mudança específica ao conteúdo
   */
  private async applyChange(content: string, change: RequiredChange): Promise<AppliedChange | null> {
    const lines = content.split('\n');
    
    switch (change.type) {
      case 'import':
        return this.applyImportChange(lines, change);
      
      case 'config':
        return this.applyConfigChange(lines, change);
      
      case 'callback':
        return this.applyCallbackChange(lines, change);
      
      case 'return_value':
        return this.applyReturnValueChange(lines, change);
      
      default:
        return null;
    }
  }

  /**
   * Aplica mudança de import
   */
  private applyImportChange(lines: string[], change: RequiredChange): AppliedChange {
    const lineIndex = (change.lineNumber || 1) - 1;
    const oldLine = lines[lineIndex];
    
    // Substituir linha de import
    lines[lineIndex] = change.newCode;
    
    return {
      type: 'import',
      description: change.description,
      lineNumber: change.lineNumber || 1,
      oldContent: oldLine,
      newContent: lines.join('\n')
    };
  }

  /**
   * Aplica mudança de configuração
   */
  private applyConfigChange(lines: string[], change: RequiredChange): AppliedChange {
    const lineIndex = (change.lineNumber || 1) - 1;
    const oldLine = lines[lineIndex];
    
    // Encontrar e substituir a chamada do hook
    const newLine = this.replaceHookCall(oldLine, change.oldCode, change.newCode);
    lines[lineIndex] = newLine;
    
    return {
      type: 'config',
      description: change.description,
      lineNumber: change.lineNumber || 1,
      oldContent: oldLine,
      newContent: lines.join('\n')
    };
  }

  /**
   * Aplica mudança de callback
   */
  private applyCallbackChange(lines: string[], change: RequiredChange): AppliedChange {
    const lineIndex = (change.lineNumber || 1) - 1;
    const oldLine = lines[lineIndex];
    
    // Substituir callback na configuração
    const newLine = oldLine.replace(change.oldCode, change.newCode);
    lines[lineIndex] = newLine;
    
    return {
      type: 'callback',
      description: change.description,
      lineNumber: change.lineNumber || 1,
      oldContent: oldLine,
      newContent: lines.join('\n')
    };
  }

  /**
   * Aplica mudança de valor de retorno
   */
  private applyReturnValueChange(lines: string[], change: RequiredChange): AppliedChange {
    const lineIndex = (change.lineNumber || 1) - 1;
    const oldLine = lines[lineIndex];
    
    // Substituir destructuring ou acesso a propriedades
    const newLine = oldLine.replace(change.oldCode, change.newCode);
    lines[lineIndex] = newLine;
    
    return {
      type: 'return_value',
      description: change.description,
      lineNumber: change.lineNumber || 1,
      oldContent: oldLine,
      newContent: lines.join('\n')
    };
  }

  /**
   * Substitui chamada de hook na linha
   */
  private replaceHookCall(line: string, oldCall: string, newCall: string): string {
    // Implementação simplificada - em produção seria mais robusta
    return line.replace(oldCall, newCall);
  }

  /**
   * Cria backup do arquivo
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    
    await fs.promises.copyFile(filePath, backupPath);
    return backupPath;
  }

  /**
   * Valida sintaxe do código modificado
   */
  private async validateSyntax(content: string, filePath: string): Promise<{
    isValid: boolean;
    errors: MigrationError[];
  }> {
    const errors: MigrationError[] = [];
    
    try {
      // Validação básica de sintaxe TypeScript/JavaScript
      const ext = path.extname(filePath);
      
      if (ext === '.ts' || ext === '.tsx') {
        // Validar TypeScript (simplificado)
        const hasBasicSyntaxErrors = this.checkBasicTypeScriptSyntax(content);
        if (hasBasicSyntaxErrors.length > 0) {
          errors.push(...hasBasicSyntaxErrors);
        }
      }
      
      // Validar parênteses e chaves balanceadas
      const balanceErrors = this.checkBalancedBrackets(content);
      if (balanceErrors.length > 0) {
        errors.push(...balanceErrors);
      }
      
    } catch (error) {
      errors.push({
        type: 'compilation',
        message: `Erro de validação: ${error}`,
        filePath,
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifica sintaxe básica do TypeScript
   */
  private checkBasicTypeScriptSyntax(content: string): MigrationError[] {
    const errors: MigrationError[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Verificar imports malformados
      if (line.trim().startsWith('import') && !line.includes('from')) {
        errors.push({
          type: 'syntax',
          message: 'Import statement malformado',
          lineNumber: index + 1,
          severity: 'error'
        });
      }
      
      // Verificar ponto e vírgula em statements
      const trimmed = line.trim();
      if (trimmed.length > 0 && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith('{') && 
          !trimmed.endsWith('}') &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('/*') &&
          !trimmed.includes('=')) {
        // Possível statement sem ponto e vírgula
        errors.push({
          type: 'syntax',
          message: 'Possível statement sem ponto e vírgula',
          lineNumber: index + 1,
          severity: 'warning'
        });
      }
    });

    return errors;
  }

  /**
   * Verifica se parênteses e chaves estão balanceados
   */
  private checkBalancedBrackets(content: string): MigrationError[] {
    const errors: MigrationError[] = [];
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char in brackets) {
          stack.push(char);
        } else if (Object.values(brackets).includes(char)) {
          const last = stack.pop();
          if (!last || brackets[last as keyof typeof brackets] !== char) {
            errors.push({
              type: 'syntax',
              message: `Parênteses/chaves desbalanceados: ${char}`,
              lineNumber: lineIndex + 1,
              severity: 'error'
            });
          }
        }
      }
    });
    
    if (stack.length > 0) {
      errors.push({
        type: 'syntax',
        message: `Parênteses/chaves não fechados: ${stack.join(', ')}`,
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Executa múltiplos planos de migração
   */
  async executeMigrationPlans(plans: MigrationPlan[]): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    for (const plan of plans) {
      try {
        const result = await this.executeMigrationPlan(plan);
        results.push(result);
      } catch (error) {
        results.push({
          filePath: plan.filePath,
          success: false,
          changes: [],
          errors: [{
            type: 'semantic',
            message: `Erro ao executar plano: ${error}`
          }],
          warnings: []
        });
      }
    }

    return results;
  }
}