# Padronização dos Botões - Modal e Grid do Calendário

## 🎯 Objetivo

Garantir que os botões do modal e da grid do calendário funcionem **exatamente igual**, usando as mesmas APIs e a mesma lógica de estados.

## 🔧 Problemas Identificados e Corrigidos

### 1. **APIs Diferentes**

#### ❌ **ANTES - APIs Inconsistentes**
```typescript
// Calendário Principal (Grid)
fetch('/api/participations', {
  body: JSON.stringify({
    action: 'participate',
    operacaoId,
    membroId: membroAtual
  })
});

// OperacaoDialog (Modal)
fetch('/api/participations', {
  body: JSON.stringify({
    action: 'join',                    // ❌ Diferente
    operationId: operacaoId.toString(), // ❌ Diferente
    membroId: membroIdLocal
  })
});
```

#### ✅ **DEPOIS - APIs Padronizadas**
```typescript
// Ambos usam exatamente a mesma API
fetch('/api/participations', {
  body: JSON.stringify({
    action: 'participate',  // ✅ Igual
    operacaoId,            // ✅ Igual
    membroId: membroId     // ✅ Igual
  })
});
```

### 2. **Lógica de Estados Diferente**

#### ❌ **ANTES - Lógicas Inconsistentes**
- **Grid**: Lógica simples com 4 estados básicos
- **Modal**: Lógica complexa com estados detalhados

#### ✅ **DEPOIS - Lógica Unificada**
```typescript
// Função getEstadoVisualInfo() padronizada
const getEstadoVisualInfo = (operacao: Operacao) => {
  const estado = operacao.minha_participacao?.estado_visual;
  
  // 1. Se tem participação → CANCELAR
  if (estado === 'CONFIRMADO' || estado === 'ADICIONADO_SUP') {
    return { buttonText: 'CANCELAR', buttonClass: 'cancel', buttonAction: 'cancelar' };
  }
  
  if (estado === 'PENDENTE' || estado === 'NA_FILA') {
    return { buttonText: 'CANCELAR', buttonClass: 'cancel', buttonAction: 'cancelar' };
  }
  
  // 2. Se não tem participação → calcular disponibilidade
  const confirmados = operacao.participantes_confirmados || 0;
  const totalSolicitacoes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0;
  const limite = operacao.limite_participantes;
  const totalOcupado = confirmados + totalSolicitacoes;
  const limiteTotal = limite * 2;
  
  if (totalOcupado < limiteTotal) {
    if (confirmados < limite) {
      return { buttonText: 'EU VOU', buttonClass: 'participate', buttonAction: 'participar' };
    } else {
      return { buttonText: 'ENTRAR NA FILA', buttonClass: 'queue', buttonAction: 'participar' };
    }
  } else {
    return { buttonText: 'LOTADO', buttonClass: 'full', buttonAction: 'lotado' };
  }
};
```

### 3. **Mensagens de Toast Diferentes**

#### ❌ **ANTES**
- **Grid**: `'Participação confirmada!'`
- **Modal**: `data.data.mensagem || 'Participação confirmada!'`

#### ✅ **DEPOIS**
```typescript
// Ambos usam mensagens padronizadas
if (data.success) {
  toast.success('Participação confirmada!');
} else {
  toast.error(data.error || 'Erro ao confirmar participação');
}
```

## 🔄 Fluxo Unificado

### **Estados dos Botões (Grid e Modal)**
1. **DISPONÍVEL** → `EU VOU` (verde)
2. **CONFIRMADO/PENDENTE/NA_FILA** → `CANCELAR` (vermelho)
3. **OPERAÇÃO CHEIA** → `ENTRAR NA FILA` (amarelo)
4. **TUDO LOTADO** → `LOTADO` (cinza, não clicável)

### **APIs Unificadas**
```typescript
// EU VOU / ENTRAR NA FILA
POST /api/participations
{
  "action": "participate",
  "operacaoId": 123,
  "membroId": "35"
}

// CANCELAR
POST /api/agendamento/cancelar
{
  "operacaoId": 123,
  "membroId": "35"
}
```

### **Realtime Sincronizado**
- Ambos escutam o mesmo canal: `calendario-membro-${membroId}`
- Ambos atualizam quando há mudanças em `operacao` ou `participacao`
- Estados sincronizam automaticamente entre grid e modal

## ✅ Resultado Final

### **Comportamento Idêntico**
- ✅ **Mesmas APIs** para todas as ações
- ✅ **Mesma lógica** de estados dos botões
- ✅ **Mesmas mensagens** de feedback
- ✅ **Mesmo realtime** para sincronização
- ✅ **Mesmos estilos** visuais

### **Experiência do Usuário**
- ✅ Botão na grid e no modal sempre mostram o mesmo estado
- ✅ Ação em qualquer botão atualiza ambos instantaneamente
- ✅ Feedback consistente em toda a aplicação
- ✅ Comportamento previsível e intuitivo

## 🚀 Como Testar

1. **Abra o calendário** → Veja botão na grid
2. **Clique na data** → Abra o modal
3. **Compare os botões** → Devem ser idênticos
4. **Clique em qualquer botão** → Ambos devem atualizar
5. **Teste realtime** → Abra duas abas e veja sincronização

---

**Botões da grid e modal funcionando identicamente!** 🎉