/**
 * Planejador de migração que gera planos de migração baseados na análise de código
 */

import { 
  HookUsageAnalysis, 
  MigrationPlan, 
  RequiredChange, 
  HookMigrationMapping,
  ConfigTransformation,
  CallbackMapping
} from './types';

export class MigrationPlanner {
  private hookMappings: HookMigrationMapping;

  constructor() {
    this.hookMappings = this.initializeHookMappings();
  }

  /**
   * Gera um plano de migração baseado na análise
   */
  generateMigrationPlan(analysis: HookUsageAnalysis): MigrationPlan {
    const changes: RequiredChange[] = [];
    
    // Gerar mudanças para imports
    changes.push(...this.generateImportChanges(analysis));
    
    // Gerar mudanças para cada padrão de uso
    for (const pattern of analysis.hookPatterns) {
      changes.push(...this.generateHookUsageChanges(pattern));
    }

    // Determinar se backup é necessário
    const backupRequired = analysis.complexity !== 'simple' || changes.length > 3;
    
    // Determinar se testes são necessários
    const testingRequired = analysis.hookPatterns.length > 0;

    // Extrair dependências
    const dependencies = this.extractDependencies(analysis);

    return {
      filePath: analysis.filePath,
      analysis,
      changes,
      backupRequired,
      testingRequired,
      dependencies
    };
  }

  /**
   * Gera mudanças necessárias para imports
   */
  private generateImportChanges(analysis: HookUsageAnalysis): RequiredChange[] {
    const changes: RequiredChange[] = [];
    
    for (const importAnalysis of analysis.imports) {
      const { hookName, importPath, lineNumber } = importAnalysis;
      
      // Verificar se é um hook legado que precisa ser migrado
      if (this.hookMappings[hookName]) {
        const oldImport = this.reconstructImportStatement(importAnalysis);
        const newImport = this.generateNewImportStatement(hookName);
        
        changes.push({
          type: 'import',
          description: `Migrar import de ${hookName} para useRealtimeUnified`,
          oldCode: oldImport,
          newCode: newImport,
          lineNumber
        });
      }
    }

    return changes;
  }

  /**
   * Gera mudanças para uso de hooks
   */
  private generateHookUsageChanges(pattern: any): RequiredChange[] {
    const changes: RequiredChange[] = [];
    const mapping = this.hookMappings[pattern.hookName];
    
    if (!mapping) {
      return changes;
    }

    // Mudança na chamada do hook
    const oldHookCall = this.extractHookCall(pattern);
    const newHookCall = this.generateNewHookCall(pattern, mapping);
    
    changes.push({
      type: 'config',
      description: `Migrar ${pattern.hookName} para useRealtimeUnified`,
      oldCode: oldHookCall,
      newCode: newHookCall,
      lineNumber: pattern.lineNumber
    });

    // Mudanças em callbacks se necessário
    changes.push(...this.generateCallbackChanges(pattern, mapping));

    return changes;
  }

  /**
   * Gera mudanças para callbacks
   */
  private generateCallbackChanges(pattern: any, mapping: any): RequiredChange[] {
    const changes: RequiredChange[] = [];
    
    for (const callbackMapping of mapping.callbackMappings) {
      if (pattern.configObject && pattern.configObject[callbackMapping.from]) {
        changes.push({
          type: 'callback',
          description: `Migrar callback ${callbackMapping.from} para ${callbackMapping.to}`,
          oldCode: `${callbackMapping.from}: ${pattern.configObject[callbackMapping.from]}`,
          newCode: `${callbackMapping.to}: ${pattern.configObject[callbackMapping.from]}`,
          lineNumber: pattern.lineNumber
        });
      }
    }

    return changes;
  }

  /**
   * Reconstrói statement de import
   */
  private reconstructImportStatement(importAnalysis: any): string {
    const { hookName, importPath, isDefault, isNamed } = importAnalysis;
    
    if (isDefault) {
      return `import ${hookName} from '${importPath}';`;
    } else if (isNamed) {
      return `import { ${hookName} } from '${importPath}';`;
    }
    
    return `import ${hookName} from '${importPath}';`;
  }

  /**
   * Gera novo statement de import
   */
  private generateNewImportStatement(oldHookName: string): string {
    return `import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';`;
  }

  /**
   * Extrai chamada do hook do padrão
   */
  private extractHookCall(pattern: any): string {
    // Simplificado - em produção seria mais robusto
    const config = pattern.configObject ? JSON.stringify(pattern.configObject) : '{}';
    return `const result = ${pattern.hookName}(${config});`;
  }

  /**
   * Gera nova chamada do hook
   */
  private generateNewHookCall(pattern: any, mapping: any): string {
    const newConfig = this.transformConfig(pattern.configObject || {}, mapping);
    const configStr = JSON.stringify(newConfig, null, 2);
    
    return `const result = useRealtimeUnified(${configStr});`;
  }

