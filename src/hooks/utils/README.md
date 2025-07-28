# 🚨 Sistema de Tratamento de Erros Realtime

Este documento descreve o sistema abrangente de tratamento de erros implementado para os hooks realtime, seguindo as melhores práticas de error handling e recuperação automática.

## 📋 Visão Geral

O sistema de tratamento de erros é composto por vários módulos integrados que trabalham juntos para:

- **Classificar** erros automaticamente baseado em tipo, mensagem e contexto
- **Recuperar** de erros usando estratégias inteligentes (retry, backoff, fallback)
- **Limitar** operações para evitar sobrecarga (rate limiting)
- **Monitorar** e coletar métricas de erros
- **Degradar** graciosamente quando necessário (error boundaries)

## 🏗️ Arquitetura

### Componentes Principais

1. **ErrorClassifier** - Classifica erros em tipos específicos
2. **ErrorRecoveryManager** - Gerencia estratégias de recuperação
3. **RealtimeErrorHandler** - Orquestra todo o processo de tratamento
4. **RateLimiter** - Controla frequência de operações
5. **RealtimeErrorBoundary** - Componente React para degradação graciosa

### Fluxo de Tratamento

```
Erro Ocorre → Classificação → Rate Limiting → Recuperação → Logging/Métricas
```

## 🎯 Tipos de Erro

O sistema reconhece os seguintes tipos de erro:

- `CONNECTION_ERROR` - Problemas de conexão
- `RATE_LIMIT_ERROR` - Limite de requisições excedido
- `AUTHENTICATION_ERROR` - Falhas de autenticação
- `CONFIGURATION_ERROR` - Configuração inválida
- `FETCH_ERROR` - Erros em requisições HTTP
- `POLLING_ERROR` - Problemas no polling
- `SUBSCRIPTION_ERROR` - Erros de subscription realtime
- `NETWORK_ERROR` - Problemas de rede
- `TIMEOUT_ERROR` - Timeouts
- `VALIDATION_ERROR` - Dados inválidos
- `UNKNOWN_ERROR` - Erros não classificados

## 🔄 Estratégias de Recuperação

### 1. RETRY
Tenta novamente imediatamente com limite de tentativas.

### 2. EXPONENTIAL_BACKOFF
Aumenta progressivamente o tempo entre tentativas.

### 3. FALLBACK
Usa uma operação alternativa quando a principal falha.

### 4. RESET
Reinicia completamente o estado do sistema.

### 5. DISABLE
Desabilita a funcionalidade temporariamente.

### 6. IGNORE
Ignora o erro e continua operação.

### 7. ESCALATE
Propaga o erro para nível superior.

## 🚦 Rate Limiting

### Estratégias Disponíveis

- **FIXED_WINDOW** - Janela fixa de tempo
- **SLIDING_WINDOW** - Janela deslizante
- **TOKEN_BUCKET** - Balde de tokens para rajadas
- **EXPONENTIAL_BACKOFF** - Backoff após erros consecutivos

### Configurações Padrão

```typescript
const DEFAULT_RATE_LIMITS = {
  'realtime_connection': { maxRequests: 100, windowMs: 60000 },
  'realtime_subscription': { maxRequests: 50, windowMs: 60000 },
  'api_fetch': { maxRequests: 200, windowMs: 60000 },
  'polling': { maxRequests: 60, windowMs: 60000 },
  'error_recovery': { maxRequests: 10, windowMs: 60000 }
};
```

## 🛡️ Error Boundaries

### RealtimeErrorBoundary

Componente React que captura erros e fornece fallbacks:

```tsx
<RealtimeErrorBoundary
  fallback={(error, retry) => <ErrorFallback error={error} onRetry={retry} />}
  onError={(error) => console.error('Boundary caught:', error)}
>
  <MyRealtimeComponent />
</RealtimeErrorBoundary>
```

### Funcionalidades

- Captura erros de renderização
- Tentativas automáticas de recuperação
- Fallbacks customizáveis
- Isolamento de erros críticos

## 📊 Métricas e Logging

### Métricas Coletadas

- Total de erros por tipo e severidade
- Tentativas de recuperação (sucessos/falhas)
- Tempo médio de recuperação
- Estatísticas de rate limiting

### Logging Estruturado

```typescript
const logEntry = {
  id: 'unique-id',
  timestamp: Date.now(),
  error: classifiedError,
  level: 'error',
  message: 'Friendly message',
  context: { channelId, operation },
  resolved: false
};
```

