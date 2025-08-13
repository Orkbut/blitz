# Design Técnico - Otimização Gerenciar Membros

## Visão Geral

Este documento detalha a arquitetura técnica para otimizar o componente "Gerenciar Membros" seguindo princípios pragmáticos: **soluções simples, incrementais e que funcionam**. O design prioriza compatibilidade, manutenibilidade e performance usando ferramentas nativas do React.

## Arquitetura Atual vs. Proposta

### Estado Atual
```
GerenciarMembrosModal.tsx (1.2k linhas)
├── Estado complexo espalhado
├── Lógica misturada com apresentação  
├── Re-renders desnecessários
├── Logs de debug em produção
└── Interface não responsiva
```

### Arquitetura Proposta
```
GerenciarMembrosModal/
├── index.tsx (componente principal, ~100 linhas)
├── components/
│   ├── MemberList.tsx (~150 linhas)
│   ├── MemberForm.tsx (~150 linhas)
│   ├── MemberActions.tsx (~100 linhas)
│   └── LoadingStates.tsx (~50 linhas)
├── hooks/
│   ├── useMemberData.ts (~100 linhas)
│   ├── useMemberActions.ts (~100 linhas)
│   └── useResponsive.ts (~50 linhas)
└── utils/
    ├── memberValidation.ts (~50 linhas)
    └── constants.ts (~30 linhas)
```

## Componentes e Interfaces

### 1. Componente Principal (GerenciarMembrosModal)

```typescript
interface GerenciarMembrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  initialData?: MemberData[];
}

const GerenciarMembrosModal = memo(({ isOpen, onClose, serverId, initialData }) => {
  // Estado local simples
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Hooks customizados
  const { members, refreshMembers } = useMemberData(serverId);
  const { addMember, removeMember, updateMember } = useMemberActions(serverId);
  const { isMobile, isTablet } = useResponsive();
  
  // Memoização para performance
  const filteredMembers = useMemo(() => 
    members.filter(member => 
      member.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [members, searchTerm]
  );
  
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size={isMobile ? 'full' : 'large'}>
      <ModalHeader>
        <h2>Gerenciar Membros</h2>
        <SearchInput onSearch={handleSearch} />
      </ModalHeader>
      
      <ModalBody>
        {isLoading ? (
          <LoadingStates.MemberList />
        ) : (
          <MemberList 
            members={filteredMembers}
            onSelectMember={setSelectedMember}
            isMobile={isMobile}
          />
        )}
        
        {selectedMember && (
          <MemberForm 
            member={selectedMember}
            onSave={updateMember}
            onCancel={() => setSelectedMember(null)}
          />
        )}
      </ModalBody>
      
      <ModalFooter>
        <MemberActions 
          onAddMember={addMember}
          onRefresh={refreshMembers}
          disabled={isLoading}
        />
      </ModalFooter>
    </Modal>
  );
});
```

### 2. MemberList Component

```typescript
interface MemberListProps {
  members: Member[];
  onSelectMember: (member: Member) => void;
  isMobile: boolean;
}

const MemberList = memo(({ members, onSelectMember, isMobile }) => {
  // Renderização otimizada para listas grandes
  const renderMember = useCallback((member: Member) => (
    <MemberItem 
      key={member.id}
      member={member}
      onClick={() => onSelectMember(member)}
      compact={isMobile}
    />
  ), [onSelectMember, isMobile]);
  
  if (members.length === 0) {
    return <EmptyState message="Nenhum membro encontrado" />;
  }
  
  return (
    <div className={`member-list ${isMobile ? 'mobile' : 'desktop'}`}>
      {members.map(renderMember)}
    </div>
  );
});
```

### 3. Hooks Customizados

```typescript
// useMemberData.ts
export const useMemberData = (serverId: string) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/supervisor/membros?serverId=${serverId}`);
      setMembers(response.data);
    } catch (err) {
      setError('Erro ao carregar membros');
      console.error('Fetch members error:', err);
    } finally {
      setLoading(false);
    }
  }, [serverId]);
  
  useEffect(() => {
    if (serverId) {
      fetchMembers();
    }
  }, [serverId, fetchMembers]);
  
  return {
    members,
    loading,
    error,
    refreshMembers: fetchMembers
  };
};

// useMemberActions.ts
export const useMemberActions = (serverId: string) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const addMember = useCallback(async (memberData: CreateMemberData) => {
    setActionLoading('add');
    try {
      const response = await api.post('/supervisor/membros', {
        ...memberData,
        serverId
      });
      
      // Feedback visual
      toast.success('Membro adicionado com sucesso!');
      return response.data;
    } catch (error) {
      toast.error('Erro ao adicionar membro');
      throw error;
    } finally {
      setActionLoading(null);
    }
  }, [serverId]);
  
  const removeMember = useCallback(async (memberId: string) => {
    setActionLoading('remove');
    try {
      await api.delete(`/supervisor/membros/${memberId}`);
      toast.success('Membro removido com sucesso!');
    } catch (error) {
      toast.error('Erro ao remover membro');
      throw error;
    } finally {
      setActionLoading(null);
    }
  }, []);
  
  return {
    addMember,
    removeMember,
    actionLoading
  };
};

