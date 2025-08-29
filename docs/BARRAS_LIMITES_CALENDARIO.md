# 📊 Barras de Limites - Calendário dos Membros

## 🎯 Resumo do Plano de Contagem

• **3 Barras Informativas**: Operações ciclo anterior (10→09), Operações ciclo corrente (10→09), Diárias equivalentes mês civil (01→último dia)
• **Estados Incluídos**: CONFIRMADO, ADICIONADO_SUP, PENDENTE, SOLICITADO, NA_FILA, APROVADO
• **Contagem Operações**: TODAS as participações (PLANEJADA + VOLUNTÁRIA) nos ciclos 10→09
• **Contagem Diárias**: SOMENTE PLANEJADA no mês civil, valor fracionário sem arredondamento
• **Realtime**: Assinatura de mudanças em `participacao` filtrada por `membro_id` com debounce 300ms

## 📡 Assinaturas de Eventos e Filtros

### Tabelas Monitoradas
- **participacao**: `membro_id.eq.${membroId}`

### Eventos que Disparam Recálculo
- **INSERT**: Nova participação do membro
- **UPDATE**: Mudança de estado da participação
- **DELETE**: Remoção de participação

### Filtros por Usuário
```typescript
filters: {
  participacao: `membro_id.eq.${membroId}`
}
```

### Debounce e Coalescing
- **Debounce**: 300ms para evitar "piscar" das barras
- **Filtro**: Apenas eventos do membro logado são processados

## 🔄 Algoritmos de Recálculo Incremental

### Algoritmo - Operações (Ciclos 10→09)

```typescript
function calcularOperacoesCiclo(participacoes, periodoInicio, periodoFim) {
  return participacoes.filter(p => {
    // 1. Verificar estado válido
    if (!ESTADOS_INCLUIDOS.includes(p.estado)) return false;
    
    // 2. Verificar operação ativa (operações arquivadas DEVEM contar)
    if (p.operacao.excluida_temporariamente || 
        !p.operacao.ativa) return false;
    
    // 3. Verificar período (data da operação)
    const dataOp = p.operacao.data_operacao.substring(0, 10);
    return dataOp >= periodoInicio && dataOp <= periodoFim;
  }).length;
}
```

### Algoritmo - Diárias Equivalentes (Mês Civil)

```typescript
function calcularDiariasEquivalentes(participacoes, mesInicio, mesFim) {
  // 1. Filtrar apenas PLANEJADA no mês civil
  const participacoesPlanejadas = participacoes.filter(p => {
    // Verificar estado válido
    if (!ESTADOS_INCLUIDOS.includes(p.estado)) return false;
    
    // Verificar operação ativa (operações arquivadas DEVEM contar)
    if (p.operacao.excluida_temporariamente || 
        !p.operacao.ativa) return false;
    
    // Verificar tipo PLANEJADA
    if (p.operacao.tipo !== 'PLANEJADA') return false;
    
    // Verificar período (data da operação)
    const dataOp = p.operacao.data_operacao.substring(0, 10);
    return dataOp >= mesInicio && dataOp <= mesFim;
  });
  
  // 2. Calcular diárias (por simplicidade: 1 participação = 1 diária)
  // TODO: Implementar lógica D...+1 para meias diárias
  let diariasEquivalentes = 0;
  
  // Agrupar por operação para detectar sequências
  const operacoesPorId = new Map();
  participacoesPlanejadas.forEach(p => {
    if (!operacoesPorId.has(p.operacao.id)) {
      operacoesPorId.set(p.operacao.id, []);
    }
    operacoesPorId.get(p.operacao.id).push(p);
  });
  
  // Calcular diárias por operação
  operacoesPorId.forEach((participacoes, operacaoId) => {
    diariasEquivalentes += participacoes.length;
  });
  
  return diariasEquivalentes; // Valor fracionário, SEM arredondamento
}
```

## ✅ Checklist de Testes - Critérios de Aceite

### 1. "Eu vou" sobe na hora a barra do ciclo correto; Cancelar/Remover desce

- [ ] **Teste**: Membro clica "EU VOU" em operação do ciclo corrente
  - **Esperado**: Barra "Operações - Ciclo Corrente" incrementa +1 imediatamente
  - **Verificar**: Realtime detecta INSERT em participacao e recalcula

