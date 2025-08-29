'use client';

/**
 * MODAL DE OPERAÇÃO DO SUPERVISOR
 * 
 * 🔑 REGRAS FUNDAMENTAIS:
 * - O banco de dados é a fonte absoluta da verdade
 * - Todos os dados exibidos devem ser consumidos diretamente do banco
 * - Não pode haver inconsistências entre interface e banco de dados
 * - Sempre refletir o estado real dos dados armazenados
 * 
 * 📋 REGRAS DE NEGÓCIO:
 * - O supervisor pode exceder o limite de participantes que ele mesmo definiu
 * - Existe exceção no banco de dados que permite ao supervisor adicionar mais participantes
 * - Esta exceção é uma regra de negócio válida e intencional
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Operacao } from '@/shared/types';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { getSupervisorHeaders, formatarDataBR } from '@/lib/auth-utils';
import styles from './TimelineOperacoes.module.css';

interface ModalOperacaoSupervisorProps {
  operacao: Operacao;
  onClose: () => void;
  onGerenciarMembros: (operacao: Operacao) => void;
  onDefinirHorario: (operacao: Operacao) => void;
  onExcluirOperacao: (id: number) => void;
}

export const ModalOperacaoSupervisor: React.FC<ModalOperacaoSupervisorProps> = ({
  operacao,
  onClose,
  onGerenciarMembros,
  onDefinirHorario,
  onExcluirOperacao
}) => {
  
  // ✅ ESTADO LOCAL: Operação atualizada via realtime
  const [operacaoAtualizada, setOperacaoAtualizada] = useState(operacao);

  // ✅ FUNÇÃO DE RELOAD SILENCIOSO: Específica para uma operação
  const reloadOperacaoSilenciosa = useCallback(async (operacaoId: number) => {
    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor', {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();

      if (result.success) {
        const operacaoEncontrada = result.data.find((op: any) => op.id === operacaoId);
        if (operacaoEncontrada) {
          setOperacaoAtualizada(prev => ({
            ...prev,
            participantes_confirmados: operacaoEncontrada.participantes_confirmados || 0,
            total_solicitacoes: operacaoEncontrada.total_solicitacoes || 0,
            ativa: operacaoEncontrada.ativa,
            excluida_temporariamente: operacaoEncontrada.excluida_temporariamente
          }));
        }
      }
    } catch (error) {
      // Erro silencioso
    }
  }, []);

  // ✅ HOOK REALTIME UNIFICADO: Migrado para useRealtimeUnified - Específico para esta operação
  useRealtimeUnified({
    channelId: `modal-operacao-${operacao.id}`,
    tables: ['operacao', 'participacao'],
    filters: {
      operacao: `id.eq.${operacao.id}`,
      participacao: `operacao_id.eq.${operacao.id}`
    },
    enableRealtime: true,
    enablePolling: false,
    enableFetch: false,
    debug: false,
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;
      
      if (table === 'operacao' && eventType === 'UPDATE' && payload.new.id === operacao.id) {
        setOperacaoAtualizada(prev => ({
          ...prev,
          participantes_confirmados: payload.new.participantes_confirmados || 0,
          total_solicitacoes: payload.new.total_solicitacoes || 0,
          ativa: payload.new.ativa,
          excluida_temporariamente: payload.new.excluida_temporariamente,
          updated_at: payload.new.updated_at
        }));
      } else if (table === 'participacao') {
        const operacaoId = payload.new?.operacao_id || payload.old?.operacao_id;
        if (operacaoId === operacao.id) {
          // Reload silencioso específico para esta operação
          setTimeout(() => {
            reloadOperacaoSilenciosa(operacao.id);
          }, 1000);
        }
      }
    }, [operacao.id, reloadOperacaoSilenciosa])
  });
  
  // Controle de scroll do modal
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Fechar modal com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatarDataCompleta = (dataString: string) => {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };



  return (
    <div className={styles.modalOverlay} onClick={onClose} data-modal="true">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <h3>📅 {formatarDataBR(operacao.data_operacao)}</h3>
            <p>Operação #{operacao.id}</p>
          </div>
          <button
            className={styles.modalCloseButton}
            onClick={onClose}
            title="Fechar"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalOperacaoCard}>
            <div className={styles.modalOperacaoHeader}>
              <div className={styles.modalOperacaoInfo}>
                <span className={`${styles.modalidadeBadge} ${
                  operacao.modalidade === 'BLITZ' ? styles.blitz : styles.balanca
                }`}>
                  {operacao.modalidade}
                </span>
                <span className={styles.tipoBadge}>
                  {operacao.tipo}
                </span>
                <span className={styles.turnoInfo}>
                  🕐 {operacao.turno}
                  {operacao.horario && ` - ${operacao.horario}`}
                </span>
              </div>
              <span className={`${styles.statusBadge} ${
                operacao.ativa ? styles.ativa : styles.inativa
              }`}>
                {operacao.ativa ? 'ATIVA' : 'INATIVA'}
              </span>
            </div>

            <div className={styles.modalEstatisticas}>
              <div className={styles.estatItem}>
                <span className={styles.estatValor}>
                  {operacaoAtualizada.participantes_confirmados || 0}/{operacaoAtualizada.limite_participantes}
                </span>
                <span className={styles.estatLabel}>Confirmados</span>
              </div>
              
              <div className={styles.estatItem}>
                <span className={styles.estatValor}>
                  {operacaoAtualizada.pessoas_na_fila || 0}
                </span>
                <span className={styles.estatLabel}>Na Fila</span>
              </div>
              
              <div className={styles.estatItem}>
                <span className={styles.estatValor}>
                  {operacaoAtualizada.total_solicitacoes || 0}
                </span>
                <span className={styles.estatLabel}>Solicitações</span>
              </div>
            </div>

            <div className={styles.modalAcoes}>
              <button
                className={styles.modalBotaoPrimario}
                onClick={() => onGerenciarMembros(operacao)}
              >
                👥 Membros
              </button>
              
              <div className={styles.modalAcoesSecundarias}>
                <button
                  className={styles.modalBotaoSecundario}
                  onClick={() => onDefinirHorario(operacao)}
                  data-tooltip="Definir horário da operação"
                >
                  ⏰
                </button>
                
                <button
                  className={styles.modalBotaoExcluir}
                  onClick={() => {
                    onExcluirOperacao(operacao.id);
                    onClose();
                  }}
                  data-tooltip="Excluir operação temporariamente"
                >
                  🚫
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};