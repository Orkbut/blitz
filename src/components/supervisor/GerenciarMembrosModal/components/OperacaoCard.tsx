/**
 * Componente OperacaoCard
 * 
 * Componente memoizado que renderiza um card de operação
 * com informações de data, modalidade e estatísticas de participação.
 */

import React, { memo, useMemo, useCallback } from 'react';
import type { OperacaoCardProps } from '../types';
import styles from '../GerenciarMembrosModal.module.css';

export const OperacaoCard = memo<OperacaoCardProps>(({ 
  operacao, 
  isSelected, 
  onSelect, 
  formatarDataCompleta 
}) => {
  // ✅ MEMOIZAÇÃO: Formatação de data (cálculo pesado)
  const dataInfo = useMemo(() => 
    formatarDataCompleta(operacao.data_operacao), 
    [operacao.data_operacao, formatarDataCompleta]
  );

  // ✅ MEMOIZAÇÃO: Contadores de participantes (filtros pesados)
  const { confirmados, naFila, pendentes } = useMemo(() => {
    const participantes = operacao.participantes || [];
    return {
      confirmados: participantes.filter((p: any) =>
        p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP'
      ).length,
      naFila: participantes.filter((p: any) => p.estado_visual === 'NA_FILA').length,
      pendentes: participantes.filter((p: any) => p.estado_visual === 'PENDENTE').length
    };
  }, [operacao.participantes]);

  const handleClick = useCallback(() => {
    onSelect(operacao);
  }, [operacao, onSelect]);

  return (
    <div
      className={`${styles.operacaoCard} ${isSelected ? styles.selecionada : ''}`}
      onClick={handleClick}
    >
      {/* Data em destaque */}
      <div className={styles.dataDestaque}>
        <div className={styles.diaMes}>{dataInfo.diaMes}</div>
        <div className={styles.mesAno}>
          <div className={styles.mes}>{dataInfo.mes}</div>
          <div className={styles.ano}>{dataInfo.ano}</div>
        </div>
        <div className={styles.diaSemana}>{dataInfo.diaSemanaAbrev}</div>
      </div>

      {/* Informações da operação */}
      <div className={styles.operacaoInfo}>
        <div className={styles.operacaoHeader}>
          <div className={`${styles.modalidadeBadge} ${styles[operacao.modalidade.toLowerCase()]}`}>
            {operacao.modalidade}
          </div>
          <div className={`${styles.tipoBadge} ${styles[operacao.tipo.toLowerCase()]}`}>
            {operacao.tipo}
          </div>
        </div>

        <div className={styles.turnoInfo}>
          🕐 <strong>{operacao.turno}</strong>
        </div>

        <div className={styles.participacaoInfo}>
          <div className={styles.participacaoItem}>
            <span className={styles.label}>Confirmados:</span>
            <span className={`${styles.valor} ${styles.confirmados}`}>
              {confirmados}/{operacao.limite_participantes}
            </span>
          </div>

          {naFila > 0 && (
            <div className={styles.participacaoItem}>
              <span className={styles.label}>Na fila:</span>
              <span className={`${styles.valor} ${styles.fila}`}>
                {naFila}
              </span>
            </div>
          )}

          {pendentes > 0 && (
            <div className={styles.participacaoItem}>
              <span className={styles.label}>Pendentes:</span>
              <span className={`${styles.valor} ${styles.pendentes}`}>
                {pendentes}
              </span>
            </div>
          )}

          <div className={styles.totalItem}>
            <span className={styles.totalLabel}>Total solicitações:</span>
            <span className={styles.totalValor}>
              {confirmados + naFila + pendentes}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

OperacaoCard.displayName = 'OperacaoCard';