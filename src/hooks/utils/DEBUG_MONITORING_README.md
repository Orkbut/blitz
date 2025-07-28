# 🐛 Sistema de Debug e Monitoramento Realtime

Sistema abrangente de debug, logging e monitoramento de performance para hooks realtime unificados.

## 📋 Visão Geral

O sistema de debug e monitoramento fornece:

- **Debug Logger**: Logging estruturado com níveis configuráveis
- **Performance Monitor**: Coleta de métricas de performance em tempo real
- **Connection Health Monitor**: Monitoramento da saúde das conexões
- **Debug Info Collector**: Coleta de informações completas para troubleshooting
- **Debugging Utilities**: Ferramentas auxiliares para análise e debug

## 🚀 Como Usar

### Habilitando Debug no Hook

```typescript
import { useRealtimeUnified } from '../hooks/useRealtimeUnified';

const MyComponent = () => {
  const {
    data,
    loading,
    error,
    debugInfo
  } = useRealtimeUnified({
    tables: ['operacao', 'participacao'],
    debug: true, // 🔥 Habilita debug completo
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true
  });

  // debugInfo contém informações completas quando debug=true
  console.log('Debug Info:', debugInfo);

  return (
    <div>
      {/* Seu componente */}
    </div>
  );
};
```

### Usando o Debug Logger Diretamente

```typescript
import { debugLogger, LogLevel } from '../hooks/utils';

// Configurar nível de log
debugLogger.updateConfig({
  level: LogLevel.DEBUG,
  includeStackTrace: true,
  persistLogs: true
});

// Registrar logs
debugLogger.error('Erro crítico', { code: 'ERR_001' });
debugLogger.warn('Aviso importante', { type: 'WARNING' });
debugLogger.info('Informação geral', { status: 'OK' });
debugLogger.debug('Debug detalhado', { debug: true });

// Filtrar logs
const errorLogs = debugLogger.getLogs({ level: LogLevel.ERROR });
const channelLogs = debugLogger.getLogs({ channelId: 'my-channel' });

// Exportar logs
const logsJson = debugLogger.exportLogs();
```

### Monitoramento de Performance

```typescript
import { performanceMonitor } from '../hooks/utils';

// Timing de operações
performanceMonitor.startTiming('data-fetch');
// ... operação ...
performanceMonitor.endTiming('data-fetch', true, { dataCount: 100 });

// Registrar eventos
performanceMonitor.recordDatabaseEvent('INSERT', 50, 1024);
performanceMonitor.recordNetworkRequest('/api/data', 'GET', 200, true, 2048);
performanceMonitor.recordRender('MyComponent', 5, 'props_change');

// Obter métricas
const metrics = performanceMonitor.getMetrics();
console.log('Performance:', metrics);
```

### Monitoramento de Saúde da Conexão

```typescript
import { connectionHealthMonitor } from '../hooks/utils';

// Registrar eventos de conexão
connectionHealthMonitor.recordConnectionEvent('connected');
connectionHealthMonitor.recordEventLatency('INSERT', 100);
connectionHealthMonitor.recordDataEvent('received', 'event-1', 'users', 512);

// Obter saúde da conexão
const health = connectionHealthMonitor.getHealthMetrics();
console.log('Connection Health:', health);

// Verificar problemas ativos
const issues = connectionHealthMonitor.getActiveIssues();
console.log('Active Issues:', issues);
```

### Sessões de Debug

```typescript
import { realtimeDebugger } from '../hooks/utils';

// Iniciar sessão
const sessionId = realtimeDebugger.startSession('my-channel', 'useRealtimeUnified');

// Adicionar eventos
realtimeDebugger.addEvent(sessionId, 'connection', 'connected', 'Connection established');
realtimeDebugger.addEvent(sessionId, 'data', 'fetch_start', 'Starting data fetch');
realtimeDebugger.addEvent(sessionId, 'error', 'fetch_failed', 'Fetch failed', { error: 'Network error' }, 'high');

// Finalizar sessão
const session = realtimeDebugger.endSession(sessionId);
console.log('Session Summary:', session?.summary);

// Gerar relatório
const report = realtimeDebugger.generateReport(sessionId);
console.log(report);
```

## 📊 Informações de Debug Disponíveis

Quando `debug: true` está habilitado, o `debugInfo` retornado pelo hook contém:

```typescript
interface DebugInfo {
  // Identificação
  channelId: string;
  hookType: string;
  instanceId: string;
  timestamp: number;
  
  // Configuração
  config: {
    tables: string[];
    filters?: Record<string, string>;
    enableRealtime: boolean;
    enablePolling: boolean;
    enableFetch: boolean;
    debug: boolean;
  };
  
  // Estado atual
  state: {
    isConnected: boolean;
    connectionStatus: string;
    loading: boolean;
    error: string | null;
    dataCount: number;
    lastEventTime: number | null;
    eventsReceived: number;
    reconnectCount: number;
  };
  
  // Métricas de performance
  performance: PerformanceMetrics;
  
  // Saúde da conexão
  health: ConnectionHealthMetrics | null;
  
  // Logs recentes
  recentLogs: LogEntry[];
  
  // Problemas detectados
  issues: ConnectionIssue[];
  
  // Recomendações
  recommendations: string[];
  
  // Diagnósticos
  diagnostics: {
    networkConnectivity: 'good' | 'poor' | 'unknown';
    authenticationStatus: 'valid' | 'invalid' | 'unknown';
    rateLimitStatus: 'ok' | 'throttled' | 'unknown';
    dataIntegrity: 'good' | 'issues' | 'unknown';
    performanceIssues: string[];
  };
}
```

