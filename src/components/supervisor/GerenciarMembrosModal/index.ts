/**
 * Export centralizado para GerenciarMembrosModal
 * 
 * Este arquivo centraliza todas as exportações do módulo,
 * facilitando imports e manutenção da estrutura modular.
 * 
 * NOTA: O componente principal ainda está no arquivo original
 * e será migrado nas próximas tarefas.
 */

// Exportar tipos
export type {
  Membro,
  OperacaoParticipacao,
  GerenciarMembrosModalProps,
  OperacaoCardProps,
  MembroCardProps,
  SearchBoxProps,
  MemberActionsProps,
  MemberDataHookReturn,
  MemberActionsHookReturn,
  ValidationResult,
  CreateMemberData,
  UpdateMemberData
} from './types';

// Re-exportar componentes filhos
export {
  OperacaoCard,
  MembroCard,
  MemberList,
  MemberForm,
  MemberActions,
  SearchBox,
  LoadingStates
} from './components';

// Re-exportar hooks
export {
  useMemberData,
  useMemberActions,
  useResponsive
} from './hooks';

// Re-exportar utilitários
export {
  memberValidation,
  constants
} from './utils';

// TEMPORÁRIO: Re-exportar o componente principal do arquivo original
// Isso será removido quando migrarmos completamente
export { GerenciarMembrosModal } from '../GerenciarMembrosModal';