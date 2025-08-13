/**
 * Componente MembroCard
 * 
 * Componente memoizado que renderiza um card de membro
 * com informações pessoais, status de participação e ações disponíveis.
 */

import React, { memo, useCallback } from 'react';
import { MemberActions } from './MemberActions';
import type { MembroCardProps } from '../types';
import styles from '../GerenciarMembrosModal.module.css';

export const MembroCard = memo<MembroCardProps>(({ 
  membro, 
  participacao, 
  statusInfo, 
  loading,
  onAdicionarMembro,
  onAprovarSolicitacao,
  onRejeitarSolicitacao,
  onRemoverMembro
}) => {
  const temParticipacao = !!participacao;

  const obterClasseFundo = useCallback(() => {
    if (!participacao) {
      return '';
    }

    switch (participacao.estado_visual) {
      case 'CONFIRMADO':
      case 'ADICIONADO_SUP':
        return styles.membroConfirmado;
      case 'NA_FILA':
      case 'PENDENTE':
        return styles.membroAguardando;
      default:
        return '';
    }
  }, [participacao]);

  // Converter callbacks para async (MemberActions espera Promise)
  const handleAdicionarAsync = useCallback(async (membroId: number) => {
    onAdicionarMembro(membroId);
  }, [onAdicionarMembro]);

  const handleAprovarAsync = useCallback(async (participacaoId: number) => {
    onAprovarSolicitacao(participacaoId);
  }, [onAprovarSolicitacao]);

  const handleRejeitarAsync = useCallback(async (participacaoId: number) => {
    onRejeitarSolicitacao(participacaoId);
  }, [onRejeitarSolicitacao]);

  const handleRemoverAsync = useCallback(async (participacaoId: number) => {
    onRemoverMembro(participacaoId);
  }, [onRemoverMembro]);

  return (
    <div className={`${styles.membroCard} ${obterClasseFundo()}`}>
      <div className={styles.membroInfo}>
        <div className={styles.membroNomeContainer}>
          <h4>{membro.nome}</h4>
          {temParticipacao && participacao.estado_visual !== 'ADICIONADO_SUP' && (
            <span className={styles.posicaoCronologica} title="Solicitou participação">
              📋
            </span>
          )}
        </div>
        <p>Mat: {membro.matricula} • {membro.perfil}</p>
      </div>

      <div className={styles.membroActions}>
        {statusInfo.label && (
          <span className={`${styles.statusBadge} ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        )}

        <MemberActions
          membroId={membro.id}
          participacaoId={participacao?.id}
          acoes={statusInfo.acoes}
          loading={loading}
          onAdicionarMembro={handleAdicionarAsync}
          onRemoverMembro={handleRemoverAsync}
          onAprovarSolicitacao={handleAprovarAsync}
          onRejeitarSolicitacao={handleRejeitarAsync}
        />
      </div>
    </div>
  );
});

MembroCard.displayName = 'MembroCard';