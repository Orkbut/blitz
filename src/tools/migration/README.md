# Ferramentas de Migração - Hooks Realtime

Este conjunto de ferramentas automatiza a migração de hooks realtime legados para o `useRealtimeUnified`, fornecendo análise de código, planejamento de migração, execução automatizada e validação.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Instalação](#instalação)
- [Uso Rápido](#uso-rápido)
- [API Detalhada](#api-detalhada)
- [Configuração](#configuração)
- [Exemplos](#exemplos)
- [Testes](#testes)
- [Solução de Problemas](#solução-de-problemas)

## 🎯 Visão Geral

### Componentes Principais

- **CodeAnalyzer**: Analisa código em busca de padrões de uso de hooks legados
- **MigrationPlanner**: Gera planos de migração baseados na análise
- **MigrationExecutor**: Executa as mudanças planejadas nos arquivos
- **MigrationValidator**: Valida a correção das migrações aplicadas
- **MigrationReporter**: Gera relatórios detalhados em HTML/JSON/Markdown
- **MigrationCLI**: Interface de linha de comando para todas as operações

### Hooks Suportados

- `useRealtimePuro` → `useRealtimeUnified`
- `useRealtimeSimple` → `useRealtimeUnified`
- `useRealtimeOperacoes` → `useRealtimeUnified`
- `useRealtimeEventos` → `useRealtimeUnified`
- `useRealtimeCentralized` → `useRealtimeUnified`
- `useRealtimeCalendarioSupervisor` → `useRealtimeUnified`
- `useRealtimeUnificado` → `useRealtimeUnified`

## 🚀 Instalação

As ferramentas estão incluídas no projeto. Não é necessária instalação adicional.

```typescript
import { MigrationTools, MigrationCLI } from '@/tools/migration';
```

## ⚡ Uso Rápido

### Análise Rápida

```typescript
import { MigrationTools } from '@/tools/migration';

// Analisar um arquivo
const analysis = await MigrationTools.analyzeFile('./src/components/Calendar.tsx');
console.log(`Hooks encontrados: ${analysis.totalHookUsages}`);

// Analisar um diretório
const analyses = await MigrationTools.analyzeDirectory('./src/components');
console.log(`Arquivos com hooks legados: ${analyses.length}`);
```

### Migração Simples

```typescript
import { migrateLegacyHooks } from '@/tools/migration';

// Migração com dry-run (sem aplicar mudanças)
await migrateLegacyHooks('./src/components', { dryRun: true });

// Migração completa
await migrateLegacyHooks('./src/components', { 
  dryRun: false,
  skipValidation: false,
  force: false 
});
```

### Validação

```typescript
import { MigrationTools } from '@/tools/migration';

// Validar arquivos migrados
const validations = await MigrationTools.validate('./src/components');
const validCount = validations.filter(v => v.isValid).length;
console.log(`Arquivos válidos: ${validCount}`);
```

## 📚 API Detalhada

### MigrationTools (Utilitários)

```typescript
interface MigrationTools {
  // Análise
  analyzeFile(filePath: string): Promise<HookUsageAnalysis>;
  analyzeDirectory(dirPath: string): Promise<HookUsageAnalysis[]>;
  
  // Migração
  migrate(targetPath: string, options?: MigrateOptions): Promise<void>;
  
  // Validação
  validate(targetPath: string): Promise<ValidationResult[]>;
  
  // Rollback
  rollback(targetPath: string): Promise<void>;
}

interface MigrateOptions {
  dryRun?: boolean;        // Não aplicar mudanças (padrão: false)
  skipValidation?: boolean; // Pular validação (padrão: false)
  force?: boolean;         // Não pedir confirmação (padrão: false)
}
```

### MigrationCLI (Interface Avançada)

```typescript
class MigrationCLI {
  constructor(config?: Partial<MigrationConfig>);
  
  // Comandos principais
  migrate(targetPath: string, options?: MigrateOptions): Promise<void>;
  analyze(targetPath: string): Promise<HookUsageAnalysis[]>;
  validate(targetPath: string): Promise<ValidationResult[]>;
  rollback(targetPath: string): Promise<void>;
}
```

### Tipos Principais

```typescript
interface HookUsageAnalysis {
  filePath: string;
  totalHookUsages: number;
  hookPatterns: HookUsagePattern[];
  imports: ImportAnalysis[];
  complexity: 'simple' | 'moderate' | 'complex';
  migrationRecommendation: MigrationRecommendation;
}

interface MigrationResult {
  filePath: string;
  success: boolean;
  changes: AppliedChange[];
  errors: MigrationError[];
  warnings: string[];
  backupPath?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
  testResults?: TestResult[];
}
```

## ⚙️ Configuração

### Configuração Padrão

```typescript
const DEFAULT_CONFIG = {
  includePatterns: ['**/*.ts', '**/*.tsx'],
  excludePatterns: [
    '**/node_modules/**', 
    '**/dist/**', 
    '**/*.test.*', 
    '**/*.spec.*'
  ],
  createBackups: true,
  validateAfterMigration: true,
  runTests: false,
  targetHook: 'useRealtimeUnified',
  legacyHooks: [
    'useRealtimePuro',
    'useRealtimeSimple',
    'useRealtimeOperacoes',
    // ... outros hooks
  ],
  outputDir: './migration-reports',
  reportFormat: 'html'
};
```

### Configuração Personalizada

```typescript
const customConfig: MigrationConfig = {
  includePatterns: ['**/components/**/*.tsx'],
  excludePatterns: ['**/*.test.*'],
  createBackups: true,
  validateAfterMigration: true,
  runTests: true,
  outputDir: './custom-reports',
  reportFormat: 'json'
};

const cli = new MigrationCLI(customConfig);
```

## 📝 Exemplos

### Exemplo 1: Análise Detalhada

```typescript
import { CodeAnalyzer } from '@/tools/migration';

const analyzer = new CodeAnalyzer(config);
const analysis = await analyzer.analyzeFile('./src/components/Calendar.tsx');

console.log('📊 Análise do arquivo:');
console.log(`  • Hooks encontrados: ${analysis.totalHookUsages}`);
console.log(`  • Complexidade: ${analysis.complexity}`);
console.log(`  • Estratégia: ${analysis.migrationRecommendation.strategy}`);

if (analysis.hookPatterns.length > 0) {
  console.log('📋 Hooks detectados:');
  analysis.hookPatterns.forEach(pattern => {
    console.log(`  • ${pattern.hookName} (linha ${pattern.lineNumber})`);
  });
}
```

### Exemplo 2: Migração com Validação

```typescript
import { MigrationCLI } from '@/tools/migration';

const cli = new MigrationCLI({
  createBackups: true,
  validateAfterMigration: true,
  runTests: true
});

// 1. Análise inicial
const analyses = await cli.analyze('./src/components');
console.log(`Arquivos para migrar: ${analyses.length}`);

// 2. Migração
await cli.migrate('./src/components', {
  dryRun: false,
  skipValidation: false
});

// 3. Validação adicional
const validations = await cli.validate('./src/components');
const issues = validations.filter(v => !v.isValid);
if (issues.length > 0) {
  console.log(`⚠️ ${issues.length} arquivos com problemas`);
}
```

### Exemplo 3: Processamento em Lote

```typescript
import { MigrationTools } from '@/tools/migration';

const directories = [
  './src/components/calendario',
  './src/components/supervisor',
  './src/pages/admin'
];

for (const dir of directories) {
  console.log(`🔄 Processando ${dir}...`);
  
  // Análise
  const analyses = await MigrationTools.analyzeDirectory(dir);
  if (analyses.length === 0) {
    console.log('✅ Nenhum hook legado encontrado');
    continue;
  }
  
  // Migração
  await MigrationTools.migrate(dir, { 
    dryRun: false,
    force: true 
  });
  
  // Validação
  const validations = await MigrationTools.validate(dir);
  const validCount = validations.filter(v => v.isValid).length;
  console.log(`✅ ${validCount}/${validations.length} arquivos válidos`);
}
```

### Exemplo 4: Relatórios Personalizados

```typescript
import { MigrationReporter } from '@/tools/migration';

const reporter = new MigrationReporter();

// Relatório em JSON
await reporter.generateJSONReport(analyses, 'analysis-report.json');

// Relatório em Markdown
await reporter.generateMarkdownReport(analyses, results);

// Relatório HTML personalizado
await reporter.generateAnalysisReport(analyses, plans);
```

## 🧪 Testes

### Executar Testes

```bash
# Todos os testes
npm run test src/tools/migration/tests

# Testes específicos
npm run test src/tools/migration/tests/code-analyzer.test.ts
npm run test src/tools/migration/tests/migration-planner.test.ts
npm run test src/tools/migration/tests/migration-executor.test.ts
npm run test src/tools/migration/tests/migration-validator.test.ts
npm run test src/tools/migration/tests/migration-cli.test.ts
```

### Cobertura de Testes

Os testes cobrem:

- ✅ Análise de código e detecção de padrões
- ✅ Geração de planos de migração
- ✅ Execução de mudanças nos arquivos
- ✅ Validação de sintaxe e tipos
- ✅ Interface CLI e funções utilitárias
- ✅ Tratamento de erros e casos extremos

## 🔧 Solução de Problemas

### Problemas Comuns

#### 1. Erro: "Module not found"

```typescript
// ❌ Problema
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

// ✅ Solução: Verificar caminho
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';
```

#### 2. Configuração Inválida

```typescript
// ❌ Problema
const result = useRealtimeUnified(); // Falta 'tables'

// ✅ Solução
const result = useRealtimeUnified({ 
  tables: ['operacao'],
  enableRealtime: true 
});
```

#### 3. Backup Não Criado

```typescript
// ✅ Forçar criação de backup
const cli = new MigrationCLI({
  createBackups: true // Sempre criar backups
});
```

#### 4. Validação Falha

```typescript
// Verificar erros específicos
const validations = await cli.validate('./src');
validations.forEach(validation => {
  if (!validation.isValid) {
    console.log('Erros:', validation.errors);
    console.log('Sugestões:', validation.suggestions);
  }
});
```

### Debug e Logs

```typescript
// Habilitar logs detalhados
const cli = new MigrationCLI({
  debug: true // Em desenvolvimento
});

// Verificar relatórios gerados
console.log('Relatórios em: ./migration-reports/');
```

### Rollback de Emergência

```typescript
// Reverter todas as mudanças
await MigrationTools.rollback('./src');

// Ou usando CLI
const cli = new MigrationCLI();
await cli.rollback('./src');
```

## 📊 Métricas e Relatórios

### Tipos de Relatórios

1. **Relatório de Análise** (`migration-analysis.html`)
   - Hooks encontrados por arquivo
   - Complexidade de migração
   - Recomendações e avisos

2. **Relatório de Migração** (`migration-report.html`)
   - Mudanças aplicadas
   - Sucessos e falhas
   - Backups criados

3. **Relatório de Validação** (`validation-report.html`)
   - Erros de compilação
   - Resultados de testes
   - Sugestões de melhoria

### Métricas Coletadas

- Número de hooks migrados
- Tempo de execução
- Taxa de sucesso
- Problemas encontrados
- Performance antes/depois

## 🤝 Contribuição

### Adicionando Novos Hooks

1. Atualizar `hookMappings` em `MigrationPlanner`
2. Adicionar testes correspondentes
3. Atualizar documentação

### Melhorando Validação

1. Adicionar novos tipos de erro em `ValidationError`
2. Implementar verificações em `MigrationValidator`
3. Atualizar relatórios

## 📚 Recursos Adicionais

- [Guia de Migração Completo](./MIGRATION_GUIDE.md)
- [Exemplos Práticos](./examples/migration-example.ts)
- [Documentação do useRealtimeUnified](../hooks/README.md)
- [Testes de Referência](./tests/)

---

**Versão:** 1.0.0  
**Última Atualização:** Janeiro 2024  
**Compatibilidade:** TypeScript 4.5+, React 18+