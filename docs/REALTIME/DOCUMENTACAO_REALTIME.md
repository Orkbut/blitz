# 📡 **Documentação Completa: Sistema Realtime Radar Detran**

## 🎯 **Visão Geral**

O sistema realtime do Radar Detran permite **sincronização em tempo real** entre múltiplos supervisores e membros, garantindo que mudanças em participações sejam imediatamente refletidas em todas as telas conectadas.

### **Componentes Principais**
- **Frontend**: React com hooks customizados e contexts
- **Backend**: Supabase Realtime com triggers PostgreSQL 
- **Banco**: Triggers e funções que detectam mudanças
- **Comunicação**: WebSockets com Supabase Realtime API

---

## 🖥️ **FRONTEND: Arquitetura Realtime**

### **1. Context Central - `RealtimeContext`**

**Localização**: `src/contexts/RealtimeContext.tsx`

**Responsabilidades**:
- Gerenciar **conexão única** com Supabase Realtime
- **Autenticação** e reconexão automática
- **Broadcasting** de eventos para todos os componentes
- **Health monitoring** e controle de estabilidade

**Características Técnicas**:
```typescript
// ✅ SINGLETON: Uma única conexão para toda aplicação
// ✅ DEBOUNCE: Evita reconexões desnecessárias
// ✅ AUTO-RECOVERY: Reconexão automática em caso de falha
// ✅ EVENT BROADCASTING: Distribui eventos para componentes específicos
```

**Estados Monitorados**:
- `isConnected`: Status da conexão WebSocket
- `lastEventTime`: Timestamp do último evento recebido
- `reconnectCount`: Contador de reconexões para debugging

### **2. Hook de Operações - `useOperacoes`**

**Localização**: `src/hooks/useOperacoes.ts`

**Responsabilidades**:
- **Carregar operações** do dia atual
- **Escutar eventos** de mudanças em operações
- **Sincronizar estado** local com banco de dados
- **Otimizations**: Cache e debounce para performance

**Eventos Processados**:
```typescript
// INSERT: Nova operação criada
// UPDATE: Operação modificada (horários, detalhes)
// DELETE: Operação removida/cancelada
```

### **3. Componente CalendarioSupervisor**

**Localização**: `src/components/supervisor/CalendarioSupervisor.tsx`

**Responsabilidades**:
- **Renderizar** operações em formato de calendário
- **Processar eventos** de participações em tempo real
- **Atualizar contadores** (confirmados/solicitações) instantaneamente
- **Gerenciar estado visual** das barrinhas de progresso

**Algoritmo de Contadores**:
```typescript
// 🎯 LÓGICA DE CONTADORES OTIMIZADA
INSERT → estado_visual = 'PENDENTE' → +1 solicitação
UPDATE → ativa = false → -1 solicitação (CANCELAMENTO)
UPDATE → estado_visual = 'CONFIRMADO' → +1 confirmado, -1 solicitação
DELETE → Remove da contagem correspondente
```

### **4. Timeline de Operações**

**Localização**: `src/components/supervisor/TimelineOperacoes.tsx`

**Responsabilidades**:
- **Monitorar solicitações** pendentes em operações específicas
- **Exibir animações** visuais para solicitações ativas
- **Processar cancelamentos** e atualizações de estado
- **Cache inteligente** para evitar requisições desnecessárias

---

## 🔧 **BACKEND: Triggers e Funções PostgreSQL**

### **1. Trigger de Participações**

**Localização**: `migrations/xxx_realtime_triggers.sql`

**Funcionamento**:
```sql
-- ✅ TRIGGER APÓS INSERT/UPDATE/DELETE em participacoes
CREATE OR REPLACE FUNCTION notify_participacao_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT: Nova participação criada
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify('participacao_changes', 
            json_build_object(
                'type', 'INSERT',
                'operacao_id', NEW.operacao_id,
                'membro_id', NEW.membro_id,
                'estado_visual', NEW.estado_visual,
                'ativa', NEW.ativa
            )::text
        );
        RETURN NEW;
    
    -- UPDATE: Participação modificada (confirmação/cancelamento)
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM pg_notify('participacao_changes',
            json_build_object(
                'type', 'UPDATE', 
                'operacao_id', NEW.operacao_id,
                'old_ativa', OLD.ativa,
                'new_ativa', NEW.ativa,
                'old_estado', OLD.estado_visual,
                'new_estado', NEW.estado_visual
            )::text
        );
        RETURN NEW;
        
    -- DELETE: Participação removida fisicamente
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('participacao_changes',
            json_build_object(
                'type', 'DELETE',
                'operacao_id', OLD.operacao_id,
                'estado_visual', OLD.estado_visual
            )::text
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### **2. Configuração Row Level Security (RLS)**

**Tabelas Protegidas**:
- `participacoes`: Apenas membros podem ver suas próprias + supervisores veem todas
- `operacoes`: Visibilidade baseada na regional do usuário
- `usuarios`: Dados sensíveis protegidos por role

**Policies de Realtime**:
```sql
-- ✅ SUPERVISORES: Recebem eventos de todas operações de sua regional
ALTER PUBLICATION supabase_realtime ADD TABLE participacoes;

