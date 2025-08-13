/**
 * Componente LoadingStates
 * 
 * Componentes de loading e skeleton para melhor UX
 * durante carregamento de dados e estados vazios.
 */

import React, { memo } from 'react';
import { Loader2, Users, Search, AlertCircle } from 'lucide-react';
import styles from '../GerenciarMembrosModal.module.css';
import { constants } from '../utils/constants';

/**
 * Skeleton loading para lista de membros
 */
const MemberListSkeleton = memo(() => (
  <div className={styles.memberListSkeleton}>
    {Array.from({ length: constants.UI.SKELETON_ITEMS }).map((_, i) => (
      <div key={i} className={styles.memberItemSkeleton}>
        <div className={styles.avatarSkeleton} />
        <div className={styles.contentSkeleton}>
          <div className={styles.nameSkeleton} />
          <div className={styles.emailSkeleton} />
        </div>
        <div className={styles.actionsSkeleton} />
      </div>
    ))}
  </div>
));

/**
 * Skeleton loading para formulário de membro
 */
const MemberFormSkeleton = memo(() => (
  <div className={styles.formSkeleton}>
    <div className={styles.inputSkeleton} />
    <div className={styles.inputSkeleton} />
    <div className={styles.inputSkeleton} />
    <div className={styles.buttonSkeleton} />
  </div>
));

/**
 * Skeleton loading para card de operação
 */
const OperationCardSkeleton = memo(() => (
  <div className={styles.operationCardSkeleton}>
    <div className={styles.operationHeaderSkeleton} />
    <div className={styles.operationContentSkeleton}>
      <div className={styles.operationInfoSkeleton} />
      <div className={styles.operationInfoSkeleton} />
    </div>
    <div className={styles.operationActionsSkeleton} />
  </div>
));

/**
 * Loading spinner com mensagem customizável
 */
const LoadingSpinner = memo(({
  message = constants.MESSAGES.LOADING,
  size = 24
}: {
  message?: string;
  size?: number;
}) => (
  <div className={styles.loadingContainer}>
    <div className={styles.loadingSpinner}>
      <Loader2 size={size} className={styles.spinning} />
      <p>{message}</p>
    </div>
  </div>
));

/**
 * Loading inline para botões e ações
 */
const InlineSpinner = memo(({ size = 16 }: { size?: number }) => (
  <Loader2 size={size} className={styles.spinning} />
));

/**
 * Estado vazio para quando não há dados
 */
const EmptyState = memo(({
  message = constants.MESSAGES.NO_MEMBERS,
  icon: IconComponent = Users,
  showSearch = false
}: {
  message?: string;
  icon?: React.ComponentType<{ size?: number }>;
  showSearch?: boolean;
}) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIcon}>
      <IconComponent size={48} />
    </div>
    <p>{message}</p>
    {showSearch && (
      <div className={styles.emptyHint}>
        <Search size={16} />
        <span>Tente ajustar os filtros de busca</span>
      </div>
    )}
  </div>
));

/**
 * Estado de erro para quando algo dá errado
 */
const ErrorState = memo(({
  message = constants.MESSAGES.CONNECTION_ERROR,
  onRetry
}: {
  message?: string;
  onRetry?: () => void;
}) => (
  <div className={styles.errorState}>
    <div className={styles.errorIcon}>
      <AlertCircle size={48} />
    </div>
    <p>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className={styles.retryButton}>
        Tentar novamente
      </button>
    )}
  </div>
));

/**
 * Loading para ações específicas (usado em botões)
 */
const ActionLoading = memo(({
  action,
  size = 16
}: {
  action: string;
  size?: number;
}) => (
  <div className={styles.actionLoading}>
    <Loader2 size={size} className={styles.spinning} />
    <span>{action}...</span>
  </div>
));

// Definir displayName para melhor debugging
MemberListSkeleton.displayName = 'MemberListSkeleton';
MemberFormSkeleton.displayName = 'MemberFormSkeleton';
OperationCardSkeleton.displayName = 'OperationCardSkeleton';
LoadingSpinner.displayName = 'LoadingSpinner';
InlineSpinner.displayName = 'InlineSpinner';
EmptyState.displayName = 'EmptyState';
ErrorState.displayName = 'ErrorState';
ActionLoading.displayName = 'ActionLoading';

export const LoadingStates = {
  MemberList: MemberListSkeleton,
  MemberForm: MemberFormSkeleton,
  OperationCard: OperationCardSkeleton,
  Spinner: LoadingSpinner,
  InlineSpinner: InlineSpinner,
  Empty: EmptyState,
  Error: ErrorState,
  ActionLoading: ActionLoading,
};