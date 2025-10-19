
# ANÁLISE DIMENSIONAL COMPLETA - "TODAS AS VEIAS E ARTÉRIAS"

## 📊 RESUMO DIMENSIONAL
- **Total de funções mapeadas:** 163
- **Funções públicas (RISCO ALTO):** 69
- **Funções privadas (RISCO BAIXO):** 94
- **Contratos públicos identificados:** 69
- **Pontos de impacto do usuário:** 7

## 🚨 FUNÇÕES PÚBLICAS - NÃO ALTERAR
- **useRealtimeEventos** (src/hooks/useRealtimeEventos.ts:25) - Contrato público
- **useRealtimeEventosOperacao** (src/hooks/useRealtimeEventos.ts:81) - Contrato público
- **POST** (src/app/api/eu-vou/route.ts:19) - Contrato público
- **GET** (src/app/api/eu-vou/route.ts:89) - Contrato público
- **GET** (src/app/api/test/route.ts:2) - Contrato público
- **POST** (src/app/api/test/route.ts:16) - Contrato público
- **GET** (src/app/api/test-realtime/route.ts:4) - Contrato público
- **POST** (src/app/api/test-realtime/route.ts:131) - Contrato público
- **GET** (src/app/api/test-supabase/route.ts:4) - Contrato público
- **POST** (src/app/api/admin/limpeza-operacoes-expiradas/route.ts:9) - Contrato público
- **GET** (src/app/api/admin/limpeza-operacoes-expiradas/route.ts:72) - Contrato público
- **GET** (src/app/api/admin/parametros/route.ts:5) - Contrato público
- **PUT** (src/app/api/admin/parametros/route.ts:39) - Contrato público
- **GET** (src/app/api/admin/stats/route.ts:5) - Contrato público
- **POST** (src/app/api/agendamento/cancelar/route.ts:5) - Contrato público
- **GET** (src/app/api/agendamento/cancelar/route.ts:123) - Contrato público
- **GET** (src/app/api/comunicacao/eventos-calendario/route.ts:10) - Contrato público
- **POST** (src/app/api/comunicacao/eventos-calendario/route.ts:85) - Contrato público
- **getEmojiPorCor** (src/app/api/comunicacao/eventos-calendario/route.ts:230) - Contrato público
- **getDescricaoPorTipo** (src/app/api/comunicacao/eventos-calendario/route.ts:240) - Contrato público
- **GET** (src/app/api/comunicacao/mensagens-regionais/route.ts:6) - Contrato público
- **POST** (src/app/api/comunicacao/mensagens-regionais/route.ts:68) - Contrato público
- **DELETE** (src/app/api/comunicacao/mensagens-regionais/route.ts:160) - Contrato público
- **GET** (src/app/api/dashboard/stats/route.ts:9) - Contrato público
- **GET** (src/app/api/debug/calculo-diarias/route.ts:33) - Contrato público
- **POST** (src/app/api/debug/calculo-diarias/route.ts:203) - Contrato público
- **GET** (src/app/api/supervisor/diretoria/route.ts:10) - Contrato público
- **POST** (src/app/api/supervisor/diretoria/route.ts:95) - Contrato público
- **encaminharParaDiretoria** (src/app/api/supervisor/diretoria/route.ts:148) - Contrato público
- **desencaminharDaDiretoria** (src/app/api/supervisor/diretoria/route.ts:238) - Contrato público
- **registrarRetornoDiretoria** (src/app/api/supervisor/diretoria/route.ts:292) - Contrato público
- **forceRealtimeUpdate** (src/app/api/supervisor/gerenciar-participacao/route.ts:20) - Contrato público
- **POST** (src/app/api/supervisor/gerenciar-participacao/route.ts:34) - Contrato público
- **promoverPrimeiroDaFila** (src/app/api/supervisor/gerenciar-participacao/route.ts:264) - Contrato público
- **reorganizarFilaAposRemocao** (src/app/api/supervisor/gerenciar-participacao/route.ts:311) - Contrato público
- **reorganizarFilaAposPromocao** (src/app/api/supervisor/gerenciar-participacao/route.ts:339) - Contrato público
- **GET** (src/app/api/supervisor/janelas-operacionais/route.ts:12) - Contrato público
- **POST** (src/app/api/supervisor/janelas-operacionais/route.ts:81) - Contrato público
- **DELETE** (src/app/api/supervisor/janelas-operacionais/route.ts:209) - Contrato público
- **PUT** (src/app/api/supervisor/janelas-operacionais/route.ts:295) - Contrato público
- **GET** (src/app/api/supervisor/membros/route.ts:5) - Contrato público
- **GET** (src/app/api/supervisor/operacoes/route.ts:10) - Contrato público
- **POST** (src/app/api/supervisor/operacoes/route.ts:77) - Contrato público
- **GET** (src/app/api/supervisor/solicitacoes/route.ts:6) - Contrato público
- **POST** (src/app/api/supervisor/solicitacoes/route.ts:107) - Contrato público
- **reorganizarFilaAposAprovacao** (src/app/api/supervisor/solicitacoes/route.ts:266) - Contrato público
- **promoverPrimeiroDaFila** (src/app/api/supervisor/solicitacoes/route.ts:301) - Contrato público
- **reorganizarFila** (src/app/api/supervisor/solicitacoes/route.ts:350) - Contrato público
- **GET** (src/app/api/unified/operacoes/route.ts:26) - Contrato público
- **POST** (src/app/api/agendamento/fila-espera/reorganizar/route.ts:8) - Contrato público
- **GET** (src/app/api/membro/[id]/limites-validacoes/route.ts:4) - Contrato público
- **promoverPrimeiroDaFila** (src/app/api/supervisor/solicitacoes/[id]/route.ts:5) - Contrato público
- **reorganizarFila** (src/app/api/supervisor/solicitacoes/[id]/route.ts:46) - Contrato público
- **forceRealtimeUpdate** (src/app/api/supervisor/solicitacoes/[id]/route.ts:73) - Contrato público
- **PUT** (src/app/api/supervisor/solicitacoes/[id]/route.ts:85) - Contrato público
- **GET** (src/app/api/agendamento/membros/[id]/participacoes/route.ts:4) - Contrato público
- **POST** (src/app/api/agendamento/operacoes/[id]/eu-vou/route.ts:4) - Contrato público
- **GET** (src/app/api/agendamento/operacoes/[id]/eu-vou/route.ts:75) - Contrato público
- **GET** (src/app/api/agendamento/operacoes/[id]/historico/route.ts:15) - Contrato público
- **GET** (src/app/api/agendamento/operacoes/[id]/posicao-fila/route.ts:9) - Contrato público
- **POST** (src/app/api/supervisor/operacoes/[id]/excluir-temporariamente/route.ts:4) - Contrato público
- **PUT** (src/app/api/supervisor/operacoes/[id]/horario/route.ts:10) - Contrato público
- **DELETE** (src/app/api/supervisor/operacoes/[id]/horario/route.ts:156) - Contrato público
- **POST** (src/app/api/supervisor/operacoes/[id]/reativar/route.ts:4) - Contrato público
- **TooltipTrigger** (src/components/supervisor/TooltipOperacaoIsolado.tsx:46) - Contrato público
- **TooltipOperacaoContent** (src/components/supervisor/TooltipOperacaoIsolado.tsx:210) - Contrato público
- **CalendarTooltipGroup** (src/components/supervisor/TooltipOperacaoIsolado.tsx:300) - Contrato público
- **LimitesServidorInfo** (src/shared/components/business/LimitesServidorInfo.tsx:24) - Contrato público
- **NotificacaoExclusaoOperacao** (src/shared/components/business/NotificacaoExclusaoOperacao.tsx:28) - Contrato público

