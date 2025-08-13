# API de Inativação Múltipla de Operações

## Endpoint
`POST /api/supervisor/operacoes/inativar-multiplas`

## Descrição
Esta API permite que supervisores inativem ou reativem múltiplas operações de uma só vez. Operações inativadas ficam marcadas como "históricas" e não permitem mais interação dos membros.

## Payload

### Inativar Operações
```json
{
  "operacaoIds": [1, 2, 3, 4],
  "inativar": true,
  "motivo": "Operações canceladas devido a problemas técnicos",
  "supervisorId": 123
}
```

### Reativar Operações
```json
{
  "operacaoIds": [1, 2, 3, 4],
  "inativar": false,
  "supervisorId": 123
}
```

## Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `operacaoIds` | `number[]` | ✅ | Array com IDs das operações a serem processadas |
| `inativar` | `boolean` | ✅ | `true` para inativar, `false` para reativar |
| `motivo` | `string` | ❌ | Motivo da inativação (opcional, apenas para inativar) |
| `supervisorId` | `number` | ❌ | ID do supervisor que está fazendo a operação |

## Respostas

### Sucesso (200)
```json
{
  "success": true,
  "data": {
    "operacoesProcessadas": 3,
    "operacoes": [
      {
        "id": 1,
        "data_operacao": "2025-08-15",
        "modalidade": "BLITZ",
        "turno": "MANHA",
        "inativa_pelo_supervisor": true,
        "data_inativacao": "2025-08-12T22:30:00.000Z"
      }
    ],
    "acao": "inativadas"
  },
  "message": "3 operação(ões) inativadas com sucesso",
  "boundedContext": "supervisor",
  "timestamp": "2025-08-12T22:30:00.000Z"
}
```

### Erro - Validação (400)
```json
{
  "success": false,
  "error": "Array de IDs de operações é obrigatório",
  "boundedContext": "supervisor"
}
```

### Erro - Operações não encontradas (404)
```json
{
  "success": false,
  "error": "Algumas operações não foram encontradas ou estão inativas",
  "operacoesNaoEncontradas": [99999, 99998],
  "boundedContext": "supervisor"
}
```

### Erro - Servidor (500)
```json
{
  "success": false,
  "error": "Erro interno do servidor",
  "boundedContext": "supervisor"
}
```

## Regras de Negócio

1. **Validação de Existência**: Todas as operações devem existir e estar ativas
2. **Campos de Inativação**: Ao inativar, os campos `inativa_pelo_supervisor`, `data_inativacao`, `motivo_inativacao` e `supervisor_inativacao_id` são preenchidos
3. **Limpeza na Reativação**: Ao reativar, todos os campos de inativação são limpos (definidos como `null` ou `false`)
4. **Atomicidade**: Todas as operações são processadas em uma única transação

## Exemplo de Uso com JavaScript

```javascript
// Inativar operações
const inativarOperacoes = async (operacaoIds, motivo, supervisorId) => {
  try {
    const response = await fetch('/api/supervisor/operacoes/inativar-multiplas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operacaoIds,
        inativar: true,
        motivo,
        supervisorId
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`${data.data.operacoesProcessadas} operações inativadas`);
      return data.data.operacoes;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Erro ao inativar operações:', error);
    throw error;
  }
};

// Reativar operações
const reativarOperacoes = async (operacaoIds, supervisorId) => {
  try {
    const response = await fetch('/api/supervisor/operacoes/inativar-multiplas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operacaoIds,
        inativar: false,
        supervisorId
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`${data.data.operacoesProcessadas} operações reativadas`);
      return data.data.operacoes;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Erro ao reativar operações:', error);
    throw error;
  }
};
```

## Integração com Realtime

A API atualiza as operações no banco de dados, e as mudanças são automaticamente propagadas via Supabase Realtime para todos os clientes conectados. Isso garante que:

- O portal do supervisor seja atualizado em tempo real
- O portal dos membros reflita imediatamente as operações inativadas
- Não há necessidade de refresh manual das páginas

## Requisitos Atendidos

Esta API atende aos seguintes requisitos da especificação:

- **Requirement 1.3**: Processar array de IDs de operações para inativar/reativar
- **Requirement 2.2**: Validar permissões de supervisor e regional (TODO: implementar autenticação)