## 🔧 Uso Básico

### 1. Tratamento Simples

```typescript
import { handleRealtimeError } from './utils/error-handler';

try {
  await riskyOperation();
} catch (error) {
  const result = await handleRealtimeError(error, { 
    operation: 'data_fetch',
    channelId: 'my-channel'
  });
  
  if (!result.success) {
    console.error('Recovery failed:', result.error);
  }
}
```

### 2. Com Retry Automático

```typescript
import { handleRealtimeErrorWithRetry } from './utils/error-handler';

const result = await handleRealtimeErrorWithRetry(
  error,
  () => retryOperation(),
  { channelId: 'my-channel' }
);
```

### 3. Com Rate Limiting

```typescript
import { withRateLimit } from './utils/rate-limiter';

const result = await withRateLimit(
  'api_fetch',
  () => fetchData(),
  'user-123'
);
```

### 4. Error Boundary

```tsx
import { RealtimeErrorBoundary } from './utils/error-boundary';

function App() {
  return (
    <RealtimeErrorBoundary>
      <RealtimeComponent />
    </RealtimeErrorBoundary>
  );
}
```

## ⚙️ Configuração Avançada

### Custom Error Handler

```typescript
import { realtimeErrorHandler } from './utils/error-handler';

realtimeErrorHandler.setCustomHandler(
  RealtimeErrorType.CONNECTION_ERROR,
  async (error) => {
    // Custom recovery logic
    return { success: true, strategy: RecoveryStrategy.RETRY, retryCount: 1 };
  }
);
```

### Rate Limit Personalizado

```typescript
import { rateLimiter } from './utils/rate-limiter';

rateLimiter.setRateLimit('custom_operation', {
  maxRequests: 10,
  windowMs: 30000,
  strategy: RateLimitStrategy.TOKEN_BUCKET
});
```

## 🧪 Testes

O sistema inclui testes abrangentes para:

- Classificação de erros
- Estratégias de recuperação
- Rate limiting
- Integração entre componentes
- Error boundaries

Execute os testes:

```bash
npm test -- error-handling.test.ts rate-limiter.test.ts
```

## 📈 Monitoramento

### Obter Métricas

```typescript
import { realtimeErrorHandler } from './utils/error-handler';

const metrics = realtimeErrorHandler.getMetrics();
console.log('Total errors:', metrics.totalErrors);
console.log('Recovery rate:', metrics.successfulRecoveries / metrics.recoveryAttempts);
```

### Obter Logs

```typescript
const errorLog = realtimeErrorHandler.getErrorLog();
const unresolvedErrors = realtimeErrorHandler.getUnresolvedErrors();
```

## 🔍 Debugging

### Debug Mode

```typescript
const config = {
  enableLogging: true,
  logLevel: 'debug',
  enableMetrics: true
};

const handler = new RealtimeErrorHandler(config);
```

### Console Logging

O sistema produz logs estruturados no console quando habilitado:

```
[CONNECTION_ERROR] Connection failed {
  error: { type: 'CONNECTION_ERROR', severity: 'HIGH', ... },
  context: { channelId: 'my-channel', operation: 'subscribe' }
}
```

## 🚀 Integração com Hooks

O sistema está totalmente integrado com o `useRealtimeUnified`:

```typescript
const { data, error, isConnected } = useRealtimeUnified({
  tables: ['users'],
  enableRealtime: true,
  onError: (error) => {
    // Error já foi processado pelo sistema
    console.log('User notification:', error.message);
  }
});
```

## 📝 Melhores Práticas

1. **Sempre forneça contexto** nos erros para melhor classificação
2. **Use rate limiting** para operações que podem ser abusadas
3. **Implemente fallbacks** para funcionalidades críticas
4. **Monitore métricas** regularmente para identificar padrões
5. **Teste cenários de erro** durante desenvolvimento
6. **Configure error boundaries** em componentes críticos

## 🔮 Extensibilidade

O sistema foi projetado para ser extensível:

- Adicione novos tipos de erro em `error-types.ts`
- Implemente estratégias customizadas de recuperação
- Crie classificadores específicos para sua aplicação
- Adicione métricas customizadas conforme necessário

---

Este sistema fornece uma base sólida para tratamento de erros em aplicações realtime, garantindo resiliência e uma experiência de usuário consistente mesmo em cenários de falha.