# 🔍 INSTRUMENTAÇÃO COMPLETA PARA DEBUGGING DOS MODAIS

## 📋 Resumo

Este documento descreve todas as instrumentações implementadas para identificar e corrigir inconsistências entre o banco de dados Supabase e os modais do frontend.

## 🎯 Objetivo

**O banco de dados é a fonte da verdade.** Qualquer inconsistência entre o que está no banco e o que aparece no frontend deve ser corrigida no frontend.

## 🔍 Pontos de Instrumentação

### 1. **API Unified Operações** (`/api/unified/operacoes/route.ts`)

**Logs implementados:**
- `🔍 [API-UNIFIED] ========== NOVA REQUISIÇÃO ==========`
- `🔍 [API-UNIFIED] Parâmetros recebidos`
- `🔍 [API-UNIFIED] Operações brutas do Supabase`
- `🔍 [API-UNIFIED] ========== PROCESSANDO OPERAÇÃO X ==========`
- `🔍 [API-UNIFIED] Dados brutos da operação`
- `🔍 [API-UNIFIED] Participações brutas`
- `🔍 [API-UNIFIED] Participações ATIVAS filtradas`
- `🔍 [API-UNIFIED] Contadores calculados`
- `🔍 [API-UNIFIED] SUPERVISOR - Participantes formatados`
- `🔍 [API-UNIFIED] PADRÃO - Resultado final`
- `🔍 [API-UNIFIED] ========== RESULTADO FINAL ==========`

**O que mostra:**
- Parâmetros da requisição
- Dados brutos do Supabase
- Filtragem de participações ativas
- Contadores de confirmados vs pendentes
- Formato final enviado para o frontend

### 2. **Hook useOperacoes** (`/hooks/useOperacoes.ts`)

**Logs implementados:**
- `🔍 [HOOK-OPERACOES] ========== INICIANDO FETCH ==========`
- `🔍 [HOOK-OPERACOES] Parâmetros`
- `🔍 [HOOK-OPERACOES] URL da requisição`
- `🔍 [HOOK-OPERACOES] Status da resposta`
- `🔍 [HOOK-OPERACOES] Resposta completa da API`
- `🔍 [HOOK-OPERACOES] ========== OPERAÇÕES RECEBIDAS ==========`
- `🔍 [HOOK-OPERACOES] Operação X`
- `🔍 [HOOK-OPERACOES] Minha participação na Op X`
- `🔍 [HOOK-OPERACOES] Participantes confirmados Op X`
- `🔍 [HOOK-OPERACOES] Fila/Pendentes Op X`
- `🔍 [HOOK-OPERACOES] ✅ Estado atualizado`
- `🔍 [HOOK-OPERACOES] ========== FETCH FINALIZADO ==========`

**O que mostra:**
- Dados recebidos da API
- Processamento no hook
- Estado final do hook

### 3. **Modal do Membro** (`/components/calendario/OperacaoDialog.tsx`)

**Logs implementados:**
- `🔍 [MODAL-MEMBRO] ========== MODAL ABERTO ==========`
- `🔍 [MODAL-MEMBRO] Data selecionada`
- `🔍 [MODAL-MEMBRO] Operações recebidas`
- `🔍 [MODAL-MEMBRO] ========== OPERAÇÃO X ==========`
- `🔍 [MODAL-MEMBRO] Participantes confirmados detalhados`
- `🔍 [MODAL-MEMBRO] Fila/Pendentes detalhados`
- `🔍 [MODAL-MEMBRO] ========== CALCULANDO ESTADO VISUAL ==========`
- `🔍 [MODAL-MEMBRO] Estado da minha participação`
- `🔍 [MODAL-MEMBRO] → RESULTADO: [STATUS]`

**O que mostra:**
- Dados recebidos no modal
- Cálculo do estado visual
- Lógica de botões (EU VOU, CANCELAR, etc.)

### 4. **Modal do Supervisor** (`/components/supervisor/GerenciarMembrosModal.tsx`)

