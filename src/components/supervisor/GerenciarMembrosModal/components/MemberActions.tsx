/**
 * Componente MemberActions
 * 
 * Componente responsável por renderizar os botões de ação para membros
 * (adicionar, remover, aprovar, rejeitar) com estados de loading individuais.
 */

import React, { memo, useCallback, useState } from 'react';
import { UserPlus, UserMinus, Check, X, Loader2 } from 'lucide-react';
import styles from '../GerenciarMembrosModal.module.css';

interface MemberActionsProps {
  /** ID do membro */
  membroId: number;
  /** ID da participação (se existir) */
  participacaoId?: number;
  /** Lista de ações disponíveis para este membro */
  acoes: string[];
  /** Estado de loading geral */
  loading?: boolean;
  /** Callbacks para as ações */
  onAdicionarMembro: (membroId: number) => Promise<void>;
  onRemoverMembro: (participacaoId: number) => Promise<void>;
  onAprovarSolicitacao: (participacaoId: number) => Promise<void>;
  onRejeitarSolicitacao: (participacaoId: number) => Promise<void>;
}

export const MemberActions = memo<MemberActionsProps>(({
  membroId,
  participacaoId,
  acoes,
  loading = false,
  onAdicionarMembro,
  onRemoverMembro,
  onAprovarSolicitacao,
  onRejeitarSolicitacao
}) => {
  // Estados de loading individuais para cada ação
  const [loadingStates, setLoadingStates] = useState({
    adicionar: false,
    remover: false,
    aprovar: false,
    rejeitar: false
  });

  // Handler para adicionar membro
  const handleAdicionar = useCallback(async () => {
    if (loading || loadingStates.adicionar) return;
    
    setLoadingStates(prev => ({ ...prev, adicionar: true }));
    try {
      await onAdicionarMembro(membroId);
    } finally {
      setLoadingStates(prev => ({ ...prev, adicionar: false }));
    }
  }, [membroId, onAdicionarMembro, loading, loadingStates.adicionar]);

  // Handler para remover membro
  const handleRemover = useCallback(async () => {
    if (loading || loadingStates.remover || !participacaoId) return;
    
    setLoadingStates(prev => ({ ...prev, remover: true }));
    try {
      await onRemoverMembro(participacaoId);
    } finally {
      setLoadingStates(prev => ({ ...prev, remover: false }));
    }
  }, [participacaoId, onRemoverMembro, loading, loadingStates.remover]);

  // Handler para aprovar solicitação
  const handleAprovar = useCallback(async () => {
    if (loading || loadingStates.aprovar || !participacaoId) return;
    
    setLoadingStates(prev => ({ ...prev, aprovar: true }));
    try {
      await onAprovarSolicitacao(participacaoId);
    } finally {
      setLoadingStates(prev => ({ ...prev, aprovar: false }));
    }
  }, [participacaoId, onAprovarSolicitacao, loading, loadingStates.aprovar]);

  // Handler para rejeitar solicitação
  const handleRejeitar = useCallback(async () => {
    if (loading || loadingStates.rejeitar || !participacaoId) return;
    
    setLoadingStates(prev => ({ ...prev, rejeitar: true }));
    try {
      await onRejeitarSolicitacao(participacaoId);
    } finally {
      setLoadingStates(prev => ({ ...prev, rejeitar: false }));
    }
  }, [participacaoId, onRejeitarSolicitacao, loading, loadingStates.rejeitar]);

  // Se não há ações disponíveis, não renderiza nada
  if (!acoes || acoes.length === 0) {
    return null;
  }

  return (
    <div className={styles.memberActions}>
      {acoes.includes('adicionar') && (
        <button
          onClick={handleAdicionar}
          disabled={loading || loadingStates.adicionar}
          className={`${styles.actionButton} ${styles.addButton}`}
          title="Adicionar membro à operação"
        >
          {loadingStates.adicionar ? (
            <Loader2 size={16} className={styles.spinning} />
          ) : (
            <UserPlus size={16} />
          )}
          <span>Adicionar</span>
        </button>
      )}

      {acoes.includes('remover') && participacaoId && (
        <button
          onClick={handleRemover}
          disabled={loading || loadingStates.remover}
          className={`${styles.actionButton} ${styles.removeButton}`}
          title="Remover membro da operação"
        >
          {loadingStates.remover ? (
            <Loader2 size={16} className={styles.spinning} />
          ) : (
            <UserMinus size={16} />
          )}
          <span>Remover</span>
        </button>
      )}

      {acoes.includes('aprovar') && participacaoId && (
        <button
          onClick={handleAprovar}
          disabled={loading || loadingStates.aprovar}
          className={`${styles.actionButton} ${styles.approveButton}`}
          title="Aprovar solicitação"
        >
          {loadingStates.aprovar ? (
            <Loader2 size={16} className={styles.spinning} />
          ) : (
            <Check size={16} />
          )}
          <span>Aprovar</span>
        </button>
      )}

      {acoes.includes('rejeitar') && participacaoId && (
        <button
          onClick={handleRejeitar}
          disabled={loading || loadingStates.rejeitar}
          className={`${styles.actionButton} ${styles.rejectButton}`}
          title="Rejeitar solicitação"
        >
          {loadingStates.rejeitar ? (
            <Loader2 size={16} className={styles.spinning} />
          ) : (
            <X size={16} />
          )}
          <span>Rejeitar</span>
        </button>
      )}
    </div>
  );
});

MemberActions.displayName = 'MemberActions';