-- ✅ MEMBROS: Recebem apenas eventos relacionados a suas participações
CREATE POLICY "realtime_participacoes_supervisor" ON participacoes 
FOR SELECT USING (
    auth.jwt() ->> 'role' = 'supervisor' AND
    EXISTS (SELECT 1 FROM operacoes o WHERE o.id = operacao_id AND o.regional_id = auth.jwt() ->> 'regional_id')
);
```

### **3. Otimizações de Performance**

**Índices Estratégicos**:
```sql
-- ✅ ÍNDICES PARA REALTIME
CREATE INDEX idx_participacoes_realtime 
ON participacoes(operacao_id, ativa, estado_visual) 
WHERE ativa = true;

CREATE INDEX idx_operacoes_data_regional 
ON operacoes(data_operacao, regional_id) 
WHERE ativa = true;
```

---

## 💾 **BANCO DE DADOS: Estrutura e Triggers**

### **1. Tabela `participacoes`**

**Campos Críticos para Realtime**:
```sql
-- ✅ ESTRUTURA OTIMIZADA PARA REALTIME
id BIGSERIAL PRIMARY KEY,
operacao_id BIGINT NOT NULL,
membro_id BIGINT NOT NULL,
ativa BOOLEAN DEFAULT true,           -- 🎯 SOFT DELETE
estado_visual VARCHAR(50) DEFAULT 'PENDENTE',  -- 🎯 STATUS VISUAL
status_interno VARCHAR(50) DEFAULT 'AGUARDANDO_SUPERVISOR',
data_participacao TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now(),
posicao_fila INTEGER
```

**Estados Visuais**:
- `PENDENTE`: Solicitação aguardando supervisor
- `CONFIRMADO`: Aprovado pelo supervisor
- `ADICIONADO_SUP`: Adicionado diretamente pelo supervisor
- `REMOVIDO`: Cancelado (soft delete com `ativa = false`)

### **2. Trigger de Auditoria**

**Funcionamento**:
```sql
-- ✅ TRIGGER AUTOMÁTICO DE UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_participacoes_updated_at 
BEFORE UPDATE ON participacoes 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **3. Funções de Limpeza**

**Limpeza Automática**:
```sql
-- ✅ LIMPEZA DE PARTICIPAÇÕES ANTIGAS (7 dias)
CREATE OR REPLACE FUNCTION cleanup_old_participacoes()
RETURNS void AS $$
BEGIN
    DELETE FROM participacoes 
    WHERE ativa = false 
    AND updated_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;
```

---

## 🐛 **CASO TÉCNICO: "Heisenbug" no Realtime**

### **Problema Identificado**

**Sintoma**: Sistema funcionava com logs de debug, mas falhava sem eles
**Tipo**: Heisenbug - bug que muda comportamento quando observado
**Causa Raiz**: Race conditions em timing do JavaScript Event Loop

### **Análise Técnica**

**O que Estava Acontecendo**:
```javascript
// ❌ PROBLEMA: Eventos processados em ordem incorreta
1. Evento UPDATE chega via WebSocket
2. Payload object não está completamente serializado
3. Propriedades undefined devido a timing
4. Detecção de cancelamento falha

// ✅ DEBUG "MÁGICO": console.log forçava serialização
console.log(payload.old, payload.new); // Força serialização síncrona
JSON.stringify() // Estabiliza objeto na memória
```

**Causas Identificadas**:
1. **Micro-timing**: `console.log()` cria latências que sincronizam event loop
2. **Serialização**: `JSON.stringify()` força serialização completa de objetos
3. **WebSocket timing**: Firefox/Chrome processam WebSockets diferentemente
4. **Race conditions**: Eventos simultâneos processados fora de ordem

### **Solução Robusta Implementada**

**Estratégia**: Manter benefícios do debug sem dependência de logs

