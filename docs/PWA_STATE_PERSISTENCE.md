# Sistema de Persistência de Estado PWA e Botão Voltar Nativo

## Visão Geral

Este sistema implementa duas funcionalidades principais para melhorar a experiência do usuário em PWAs:

1. **Persistência de Estado**: Salva automaticamente o estado da aplicação no `localStorage` e restaura quando o usuário retorna
2. **Botão Voltar Nativo**: Intercepta o botão voltar do navegador/dispositivo para fechar modais em ordem de prioridade

## 🔄 Persistência de Estado

### Hook: `usePWAState`

Localização: `src/hooks/usePWAState.ts`

#### Funcionalidades

- **Salvamento Automático**: Estado é salvo automaticamente em mudanças de rota
- **Restauração Inteligente**: Restaura estado apenas se for PWA e estiver na página inicial
- **Expiração**: Estado expira em 24 horas para evitar dados obsoletos
- **Detecção PWA**: Verifica se a aplicação está rodando como PWA

#### Estado Persistido

```typescript
interface PWAState {
  lastPath: string;           // Última rota visitada
  lastVisitedMonth: string;   // Último mês visualizado
  lastVisitedDate: string;    // Última data visitada
  userType: string;           // Tipo de usuário (admin, supervisor, membro)
  timestamp: number;          // Timestamp para expiração
}
```

#### Métodos Disponíveis

```typescript
const {
  saveState,      // Salvar estado manualmente
  restoreState,   // Restaurar estado (com verificação de expiração)
  getState,       // Obter estado atual
  clearState,     // Limpar estado
  isPWA          // Verificar se é PWA
} = usePWAState();
```

### Componente: `PWAStateManager`

Localização: `src/components/PWAStateManager.tsx`

#### Responsabilidades

- Integra `usePWAState` e `useNativeBackButton`
- Adiciona classes CSS ao body baseado no estado PWA
- Salva estado antes do app fechar
- Previne comportamento padrão do botão voltar quando há modais abertos

#### Classes CSS Adicionadas

- `pwa-app`: Quando a aplicação está rodando como PWA
- `pwa-restoring`: Quando está restaurando estado salvo

## ⬅️ Sistema de Botão Voltar Nativo

### Hook: `useNativeBackButton`

Localização: `src/hooks/useNativeBackButton.ts`

#### Funcionalidades

- **Stack de Modais**: Mantém uma pilha de modais abertos ordenada por prioridade
- **Interceptação**: Intercepta evento `popstate` (botão voltar)
- **Fechamento Ordenado**: Fecha modais em ordem de prioridade (maior primeiro)
- **Prevenção de Loop**: Evita loops infinitos no histórico

#### Métodos Principais

```typescript
const {
  registerModal,    // Registrar modal na stack
  unregisterModal,  // Remover modal da stack
  closeTopModal,    // Fechar modal com maior prioridade
  hasOpenModals,    // Verificar se há modais abertos
  getModalCount     // Obter número de modais abertos
} = useNativeBackButton();
```

### Hook: `useModalBackButton`

Hook simplificado para uso em modais individuais.

```typescript
useModalBackButton(
  'modal-id',        // ID único do modal
  isOpen,            // Estado de abertura do modal
  onClose,           // Função de fechamento
  priority           // Prioridade (maior = fecha primeiro)
);
```

#### Níveis de Prioridade Recomendados

- **20**: Modais críticos (confirmações, alertas)
- **15**: Modais de mídia (fotos, visualizadores)
- **10**: Modais principais (formulários, gerenciamento)
- **5**: Modais informativos (tooltips, ajuda)

## 🔧 Implementação

### 1. Configuração no Layout Principal

O `PWAStateManager` já está integrado no layout principal (`src/app/layout.tsx`):

```tsx
<body className={inter.className}>
  <RealtimeProvider>
    <PWAStateManager />
    <PWAInstaller />
    {children}
  </RealtimeProvider>
</body>
```

### 2. Uso em Modais

Para adicionar suporte ao botão voltar nativo em um modal:

```tsx
import { useModalBackButton } from '@/hooks/useNativeBackButton';

const MeuModal = ({ isOpen, onClose }) => {
  // Registrar modal para botão voltar nativo
  useModalBackButton('meu-modal', isOpen, onClose, 10);

  return (
    // JSX do modal
  );
};
```

### 3. Modais Já Implementados

Os seguintes modais já possuem suporte ao botão voltar nativo:

- `OperacaoDialog` (prioridade 10 e 20 para histórico)
- `GerenciarMembrosModal` (prioridade 10)
- `GerenciarMembrosModal_new` (prioridade 10)
- `CriarOperacaoModal` (prioridade 10)
- `CriarJanelaModal` (prioridade 10)
- `ModalOperacaoSupervisor` (prioridade 10)
- `ModalInativacaoOperacoes` (prioridade 10)
- `FotoOperacaoManager` (prioridade 15)
- `UniversalModal` (prioridade 5)

## 🎯 Benefícios

### Para Usuários PWA

1. **Continuidade**: Retorna exatamente onde parou
2. **Navegação Intuitiva**: Botão voltar funciona como esperado
3. **Experiência Nativa**: Comportamento similar a apps nativos

### Para Desenvolvedores

1. **Automático**: Funciona sem configuração adicional
2. **Flexível**: Prioridades customizáveis para modais
3. **Robusto**: Prevenção de loops e estados inconsistentes

## 🔍 Debugging

### Verificar Estado PWA

```javascript
// No console do navegador
console.log('É PWA:', window.matchMedia('(display-mode: standalone)').matches);
console.log('Estado salvo:', localStorage.getItem('pwa-state'));
```

### Verificar Stack de Modais

```javascript
// Adicionar no useNativeBackButton para debug
console.log('Modais abertos:', modalStack.current.length);
console.log('Stack atual:', modalStack.current);
```

## 🚀 Próximos Passos

1. **Métricas**: Adicionar analytics para uso do botão voltar
2. **Configuração**: Permitir configuração de tempo de expiração
3. **Sincronização**: Sincronizar estado entre abas (se necessário)
4. **Testes**: Adicionar testes automatizados para os hooks

## ⚠️ Considerações

- O estado é salvo apenas no `localStorage` (não sincroniza entre dispositivos)
- A expiração de 24 horas é fixa (pode ser configurável no futuro)
- O sistema funciona apenas em PWAs (detectado automaticamente)
- Modais devem ter IDs únicos para evitar conflitos