'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Operacao } from '@/shared/types';
import { useRealtimeOperacoes } from '@/hooks/useRealtime';
import { ElegantInlineLoader } from '@/shared/components/ui/LoadingSpinner';
import { clickInspector, limparTodosOsLogs } from '@/lib/logger';
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
  console.log(`[TEMP-LOG-TIMELINE] 🚀 === COMPONENTE TimelineOperacoes RENDERIZADO ===`);
  console.log(`[TEMP-LOG-TIMELINE] 📊 Props: operacoes.length=${operacoes.length}, loading=${loading}`);
  
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [showModalDetalhes, setShowModalDetalhes] = useState(false);
  // Modo removido - sempre timeline - versão simplificada
  const [showInspectorModal, setShowInspectorModal] = useState(false);
  const [inspectorResult, setInspectorResult] = useState<{ discrepancias: any[], success: boolean, isCleanup?: boolean } | null>(null);
  
  // Funcionalidade de modo removida
  
  // 🚀 NOVO: Estado para solicitações em tempo real
  const [solicitacoesPorOperacao, setSolicitacoesPorOperacao] = useState<{[key: number]: any[]}>({});
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);

  // 🎯 CONTROLE DE PERFORMANCE: Request deduplication sem cache
  const lastRequestRef = useRef<Promise<any> | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestCounterRef = useRef<number>(0);

  // 🔥 LOGS ESPECÍFICOS: Event tracking para sobrecarga
  const eventCounterRef = useRef<number>(0);
  const eventTimestampsRef = useRef<number[]>([]);
  const lastSetStateRef = useRef<number>(0);
  const renderCounterRef = useRef<number>(0);

  // 🚀 MEMOIZAÇÃO CORRETA: IDs de todas as operações ordenados e estáveis
  const operacaoIds = useMemo(() => {
    return operacoes.map(op => op.id).sort((a, b) => a - b);
  }, [operacoes.map(op => op.id).sort((a, b) => a - b).join(',')]);

  // 🚀 NOVA FUNCIONALIDADE: Calcular range de datas das operações para o hook unificado
  const dateRange = useMemo(() => {
    if (operacoes.length === 0) {
      const hoje = new Date();
      return {
        startDate: hoje,
        endDate: hoje
      };
    }

    const datas = operacoes.map(op => new Date(op.data_operacao));
    const minData = new Date(Math.min(...datas.map(d => d.getTime())));
    const maxData = new Date(Math.max(...datas.map(d => d.getTime())));
    
    return {
      startDate: minData,
      endDate: maxData
    };
  }, [operacoes]);
  
  // 🚀 FUNÇÃO OTIMIZADA: Carregar solicitações sempre com dados frescos
  const carregarSolicitacoes = useCallback(async (operacaoIdEspecifica?: number) => {
    const requestId = ++requestCounterRef.current;
    const startTime = Date.now();
    
    // Request loading logging removed for performance
    
    if (operacaoIds.length === 0) {
      // No operations logging removed for performance
      return;
    }

    // 🎯 CONTROLE DE CONCORRÊNCIA: Se já há uma requisição em andamento, reutilizar
    if (lastRequestRef.current) {
      // Request reuse logging removed for performance
      try {
        const result = await lastRequestRef.current;
        return result;
      } catch (error) {
        // Continuar com nova requisição se a anterior falhou
      }
    }
    
    try {
      setLoadingSolicitacoes(true);
      
      // 🎯 OTIMIZAÇÃO: Endpoint específico vs completo
      let endpoint = '/api/supervisor/solicitacoes';
      if (operacaoIdEspecifica) {
        // 🚀 NOVO: Endpoint para operação específica (quando disponível)
        // Por enquanto, usar o endpoint completo mas processar apenas a operação específica
        endpoint = '/api/supervisor/solicitacoes';
      }
      
      // 🎯 CRIAR PROMISE QUE SERÁ REUTILIZADA
      const requestPromise = fetch(endpoint).then(response => response.json());
      lastRequestRef.current = requestPromise;
      
      const result = await requestPromise;
      
      // ✅ LIMPAR REFERÊNCIA APÓS COMPLETAR
      if (lastRequestRef.current === requestPromise) {
        lastRequestRef.current = null;
      }
      
      if (result.success) {
        // 🚀 PROCESSAMENTO SEMPRE FRESCO: Dados sempre atualizados
        const todasSolicitacoes = result.data?.todas || [];
        // Processing requests logging removed for performance
        
        // Agrupar solicitações por operação
        const solicitacoesPorOp: {[key: number]: any[]} = {};
        
        todasSolicitacoes.forEach((sol: any) => {
          const opId = sol.operacaoDetalhes?.id || sol.operacaoId || sol.operacao_id;
          if (opId) {
            if (!solicitacoesPorOp[opId]) {
              solicitacoesPorOp[opId] = [];
            }
            solicitacoesPorOp[opId].push(sol);
          }
        });
        
        // 🎯 OTIMIZAÇÃO GRANULAR: Atualizar apenas operação específica quando possível
        if (operacaoIdEspecifica) {
          // Specific operation update logging removed for performance
          
          // ✅ SEGURANÇA: Atualizar apenas uma operação específica no estado
          setSolicitacoesPorOperacao(prevState => {
            const newState = { ...prevState };
            
            if (solicitacoesPorOp[operacaoIdEspecifica]) {
              newState[operacaoIdEspecifica] = solicitacoesPorOp[operacaoIdEspecifica];
              // Operation state update logging removed for performance
            } else {
              // ✅ REMOÇÃO: Se não há solicitações para esta operação, removê-la do estado
              delete newState[operacaoIdEspecifica];
              // Operation state removal logging removed for performance
            }
            
            return newState;
          });
        } else {
          // ✅ FALLBACK: Carregamento completo (comportamento original)
          // Full load logging removed for performance
          
          const newStateKeys = Object.keys(solicitacoesPorOp);
          // State update logging removed for performance
          
          setSolicitacoesPorOperacao(solicitacoesPorOp);
        }
      } else {
        // API error logging removed for performance
      }
      
      return result;
    } catch (error) {
      // Request error logging removed for performance
      // ✅ LIMPAR REFERÊNCIA EM CASO DE ERRO
      lastRequestRef.current = null;
      throw error;
    } finally {
      setLoadingSolicitacoes(false);
    }
  }, [operacaoIds]);

  // 🎯 DEBOUNCE INTELIGENTE: Função para agendar carregamento com cancelamento
  const agendarCarregamento = useCallback((motivo: string, delay: number = 200, operacaoIdEspecifica?: number) => {
    // Debounce scheduling logging removed for performance
    
    // ✅ CANCELAR TIMER ANTERIOR
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // ✅ AGENDAR NOVO TIMER
    debounceTimerRef.current = setTimeout(() => {
      // Debounce execution logging removed for performance
      debounceTimerRef.current = null;
      carregarSolicitacoes(operacaoIdEspecifica);
    }, delay);
  }, [carregarSolicitacoes]);
  
  // 🚀 CALLBACK MEMOIZADO: Para evitar recriar função em cada render
  const handleRealtimeUpdate = useCallback((operacaoId: number, eventType?: string) => {
    const eventTime = Date.now();
    const eventId = ++eventCounterRef.current;
    
    // ✅ OTIMIZADO: Event overload detection com logs mínimos
    eventTimestampsRef.current.push(eventTime);
    const recentEvents = eventTimestampsRef.current.filter(t => eventTime - t < 5000); // Últimos 5 segundos
    eventTimestampsRef.current = recentEvents;
    
    // ✅ OTIMIZADO: Log apenas sobrecarga crítica
    if (recentEvents.length > 20) {
      console.warn(`[Realtime] 🚨 SOBRECARGA CRÍTICA! ${recentEvents.length} eventos em 5s`);
    }
    
    // Funcionalidade removida - não há mais modo compacto
  }, [agendarCarregamento]);
  
  // ✅ NOVO: Hook realtime otimizado para operações
  console.log(`[TEMP-LOG-TIMELINE] 🔄 Migrando para useRealtimeOperacoes...`);
  const { 
    isConnected, 
    reconnect: forceRealtimeRefresh 
  } = useRealtimeOperacoes({
    operacaoIds,
    enabled: operacaoIds.length > 0 && !loading,
    onOperacaoChange: (operacaoId, eventType) => {
      console.log(`[TEMP-LOG-TIMELINE] 🔄 Operação ${operacaoId} alterada: ${eventType}`);
      handleRealtimeUpdate(operacaoId, eventType);
    },
    onParticipacaoChange: (operacaoId, eventType) => {
      console.log(`[TEMP-LOG-TIMELINE] 👤 Participação operação ${operacaoId} alterada: ${eventType}`);
      handleRealtimeUpdate(operacaoId, eventType);
    },
    debug: false
  });
  console.log(`[TEMP-LOG-TIMELINE] ✅ Hook realtime ativo - Conectado: ${isConnected}`);

  // Funcionalidade removida - não há mais modo compacto
  
  // ✅ OTIMIZADO: CARREGAR SOLICITAÇÕES INICIALMENTE
  useEffect(() => {
    if (operacaoIds.length > 0 && !loadingSolicitacoes) {
      carregarSolicitacoes(); // ✅ CARREGAMENTO COMPLETO para carregamento inicial
    }
  }, [operacaoIds.length]);

  // ✅ CONTROLE DE SCROLL DO MODAL
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

  // ✅ REABRIR MODAL APÓS OPERAÇÕES (ex: salvar horário)
  useEffect(() => {
    if (dataParaReabrir && !showModalDetalhes) {
      setDataSelecionada(dataParaReabrir);
      setShowModalDetalhes(true);
    }
  }, [dataParaReabrir, showModalDetalhes]);

  // ✅ OTIMIZADO: Monitor de solicitações removido (logs excessivos)

  const timelineRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Hook para fechar modal do inspetor com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showInspectorModal) {
        setShowInspectorModal(false);
      }
      if (e.key === 'Enter' && showInspectorModal) {
        setShowInspectorModal(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showInspectorModal]);

  // Agrupar operações por data e mês
  const operacoesPorData = useMemo(() => {
    const grupos: { [key: string]: Operacao[] } = {};
    
    operacoes.forEach(operacao => {
      const data = operacao.data_operacao.split('T')[0]; // YYYY-MM-DD
      if (!grupos[data]) {
        grupos[data] = [];
      }
      grupos[data].push(operacao);
    });

    // Ordenar datas (mais recentes primeiro)
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

    // Ordenar meses (mais recentes primeiro) e dentro de cada mês, ordenar datas do início para o fim
    const mesesOrdenados = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    const resultado: { [key: string]: { [key: string]: Operacao[] } } = {};
    
    mesesOrdenados.forEach(mes => {
      // Ordenar datas dentro do mês do início para o fim (crescente)
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

  // Funções de navegação
  const scrollTimeline = (direction: 'left' | 'right') => {
    if (timelineRef.current) {
      const scrollAmount = 300;
      const newScrollLeft = timelineRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      timelineRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

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
              🚨 Nova Operação
            </button>
          )}
          


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
                      className={`${styles.modalOperacaoCard} ${
                        operacao.excluida_temporariamente === true ? styles.excluida : ''
                      }`}
                    >
                      {/* Header da operação */}
                      <div className={styles.modalOperacaoHeader}>
                        <div className={styles.modalOperacaoInfo}>
                          <span className={`${styles.modalidadeBadge} ${
                            operacao.modalidade === 'BLITZ' ? styles.blitz : styles.balanca
                          }`}>
                            {operacao.modalidade === 'BLITZ' ? '🚨' : '⚖️'} {operacao.modalidade}
                          </span>
                          <span className={styles.tipoBadge}>{operacao.tipo}</span>
                          <span className={styles.turnoInfo}>🕐 {operacao.turno}</span>
                          {operacao.horario && (
                            <span className={styles.horarioInfo}>• {operacao.horario}</span>
                          )}
                        </div>

                        <span className={`${styles.statusBadge} ${
                          operacao.excluida_temporariamente === true ? styles.excluida :
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

          {/* Modal do Inspetor */}
          {showInspectorModal && inspectorResult && (
            <div 
              className={styles.modalOverlay} 
              onClick={() => setShowInspectorModal(false)}
            >
              <div 
                className={styles.modalContent} 
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '500px' }}
              >
                <div className={styles.modalHeader}>
                  <div className={styles.modalTitle}>
                    <h3>
                      {inspectorResult.isCleanup 
                        ? '🧹 Limpeza Concluída' 
                        : inspectorResult.success 
                        ? '✅ Resultado do Inspetor' 
                        : '🚨 Resultado do Inspetor'
                      }
                    </h3>
                    <p>
                      {inspectorResult.isCleanup
                        ? 'Dados do inspetor foram limpos'
                        : inspectorResult.success 
                        ? 'Verificação de integridade concluída'
                        : `${inspectorResult.discrepancias.length} discrepância(s) encontrada(s)`
                      }
                    </p>
                  </div>
                  
                  <button
                    className={styles.modalCloseButton}
                    onClick={() => setShowInspectorModal(false)}
                    title="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.modalBody}>
                  {inspectorResult.success ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px 20px',
                      color: '#16a34a'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>
                        {inspectorResult.isCleanup ? '🧹' : '✅'}
                      </div>
                      <h4 style={{ margin: '0 0 8px 0', color: '#16a34a' }}>
                        {inspectorResult.isCleanup ? 'Dados Limpos!' : 'Perfeito!'}
                      </h4>
                      <p style={{ margin: '0', color: '#65a30d' }}>
                        {inspectorResult.isCleanup 
                          ? 'Todos os dados do inspetor foram removidos. Pronto para novo teste!'
                          : 'Todos os clicks foram renderizados corretamente.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '20px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '16px',
                        color: '#dc2626'
                      }}>
                        <span style={{ fontSize: '24px', marginRight: '12px' }}>🚨</span>
                        <strong>Atenção: Discrepâncias detectadas!</strong>
                      </div>
                      
                      <p style={{ 
                        margin: '0 0 16px 0', 
                        color: '#991b1b',
                        fontSize: '14px'
                      }}>
                        {inspectorResult.discrepancias.length} problema(s) encontrado(s) na sincronização 
                        entre clicks e renderizações.
                      </p>
                      
                      <div style={{
                        backgroundColor: '#fff',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        fontSize: '13px',
                        color: '#7f1d1d'
                      }}>
                        💡 <strong>Como resolver:</strong><br/>
                        • Verifique o console do navegador para detalhes<br/>
                        • Use o botão "🧹 Limpar" para resetar os dados<br/>
                        • Execute um novo teste após a limpeza
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ 
                  padding: '20px',
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  {!inspectorResult.success && (
                    <button
                      onClick={() => {
                        // ✅ OTIMIZADO: Log removido (performance)
                        setShowInspectorModal(false);
                      }}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      📋 Ver Detalhes no Console
                    </button>
                  )}
                  
                  <button
                    onClick={() => setShowInspectorModal(false)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: inspectorResult.success ? '#16a34a' : '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {inspectorResult.isCleanup 
                      ? '🧹 Fechar' 
                      : inspectorResult.success 
                      ? '✅ Fechar' 
                      : '🚨 Entendi'
                    }
                  </button>
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