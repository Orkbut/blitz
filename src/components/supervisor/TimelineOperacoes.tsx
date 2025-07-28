'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  onRefresh
}) => {
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);

  // Estados essenciais simplificados
  const [solicitacoesPorOperacao, setSolicitacoesPorOperacao] = useState<{ [key: number]: any[] }>({});
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);

  // IDs das operações para controle de estado
  const operacaoIds = useMemo(() => {
    return operacoes.map(op => op.id);
  }, [operacoes]);

  // Função simplificada para carregar solicitações
  const carregarSolicitacoes = useCallback(async (operacaoIdEspecifica?: number) => {
    if (operacaoIds.length === 0 || loadingSolicitacoes) return;

    setLoadingSolicitacoes(true);
    try {
      const operacoesIds = operacaoIdEspecifica ? [operacaoIdEspecifica] : operacaoIds;
      const response = await fetch('/api/debug/debug-operacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacoes_ids: operacoesIds })
      });

      const result = await response.json();
      if (!result.success) return;

      const todasSolicitacoes = result.data || [];
      const solicitacoesPorOp: { [key: number]: any[] } = {};

      operacoesIds.forEach(id => { solicitacoesPorOp[id] = []; });
      todasSolicitacoes.forEach((solicitacao: any) => {
        if (solicitacao.ativa && solicitacao.estado_visual === 'PENDENTE') {
          if (!solicitacoesPorOp[solicitacao.operacao_id]) {
            solicitacoesPorOp[solicitacao.operacao_id] = [];
          }
          solicitacoesPorOp[solicitacao.operacao_id].push(solicitacao);
        }
      });

      setSolicitacoesPorOperacao(solicitacoesPorOp);
    } catch (error) {
      // Erro silencioso
    } finally {
      setLoadingSolicitacoes(false);
    }
  }, [operacaoIds, loadingSolicitacoes]);

  // Reload silencioso para garantir consistência
  const reloadOperacoesSilencioso = useCallback(async () => {
    if (operacaoIds.length === 0) return;

    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const result = await response.json();

      if (result.success && onRefresh) {
        onRefresh();
      }
    } catch (error) {
      // Erro silencioso
    }
  }, [operacaoIds, onRefresh]);

  // Hook realtime unificado - migrado para useRealtimeUnified
  const { isConnected } = useRealtimeUnified({
    channelId: `timeline-operacoes-${operacaoIds.join('-')}`,
    tables: ['operacao', 'participacao'],
    enableRealtime: operacaoIds.length > 0 && !loading,
    enablePolling: false,
    enableFetch: false,
    debug: false,
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;
      
      if (table === 'operacao') {
        if (eventType === 'UPDATE' && onRefresh) {
          onRefresh();
        }
        if (eventType === 'INSERT' || eventType === 'DELETE') {
          if (onRefresh) onRefresh();
        }
      } else if (table === 'participacao') {
        const operacaoId = payload.new?.operacao_id || payload.old?.operacao_id;
        if (operacaoId && operacaoIds.includes(operacaoId)) {
          setTimeout(() => {
            reloadOperacoesSilencioso();
          }, 1000);
        }
      }
    }, [onRefresh, operacaoIds, reloadOperacoesSilencioso])
  });

  // Carregar solicitações inicialmente
  useEffect(() => {
    if (operacaoIds.length > 0 && !loadingSolicitacoes) {
      carregarSolicitacoes();
    }
  }, [operacaoIds.length]);

  // Limpeza de estado quando operações mudam
  useEffect(() => {
    setSolicitacoesPorOperacao(prevState => {
      const newState = { ...prevState };
      let changed = false;

      Object.keys(newState).forEach(operacaoIdStr => {
        const operacaoId = parseInt(operacaoIdStr);
        if (!operacoes.find(op => op.id === operacaoId)) {
          delete newState[operacaoId];
          changed = true;
        }
      });

      return changed ? newState : prevState;
    });
  }, [operacoes]);

  // Controle de scroll do modal
  useEffect(() => {
    if (showModalDetalhes) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModalDetalhes]);

  // Reabrir modal após operações
  useEffect(() => {
    if (dataParaReabrir && !showModalDetalhes) {
      setDataSelecionada(dataParaReabrir);
      setShowModalDetalhes(true);
    }
  }, [dataParaReabrir, showModalDetalhes]);

  // Hook para fechar modal com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModalDetalhes) {
        setShowModalDetalhes(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModalDetalhes]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Agrupar operações por data e mês
  const operacoesPorData = useMemo(() => {
    const grupos: { [key: string]: Operacao[] } = {};

    operacoes.forEach(operacao => {
      const data = operacao.data_operacao.split('T')[0];
      if (!grupos[data]) {
        grupos[data] = [];
      }
      grupos[data].push(operacao);
    });

    const datasOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    const resultado: { [key: string]: Operacao[] } = {};

    datasOrdenadas.forEach(data => {
      resultado[data] = grupos[data].sort((a, b) =>
        (a.turno + (a.horario || '')).localeCompare(b.turno + (b.horario || ''))
      );
    });

    return resultado;
  }, [operacoes]);

  // Agrupar por mês para navegação
  const operacoesPorMes = useMemo(() => {
    const grupos: { [key: string]: { [key: string]: Operacao[] } } = {};

    Object.entries(operacoesPorData).forEach(([data, operacoes]) => {
      const dataObj = new Date(data + 'T00:00:00');
      const mesAno = `${dataObj.getFullYear()}-${(dataObj.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!grupos[mesAno]) {
        grupos[mesAno] = {};
      }
      grupos[mesAno][data] = operacoes;
    });

    const mesesOrdenados = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    const resultado: { [key: string]: { [key: string]: Operacao[] } } = {};

    mesesOrdenados.forEach(mes => {
      const datasDoMes = Object.keys(grupos[mes]).sort((a, b) => a.localeCompare(b));
      const mesOrdenado: { [key: string]: Operacao[] } = {};

      datasDoMes.forEach(data => {
        mesOrdenado[data] = grupos[mes][data];
      });

      resultado[mes] = mesOrdenado;
    });

    return resultado;
  }, [operacoesPorData]);

  const formatarDataCompleta = (dataString: string) => {
    const data = new Date(dataString + 'T00:00:00');
    const hoje = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);

    const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'short' });
    const diaMes = data.getDate().toString().padStart(2, '0');
    const mes = data.toLocaleDateString('pt-BR', { month: 'short' });
    const ano = data.getFullYear();

    let labelTempo = '';
    if (data.toDateString() === hoje.toDateString()) {
      labelTempo = 'HOJE';
    } else if (data.toDateString() === amanha.toDateString()) {
      labelTempo = 'AMANHÃ';
    }

    return {
      diaSemana: diaSemana.replace('.', '').toUpperCase(),
      diaMes,
      mes: mes.replace('.', '').toUpperCase(),
      ano,
      labelTempo,
      dataCompleta: data.toLocaleDateString('pt-BR')
    };
  };

  const obterEstatisticasData = (operacoes: Operacao[]) => {
    const total = operacoes.length;
    const ativas = operacoes.filter(op => op.ativa && op.excluida_temporariamente !== true).length;
    const excluidas = operacoes.filter(op => op.excluida_temporariamente === true).length;
    const confirmados = operacoes.reduce((acc, op) => acc + (op.participantes_confirmados || 0), 0);
    const naFila = operacoes.reduce((acc, op) => acc + (op.pessoas_na_fila || 0), 0);

    return { total, ativas, excluidas, confirmados, naFila };
  };

  const datasDisponiveis = Object.keys(operacoesPorData);
  const operacoesSelecionadas = dataSelecionada ? operacoesPorData[dataSelecionada] || [] : [];

  // Verificar se pode fazer scroll
  const checkScrollButtons = () => {
    if (timelineRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = timelineRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const timeline = timelineRef.current;
    if (timeline) {
      timeline.addEventListener('scroll', checkScrollButtons);
      return () => timeline.removeEventListener('scroll', checkScrollButtons);
    }
  }, [operacoesPorData]);

  // Funções de drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (timelineRef.current) {
      setIsDragging(true);
      setStartX(e.pageX - timelineRef.current.offsetLeft);
      setScrollLeft(timelineRef.current.scrollLeft);
      timelineRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    e.preventDefault();
    const x = e.pageX - timelineRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    timelineRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (timelineRef.current) {
      timelineRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    if (timelineRef.current) {
      timelineRef.current.style.cursor = 'grab';
    }
  };

  const formatarMesAno = (mesAno: string) => {
    const [ano, mes] = mesAno.split('-');
    const data = new Date(parseInt(ano), parseInt(mes) - 1);
    return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className={styles.container}>
      {/* Header com controles */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h3 className={styles.titulo}>
            <span className={styles.icone}>📅</span>
            Operações por Data
          </h3>
          <p className={styles.subtitulo}>
            {datasDisponiveis.length} datas com operações • {operacoes.length} operações totais
          </p>
        </div>

        <div className={styles.controles}>
          {onNovaJanela && (
            <button
              className={styles.botaoAcao}
              onClick={onNovaJanela}
            >
              📅 Nova Janela
            </button>
          )}
          {onNovaOperacao && (
            <button
              className={styles.botaoAcao}
              onClick={onNovaOperacao}
            >
              Nova Operação
            </button>
          )}

          {onRefresh && (
            <button
              className={styles.botaoAcao}
              onClick={onRefresh}
              disabled={loading}
            >
              🔄 Atualizar
            </button>
          )}

          {/* Indicador de Conexão Realtime */}
          <div
            className={styles.realtimeIndicator}
            title={isConnected ? 'Realtime conectado' : 'Realtime desconectado'}
          >
            <div
              className={styles.realtimeStatus}
              style={{
                color: isConnected ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px'
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? '#10b981' : '#ef4444',
                  animation: isConnected ? 'none' : 'pulse 2s infinite'
                }}
              />
              {isConnected ? 'Real-time ativo' : 'Reconectando...'}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <ElegantInlineLoader message="Carregando operações..." />
      ) : (
        <>
          {/* Timeline horizontal com navegação */}
          <div className={styles.timeline}>
            <div className={styles.timelineScrollContainer}>
              {Object.entries(operacoesPorMes).map(([mesAno, datasMes]) => (
                <div key={mesAno} className={styles.mesSecao}>
                  {/* Header do mês */}
                  <div className={styles.mesHeader}>
                    <span className={styles.mesLabel}>{formatarMesAno(mesAno)}</span>
                    <span className={styles.mesStats}>
                      {Object.keys(datasMes).length} dias • {Object.values(datasMes).flat().length} ops
                    </span>
                  </div>

                  {/* Timeline horizontal do mês */}
                  <div className={styles.mesTimelineContainer}>
                    {/* Botão esquerda do mês */}
                    <button
                      className={`${styles.navButton} ${styles.navLeft}`}
                      onClick={() => {
                        const container = document.getElementById(`mes-${mesAno}`);
                        if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                      }}
                      title="Navegar para datas anteriores"
                    >
                      <span className={styles.navArrow}>‹</span>
                    </button>

                    {/* Scroll horizontal das datas do mês */}
                    <div
                      id={`mes-${mesAno}`}
                      className={styles.mesScrollHorizontal}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                    >
                      {Object.entries(datasMes).map(([data, operacoesData]) => {
                        const dataInfo = formatarDataCompleta(data);
                        const stats = obterEstatisticasData(operacoesData);
                        const isSelected = dataSelecionada === data;

                        return (
                          <div
                            key={data}
                            className={`${styles.dataCard} ${isSelected ? styles.selecionada : ''}`}
                            onClick={() => {
                              if (isSelected) {
                                setDataSelecionada(null);
                                setShowModalDetalhes(false);
                              } else {
                                setDataSelecionada(data);
                                setShowModalDetalhes(true);
                              }
                            }}
                          >
                            {/* Indicador de tempo especial */}
                            {dataInfo.labelTempo && (
                              <div className={styles.labelTempo}>
                                {dataInfo.labelTempo}
                              </div>
                            )}

                            {/* Data principal */}
                            <div className={styles.dataInfo}>
                              <div className={styles.diaMes}>{dataInfo.diaMes}</div>
                              <div className={styles.mesAno}>
                                <span className={styles.mes}>{dataInfo.mes}</span>
                                <span className={styles.ano}>{dataInfo.ano}</span>
                              </div>
                              <div className={styles.diaSemana}>{dataInfo.diaSemana}</div>
                            </div>

                            {/* Indicadores visuais */}
                            <div className={styles.indicadores}>
                              <div className={styles.indicadorOperacoes}>
                                <span className={styles.numero}>{stats.total}</span>
                                <span className={styles.label}>ops</span>
                              </div>

                              {stats.confirmados > 0 && (
                                <div className={styles.indicadorConfirmados}>
                                  <span className={styles.numero}>{stats.confirmados}</span>
                                  <span className={styles.label}>conf</span>
                                </div>
                              )}

                              {stats.excluidas > 0 && (
                                <div className={styles.indicadorExcluidas}>
                                  <span className={styles.numero}>{stats.excluidas}</span>
                                  <span className={styles.label}>exc</span>
                                </div>
                              )}
                            </div>

                            {/* Modalidades preview */}
                            <div className={styles.modalidadesPreview}>
                              {operacoesData.some(op => op.modalidade === 'BLITZ') && (
                                <span className={styles.modalidadeIcon} title="BLITZ">🚨</span>
                              )}
                              {operacoesData.some(op => op.modalidade === 'BALANCA') && (
                                <span className={styles.modalidadeIcon} title="BALANÇA">⚖️</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botão direita do mês */}
                    <button
                      className={`${styles.navButton} ${styles.navRight}`}
                      onClick={() => {
                        const container = document.getElementById(`mes-${mesAno}`);
                        if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                      }}
                      title="Navegar para próximas datas"
                    >
                      <span className={styles.navArrow}>›</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal de detalhes */}
          {showModalDetalhes && dataSelecionada && (
            <div className={styles.modalOverlay} onClick={() => setShowModalDetalhes(false)}>
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
                    onClick={() => setShowModalDetalhes(false)}
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.modalBody}>
                  {operacoesSelecionadas.map((operacao) => (
                    <div
                      key={operacao.id}
                      className={`${styles.modalOperacaoCard} ${operacao.excluida_temporariamente === true ? styles.excluida : ''
                        }`}
                    >
                      {/* Header da operação */}
                      <div className={styles.modalOperacaoHeader}>
                        <div className={styles.modalOperacaoInfo}>
                          <span className={`${styles.modalidadeBadge} ${operacao.modalidade === 'BLITZ' ? styles.blitz : styles.balanca
                            }`}>
                            {operacao.modalidade === 'BLITZ' ? '🚨' : '⚖️'} {operacao.modalidade}
                          </span>
                          <span className={styles.tipoBadge}>{operacao.tipo}</span>
                          <span className={styles.turnoInfo}>🕐 {operacao.turno}</span>
                          {operacao.horario && (
                            <span className={styles.horarioInfo}>• {operacao.horario}</span>
                          )}
                        </div>

                        <span className={`${styles.statusBadge} ${operacao.excluida_temporariamente === true ? styles.excluida :
                          operacao.status === 'AGUARDANDO_SOLICITACOES' ? styles.ativa : styles.outras
                          }`}>
                          {operacao.excluida_temporariamente === true ? 'EXCLUÍDA' :
                            operacao.status === 'AGUARDANDO_SOLICITACOES' ? 'ATIVA' : operacao.status}
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
                              }}
                              data-tooltip={operacao.horario ? `Horário atual: ${operacao.horario} • Clique para editar` : "Definir horário da operação"}
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
          )}
        </>
      )}
    </div>
  );
};

export default TimelineOperacoes;