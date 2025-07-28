# Guia de Migração - Hooks Realtime

Este guia fornece instruções detalhadas para migrar hooks realtime legados para o `useRealtimeUnified`.

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Ferramentas de Migração](#ferramentas-de-migração)
3. [Exemplos de Migração](#exemplos-de-migração)
4. [Processo de Migração](#processo-de-migração)
5. [Validação e Testes](#validação-e-testes)
6. [Solução de Problemas](#solução-de-problemas)

## 🎯 Visão Geral

### Hooks Legados Suportados

- `useRealtimePuro` - Hook minimalista para realtime puro
- `useRealtimeSimple` - Hook simples com polling básico
- `useRealtimeOperacoes` - Hook específico para operações
- `useRealtimeEventos` - Hook para monitoramento de eventos
- `useRealtimeCentralized` - Hook com contexto centralizado
- `useRealtimeCalendarioSupervisor` - Hook específico para calendário
- `useRealtimeUnificado` - Versão anterior do hook unificado

### Benefícios da Migração

- ✅ Código consolidado e mais fácil de manter
- ✅ Performance otimizada com pooling de conexões
- ✅ Melhor tratamento de erros e reconexão
- ✅ API consistente entre todos os componentes
- ✅ Debugging e monitoramento aprimorados

## 🛠️ Ferramentas de Migração

### Instalação

```bash
# As ferramentas estão incluídas no projeto
# Não é necessária instalação adicional
```

### Uso Básico

```typescript
import { MigrationTools } from '@/tools/migration';

// Análise de um arquivo
const analysis = await MigrationTools.analyzeFile('./src/components/Calendar.tsx');

// Análise de um diretório
const analyses = await MigrationTools.analyzeDirectory('./src/components');

// Migração completa
await MigrationTools.migrate('./src/components', {
  dryRun: false,
  skipValidation: false,
  force: false
});
```

### CLI Avançado

```typescript
import { MigrationCLI } from '@/tools/migration';

const cli = new MigrationCLI({
  includePatterns: ['**/*.tsx', '**/*.ts'],
  excludePatterns: ['**/*.test.*'],
  createBackups: true,
  validateAfterMigration: true
});

// Apenas análise
await cli.analyze('./src');

// Migração com dry-run
await cli.migrate('./src', { dryRun: true });

// Migração completa
await cli.migrate('./src');

// Validação pós-migração
await cli.validate('./src');

// Rollback se necessário
await cli.rollback('./src');
```

## 📝 Exemplos de Migração

### 1. useRealtimePuro → useRealtimeUnified

**Antes:**
```typescript
import { useRealtimePuro } from '@/hooks/useRealtimePuro';

function MyComponent() {
  const { isConnected, eventsReceived } = useRealtimePuro({
    tables: ['operacao'],
    onDatabaseChange: (payload) => {
      console.log('Database change:', payload);
    }
  });

  return (
    <div>
      Status: {isConnected ? 'Conectado' : 'Desconectado'}
      Eventos: {eventsReceived}
    </div>
  );
}
```

**Depois:**
```typescript
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function MyComponent() {
  const { isConnected, eventsReceived } = useRealtimeUnified({
    tables: ['operacao'],
    enableRealtime: true,
    enablePolling: false,
    enableFetch: false,
    onDatabaseChange: (payload) => {
      console.log('Database change:', payload);
    }
  });

  return (
    <div>
      Status: {isConnected ? 'Conectado' : 'Desconectado'}
      Eventos: {eventsReceived}
    </div>
  );
}
```

### 2. useRealtimeOperacoes → useRealtimeUnified

**Antes:**
```typescript
import { useRealtimeOperacoes } from '@/hooks/useRealtimeOperacoes';

function OperationsComponent() {
  const { 
    data, 
    loading, 
    error,
    refetch 
  } = useRealtimeOperacoes({
    operationIds: [1, 2, 3],
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    onOperationChange: (operationId, eventType) => {
      console.log(`Operation ${operationId} changed: ${eventType}`);
    }
  });

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <button onClick={() => refetch('manual')}>Atualizar</button>
      {data.map(operation => (
        <div key={operation.id}>{operation.nome}</div>
      ))}
    </div>
  );
}
```

**Depois:**
```typescript
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function OperationsComponent() {
  const { 
    data, 
    loading, 
    error,
    refetch 
  } = useRealtimeUnified({
    tables: ['operacao', 'participacao'],
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    filters: {
      'operacao.id': 'in.(1,2,3)'
    },
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    onDatabaseChange: (event) => {
      if (event.table === 'operacao') {
        console.log(`Operation ${event.record.id} changed: ${event.eventType}`);
      }
    }
  });

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <button onClick={() => refetch('manual')}>Atualizar</button>
      {data.map(operation => (
        <div key={operation.id}>{operation.nome}</div>
      ))}
    </div>
  );
}
```

### 3. useRealtimeSimple → useRealtimeUnified

**Antes:**
```typescript
import { useRealtimeSimple } from '@/hooks/useRealtimeSimple';

function SimpleComponent() {
  const { 
    isConnected, 
    lastEventTime,
    reconnect 
  } = useRealtimeSimple({
    tables: ['eventos_operacao'],
    pollingInterval: 10000
  });

  return (
    <div>
      <div>Status: {isConnected ? '🟢' : '🔴'}</div>
      <div>Último evento: {lastEventTime ? new Date(lastEventTime).toLocaleString() : 'Nenhum'}</div>
      <button onClick={reconnect}>Reconectar</button>
    </div>
  );
}
```

**Depois:**
```typescript
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function SimpleComponent() {
  const { 
    isConnected, 
    lastEventTime,
    reconnect 
  } = useRealtimeUnified({
    tables: ['eventos_operacao'],
    enableRealtime: true,
    enablePolling: true,
    enableFetch: false,
    activeInterval: 10000
  });

  return (
    <div>
      <div>Status: {isConnected ? '🟢' : '🔴'}</div>
      <div>Último evento: {lastEventTime ? new Date(lastEventTime).toLocaleString() : 'Nenhum'}</div>
      <button onClick={reconnect}>Reconectar</button>
    </div>
  );
}
```

### 4. Migração com Configuração Complexa

**Antes:**
```typescript
import { useRealtimeUnificado } from '@/hooks/useRealtimeUnificado';

function ComplexComponent() {
  const {
    data,
    loading,
    error,
    isConnected,
    isActive,
    refetch,
    forceExecute
  } = useRealtimeUnificado({
    tables: ['operacao', 'participacao', 'eventos_operacao'],
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    apiEndpoint: '/api/operacoes/calendario',
    pollingInterval: 5000,
    onDatabaseChange: handleDatabaseChange,
    onDataUpdate: handleDataUpdate,
    onConnectionChange: handleConnectionChange
  });

  // ... resto do componente
}
```

**Depois:**
```typescript
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

function ComplexComponent() {
  const {
    data,
    loading,
    error,
    isConnected,
    isActive,
    refetch,
    forceExecute
  } = useRealtimeUnified({
    tables: ['operacao', 'participacao', 'eventos_operacao'],
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    apiEndpoint: '/api/operacoes/calendario',
    activeInterval: 5000,
    inactiveInterval: 30000,
    onDatabaseChange: handleDatabaseChange,
    onDataUpdate: handleDataUpdate,
    onConnectionChange: handleConnectionChange
  });

  // ... resto do componente
}
```

## 🔄 Processo de Migração

### 1. Análise Inicial

```bash
# Analisar todo o projeto
npm run migration:analyze ./src

# Analisar diretório específico
npm run migration:analyze ./src/components
```

### 2. Dry Run

```bash
# Executar migração em modo dry-run (sem aplicar mudanças)
npm run migration:migrate ./src --dry-run
```

### 3. Migração Incremental

```bash
# Migrar arquivo por arquivo
npm run migration:migrate ./src/components/Calendar.tsx

# Migrar diretório específico
npm run migration:migrate ./src/components/calendario
```

### 4. Migração Completa

```bash
# Migração completa com validação
npm run migration:migrate ./src

# Migração forçada (sem confirmação)
npm run migration:migrate ./src --force
```

### 5. Validação

```bash
# Validar arquivos migrados
npm run migration:validate ./src
```

### 6. Rollback (se necessário)

```bash
# Reverter usando backups
npm run migration:rollback ./src
```

## ✅ Validação e Testes

### Validação Automática

A ferramenta de migração inclui validação automática que verifica:

- ✅ Sintaxe TypeScript válida
- ✅ Imports corretos
- ✅ Uso adequado do hook unificado
- ✅ Compilação sem erros
- ✅ Execução de testes (se disponíveis)

### Testes Manuais

Após a migração, execute os seguintes testes:

1. **Funcionalidade Básica**
   ```bash
   npm run dev
   # Verificar se a aplicação inicia sem erros
   ```

2. **Testes Automatizados**
   ```bash
   npm run test
   # Executar suite de testes completa
   ```

3. **Testes de Integração**
   ```bash
   npm run test:integration
   # Testar funcionalidade realtime
   ```

### Checklist de Validação

- [ ] Aplicação inicia sem erros de compilação
- [ ] Conexões realtime funcionam corretamente
- [ ] Polling está operacional (se habilitado)
- [ ] Fetch de dados funciona (se habilitado)
- [ ] Callbacks são executados corretamente
- [ ] Performance não foi degradada
- [ ] Testes automatizados passam
- [ ] Funcionalidade do usuário não foi afetada

## 🔧 Solução de Problemas

### Problemas Comuns

#### 1. Erro de Import

**Problema:**
```
Module not found: Can't resolve '@/hooks/useRealtimeUnified'
```

**Solução:**
```typescript
// Verificar se o caminho está correto
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';

// Ou usar caminho relativo
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';
```

#### 2. Configuração Inválida

**Problema:**
```
Error: useRealtimeUnified requires 'tables' configuration
```

**Solução:**
```typescript
// Sempre incluir a propriedade 'tables'
const result = useRealtimeUnified({
  tables: ['operacao'], // ✅ Obrigatório
  enableRealtime: true
});
```

#### 3. Callbacks Não Funcionam

**Problema:**
Callbacks do hook legado não são executados após migração.

**Solução:**
```typescript
// Verificar mapeamento de callbacks
// useRealtimeOperacoes
onOperationChange: (id, type) => {} // ❌ Legado

// useRealtimeUnified  
onDatabaseChange: (event) => {      // ✅ Novo
  if (event.table === 'operacao') {
    // Lógica do callback
  }
}
```

#### 4. Performance Degradada

**Problema:**
Aplicação mais lenta após migração.

**Solução:**
```typescript
// Otimizar configuração
const result = useRealtimeUnified({
  tables: ['operacao'],
  enableRealtime: true,
  enablePolling: false,    // ✅ Desabilitar se não necessário
  enableFetch: false,      // ✅ Desabilitar se não necessário
  activeInterval: 10000,   // ✅ Aumentar intervalo se apropriado
  debug: false             // ✅ Desabilitar debug em produção
});
```

### Logs de Debug

Para debugar problemas, habilite logs detalhados:

```typescript
const result = useRealtimeUnified({
  tables: ['operacao'],
  debug: true, // ✅ Habilitar logs detalhados
  // ... outras configurações
});

// Verificar informações de debug
console.log('Debug info:', result.debugInfo);
```

### Suporte

Se encontrar problemas não cobertos neste guia:

1. Verifique os logs de erro no console
2. Execute validação automática: `npm run migration:validate`
3. Consulte a documentação do `useRealtimeUnified`
4. Crie um issue no repositório com detalhes do problema

## 📚 Recursos Adicionais

- [Documentação do useRealtimeUnified](../hooks/README.md)
- [Guia de Performance](../hooks/PERFORMANCE_GUIDE.md)
- [Exemplos de Uso](../hooks/examples/)
- [Testes de Referência](../tests/)

---

**Nota:** Este guia é atualizado regularmente. Verifique a versão mais recente antes de iniciar a migração.