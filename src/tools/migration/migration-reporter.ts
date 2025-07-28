/**
 * Gerador de relatórios para as ferramentas de migração
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  HookUsageAnalysis, 
  MigrationPlan, 
  MigrationResult, 
  ValidationResult 
} from './types';

export class MigrationReporter {
  
  /**
   * Gera relatório de análise de código
   */
  async generateAnalysisReport(
    analyses: HookUsageAnalysis[], 
    plans: MigrationPlan[]
  ): Promise<void> {
    const report = this.createAnalysisReport(analyses, plans);
    await this.writeReport('migration-analysis.html', report);
  }

  /**
   * Gera relatório de migração
   */
  async generateMigrationReport(
    results: MigrationResult[], 
    validations: ValidationResult[]
  ): Promise<void> {
    const report = this.createMigrationReport(results, validations);
    await this.writeReport('migration-report.html', report);
  }

  /**
   * Gera relatório de validação
   */
  async generateValidationReport(validations: ValidationResult[]): Promise<void> {
    const report = this.createValidationReport(validations);
    await this.writeReport('validation-report.html', report);
  }

  /**
   * Gera relatório em formato JSON
   */
  async generateJSONReport(data: any, filename: string): Promise<void> {
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(filename, jsonContent, 'utf-8');
  }

  /**
   * Gera relatório em formato Markdown
   */
  async generateMarkdownReport(
    analyses: HookUsageAnalysis[], 
    results: MigrationResult[]
  ): Promise<void> {
    const markdown = this.createMarkdownReport(analyses, results);
    await this.writeReport('migration-report.md', markdown);
  }

  /**
   * Cria relatório HTML de análise
   */
  private createAnalysisReport(
    analyses: HookUsageAnalysis[], 
    plans: MigrationPlan[]
  ): string {
    const totalFiles = analyses.length;
    const totalHooks = analyses.reduce((sum, a) => sum + a.totalHookUsages, 0);
    const complexFiles = analyses.filter(a => a.complexity === 'complex').length;
    const totalChanges = plans.reduce((sum, p) => sum + p.changes.length, 0);

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Análise - Migração de Hooks Realtime</title>
    <style>
        ${this.getCommonStyles()}
        .analysis-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .metric-card { background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #007bff; }
        .complexity-badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        .complexity-simple { background: #d4edda; color: #155724; }
        .complexity-moderate { background: #fff3cd; color: #856404; }
        .complexity-complex { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Relatório de Análise - Migração de Hooks Realtime</h1>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </header>

        <section class="analysis-summary">
            <div class="metric-card">
                <div class="metric-value">${totalFiles}</div>
                <div>Arquivos Analisados</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${totalHooks}</div>
                <div>Hooks Encontrados</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${complexFiles}</div>
                <div>Arquivos Complexos</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${totalChanges}</div>
                <div>Mudanças Planejadas</div>
            </div>
        </section>

        <section>
            <h2>📋 Detalhes por Arquivo</h2>
            ${analyses.map(analysis => this.createAnalysisFileSection(analysis, plans.find(p => p.filePath === analysis.filePath))).join('')}
        </section>

        <section>
            <h2>📈 Estatísticas de Hooks</h2>
            ${this.createHookStatistics(analyses)}
        </section>

        <section>
            <h2>🎯 Recomendações</h2>
            ${this.createRecommendations(analyses)}
        </section>
    </div>
</body>
</html>`;
  }

  /**
   * Cria seção de arquivo na análise
   */
  private createAnalysisFileSection(analysis: HookUsageAnalysis, plan?: MigrationPlan): string {
    const complexityClass = `complexity-${analysis.complexity}`;
    
    return `
    <div class="file-section">
        <h3>📄 ${path.basename(analysis.filePath)}</h3>
        <div class="file-info">
            <span class="complexity-badge ${complexityClass}">${analysis.complexity.toUpperCase()}</span>
            <span>${analysis.totalHookUsages} hooks encontrados</span>
            <span>${plan ? plan.changes.length : 0} mudanças planejadas</span>
        </div>
        
        <div class="hooks-list">
            <h4>Hooks Encontrados:</h4>
            <ul>
                ${analysis.hookPatterns.map(pattern => `
                    <li>
                        <strong>${pattern.hookName}</strong> (linha ${pattern.lineNumber})
                        ${pattern.configObject ? '<br><small>Com configuração personalizada</small>' : ''}
                    </li>
                `).join('')}
            </ul>
        </div>

        <div class="recommendations">
            <h4>Recomendações:</h4>
            <ul>
                <li><strong>Estratégia:</strong> ${analysis.migrationRecommendation.strategy}</li>
                <li><strong>Confiança:</strong> ${analysis.migrationRecommendation.confidence}</li>
                <li><strong>Esforço:</strong> ${analysis.migrationRecommendation.estimatedEffort}</li>
            </ul>
            ${analysis.migrationRecommendation.warnings.length > 0 ? `
                <div class="warnings">
                    <strong>⚠️ Avisos:</strong>
                    <ul>
                        ${analysis.migrationRecommendation.warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    </div>`;
  }

  /**
   * Cria estatísticas de hooks
   */
  private createHookStatistics(analyses: HookUsageAnalysis[]): string {
    const hookCounts: Record<string, number> = {};
    
    analyses.forEach(analysis => {
      analysis.hookPatterns.forEach(pattern => {
        hookCounts[pattern.hookName] = (hookCounts[pattern.hookName] || 0) + 1;
      });
    });

    const sortedHooks = Object.entries(hookCounts).sort((a, b) => b[1] - a[1]);

    return `
    <div class="statistics">
        <table>
            <thead>
                <tr>
                    <th>Hook</th>
                    <th>Ocorrências</th>
                    <th>Percentual</th>
                </tr>
            </thead>
            <tbody>
                ${sortedHooks.map(([hook, count]) => {
                  const total = Object.values(hookCounts).reduce((sum, c) => sum + c, 0);
                  const percentage = ((count / total) * 100).toFixed(1);
                  return `
                    <tr>
                        <td><code>${hook}</code></td>
                        <td>${count}</td>
                        <td>${percentage}%</td>
                    </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
    </div>`;
  }

  /**
   * Cria seção de recomendações
   */
  private createRecommendations(analyses: HookUsageAnalysis[]): string {
    const recommendations = new Set<string>();
    
    analyses.forEach(analysis => {
      analysis.migrationRecommendation.suggestions.forEach(suggestion => {
        recommendations.add(suggestion);
      });
    });

    return `
    <div class="recommendations-list">
        <ul>
            ${Array.from(recommendations).map(rec => `<li>${rec}</li>`).join('')}
            <li>Teste cada arquivo migrado individualmente antes de prosseguir</li>
            <li>Mantenha backups dos arquivos originais durante a migração</li>
            <li>Execute testes automatizados após cada migração</li>
        </ul>
    </div>`;
  }

  /**
   * Cria relatório HTML de migração
   */
  private createMigrationReport(
    results: MigrationResult[], 
    validations: ValidationResult[]
  ): string {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Migração - Hooks Realtime</title>
    <style>
        ${this.getCommonStyles()}
        .migration-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .status-success { color: #28a745; }
        .status-error { color: #dc3545; }
        .status-warning { color: #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🚀 Relatório de Migração - Hooks Realtime</h1>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </header>

        <section class="migration-summary">
            <div class="metric-card">
                <div class="metric-value status-success">${successful}</div>
                <div>Sucessos</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-error">${failed}</div>
                <div>Falhas</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${totalChanges}</div>
                <div>Mudanças Aplicadas</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${validations.length}</div>
                <div>Arquivos Validados</div>
            </div>
        </section>

        <section>
            <h2>📋 Resultados por Arquivo</h2>
            ${results.map((result, index) => this.createMigrationResultSection(result, validations[index])).join('')}
        </section>

        ${this.createValidationSummary(validations)}
    </div>
</body>
</html>`;
  }

  /**
   * Cria seção de resultado de migração
   */
  private createMigrationResultSection(result: MigrationResult, validation?: ValidationResult): string {
    const statusClass = result.success ? 'status-success' : 'status-error';
    const statusIcon = result.success ? '✅' : '❌';

    return `
    <div class="file-section">
        <h3>${statusIcon} ${path.basename(result.filePath)}</h3>
        <div class="file-info">
            <span class="${statusClass}">
                ${result.success ? 'Migração bem-sucedida' : 'Migração falhou'}
            </span>
            <span>${result.changes.length} mudanças aplicadas</span>
            ${result.backupPath ? `<span>Backup: ${path.basename(result.backupPath)}</span>` : ''}
        </div>

        ${result.changes.length > 0 ? `
            <div class="changes-list">
                <h4>Mudanças Aplicadas:</h4>
                <ul>
                    ${result.changes.map(change => `
                        <li>
                            <strong>${change.type}:</strong> ${change.description}
                            <small>(linha ${change.lineNumber})</small>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        ${result.errors.length > 0 ? `
            <div class="errors-list">
                <h4>❌ Erros:</h4>
                <ul>
                    ${result.errors.map(error => `
                        <li class="status-error">
                            <strong>${error.type}:</strong> ${error.message}
                            ${error.lineNumber ? `<small>(linha ${error.lineNumber})</small>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        ${result.warnings.length > 0 ? `
            <div class="warnings-list">
                <h4>⚠️ Avisos:</h4>
                <ul>
                    ${result.warnings.map(warning => `<li class="status-warning">${warning}</li>`).join('')}
                </ul>
            </div>
        ` : ''}

        ${validation ? this.createValidationSection(validation) : ''}
    </div>`;
  }

  /**
   * Cria seção de validação
   */
  private createValidationSection(validation: ValidationResult): string {
    const statusClass = validation.isValid ? 'status-success' : 'status-error';
    const statusIcon = validation.isValid ? '✅' : '❌';

    return `
    <div class="validation-section">
        <h4>${statusIcon} Validação</h4>
        <div class="${statusClass}">
            ${validation.isValid ? 'Validação passou' : 'Validação falhou'}
        </div>

        ${validation.errors.length > 0 ? `
            <div class="validation-errors">
                <strong>Erros de Validação:</strong>
                <ul>
                    ${validation.errors.map(error => `
                        <li class="status-error">
                            <strong>${error.type}:</strong> ${error.message}
                            ${error.lineNumber ? `<small>(linha ${error.lineNumber})</small>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}

        ${validation.testResults && validation.testResults.length > 0 ? `
            <div class="test-results">
                <strong>Resultados dos Testes:</strong>
                <ul>
                    ${validation.testResults.map(test => `
                        <li class="${test.passed ? 'status-success' : 'status-error'}">
                            ${test.testName}: ${test.passed ? 'PASSOU' : 'FALHOU'}
                            <small>(${test.duration}ms)</small>
                            ${test.error ? `<br><small>${test.error}</small>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : ''}
    </div>`;
  }

  /**
   * Cria resumo de validação
   */
  private createValidationSummary(validations: ValidationResult[]): string {
    if (validations.length === 0) return '';

    const validCount = validations.filter(v => v.isValid).length;
    const invalidCount = validations.length - validCount;

    return `
    <section>
        <h2>✅ Resumo da Validação</h2>
        <div class="validation-summary">
            <p><strong>Arquivos válidos:</strong> <span class="status-success">${validCount}</span></p>
            <p><strong>Arquivos com problemas:</strong> <span class="status-error">${invalidCount}</span></p>
        </div>
    </section>`;
  }

  /**
   * Cria relatório de validação
   */
  private createValidationReport(validations: ValidationResult[]): string {
    const validCount = validations.filter(v => v.isValid).length;
    const invalidCount = validations.length - validCount;

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Validação - Migração de Hooks</title>
    <style>${this.getCommonStyles()}</style>
</head>
<body>
    <div class="container">
        <header>
            <h1>✅ Relatório de Validação - Migração de Hooks</h1>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        </header>

        <section class="validation-summary">
            <div class="metric-card">
                <div class="metric-value status-success">${validCount}</div>
                <div>Arquivos Válidos</div>
            </div>
            <div class="metric-card">
                <div class="metric-value status-error">${invalidCount}</div>
                <div>Com Problemas</div>
            </div>
        </section>

        <section>
            <h2>📋 Detalhes da Validação</h2>
            ${validations.map(validation => this.createValidationDetailSection(validation)).join('')}
        </section>
    </div>
</body>
</html>`;
  }

  /**
   * Cria seção detalhada de validação
   */
  private createValidationDetailSection(validation: ValidationResult): string {
    const statusClass = validation.isValid ? 'status-success' : 'status-error';
    const statusIcon = validation.isValid ? '✅' : '❌';

    return `
    <div class="file-section">
        <h3>${statusIcon} Validação</h3>
        <div class="${statusClass}">
            ${validation.isValid ? 'Validação passou' : 'Validação falhou'}
        </div>
        ${this.createValidationSection(validation)}
    </div>`;
  }

  /**
   * Cria relatório em Markdown
   */
  private createMarkdownReport(analyses: HookUsageAnalysis[], results: MigrationResult[]): string {
    const successful = results.filter(r => r.success).length;
    const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);

    return `# Relatório de Migração - Hooks Realtime

Gerado em: ${new Date().toLocaleString('pt-BR')}

## 📊 Resumo

- **Arquivos analisados:** ${analyses.length}
- **Migrações bem-sucedidas:** ${successful}
- **Total de mudanças:** ${totalChanges}

## 📋 Detalhes por Arquivo

${results.map(result => `
### ${path.basename(result.filePath)}

- **Status:** ${result.success ? '✅ Sucesso' : '❌ Falha'}
- **Mudanças aplicadas:** ${result.changes.length}
- **Backup:** ${result.backupPath ? path.basename(result.backupPath) : 'Não criado'}

${result.errors.length > 0 ? `
**Erros:**
${result.errors.map(error => `- ${error.type}: ${error.message}`).join('\n')}
` : ''}

${result.warnings.length > 0 ? `
**Avisos:**
${result.warnings.map(warning => `- ${warning}`).join('\n')}
` : ''}
`).join('')}

## 🎯 Próximos Passos

1. Revisar arquivos com falhas na migração
2. Executar testes para validar funcionalidade
3. Remover hooks legados após confirmação
4. Atualizar documentação do projeto
`;
  }

  /**
   * Escreve relatório em arquivo
   */
  private async writeReport(filename: string, content: string): Promise<void> {
    const reportsDir = './migration-reports';
    
    // Criar diretório se não existir
    try {
      await fs.promises.mkdir(reportsDir, { recursive: true });
    } catch {
      // Diretório já existe
    }

    const filePath = path.join(reportsDir, filename);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Estilos CSS comuns para relatórios HTML
   */
  private getCommonStyles(): string {
    return `
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; background: white; min-height: 100vh; }
        header { border-bottom: 2px solid #007bff; padding-bottom: 1rem; margin-bottom: 2rem; }
        h1 { color: #007bff; margin: 0; }
        h2 { color: #495057; border-bottom: 1px solid #dee2e6; padding-bottom: 0.5rem; }
        h3 { color: #6c757d; }
        .metric-card { background: #f8f9fa; padding: 1rem; border-radius: 8px; text-align: center; border: 1px solid #dee2e6; }
        .metric-value { font-size: 2rem; font-weight: bold; color: #007bff; }
        .file-section { background: #f8f9fa; padding: 1.5rem; margin-bottom: 1rem; border-radius: 8px; border: 1px solid #dee2e6; }
        .file-info { display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
        .file-info span { background: #e9ecef; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.9rem; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; }
        code { background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 3px; font-family: 'Monaco', 'Consolas', monospace; }
        ul { padding-left: 1.5rem; }
        li { margin-bottom: 0.5rem; }
        .warnings { background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
        .errors-list { background: #f8d7da; border: 1px solid #f5c6cb; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
        .warnings-list { background: #fff3cd; border: 1px solid #ffeaa7; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
        .validation-section { background: #e7f3ff; border: 1px solid #b3d9ff; padding: 1rem; border-radius: 4px; margin-top: 1rem; }
    `;
  }
}