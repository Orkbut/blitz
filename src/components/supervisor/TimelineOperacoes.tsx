'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Operacao } from '@/shared/types';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { ElegantInlineLoader } from '@/shared/components/ui/LoadingSpinner';
import styles from './TimelineOperacoes.module.css';

interface TimelineOperacoesProps {
  operacoes: Operacao[];
  onGerenciarMembros: (operacao: Operacao) => void;
  onExcluirOperacao: (id: number) => void;
  onReativarOperacao: (id: number) => void;
  onDefinirHorario?: (operacao: Operacao) => void;
  onNovaJanela?: () => void;
  onNovaOperacao?: () => void;
  dataParaReabrir?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
  onClose?: () => void;
}

const TimelineOperacoes: React.FC<TimelineOperacoesProps> = ({
  operacoes,
  onGerenciarMembros,
  onExcluirOperacao,
  onReativarOperacao,
  onDefinirHorario,
  onNovaJanela,
  onNovaOperacao,
  dataParaReabrir,
  loading = false,
  onRefresh,
  onClose
}) => {
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);
  const { isConnected } = useRealtimeUnified({
    tables: ['operacao'],
    enableRealtime: false,
    enablePolling: false,
    enableFetch: false
  });

  // Agrupar operações por data
  const operacoesPorData = useMemo(() => {
    const operacoesSeguras = Array.isArray(operacoes) ? operacoes : [];
    return operacoesSeguras.reduce((acc, operacao) => {
      const data = operacao.data_operacao.split('T')[0];
      if (!acc[data]) {
        acc[data] = [];
      }
      acc[data].push(operacao);
      return acc;
    }, {} as Record<string, Operacao[]>);
  }, [operacoes]);

  // Operações da data selecionada
  const operacoesSelecionadas = useMemo(() => {
    if (!dataSelecionada) return [];
    return operacoesPorData[dataSelecionada] || [];
  }, [operacoesPorData, dataSelecionada]);

  // Função para formatar data completa
  const formatarDataCompleta = (data: string) => {
    const dataObj = new Date(data + 'T00:00:00');
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    const dataFormatada = dataObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let labelTempo = '';
    if (data === hoje.toISOString().split('T')[0]) {
      labelTempo = 'Hoje';
    } else if (data === amanha.toISOString().split('T')[0]) {
      labelTempo = 'Amanhã';
    } else if (data === ontem.toISOString().split('T')[0]) {
      labelTempo = 'Ontem';
    }

    return {
      dataCompleta: dataFormatada,
      labelTempo,
      diaMes: dataObj.getDate().toString(),
      mes: dataObj.toLocaleDateString('pt-BR', { month: 'short' }),
      ano: dataObj.getFullYear().toString(),
      diaSemana: dataObj.toLocaleDateString('pt-BR', { weekday: 'short' })
    };
  };

  // Automaticamente mostrar o modal quando há operações
  useEffect(() => {
    if (operacoes.length > 0 && !dataSelecionada) {
      const primeiraData = Object.keys(operacoesPorData)[0];
      if (primeiraData) {
        setDataSelecionada(primeiraData);
        setShowModalDetalhes(true);
      }
    }
  }, [operacoes, operacoesPorData, dataSelecionada]);

  // Usar dataParaReabrir se fornecida
  useEffect(() => {
    if (dataParaReabrir && operacoesPorData[dataParaReabrir]) {
      setDataSelecionada(dataParaReabrir);
      setShowModalDetalhes(true);
    }
  }, [dataParaReabrir, operacoesPorData]);

  return (
    <>
      {loading ? (
        <ElegantInlineLoader message="Carregando operações..." />
      ) : (
        /* Modal de detalhes */
        showModalDetalhes && dataSelecionada && (
          <div className={styles.modalOverlay} onClick={() => {
            setShowModalDetalhes(false);
            if (onClose) onClose();
          }}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>
                  <h3>
                    📅 {formatarDataCompleta(dataSelecionada).dataCompleta}
                    {formatarDataCompleta(dataSelecionada).labelTempo && (
                      <span className={styles.labelTempoModal}>
                        {formatarDataCompleta(dataSelecionada).labelTempo}
                      </span>
                    )}
                  </h3>
                  <p>{operacoesSelecionadas.length} operação(ões) nesta data</p>
                </div>

                <button
                  className={styles.modalCloseButton}
                  onClick={() => {
                    setShowModalDetalhes(false);
                    if (onClose) onClose();
                  }}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>

              <div className={styles.modalBody}>
                {operacoesSelecionadas.map((operacao) => (
                  <div
                    key={operacao.id}
                    className={`${styles.modalOperacaoCard} ${
                      operacao.excluida_temporariamente === true ? styles.excluida : ''
                    }`}
                  >
                    {/* Header da operação */}
                    <div className={styles.modalOperacaoHeader}>
                      <div className={styles.modalOperacaoInfo}>
                        <span
                          className={`${styles.modalidadeBadge} ${
                            operacao.modalidade === 'BLITZ' ? styles.blitz : styles.balanca
                          }`}
                        >
                          {operacao.modalidade === 'BLITZ' ? '🚨' : '⚖️'} {operacao.modalidade}
                        </span>
                        <span className={styles.tipoBadge}>{operacao.tipo}</span>
                        <span className={styles.turnoInfo}>🕐 {operacao.turno}</span>
                        {operacao.horario && (
                          <span className={styles.horarioInfo}>• {operacao.horario}</span>
                        )}
                      </div>

                      <span
                        className={`${styles.statusBadge} ${
                          operacao.excluida_temporariamente === true
                            ? styles.excluida
                            : operacao.status === 'AGUARDANDO_SOLICITACOES'
                            ? styles.ativa
                            : styles.outras
                        }`}
                      >
                        {operacao.excluida_temporariamente === true
                          ? 'EXCLUÍDA'
                          : operacao.status === 'AGUARDANDO_SOLICITACOES'
                          ? 'ATIVA'
                          : operacao.status}
                      </span>
                    </div>

                    {/* Estatísticas */}
                    <div className={styles.modalEstatisticas}>
                      <div className={styles.estatItem}>
                        <span className={styles.estatValor}>
                          {operacao.participantes_confirmados || 0}/{operacao.limite_participantes}
                        </span>
                        <span className={styles.estatLabel}>Confirmados</span>
                      </div>

                      {(operacao.pessoas_na_fila || 0) > 0 && (
                        <div className={styles.estatItem}>
                          <span className={styles.estatValor}>{operacao.pessoas_na_fila}</span>
                          <span className={styles.estatLabel}>Na fila</span>
                        </div>
                      )}

                      <div className={styles.estatItem}>
                        <span className={styles.estatValor}>{operacao.regional || 'Centro'}</span>
                        <span className={styles.estatLabel}>Regional</span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className={styles.modalAcoes}>
                      <button
                        className={styles.modalBotaoPrimario}
                        onClick={() => {
                          onGerenciarMembros(operacao);
                          setShowModalDetalhes(false);
                          if (onClose) onClose();
                        }}
                      >
                        👥 Membros
                      </button>

                      <div className={styles.modalAcoesSecundarias}>
                        {onDefinirHorario && (
                          <button
                            className={styles.modalBotaoSecundario}
                            onClick={() => {
                              onDefinirHorario(operacao);
                              setShowModalDetalhes(false);
                              if (onClose) onClose();
                            }}
                            data-tooltip={
                              operacao.horario
                                ? `Horário atual: ${operacao.horario} • Clique para editar`
                                : 'Definir horário da operação'
                            }
                          >
                            ⏰
                          </button>
                        )}

                        {operacao.ativa && operacao.excluida_temporariamente !== true ? (
                          <button
                            className={styles.modalBotaoExcluir}
                            onClick={() => {
                              onExcluirOperacao(operacao.id);
                              setShowModalDetalhes(false);
                              if (onClose) onClose();
                            }}
                            data-tooltip="Excluir operação temporariamente"
                          >
                            🚫
                          </button>
                        ) : (
                          <button
                            className={styles.modalBotaoReativar}
                            onClick={() => {
                              onReativarOperacao(operacao.id);
                              setShowModalDetalhes(false);
                              if (onClose) onClose();
                            }}
                            data-tooltip="Reativar operação excluída"
                          >
                            ✅
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
};

export default TimelineOperacoes;