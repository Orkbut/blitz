/**
 * Tipos TypeScript para GerenciarMembrosModal
 * 
 * Centraliza todas as interfaces e tipos utilizados
 * no módulo de gerenciamento de membros.
 */

export interface Membro {
  id: number;
  nome: string;
  matricula: string;
  perfil: string;
  ativo: boolean;
}

export interface OperacaoParticipacao {
  id: number;
  data_operacao: string;
  modalidade: string;
  tipo: string;
  turno: string;
  limite_participantes: number;
  participantes: Array<{
    id: number;
    membro_id: number;
    nome: string;
    matricula: string;
    estado_visual: string;
    status_interno: string;
    posicao_fila?: number;
    data_participacao?: string;
  }>;
}

export interface GerenciarMembrosModalProps {
  onClose: () => void;
  onUpdate: () => void;
  operacaoEspecifica?: any;
}

export interface OperacaoCardProps {
  operacao: OperacaoParticipacao;
  isSelected: boolean;
  onSelect: (operacao: OperacaoParticipacao) => void;
  formatarDataCompleta: (data: string) => any;
}

export interface MembroCardProps {
  membro: Membro;
  participacao: any;
  statusInfo: any;
  loading: boolean;
  onAdicionarMembro: (membroId: number) => void;
  onAprovarSolicitacao: (participacaoId: number) => void;
  onRejeitarSolicitacao: (participacaoId: number) => void;
  onRemoverMembro: (participacaoId: number) => void;
}

export interface SearchBoxProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export interface MemberDataHookReturn {
  members: Membro[];
  loading: boolean;
  error: string | null;
  refreshMembers: () => Promise<void>;
}

export interface MemberActionsHookReturn {
  addMember: (memberData: any) => Promise<any>;
  removeMember: (memberId: string) => Promise<void>;
  actionLoading: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CreateMemberData {
  name: string;
  email: string;
  role: string;
}

export interface UpdateMemberData extends Partial<CreateMemberData> {
  id: string;
}

export interface MemberActionsProps {
  membroId: number;
  participacaoId?: number;
  acoes: string[];
  loading?: boolean;
  onAdicionarMembro: (membroId: number) => Promise<void>;
  onRemoverMembro: (participacaoId: number) => Promise<void>;
  onAprovarSolicitacao: (participacaoId: number) => Promise<void>;
  onRejeitarSolicitacao: (participacaoId: number) => Promise<void>;
}