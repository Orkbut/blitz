// ✅ TIPOS COMPARTILHADOS - INTERFACE ÚNICA PARA OPERAÇÃO
// Consolidação de todas as 11 interfaces Operacao diferentes encontradas no sistema

export interface Operacao {
  // ✅ Campos básicos obrigatórios
  id: number;
  data_operacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: 'MANHA' | 'TARDE' | 'NOITE';
  horario?: string;
  limite_participantes: number;
  status: string;
  ativa: boolean;
  criado_em: string;

  // ✅ Relacionamentos
  janela_id?: number;
  janela?: {
    id: number;
    dataInicio: string;
    dataFim: string;
    modalidades: string[];
  };

  // ✅ Campos específicos do contexto
  regional?: string;
  participantes_confirmados?: number;
  pessoas_na_fila?: number;
  total_solicitacoes?: number; // ✅ NOVO: total de solicitações (PENDENTE + NA_FILA)
  
  // ✅ Campos para contexto do membro
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'NA_FILA' | 'DISPONIVEL' | 'ADICIONADO_SUP';
    posicao_fila?: number;
  };

  // ✅ Campos para contexto da diretoria
  encaminhado_diretoria_em?: string;
  retorno_diretoria_em?: string;
  decisao_diretoria?: string;
  motivo_diretoria?: string;
  documentacao_gerada?: any;
  valor_total_diarias?: number;
  portaria_gerada?: any;
  participantes?: any[];
  total_participantes?: number;
  membros_bloquados?: number;
  excluida_temporariamente?: boolean;
  data_exclusao?: string;
  motivo_exclusao?: string;

  // ✅ Campos de inativação pelo supervisor
  inativa_pelo_supervisor?: boolean;
  data_inativacao?: string;
  motivo_inativacao?: string;
  supervisor_inativacao_id?: number;
}

// ✅ Interface para Janela Operacional
export interface JanelaOperacional {
  id: number;
  dataInicio: string;
  dataFim: string;
  modalidades: string[];
  status: string;
  operacoesCriadas: number;
  regional?: string;
  limite_min: number;
  limite_max: number;
  ativa: boolean;
  criado_em: string;
}

// ✅ Interface para Solicitação
export interface Solicitacao {
  id: number;
  membroNome: string;
  operacao: string;
  dataOperacao: string;
  turno: string;
  status: string;
  estadoVisual: 'CONFIRMADO' | 'NA_FILA' | 'PENDENTE' | 'DISPONIVEL' | 'ADICIONADO_SUP';
  timestamp: string;
  posicaoFila?: number;
  isNaFila?: boolean;
  isProximoDaFila?: boolean;
  membroId: number;
  operacaoId: number;
  membroMatricula?: string;
  operacaoDetalhes?: {
    id: number;
    modalidade: string;
    tipo: string;
    data_operacao: string;
    turno: string;
    limite_participantes: number;
  };
}

// ✅ Interface para Servidor/Membro
export interface Servidor {
  id: number;
  matricula: string;
  nome: string;
  perfil: 'Membro' | 'Supervisor' | 'Administrador';
  regionalId: number;
  ativo: boolean;
  limiteMensalDiarias: number;
}

// ✅ Tipos de Estado Visual
export type EstadoVisual = 'CONFIRMADO' | 'NA_FILA' | 'DISPONIVEL' | 'ADICIONADO_SUP';

// ✅ Tipos de Status de Participação
export type StatusParticipacao = 'AGUARDANDO_SUPERVISOR' | 'APROVADO' | 'REJEITADO';

// ✅ Tipos de Modalidade
export type Modalidade = 'BLITZ' | 'BALANCA';

// ✅ Tipos de Turno
export type Turno = 'MANHA' | 'TARDE' | 'NOITE'; 