  /**
   * Transforma configuração do hook legado para o novo formato
   */
  private transformConfig(oldConfig: Record<string, any>, mapping: any): Record<string, any> {
    const newConfig = { ...mapping.targetConfig };
    
    // Aplicar transformações de configuração
    for (const transformation of mapping.configTransformations) {
      if (oldConfig[transformation.from] !== undefined) {
        const value = transformation.transform 
          ? transformation.transform(oldConfig[transformation.from])
          : oldConfig[transformation.from];
        
        newConfig[transformation.to] = value;
      }
    }

    return newConfig;
  }

  /**
   * Extrai dependências do plano de migração
   */
  private extractDependencies(analysis: HookUsageAnalysis): string[] {
    const dependencies = new Set<string>();
    
    // Adicionar dependências dos hooks
    for (const pattern of analysis.hookPatterns) {
      dependencies.add('useRealtimeUnified');
      
      // Adicionar dependências específicas baseadas na configuração
      if (pattern.configObject) {
        if (pattern.configObject.enablePolling) {
          dependencies.add('useSmartPolling');
        }
        if (pattern.configObject.enableFetch) {
          dependencies.add('data fetching utilities');
        }
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Inicializa mapeamentos de hooks legados
   */
  private initializeHookMappings(): HookMigrationMapping {
    return {
      'useRealtimePuro': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: false,
          enableFetch: false
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'tables',
            to: 'tables',
            required: true
          },
          {
            from: 'onDatabaseChange',
            to: 'onDatabaseChange',
            required: false
          }
        ],
        callbackMappings: [
          {
            from: 'onDatabaseChange',
            to: 'onDatabaseChange'
          }
        ]
      },
      
      'useRealtimeSimple': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: true,
          enableFetch: false
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'tables',
            to: 'tables',
            required: true
          },
          {
            from: 'pollingInterval',
            to: 'activeInterval',
            required: false
          }
        ],
        callbackMappings: []
      },

      'useRealtimeOperacoes': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: true,
          enableFetch: true,
          tables: ['operacao', 'participacao']
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'operationIds',
            to: 'filters',
            transform: (ids: number[]) => ({ 'operacao.id': `in.(${ids.join(',')})` }),
            required: false
          },
          {
            from: 'startDate',
            to: 'startDate',
            required: false
          },
          {
            from: 'endDate',
            to: 'endDate',
            required: false
          }
        ],
        callbackMappings: [
          {
            from: 'onOperationChange',
            to: 'onDatabaseChange'
          },
          {
            from: 'onParticipationChange',
            to: 'onDatabaseChange'
          }
        ]
      },

      'useRealtimeEventos': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: false,
          enableFetch: false,
          tables: ['eventos_operacao']
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'operationIds',
            to: 'filters',
            transform: (ids: number[]) => ({ 'eventos_operacao.operacao_id': `in.(${ids.join(',')})` }),
            required: false
          }
        ],
        callbackMappings: [
          {
            from: 'onNewEvent',
            to: 'onDatabaseChange'
          }
        ]
      },

      'useRealtimeUnificado': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: true,
          enableFetch: true
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'tables',
            to: 'tables',
            required: true
          },
          {
            from: 'startDate',
            to: 'startDate',
            required: false
          },
          {
            from: 'endDate',
            to: 'endDate',
            required: false
          },
          {
            from: 'apiEndpoint',
            to: 'apiEndpoint',
            required: false
          },
          {
            from: 'pollingInterval',
            to: 'activeInterval',
            required: false
          }
        ],
        callbackMappings: [
          {
            from: 'onDatabaseChange',
            to: 'onDatabaseChange'
          },
          {
            from: 'onDataUpdate',
            to: 'onDataUpdate'
          }
        ]
      },

      'useRealtimeCentralized': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: false,
          enableFetch: false
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'channelId',
            to: 'channelId',
            required: false
          },
          {
            from: 'tables',
            to: 'tables',
            required: true
          }
        ],
        callbackMappings: []
      },

      'useRealtimeCalendarioSupervisor': {
        targetConfig: {
          enableRealtime: true,
          enablePolling: true,
          enableFetch: true,
          tables: ['operacao', 'participacao']
        },
        requiredImports: ['useRealtimeUnified'],
        configTransformations: [
          {
            from: 'startDate',
            to: 'startDate',
            required: false
          },
          {
            from: 'endDate',
            to: 'endDate',
            required: false
          }
        ],
        callbackMappings: [
          {
            from: 'onCalendarUpdate',
            to: 'onDataUpdate'
          }
        ]
      }
    };
  }
}