// useResponsive.ts
export const useResponsive = () => {
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return {
    isMobile: screenSize.width < 768,
    isTablet: screenSize.width >= 768 && screenSize.width < 1024,
    isDesktop: screenSize.width >= 1024
  };
};
```

## Modelos de Dados

### Interfaces TypeScript

```typescript
interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: Date;
  lastActive?: Date;
}

interface CreateMemberData {
  name: string;
  email: string;
  role: MemberRole;
}

interface UpdateMemberData extends Partial<CreateMemberData> {
  id: string;
}

enum MemberRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member'
}

enum MemberStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}
```

### Validação de Dados

```typescript
// memberValidation.ts
export const validateMemberData = (data: CreateMemberData): ValidationResult => {
  const errors: string[] = [];
  
  if (!data.name?.trim()) {
    errors.push('Nome é obrigatório');
  }
  
  if (!data.email?.trim()) {
    errors.push('Email é obrigatório');
  } else if (!isValidEmail(data.email)) {
    errors.push('Email inválido');
  }
  
  if (!Object.values(MemberRole).includes(data.role)) {
    errors.push('Função inválida');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

## Estratégia de Performance

### 1. Memoização Estratégica

```typescript
// Componentes que devem ser memoizados
const MemberList = memo(MemberListComponent);
const MemberItem = memo(MemberItemComponent);
const MemberForm = memo(MemberFormComponent);

// Callbacks estáveis
const handleMemberSelect = useCallback((member: Member) => {
  setSelectedMember(member);
}, []);

// Cálculos pesados memoizados
const filteredAndSortedMembers = useMemo(() => {
  return members
    .filter(member => member.name.includes(searchTerm))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [members, searchTerm]);
```

### 2. Otimização de Re-renders

```typescript
// Evitar objetos inline
const memberListProps = useMemo(() => ({
  members: filteredMembers,
  onSelectMember: handleMemberSelect,
  isMobile
}), [filteredMembers, handleMemberSelect, isMobile]);

return <MemberList {...memberListProps} />;
```

### 3. Loading States Inteligentes

```typescript
const LoadingStates = {
  MemberList: () => (
    <div className="member-list-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="member-item-skeleton">
          <div className="avatar-skeleton" />
          <div className="content-skeleton">
            <div className="name-skeleton" />
            <div className="email-skeleton" />
          </div>
        </div>
      ))}
    </div>
  ),
  
  MemberForm: () => (
    <div className="form-skeleton">
      <div className="input-skeleton" />
      <div className="input-skeleton" />
      <div className="button-skeleton" />
    </div>
  )
};
```

## Design Responsivo

### 1. Breakpoints CSS

```css
/* constants.css */
:root {
  --mobile-max: 767px;
  --tablet-min: 768px;
  --tablet-max: 1023px;
  --desktop-min: 1024px;
}

/* Componente principal */
.gerenciar-membros-modal {
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
}

@media (max-width: var(--mobile-max)) {
  .gerenciar-membros-modal {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
}

/* Lista de membros */
.member-list {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.member-list.desktop {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.member-list.mobile {
  grid-template-columns: 1fr;
}

/* Itens da lista */
.member-item {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.member-item:hover {
  border-color: #2196f3;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
}

@media (max-width: var(--mobile-max)) {
  .member-item {
    padding: 12px;
    min-height: 44px; /* Touch-friendly */
  }
}
```

### 2. Componentes Adaptativos

```typescript
const MemberItem = memo(({ member, onClick, compact }) => {
  return (
    <div 
      className={`member-item ${compact ? 'compact' : 'full'}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="member-avatar">
        <img src={member.avatar || '/default-avatar.png'} alt={member.name} />
      </div>
      
      <div className="member-info">
        <h3 className="member-name">{member.name}</h3>
        {!compact && <p className="member-email">{member.email}</p>}
        <span className={`member-role ${member.role}`}>
          {getRoleLabel(member.role)}
        </span>
      </div>
      
      <div className="member-status">
        <StatusIndicator status={member.status} />
      </div>
    </div>
  );
});
```

## Tratamento de Erros

### 1. Error Boundaries

```typescript
class MemberModalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MemberModal Error:', error, errorInfo);
    
    // Log para monitoramento (apenas em produção)
    if (process.env.NODE_ENV === 'production') {
      logError('member-modal', error, errorInfo);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    
    return this.props.children;
  }
}
```

### 2. Tratamento de Erros de API

```typescript
const handleApiError = (error: ApiError, context: string) => {
  const errorMessage = getErrorMessage(error);
  
  // Log estruturado
  console.error(`API Error [${context}]:`, {
    message: errorMessage,
    status: error.status,
    endpoint: error.config?.url,
    timestamp: new Date().toISOString()
  });
  
  // Feedback para usuário
  toast.error(errorMessage);
  
  // Métricas (se necessário)
  if (process.env.NODE_ENV === 'production') {
    trackError(context, error);
  }
};