## ✅ FUNÇÕES PRIVADAS - PODEM SER ALTERADAS
- **ClickInspector.logClick** (src/lib/logger.ts:64) - Lógica interna
- **ClickInspector.logRender** (src/lib/logger.ts:83) - Lógica interna
- **ClickInspector.inspecionar** (src/lib/logger.ts:102) - Lógica interna
- **ClickInspector.relatorioCircurgico** (src/lib/logger.ts:134) - Lógica interna
- **ClickInspector.limpar** (src/lib/logger.ts:153) - Lógica interna
- **ClickInspector.limparTudo** (src/lib/logger.ts:160) - Lógica interna
- **SmartLogger.shouldLog** (src/lib/logger.ts:191) - Lógica interna
- **SmartLogger.log** (src/lib/logger.ts:206) - Lógica interna
- **SmartLogger.error** (src/lib/logger.ts:228) - Lógica interna
- **SmartLogger.warn** (src/lib/logger.ts:232) - Lógica interna
... e mais 84 funções privadas

## 👤 PONTOS DE IMPACTO DO USUÁRIO FINAL

### MEMBRO (não pode sentir mudanças):
- **BOTAO:** Botão "Eu Vou" no CalendarioMembro (src/components/calendario/CalendarioMembro.tsx)
- **BOTAO:** Botão "Cancelar" no CalendarioMembro (src/components/calendario/CalendarioMembro.tsx)
- **CALENDARIO:** Calendário principal do membro (src/components/calendario/CalendarioMembro.tsx)

