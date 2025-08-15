# Padrão de Formatação de Datas - Projeto EuVou

## 📋 Objetivo
Este documento estabelece o padrão único de formatação de datas para todo o projeto, garantindo consistência visual e evitando discrepâncias entre diferentes componentes.

## 🎯 Função Padrão

### `formatarDataBR(dataISO: string): string`

**Localização:** `src/lib/auth-utils.ts`

**Formato de saída:** `DD/MM/AAAA`

**Exemplo:**
- Input: `"2024-01-15T10:30:00.000Z"`
- Output: `"15/01/2024"`

## ✅ Regras de Uso

### 1. **SEMPRE usar `formatarDataBR`**
```typescript
// ✅ CORRETO
import { formatarDataBR } from '@/lib/auth-utils';
const dataFormatada = formatarDataBR(operacao.data_operacao);

// ❌ INCORRETO - Não criar funções locais
const formatarDataLocal = (data: string) => {
  // implementação local...
};
```

### 2. **Importação obrigatória**
```typescript
import { formatarDataBR } from '@/lib/auth-utils';
```

### 3. **Aplicação em todos os componentes**
- Modais de operações
- Cards de timeline
- Formulários de entrada
- Exibição de períodos
- Relatórios e listagens

## 🚫 Práticas Proibidas

### ❌ Funções locais duplicadas
```typescript
// NÃO FAZER - Função duplicada
const formatarDataBRLocal = (data: string) => {
  const [ano, mes, dia] = data.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
};

// NÃO FAZER - Função com nome diferente
const formatarDataComSemana = (data: string) => {
  // implementação...
};
```

### ❌ Formatação inline
```typescript
// NÃO FAZER - Formatação direta
const dataFormatada = new Date(data).toLocaleDateString('pt-BR');
```

### ❌ Problemas de Timezone
```typescript
// ❌ ERRADO - Causa problemas de timezone
const data = new Date('2025-09-01'); // Interpretado como UTC

// ✅ CORRETO - Adicionar horário para evitar problemas
const data = new Date('2025-09-01T12:00:00'); // Timezone local
```

## 📁 Componentes Padronizados

Os seguintes componentes foram atualizados para usar o padrão:

- ✅ `EditarJanelaModal.tsx`
- ✅ `CriarJanelaModal.tsx`
- ✅ `CriarOperacaoModal.tsx`
- ✅ `GerenciarMembrosModal.tsx`
- ✅ `GerenciarMembrosModal_new.tsx`
- ✅ `ModalInativacaoOperacoes.tsx`
- ✅ `ModalOperacaoSupervisor.tsx`

## 🔧 Funções Auxiliares Disponíveis

Além de `formatarDataBR`, o arquivo `auth-utils.ts` disponibiliza:

### `formatarDataHoraCompleta(dataISO: string): string`
- **Uso:** Quando precisar de data + hora
- **Formato:** `DD/MM/AAAA às HH:mm`

### `formatarPeriodoJanela(dataInicio: string, dataFim: string): string`
- **Uso:** Para exibir períodos de janelas
- **Formato:** `DD/MM/AAAA - DD/MM/AAAA`

### `obterDataAtualIguatu(): string`
- **Uso:** Para obter data atual no fuso horário de Iguatu
- **Formato:** ISO string

## 🎨 Exemplos de Uso

### Em componentes React
```typescript
import { formatarDataBR } from '@/lib/auth-utils';

const OperacaoCard = ({ operacao }) => {
  return (
    <div>
      <p>Data: {formatarDataBR(operacao.data_operacao)}</p>
    </div>
  );
};
```

### Em inputs de formulário
```typescript
<input 
  type="text" 
  value={formatarDataBR(janela.dataInicio)} 
  readOnly 
/>
```

### Em exibição de períodos
```typescript
<p>
  <strong>Período:</strong> {formatarDataBR(janela.dataInicio)} - {formatarDataBR(janela.dataFim)}
</p>
```

## 🔍 Verificação de Conformidade

Para verificar se um componente está seguindo o padrão:

1. ✅ Importa `formatarDataBR` de `@/lib/auth-utils`
2. ✅ Não possui funções locais de formatação de data
3. ✅ Usa `formatarDataBR` para todas as exibições de data
4. ✅ Mantém consistência visual em todo o componente

## 📝 Manutenção

- **Data de criação:** Janeiro 2024
- **Última atualização:** Janeiro 2024
- **Responsável:** Equipe de desenvolvimento
- **Revisão:** A cada nova funcionalidade que envolva datas

---

**⚠️ Importante:** Qualquer nova funcionalidade que envolva formatação de datas DEVE seguir este padrão. Em caso de necessidades específicas, discutir com a equipe antes de implementar soluções alternativas.