**Logs implementados:**
- `🔍 [MODAL-SUPERVISOR] ========== CARREGANDO DADOS OTIMIZADOS ==========`
- `🔍 [MODAL-SUPERVISOR] Operação ID`
- `🔍 [MODAL-SUPERVISOR] URL da requisição`
- `🔍 [MODAL-SUPERVISOR] Status da resposta`
- `🔍 [MODAL-SUPERVISOR] Resposta completa da API`
- `🔍 [MODAL-SUPERVISOR] ========== OPERAÇÃO ENCONTRADA ==========`
- `🔍 [MODAL-SUPERVISOR] Participantes brutos`
- `🔍 [MODAL-SUPERVISOR] ========== PARTICIPANTES PROCESSADOS ==========`
- `🔍 [MODAL-SUPERVISOR] Confirmados`
- `🔍 [MODAL-SUPERVISOR] Pendentes/Fila`
- `🔍 [MODAL-SUPERVISOR] Aguardando Supervisor`
- `🔍 [MODAL-SUPERVISOR] ✅ Estados atualizados`
- `🔍 [MODAL-SUPERVISOR] ========== CARREGAMENTO FINALIZADO ==========`

**O que mostra:**
- Dados recebidos da API
- Processamento por estado (confirmados, pendentes, aguardando)
- Estados finais do modal

### 5. **API de Membros** (`/api/supervisor/membros/route.ts`)

**Logs implementados:**
- `🔍 [API-MEMBROS] ========== NOVA REQUISIÇÃO ==========`
- `🔍 [API-MEMBROS] Buscando lista de membros ativos`
- `🔍 [API-MEMBROS] Membros encontrados no Supabase`
- `🔍 [API-MEMBROS] ========== RESULTADO FINAL ==========`
- `✅ X membros ativos encontrados`

**O que mostra:**
- Lista de membros do banco
- Filtragem por membros ativos

## 🐛 Como Usar para Debugging

### Passo 1: Abrir o Console do Navegador
1. Pressione F12 ou Ctrl+Shift+I
2. Vá para a aba "Console"
3. Filtre por "API-UNIFIED", "HOOK-OPERACOES", "MODAL-MEMBRO", "MODAL-SUPERVISOR" ou "API-MEMBROS"

### Passo 2: Reproduzir o Problema
1. Abra o modal do calendário do membro
2. Ou abra o modal "Gerenciar Membros" do supervisor
3. Observe os logs em tempo real

### Passo 3: Comparar com o Banco
1. Use os logs para ver exatamente quais dados estão sendo enviados
2. Compare com uma consulta direta no banco de dados
3. Identifique onde está a inconsistência

## 📊 Exemplo de Análise

### Caso: "Ana Santos não aparece na fila do modal do membro"

**Logs esperados:**
```
🔍 [API-UNIFIED] Participações ATIVAS filtradas: [
  {
    "id": 123,
    "membro_id": 2,
    "estado_visual": "NA_FILA",
    "servidor_nome": "Ana Santos"
  }
]

🔍 [HOOK-OPERACOES] Fila/Pendentes Op 402: [
  {
    "id": 123,
    "servidor_nome": "Ana Santos",
    "posicao": 0
  }
]

🔍 [MODAL-MEMBRO] Fila/Pendentes detalhados: [
  {
    "id": 123,
    "servidor_nome": "Ana Santos",
    "posicao": 0
  }
]
```

**Se Ana Santos não aparecer nos logs acima, o problema está na:**
- API Unified (filtragem incorreta)
- Hook useOperacoes (processamento incorreto)
- Modal do membro (renderização incorreta)

## 🔧 Próximos Passos

1. **Executar testes** com os logs ativos
2. **Identificar inconsistências** comparando logs vs banco
3. **Corrigir** o ponto onde a inconsistência surge
4. **Remover logs** após correção (opcional)

## ⚠️ Importante

- Os logs são verbosos e podem impactar performance
- Use apenas em desenvolvimento/debugging
- Remova ou comente os logs em produção
- O banco de dados é sempre a fonte da verdade 