### SUPERVISOR (não pode sentir mudanças):
- **CALENDARIO:** Calendário do supervisor (src/components/supervisor/CalendarioSupervisor.tsx)
- **MODAL:** Modal Gerenciar Membros (src/components/supervisor/GerenciarMembrosModal.tsx)
- **FILA:** Visualização da fila de espera (src/components/supervisor/TimelineOperacoes.tsx)

## 🔄 FLUXOS COMPLETOS MAPEADOS

### FLUXO "EU VOU" (deve permanecer IDÊNTICO):
1. CalendarioMembro.tsx → handleEuVou
2. useOperacoes → chamada API
3. API /api/agendamento/operacoes/[id]/eu-vou → POST
4. EuVouOrchestrator.executar()
5. ValidadorParticipacao.validar()
6. SupabaseOperacaoRepository.buscarPorId()
7. SupabaseServidorRepository.buscarPorId()
8. Supabase Database → INSERT participacao
9. Realtime trigger → notificação
10. useRealtimeCentralized → detecta mudança
11. CalendarioMembro.tsx → re-render
12. CalendarioSupervisor.tsx → re-render

### FLUXO "CANCELAR" (deve permanecer IDÊNTICO):
1. CalendarioMembro.tsx → handleCancelar
2. API /api/agendamento/cancelar → POST
3. EuVouOrchestrator.cancelarParticipacao()
4. Supabase Database → UPDATE participacao (soft delete)
5. Realtime trigger → notificação
6. Interfaces → atualização automática

## 🔗 DEPENDÊNCIAS EXTERNAS CRÍTICAS
- Supabase Database - tabela operacao
- Supabase Database - tabela participacao
- Supabase Database - tabela servidor
- Supabase Realtime - triggers automáticos
- Frontend - contratos de API REST
- Frontend - hooks personalizados
- Frontend - componentes React
- Sistema de autenticação Supabase
- Jobs de limpeza automática
- Webhooks (se existirem)
- Integrações externas (se existirem)

## 🎯 ESTRATÉGIA DE REFATORAÇÃO SEGURA

### ✅ PODE ALTERAR (transparente ao usuário):
- Lógica interna de services (EuVouOrchestrator, ValidadorParticipacao)
- Implementação de repositories (mantendo interfaces)
- Algoritmos de cálculo e validação
- Otimizações de performance internas

### ⚠️ ALTERAR COM EXTREMO CUIDADO:
- APIs públicas (manter assinaturas exatas)
- Hooks públicos (manter comportamento exato)
- Components principais (manter props e comportamento)

### 🚫 JAMAIS ALTERAR:
- Contratos de APIs REST
- Assinaturas de hooks exportados
- Props de components públicos
- Estrutura do banco de dados
- Triggers de real-time

## 📋 VALIDAÇÃO DE IMPACTO ZERO

Para garantir que a refatoração seja transparente:

1. **TESTE CADA PONTO DE IMPACTO:**
   - Botão "Eu Vou" deve funcionar identicamente
   - Botão "Cancelar" deve funcionar identicamente
   - Modal de operação deve abrir/fechar igual
   - Calendário deve atualizar igual
   - Gerenciar membros deve funcionar igual

2. **VALIDAR TODOS OS FLUXOS:**
   - Fluxo completo "Eu Vou" deve ser idêntico
   - Fluxo completo "Cancelar" deve ser idêntico
   - Real-time deve atualizar na mesma velocidade
   - Validações devem retornar os mesmos resultados

3. **CONFIRMAR CONTRATOS:**
   - APIs devem retornar exatamente os mesmos dados
   - Hooks devem ter o mesmo comportamento
   - Components devem renderizar identicamente

---
*Análise dimensional gerada em: 2025-07-08T02:10:49.609Z*
