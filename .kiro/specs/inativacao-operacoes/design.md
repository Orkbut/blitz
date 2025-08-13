# Design Document

## Overview

A funcionalidade de inativação de operações permite supervisores marcar operações como "históricas" através de um modal com calendário interativo. Operações inativas ficam visíveis mas sem interação para membros, com estilo visual diferenciado. Supervisores podem reativar operações a qualquer momento.

## Architecture

### Database Schema Changes

```sql
-- Adicionar campos na tabela operacao
ALTER TABLE operacao 
ADD COLUMN inativa_pelo_supervisor boolean DEFAULT false,
ADD COLUMN data_inativacao timestamp with time zone,
ADD COLUMN motivo_inativacao text,
ADD COLUMN supervisor_inativacao_id integer;

-- Índice para performance
CREATE INDEX idx_operacao_inativa_supervisor 
ON operacao(inativa_pelo_supervisor) 
WHERE inativa_pelo_supervisor = true;
```

### API Endpoints

#### POST /api/supervisor/operacoes/inativar-multiplas
```typescript
// Inativar/reativar múltiplas operações
{
  operacaoIds: number[],
  inativar: boolean, // true = inativar, false = reativar
  motivo?: string // opcional
}
```

#### Modificação nas APIs existentes
- `/api/membro/participacao/solicitar` - verificar se operação está inativa
- `/api/membro/participacao/cancelar` - verificar se operação está inativa
- `/api/supervisor/janelas/[id]/excluir` - verificar operações inativas na janela

## Components and Interfaces

### 1. Botão de Inativação (CalendarioSupervisor.tsx)
```tsx
// Botão no cabeçalho do calendário
<button onClick={() => setModalInativacaoAberto(true)}>
  📁 Inativar Operações
</button>
```

### 2. Modal de Inativação (ModalInativacaoOperacoes.tsx)
```tsx
interface ModalInativacaoProps {
  isOpen: boolean;
  onClose: () => void;
  janelaId: number;
  onOperacoesAlteradas: () => void;
}

// Componente com:
// - Calendário pequeno mostrando operações da janela atual
// - Checkbox para selecionar operações
// - Botões "Inativar Selecionadas" / "Reativar Selecionadas"
// - Campo opcional para motivo
```

### 3. Estilização de Operações Inativas
```css
.operacao-inativa {
  opacity: 0.7;
  filter: grayscale(50%);
  position: relative;
}

.operacao-inativa::after {
  content: "HISTÓRICO";
  position: absolute;
  top: 2px;
  right: -8px;
  background: linear-gradient(45deg, #6b7280, #4b5563);
  color: white;
  font-size: 0.5rem;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 2px;
  transform: rotate(12deg);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  z-index: 10;
}
```

### 4. Modificações no Portal do Membro
```tsx
// CalendarioMembro.tsx - renderização de operações
const renderOperacao = (operacao: Operacao) => {
  const isInativa = operacao.inativa_pelo_supervisor;
  
  return (
    <div className={`operacao-card ${isInativa ? 'operacao-inativa' : ''}`}>
      {/* Conteúdo da operação */}
      
      <div className="acoes-operacao">
        {!isInativa ? (
          <>
            <button onClick={() => solicitarParticipacao(operacao.id)}>
              Eu Vou
            </button>
            <button onClick={() => cancelarParticipacao(operacao.id)}>
              Cancelar
            </button>
          </>
        ) : (
          <div className="acoes-desabilitadas">
            <span className="texto-historico">📁 Histórico</span>
          </div>
        )}
      </div>
    </div>
  );
};
```

## Data Models

### Operacao Interface Extension
```typescript
interface Operacao {
  // campos existentes...
  inativa_pelo_supervisor?: boolean;
  data_inativacao?: string;
  motivo_inativacao?: string;
  supervisor_inativacao_id?: number;
}
```

### Estado do Modal
```typescript
interface ModalInativacaoState {
  operacoesSelecionadas: Set<number>;
  operacoes: Operacao[];
  loading: boolean;
  motivo: string;
}
```

## Error Handling

### Validações de Negócio
1. **Exclusão de Janela**: Verificar se existem operações inativas antes de permitir exclusão
2. **APIs de Participação**: Retornar erro específico para operações inativas
3. **Permissões**: Apenas supervisores podem inativar/reativar operações

### Mensagens de Erro
```typescript
const ERRORS = {
  OPERACAO_INATIVA: 'Esta operação está no histórico e não aceita mais solicitações',
  JANELA_COM_OPERACOES_INATIVAS: 'Não é possível excluir janela com operações inativas: {operacoes}',
  SEM_PERMISSAO: 'Apenas supervisores podem inativar operações'
};
```

## Testing Strategy

### Testes Unitários
1. **Modal de Inativação**: Seleção de operações, chamadas de API
2. **Estilização**: Renderização correta de operações inativas
3. **Validações**: Bloqueio de APIs para operações inativas

### Testes de Integração
1. **Fluxo Supervisor**: Inativar → visualizar → reativar operações
2. **Fluxo Membro**: Visualizar operações inativas, tentar interagir
3. **Exclusão de Janela**: Verificar bloqueio com operações inativas

### Cenários de Teste
```typescript
// Cenários principais
describe('Inativação de Operações', () => {
  test('Supervisor pode inativar múltiplas operações');
  test('Supervisor pode reativar operações inativadas');
  test('Membro vê operações inativas com estilo diferenciado');
  test('Membro não pode interagir com operações inativas');
  test('Sistema bloqueia exclusão de janela com operações inativas');
});
```

## Implementation Flow

### 1. Backend (Database + APIs)
- Migração do banco de dados
- API para inativar/reativar múltiplas operações
- Modificar APIs de participação para verificar status
- Modificar API de exclusão de janela

### 2. Frontend Supervisor
- Botão "Inativar Operações" no cabeçalho
- Modal com calendário para seleção de operações
- Integração com realtime para atualização automática

### 3. Frontend Membro
- Estilização de operações inativas
- Desabilitação de botões de ação
- Atualização em tempo real via realtime

### 4. Validações e Testes
- Testes unitários e de integração
- Validação de permissões e regras de negócio