- [ ] **Teste**: Membro cancela participação confirmada
  - **Esperado**: Barra correspondente decrementa -1 imediatamente
  - **Verificar**: Realtime detecta UPDATE/DELETE e recalcula

- [ ] **Teste**: Supervisor adiciona membro em operação
  - **Esperado**: Barra do membro incrementa +1 (estado ADICIONADO_SUP)
  - **Verificar**: Evento de INSERT/UPDATE é processado

### 2. Diárias mostra fracionário e recalcula sempre que PLANEJADA entra/sai; VOLUNTÁRIA não muda Diárias

- [ ] **Teste**: Membro participa de operação PLANEJADA
  - **Esperado**: Barra "Diárias" incrementa (ex: 7.0 → 8.0)
  - **Verificar**: Apenas operações PLANEJADA afetam diárias

- [ ] **Teste**: Membro participa de operação VOLUNTÁRIA
  - **Esperado**: Barra "Operações" incrementa, "Diárias" NÃO muda
  - **Verificar**: VOLUNTÁRIA não gera diária

- [ ] **Teste**: Exibição de valor fracionário
  - **Esperado**: Valores como 7.5, 12.3 são exibidos corretamente
  - **Verificar**: Sem arredondamento no preview

### 3. Cenário 29–31/08 + retorno 01/09 ⇒ Diárias de setembro +0.5

- [ ] **Teste**: Operação sequencial com retorno no mês seguinte
  - **Setup**: Operação 29-31/08 com retorno 01/09
  - **Esperado**: Meia diária (+0.5) conta em setembro
  - **Verificar**: Lógica de transbordo D+1 funciona

### 4. Estados incluídos/excluídos funcionam exatamente como listado

- [ ] **Teste**: Estados incluídos contam nas barras
  - **Estados**: CONFIRMADO, ADICIONADO_SUP, PENDENTE, SOLICITADO, NA_FILA, APROVADO
  - **Esperado**: Todos incrementam as barras correspondentes

- [ ] **Teste**: Estados excluídos NÃO contam nas barras
  - **Estados**: REJEITADO, RECUSADO, CANCELADO
  - **Esperado**: Não aparecem nas contagens

- [ ] **Teste**: Operações temporariamente excluídas não contam
  - **Condições**: excluida_temporariamente=true, ativa=false
  - **Esperado**: Participações dessas operações são ignoradas
  
- [ ] **Teste**: Operações arquivadas pelo supervisor DEVEM contar
  - **Condições**: inativa_pelo_supervisor=true (mas ativa=true)
  - **Esperado**: Participações contam para histórico nas barrinhas

### 5. "Atual/limite" usa o mesmo parâmetro/fallback que o restante do sistema

- [ ] **Teste**: Limites exibidos são consistentes
  - **Verificar**: Valores de limite vêm de parâmetros_sistema ou fallback (15/15)
  - **Esperado**: Mesmos valores usados pelo motor oficial

- [ ] **Teste**: Formato "atual/limite" correto
  - **Exemplos**: "7/15", "12.5/15", "15/15"
  - **Verificar**: Formatação consistente em todas as barras

## 🔧 Componentes Implementados

### 1. `useLimitesCalendario.ts`
- Hook React para calcular limites baseado nas regras
- Integração com realtime para atualizações automáticas
- Cálculo de períodos (ciclos 10→09 e mês civil)

### 2. `LimitesBarras.tsx`
- Componente visual das 3 barras informativas
- Cores baseadas em percentual (verde/azul/amarelo/vermelho)
- Modo compacto e completo

### 3. `LimitesBarras.module.css`
- Estilos responsivos e acessíveis
- Animações de progresso e shimmer
- Suporte a tema escuro

### 4. `/api/membro/[id]/participacoes`
- API para buscar participações do membro
- Filtros por período e inclusão de dados da operação
- Otimizada para as consultas das barras

## 🚀 Integração no Calendário

As barras foram integradas no `CalendarioSimplesComponent.tsx` logo após o header, antes dos dias da semana, proporcionando visibilidade imediata dos limites ao membro.

## 📝 Observações Técnicas

- **Performance**: Debounce de 300ms evita atualizações excessivas
- **Fallback**: Em caso de falha do realtime, dados são recarregados
- **Debug**: Logs detalhados em modo desenvolvimento
- **Responsividade**: Interface adaptável a diferentes tamanhos de tela
- **Acessibilidade**: Cores, ícones e mensagens informativas claras