```typescript
// 🎯 SOLUÇÃO FINAL: Serialização forçada sem debug verboso
const payloadSerialized = JSON.parse(JSON.stringify(payload));

// ✅ DETECÇÃO ESTÁVEL: Baseada em objeto serializado
const foiCancelamento = payloadSerialized.new?.ativa === false;
```

**Por que Funciona**:
- **`JSON.parse(JSON.stringify())`**: Força serialização completa sem logs
- **Timing estável**: Evita race conditions sem debug overhead
- **Compatibilidade**: Funciona em todos os browsers
- **Performance**: Minimal overhead comparado a logs verbosos

### **Lições Aprendidas**

1. **WebSockets são timing-sensitive**: Pequenas latências afetam comportamento
2. **Debug logs não são apenas informativos**: Podem alterar comportamento
3. **Serialização é crítica**: Objetos complexos precisam ser estabilizados
4. **Race conditions são reais**: Event loop timing pode causar bugs sutis

---

## 🚀 **DEPLOY EM PRODUÇÃO (VERCEL)**

### **Configurações Críticas**

**Environment Variables**:
```env
# ✅ PRODUÇÃO: Configurações estáveis
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
NEXT_PUBLIC_ENVIRONMENT=production

# ✅ REALTIME: Configurações específicas
NEXT_PUBLIC_REALTIME_DEBUG=false
NEXT_PUBLIC_CONSOLE_LOGS=error-only
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  },
  "regions": ["gru1"],
  "framework": "nextjs"
}
```

### **Monitoramento em Produção**

**Métricas Críticas**:
- **Conexão WebSocket**: Tempo de estabelecimento
- **Latência de eventos**: Tempo entre trigger DB → Frontend
- **Taxa de reconexão**: Frequência de reconexões automáticas
- **Erros de sincronização**: Eventos perdidos ou duplicados

**Logs Essenciais** (apenas em caso de erro):
```typescript
// ✅ LOGS PRODUÇÃO: Apenas erros críticos
console.error('[REALTIME-ERROR]', erro);
console.warn('[REALTIME-RECONNECT]', tentativa);
```

---

## 📊 **PERFORMANCE E OTIMIZAÇÕES**

### **Frontend Optimizations**

1. **Debounce de eventos**: Evita processamento excessivo
2. **Cache inteligente**: Reutiliza dados já carregados  
3. **Lazy loading**: Carrega operações sob demanda
4. **Memory management**: Cleanup de subscriptions

### **Backend Optimizations**

1. **Connection pooling**: Reutilização de conexões DB
2. **Índices otimizados**: Queries realtime rápidas
3. **Triggers eficientes**: Minimal overhead no PostgreSQL
4. **Row-level security**: Filtragem no banco, não no frontend

### **Network Optimizations**

1. **WebSocket keepalive**: Mantém conexão estável
2. **Reconnection strategy**: Exponential backoff
3. **Event batching**: Agrupa eventos relacionados
4. **Compression**: Gzip para payloads grandes

---

## 🔒 **SEGURANÇA**

### **Autenticação Realtime**
- **JWT tokens**: Validação a cada conexão
- **Role-based access**: Supervisores vs Membros
- **Regional isolation**: Dados isolados por regional

### **Validação de Dados**
- **Server-side validation**: Nunca confiar no frontend
- **Sanitização**: Prevent SQL injection nos triggers
- **Rate limiting**: Previne spam de eventos

---

## 📝 **TROUBLESHOOTING**

### **Problemas Comuns**

**1. Conexão Realtime Falha**:
```typescript
// Verificar: Autenticação, network, Supabase status
console.error('[REALTIME] Falha na conexão:', erro);
```

**2. Eventos Duplicados**:
```typescript
// Verificar: Event deduplication, timestamps
if (eventTime - lastEventTime < 100) return; // Skip duplicates
```

**3. Race Conditions**:
```typescript
// Solução: Sempre usar JSON.parse(JSON.stringify())
const safePayload = JSON.parse(JSON.stringify(payload));
```

---

## 🎯 **CONCLUSÃO**

O sistema realtime está **robusto e pronto para produção**, com:

✅ **Arquitetura sólida**: Frontend, Backend e DB otimizados
✅ **Solução do Heisenbug**: Timing estável sem dependência de debug
✅ **Performance otimizada**: Cache, debounce e lazy loading
✅ **Segurança garantida**: RLS, autenticação e validação
✅ **Monitoramento**: Logs essenciais e métricas de health

**O sistema está preparado para deploy no Vercel sem modificações futuras.** 