const getErrorMessage = (error: ApiError): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  switch (error.response?.status) {
    case 400: return 'Dados inválidos';
    case 401: return 'Não autorizado';
    case 403: return 'Sem permissão';
    case 404: return 'Recurso não encontrado';
    case 500: return 'Erro interno do servidor';
    default: return 'Erro inesperado';
  }
};
```

## Estratégia de Testes

### 1. Testes de Componente

```typescript
// MemberList.test.tsx
describe('MemberList', () => {
  const mockMembers = [
    { id: '1', name: 'João', email: 'joao@test.com', role: 'member' },
    { id: '2', name: 'Maria', email: 'maria@test.com', role: 'admin' }
  ];
  
  it('should render member list correctly', () => {
    render(
      <MemberList 
        members={mockMembers}
        onSelectMember={jest.fn()}
        isMobile={false}
      />
    );
    
    expect(screen.getByText('João')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
  });
  
  it('should handle member selection', () => {
    const onSelectMember = jest.fn();
    
    render(
      <MemberList 
        members={mockMembers}
        onSelectMember={onSelectMember}
        isMobile={false}
      />
    );
    
    fireEvent.click(screen.getByText('João'));
    expect(onSelectMember).toHaveBeenCalledWith(mockMembers[0]);
  });
  
  it('should show empty state when no members', () => {
    render(
      <MemberList 
        members={[]}
        onSelectMember={jest.fn()}
        isMobile={false}
      />
    );
    
    expect(screen.getByText('Nenhum membro encontrado')).toBeInTheDocument();
  });
});
```

### 2. Testes de Performance

```typescript
// performance.test.tsx
describe('Performance Tests', () => {
  it('should not re-render unnecessarily', () => {
    const renderSpy = jest.fn();
    
    const TestComponent = memo(() => {
      renderSpy();
      return <div>Test</div>;
    });
    
    const { rerender } = render(<TestComponent />);
    
    // Primeira renderização
    expect(renderSpy).toHaveBeenCalledTimes(1);
    
    // Re-render com mesmas props
    rerender(<TestComponent />);
    expect(renderSpy).toHaveBeenCalledTimes(1); // Não deve re-renderizar
  });
});
```

## Migração e Compatibilidade

### 1. Estratégia de Migração

```typescript
// Feature flag para migração gradual
const useOptimizedMemberModal = () => {
  return process.env.REACT_APP_USE_OPTIMIZED_MODAL === 'true';
};

// Componente wrapper para transição
const GerenciarMembrosModalWrapper = (props) => {
  const useOptimized = useOptimizedMemberModal();
  
  if (useOptimized) {
    return <GerenciarMembrosModalOptimized {...props} />;
  }
  
  return <GerenciarMembrosModalLegacy {...props} />;
};
```

### 2. Backward Compatibility

```typescript
// Manter interface existente
interface LegacyProps {
  // Props antigas mantidas para compatibilidade
  modalOpen: boolean; // mapeado para isOpen
  closeModal: () => void; // mapeado para onClose
  serverData: any; // mapeado para serverId
}

const LegacyAdapter = ({ modalOpen, closeModal, serverData, ...rest }: LegacyProps) => {
  return (
    <GerenciarMembrosModal
      isOpen={modalOpen}
      onClose={closeModal}
      serverId={serverData?.id}
      {...rest}
    />
  );
};
```

## Monitoramento e Métricas

### 1. Métricas de Performance

```typescript
// Performance monitoring
const usePerformanceMonitoring = (componentName: string) => {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 100) { // Log apenas renders lentos
        console.warn(`Slow render detected in ${componentName}: ${renderTime}ms`);
      }
    };
  });
};
```

### 2. Métricas de Uso

```typescript
// Analytics simples
const trackUserAction = (action: string, data?: any) => {
  if (process.env.NODE_ENV === 'production') {
    // Enviar para analytics
    analytics.track('member_modal_action', {
      action,
      timestamp: Date.now(),
      ...data
    });
  }
};
```

Este design técnico prioriza **simplicidade, performance e manutenibilidade**, usando ferramentas nativas do React e padrões estabelecidos. A arquitetura permite migração gradual e mantém compatibilidade com o sistema existente.