## 🔧 Configuração

### Debug Logger

```typescript
import { debugLogger } from '../hooks/utils';

debugLogger.updateConfig({
  enabled: true,
  level: LogLevel.DEBUG,
  includeTimestamp: true,
  includeStackTrace: true,
  includeContext: true,
  maxLogEntries: 1000,
  persistLogs: true,
  colorOutput: true,
  groupLogs: true
});
```

### Performance Monitor

```typescript
import { performanceMonitor } from '../hooks/utils';

performanceMonitor.updateConfig({
  enabled: true,
  collectMemoryMetrics: true,
  collectNetworkMetrics: true,
  collectRenderMetrics: true,
  sampleRate: 1.0,
  maxSamples: 1000,
  reportInterval: 30000,
  enableReporting: true,
  onReport: (metrics) => {
    console.log('Performance Report:', metrics);
  }
});
```

### Connection Health Monitor

```typescript
import { connectionHealthMonitor } from '../hooks/utils';

connectionHealthMonitor.updateConfig({
  enabled: true,
  checkInterval: 10000,
  latencyThresholds: {
    excellent: 100,
    good: 300,
    fair: 500,
    poor: 1000
  },
  uptimeThresholds: {
    excellent: 99,
    good: 95,
    fair: 90,
    poor: 80
  },
  onHealthChange: (metrics) => {
    console.log('Health Changed:', metrics);
  },
  onIssueDetected: (issue) => {
    console.warn('Issue Detected:', issue);
  }
});
```

## 📈 Métricas Coletadas

### Performance Metrics

- **Timing**: Tempo de conexão, latência de eventos, duração de fetch
- **Network**: Requisições totais, taxa de sucesso, bytes transferidos
- **Events**: Eventos recebidos, eventos por segundo, tempo de processamento
- **Memory**: Uso de memória, pico de memória, vazamentos detectados
- **Rendering**: Contagem de rerenders, tempo médio de render, renders pulados
- **Connection**: Reconexões, uptime, estabilidade da conexão
- **Polling**: Execuções de polling, eficiência, mudanças de intervalo adaptivo

### Connection Health Metrics

- **Status**: EXCELLENT, GOOD, FAIR, POOR, CRITICAL
- **Score**: 0-100 baseado em latência, uptime e qualidade dos dados
- **Latency**: Latência média, atual e tendência
- **Uptime**: Porcentagem de uptime, tempo total conectado/desconectado
- **Stability**: Contagem de reconexões, duração média de conexão
- **Data Quality**: Taxa de perda de eventos, eventos duplicados, problemas de ordem
- **Network**: Qualidade da rede, utilização de largura de banda, perda de pacotes estimada

## 🚨 Detecção de Problemas

O sistema detecta automaticamente:

- **Alta Latência**: Eventos com latência > 1000ms
- **Perda de Conexão**: Desconexões inesperadas
- **Problemas de Autenticação**: Erros de auth
- **Rate Limiting**: Limites de taxa excedidos
- **Perda de Dados**: Eventos perdidos ou duplicados
- **Vazamentos de Memória**: Aumento > 50MB na memória
- **Performance Degradada**: Métricas abaixo dos thresholds

## 🛠️ Troubleshooting

### Problemas Comuns

1. **Alta Latência**
   - Verificar qualidade da rede
   - Otimizar queries de banco
   - Reduzir payload dos eventos

2. **Reconexões Frequentes**
   - Verificar estabilidade da rede
   - Ajustar timeouts
   - Implementar retry com backoff

3. **Perda de Eventos**
   - Verificar rate limits
   - Otimizar processamento de eventos
   - Implementar buffer de eventos

4. **Alto Uso de Memória**
   - Verificar vazamentos
   - Limitar cache de dados
   - Implementar cleanup adequado

### Ferramentas de Debug

```typescript
import { realtimeDebugger } from '../hooks/utils';

// Validar configuração
const validation = realtimeDebugger.validateConfig(config);
if (!validation.valid) {
  console.error('Config Issues:', validation.issues);
  console.log('Suggestions:', validation.suggestions);
}

// Analisar padrões em eventos
const patterns = realtimeDebugger.analyzePatterns(events);
console.log('Patterns:', patterns.patterns);
console.log('Anomalies:', patterns.anomalies);
console.log('Trends:', patterns.trends);

// Comparar snapshots
const comparison = realtimeDebugger.compareSnapshots(snapshot1, snapshot2);
console.log('Changes:', comparison.changes);
console.log('Improvements:', comparison.improvements);
console.log('Regressions:', comparison.regressions);
```

## 📝 Exemplo Completo

Veja o arquivo `debug-monitoring.example.tsx` para um exemplo completo de como usar todos os recursos do sistema de debug e monitoramento.

## 🔒 Considerações de Performance

- **Debug Desabilitado**: Impacto mínimo na performance
- **Debug Habilitado**: Overhead adicional para coleta de métricas
- **Sampling**: Use `sampleRate < 1.0` em produção para reduzir overhead
- **Cleanup**: Dados são automaticamente limpos para evitar vazamentos
- **Persistência**: Logs podem ser persistidos no localStorage se habilitado

## 🧪 Testes

Execute os testes do sistema:

```bash
npm test -- debug-basic.test.ts
npm test -- debug-system.unit.test.ts
```

## 📚 Referências

- [Debug Logger](./debug-logger.ts)
- [Performance Monitor](./performance-monitor.ts)
- [Connection Health Monitor](./connection-health-monitor.ts)
- [Debug Info Collector](./debug-info-collector.ts)
- [Debugging Utilities](./debugging-utilities.ts)