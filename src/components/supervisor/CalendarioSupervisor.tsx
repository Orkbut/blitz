'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { JanelaOperacional } from '@/shared/types';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { getSupervisorHeaders, formatarDataBR, formatarPeriodoJanela, obterDataAtualIguatu } from '@/lib/auth-utils';
import { ModalInativacaoOperacoes } from './ModalInativacaoOperacoes';

interface Operacao {
  id: number;
  data_operacao: string;
  modalidade: string;
  tipo: string;
  turno?: string;
  limite_participantes: number;
  ativa: boolean;
  participantes_confirmados?: number;
  pessoas_na_fila?: number;
  total_solicitacoes?: number;
  participacoes?: Array<{
    id: number;
    servidor_id: string;
    confirmado: boolean;
    estado_visual: string;
    posicao_fila?: number;
    servidor?: {
      id: number;
      nome: string;
      matricula: string;
    };
  }>;
  status?: string;
  excluida_temporariamente?: boolean;
  janela_id?: number;
  // Campos para inativação de operações
  inativa_pelo_supervisor?: boolean;
  data_inativacao?: string;
  motivo_inativacao?: string;
  supervisor_inativacao_id?: number;
}

import styles from '../calendario/Calendario.module.css';
import supervisorStyles from './CalendarioSupervisor.module.css';

interface CalendarioSupervisorProps {
  onOperacaoClick: (operacoes: Operacao[]) => void;
  onNovaJanela?: () => void;
  onNovaOperacao?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export const CalendarioSupervisor: React.FC<CalendarioSupervisorProps> = ({
  onOperacaoClick,
  onNovaJanela,
  onNovaOperacao,
  onRefresh,
  loading: externalLoading = false
}) => {
  // Efeito de scroll para o header interativo
  useEffect(() => {
    const header = document.getElementById('header-interativo');
    if (!header) return;

    let lastScroll = 0;
    const handleScroll = () => {
      const currentScroll = window.scrollY;

      if (currentScroll <= 0) {
        header.style.transform = 'translateY(0)';
        header.style.opacity = '1';
        return;
      }

      if (currentScroll > lastScroll) {
        // Scroll para baixo - esconde header
        header.style.transform = 'translateY(-100%)';
        header.style.opacity = '0';
      } else {
        // Scroll para cima - mostra header
        header.style.transform = 'translateY(0)';
        header.style.opacity = '1';
      }

      lastScroll = currentScroll;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [janelas, setJanelas] = useState<JanelaOperacional[]>([]);
  const [janelaSelecionada, setJanelaSelecionada] = useState<number | null>(null);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalInativacaoAberto, setModalInativacaoAberto] = useState(false);

  // Garantir que operacoes seja sempre um array válido
  const operacoesSeguras = Array.isArray(operacoes) ? operacoes : [];

  // Carregar janelas disponíveis
  useEffect(() => {
    carregarJanelas();
  }, []);

  // Carregar operações quando mudar janela
  useEffect(() => {
    if (janelaSelecionada) {
      carregarOperacoes();
    }
  }, [janelaSelecionada]);

  const carregarJanelas = async () => {
    try {
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();

      if (result.success) {
        setJanelas(result.data);
        const primeiraJanelaAtiva = result.data.find((j: JanelaOperacional) => j.status === 'ATIVA');
        if (primeiraJanelaAtiva && !janelaSelecionada) {
          setJanelaSelecionada(primeiraJanelaAtiva.id);
        }
      }
    } catch (error) {
      // Erro silencioso
    }
  };

  const carregarOperacoes = useCallback(async () => {
    if (!janelaSelecionada) return;

    setLoading(true);
    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor', {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();

      if (result.success) {
        let operacoesData = Array.isArray(result.data) ? result.data : [];
        const operacoesFiltradas = operacoesData.filter((op: any) =>
          op.janela_id === janelaSelecionada
        );
        setOperacoes(operacoesFiltradas);
      } else {
        setOperacoes([]);
      }
    } catch (error) {
      setOperacoes([]);
    } finally {
      setLoading(false);
    }
  }, [janelaSelecionada]);

  const carregarOperacoesSilencioso = useCallback(async () => {
    if (!janelaSelecionada) return;

    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/unified/operacoes?portal=supervisor&_t=${timestamp}`, {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();

      if (result.success) {
        let operacoesData = Array.isArray(result.data) ? result.data : [];
        const operacoesFiltradas = operacoesData.filter((op: any) =>
          op.janela_id === janelaSelecionada
        );
        setOperacoes(operacoesFiltradas);
      }
    } catch (error) {
      // Erro silencioso
    }
  }, [janelaSelecionada]);

  const reloadDados = useCallback(() => {
    carregarOperacoesSilencioso();
  }, [carregarOperacoesSilencioso]);

  const calcularPeriodoVisualizacao = () => {
    if (!janelaSelecionada) {
      return {
        start: new Date(),
        end: new Date()
      };
    }

    const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
    if (!janelaAtual) {
      return {
        start: new Date(),
        end: new Date()
      };
    }

    // ✅ CORREÇÃO: Adicionar horário para evitar problemas de timezone
    const dataInicio = new Date(`${janelaAtual.dataInicio}T12:00:00`);
    const dataFim = new Date(`${janelaAtual.dataFim}T12:00:00`);

    return {
      start: dataInicio,
      end: dataFim
    };
  };

  useRealtimeUnified({
    channelId: `calendario-supervisor-${janelaSelecionada}`,
    tables: ['operacao', 'participacao'],
    enableRealtime: true,
    enablePolling: false,
    enableFetch: false,
    debug: false,
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;
      console.log(`[CalendarioSupervisor] 📡 ${table} ${eventType} - Recarregando dados...`);
      reloadDados();
    }, [reloadDados])
  });

  const { start: calendarStart, end: calendarEnd } = calcularPeriodoVisualizacao();

  const dias = useMemo(() => {
    if (!janelaSelecionada) return [];

    const weekStart = startOfWeek(calendarStart, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(calendarEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [calendarStart, calendarEnd, janelaSelecionada]);

  // Agrupar operações por dia
  const operacoesPorDia = operacoesSeguras.reduce((acc, op: Operacao) => {
    const dataOp = op.data_operacao;
    if (!dataOp) return acc;
    const key = dataOp.includes('T') ? dataOp.split('T')[0] : dataOp;
    if (!acc[key]) acc[key] = [];
    acc[key].push(op);
    return acc;
  }, {} as Record<string, Operacao[]>);

  const formatarPeriodoVisualizacao = () => {
    if (!janelaSelecionada) {
      return 'Selecione uma janela';
    }

    const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
    if (!janelaAtual) {
      return 'Janela não encontrada';
    }

    return formatarPeriodoJanela(janelaAtual.dataInicio, janelaAtual.dataFim);
  };

  const isOperacaoViavel = (operacao: Operacao) => {
    const confirmados = operacao.participantes_confirmados || 0;
    const limite = operacao.limite_participantes;
    const minimoViabilidade = Math.max(3, Math.ceil(limite * 0.5));
    const viavel = confirmados >= minimoViabilidade;
    return viavel;
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Container Principal Responsivo */}
      <div className="w-full max-w-7xl mx-auto px-1 md:px-4">
        <div className="bg-white rounded-none md:rounded-lg shadow-sm md:shadow-lg border-0 md:border border-gray-200 overflow-hidden" style={{
          minHeight: 'calc(100vh - 64px)',
          marginTop: 'clamp(4px, 0.5vw, 8px)',
          padding: 'clamp(8px, 2vw, 16px)'
        }}>
          {/* Cabeçalho Responsivo Profissional - LAYOUT ADAPTATIVO */}
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white sticky top-0 z-[100] transition-all duration-300 ease-in-out"
            style={{
              padding: 'clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 16px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              boxSizing: 'border-box',
              transform: 'translateY(0)',
              opacity: 1,
              position: 'relative'
            }}
            id="header-interativo"
          >
            {/* Container Principal - Layout Inteligente Mobile/Desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 transition-all duration-300 ease-in-out">
            
              {/* SEÇÃO PRINCIPAL: Seletor + Período (Mobile: Stack, Desktop: Horizontal) */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 flex-1 min-w-0"
                   style={{
                     rowGap: 'clamp(4px, 1vw, 8px)'
                   }}>

                {/* Seletor de Janela - ULTRA COMPACTO AJUSTADO */}
                <div className="relative mx-auto" style={{ minWidth: 'clamp(120px, 16vw, 180px)', maxWidth: 'clamp(180px, 22vw, 220px)', order: '2', zIndex: 1, overflow: 'hidden', borderRadius: 'clamp(4px, 0.8vw, 6px)' }}>
                  <select
                    value={janelaSelecionada || ''}
                    onChange={(e) => setJanelaSelecionada(Number(e.target.value) || null)}
                    className="w-full bg-white/90 border border-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all hover:bg-white appearance-none cursor-pointer shadow-sm"
                    aria-label="Selecionar janela operacional"
                    style={{
                      padding: 'clamp(5px, 0.9vw, 7px) clamp(22px, 3.5vw, 28px) clamp(5px, 0.9vw, 7px) clamp(8px, 1.5vw, 12px)',
                      borderRadius: 'clamp(4px, 0.8vw, 6px)',
                      fontSize: 'clamp(0.6rem, 1vw, 0.7rem)',
                      boxSizing: 'border-box',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      fontWeight: '500',
                      lineHeight: '1.2',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <option value="" className="text-gray-900 bg-white">
                      📋 Janela...
                    </option>
                    {janelas.map((janela) => {
                      // Formato resumido para economizar espaço: apenas DD/MM
                      const dataInicioResumo = formatarDataBR(janela.dataInicio).substring(0, 5); // DD/MM
                      const dataFimResumo = formatarDataBR(janela.dataFim).substring(0, 5); // DD/MM
                      return (
                        <option key={janela.id} value={janela.id} className="text-gray-900 bg-white py-1">
                          #{janela.id} • {dataInicioResumo} - {dataFimResumo}
                        </option>
                      );
                    })}
                  </select>
                  <div
                    className="absolute top-1/2 transform -translate-y-1/2 pointer-events-none"
                    style={{ right: 'clamp(3px, 0.6vw, 6px)' }}
                  >
                    <svg
                      className="text-white/80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{
                        width: 'clamp(8px, 1.2vw, 12px)',
                        height: 'clamp(8px, 1.2vw, 12px)'
                      }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Período Ativo - DESTAQUE PRINCIPAL */}
                <div className="flex-1 min-w-0 mx-auto" style={{ maxWidth: 'clamp(240px, 35vw, 360px)' }}>
                  <div
                    className="bg-white/30 backdrop-blur-md border-2 border-white/40"
                    style={{
                      borderRadius: 'clamp(6px, 1.2vw, 8px)',
                      padding: 'clamp(8px, 1.5vw, 12px) clamp(12px, 2.5vw, 18px)',
                      boxSizing: 'border-box',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                      textAlign: 'center'
                    }}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1rem)' }}>📅</span>
                      <div className="mt-1">
                        <div
                          className="text-white/95 font-bold"
                          style={{
                            fontSize: 'clamp(0.65rem, 1.2vw, 0.8rem)',
                            letterSpacing: 'clamp(0.2px, 0.3vw, 0.4px)',
                            textTransform: 'uppercase',
                            lineHeight: '1.2'
                          }}
                        >
                          PERÍODO ATIVO
                        </div>
                        <div
                          className="font-extrabold text-white mt-1"
                          style={{
                            fontSize: 'clamp(0.8rem, 1.5vw, 1rem)',
                            letterSpacing: 'clamp(0.2px, 0.3vw, 0.4px)',
                            lineHeight: '1.2',
                            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}
                        >
                          {formatarPeriodoVisualizacao()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO DIREITA: Botões de Ação */}
              <div className="flex gap-2 sm:gap-3 flex-shrink-0 justify-center sm:justify-end">
                {janelaSelecionada && (
                  <button
                    onClick={() => setModalInativacaoAberto(true)}
                    className="text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                      padding: 'clamp(6px, 1.2vw, 9px) clamp(10px, 2vw, 14px)',
                      borderRadius: 'clamp(4px, 0.8vw, 6px)',
                      fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)',
                      gap: 'clamp(2px, 0.4vw, 4px)',
                      minWidth: 'clamp(100px, 18vw, 130px)',
                      maxWidth: 'clamp(120px, 22vw, 150px)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(107, 114, 128, 0.3)',
                      letterSpacing: 'clamp(0.1px, 0.15vw, 0.2px)',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)' }}>📁</span>
                    <span style={{
                      minWidth: '0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      Arquivar
                    </span>
                  </button>
                )}

                {onNovaJanela && (
                  <button
                    onClick={onNovaJanela}
                    className="text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      padding: 'clamp(6px, 1.2vw, 9px) clamp(10px, 2vw, 14px)',
                      borderRadius: 'clamp(4px, 0.8vw, 6px)',
                      fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)',
                      gap: 'clamp(2px, 0.4vw, 4px)',
                      minWidth: 'clamp(80px, 14vw, 110px)',
                      maxWidth: 'clamp(100px, 18vw, 130px)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                      letterSpacing: 'clamp(0.1px, 0.15vw, 0.2px)',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)' }}>📅</span>
                    <span style={{
                      minWidth: '0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      Nova Janela
                    </span>
                  </button>
                )}

                {onNovaOperacao && (
                  <button
                    onClick={onNovaOperacao}
                    className="text-white font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      padding: 'clamp(6px, 1.2vw, 9px) clamp(10px, 2vw, 14px)',
                      borderRadius: 'clamp(4px, 0.8vw, 6px)',
                      fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)',
                      gap: 'clamp(2px, 0.4vw, 4px)',
                      minWidth: 'clamp(90px, 16vw, 120px)',
                      maxWidth: 'clamp(110px, 20vw, 140px)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)',
                      letterSpacing: 'clamp(0.1px, 0.15vw, 0.2px)',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)' }}>➕</span>
                    <span style={{
                      minWidth: '0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      Nova Operação
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grid do Calendário - NOVO DESIGN COM TILES */}
          {janelaSelecionada ? (
            <div className="p-2 sm:p-4 md:p-6">
              {/* Cabeçalho da semana - Ordem brasileira */}
              <div className="bg-gradient-to-r from-slate-100 to-slate-200 rounded-t-lg border-b border-slate-300">
                <div className="grid grid-cols-7 gap-2 p-3">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
                    <div key={dia} className="text-center">
                      <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wider">{dia}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid do calendário com tiles */}
              <div className={`bg-gradient-to-br from-slate-50 to-white rounded-b-lg ${supervisorStyles['calendar-container']}`}>
                <div className={`grid grid-cols-7 ${supervisorStyles['calendar-grid']}`}>
                  {dias.map((dia, index) => {
                    const dataFormatada = format(dia, 'yyyy-MM-dd');
                    const operacoesDia = operacoesPorDia[dataFormatada] || [];
                    const isToday_ = isToday(dia);
                    const temOperacoes = operacoesDia.length > 0;

                    const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
                    let isDentroDoPeríodo = false;

                    if (janelaAtual) {
                      const dataInicioStr = janelaAtual.dataInicio.includes('T') ? janelaAtual.dataInicio.split('T')[0] : janelaAtual.dataInicio;
                      const dataFimStr = janelaAtual.dataFim.includes('T') ? janelaAtual.dataFim.split('T')[0] : janelaAtual.dataFim;
                      const diaAtualStr = format(dia, 'yyyy-MM-dd');

                      isDentroDoPeríodo = diaAtualStr >= dataInicioStr && diaAtualStr <= dataFimStr;
                    }

                    const isComplementoSemana = !isDentroDoPeríodo && !temOperacoes;

                    // Calcular dados para o anel de progresso
                    const confirmados = operacoesDia.reduce((acc, op) => acc + (op.participantes_confirmados || 0), 0);
                    const capacidadeTotal = operacoesDia.reduce((acc, op) => acc + op.limite_participantes, 0);
                    const pendencias = operacoesDia.reduce((acc, op) => acc + ((op as any).total_solicitacoes || 0), 0);
                    const percentualOcupacao = capacidadeTotal > 0 ? Math.min(confirmados / capacidadeTotal, 1) : 0;

                    // Função para cor do anel
                    const getCorAnel = () => {
                      if (percentualOcupacao >= 0.9) return '#ef4444'; // red
                      if (percentualOcupacao >= 0.7) return '#f59e0b'; // amber
                      if (percentualOcupacao > 0) return '#22c55e'; // green
                      return '#e5e7eb'; // gray
                    };

                    return (
                      <div
                        key={dia.toISOString()}
                        data-calendar-day={format(dia, 'yyyy-MM-dd')}
                        data-has-operations={operacoesDia.length > 0}
                        className={`
                          relative rounded-2xl border transition-all duration-300 group
                          ${supervisorStyles['tile-safe']}
                          ${temOperacoes ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
                          ${isComplementoSemana ? 'opacity-40' : ''}
                          ${isToday_ ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                        `}
                        style={{
                          background: isComplementoSemana
                            ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                            : isDentroDoPeríodo
                              ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
                              : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                          borderColor: isToday_ ? '#3b82f6' : '#e2e8f0',
                          boxShadow: isToday_
                            ? '0 4px 12px rgba(59, 130, 246, 0.15)'
                            : temOperacoes
                              ? '0 2px 8px rgba(0, 0, 0, 0.1)'
                              : '0 1px 3px rgba(0, 0, 0, 0.05)'
                        }}
                        onClick={() => {
                          console.log('🔍 [CalendarioSupervisor] Clique detectado:', {
                            dataFormatada,
                            temOperacoes,
                            quantidadeOperacoes: operacoesDia.length,
                            operacoesDia,
                            onOperacaoClickExists: !!onOperacaoClick
                          });
                          if (temOperacoes && onOperacaoClick) {
                            console.log('✅ [CalendarioSupervisor] Chamando onOperacaoClick com:', operacoesDia);
                            onOperacaoClick(operacoesDia);
                          } else {
                            console.log('❌ [CalendarioSupervisor] Clique bloqueado - temOperacoes:', temOperacoes, 'onOperacaoClick:', !!onOperacaoClick);
                          }
                        }}
                      >
                        {/* Badge de pendências - POSICIONAMENTO SEGURO */}
                        {pendencias > 0 && !isComplementoSemana && (
                          <div
                            className="absolute bg-amber-500 text-white rounded-full flex items-center justify-center font-bold z-20"
                            style={{
                              top: 'clamp(-6px, -1vw, -4px)',
                              right: 'clamp(-6px, -1vw, -4px)',
                              minWidth: 'clamp(16px, 2.2vw, 20px)',
                              height: 'clamp(16px, 2.2vw, 20px)',
                              fontSize: 'clamp(0.45rem, 0.9vw, 0.6rem)',
                              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.4)',
                              // Garantir que o badge não seja cortado
                              transform: 'translate(0, 0)'
                            }}
                          >
                            {pendencias > 99 ? '99+' : pendencias}
                          </div>
                        )}

                        {/* Múltiplos anéis para operações individuais */}
                        {temOperacoes && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 'clamp(4px, 1vw, 8px)' }}>
                            <div className="relative flex items-center justify-center">
                              <svg
                                viewBox="0 0 62 62"
                                className="transform -rotate-90"
                                style={{
                                  width: 'clamp(45px, 8vw, 65px)',
                                  height: 'clamp(45px, 8vw, 65px)',
                                  maxWidth: '85%',
                                  maxHeight: '85%'
                                }}
                              >
                                {operacoesDia.map((operacao, index) => {
                                  const raio = 24 - (index * 6); // Anéis concêntricos com raios decrescentes
                                  const strokeWidth = operacoesDia.length === 1 ? 5 : 4;
                                  const participantesConfirmados = operacao.participantes_confirmados || 0;
                                  const totalSolicitacoes = operacao.total_solicitacoes || 0;
                                  const limiteParticipantes = operacao.limite_participantes || 1;
                                  
                                  // Calcular proporções
                                  const percentualConfirmados = Math.min(participantesConfirmados / limiteParticipantes, 1);
                                  const percentualSolicitacoes = Math.min(totalSolicitacoes / limiteParticipantes, 1);
                                  
                                  // Cores
                                  const corConfirmados = '#22c55e'; // Verde para confirmados
                                  const corPendentes = '#f59e0b'; // Amarelo/laranja para pendentes (cor de notificação)
                                  
                                  const circumferencia = 2 * Math.PI * raio;
                                  
                                  return (
                                    <g key={operacao.id}>
                                      {/* Trilha do anel (fundo) */}
                                      <circle
                                        cx="31"
                                        cy="31"
                                        r={raio}
                                        fill="none"
                                        stroke="#e5e7eb"
                                        strokeWidth={strokeWidth}
                                        opacity={0.3}
                                      />
                                      
                                      {/* Anel para solicitações pendentes (base) */}
                                      {totalSolicitacoes > 0 && (
                                        <circle
                                          cx="31"
                                          cy="31"
                                          r={raio}
                                          fill="none"
                                          stroke={corPendentes}
                                          strokeWidth={strokeWidth}
                                          strokeLinecap="round"
                                          strokeDasharray={circumferencia}
                                          strokeDashoffset={circumferencia * (1 - percentualSolicitacoes)}
                                          style={{
                                            transition: 'stroke-dashoffset 0.3s ease'
                                          }}
                                        />
                                      )}
                                      
                                      {/* Anel para confirmados (sobrepõe as pendentes) */}
                                      {participantesConfirmados > 0 && (
                                        <circle
                                          cx="31"
                                          cy="31"
                                          r={raio}
                                          fill="none"
                                          stroke={corConfirmados}
                                          strokeWidth={strokeWidth}
                                          strokeLinecap="round"
                                          strokeDasharray={circumferencia}
                                          strokeDashoffset={circumferencia * (1 - percentualConfirmados)}
                                          style={{
                                            transition: 'stroke-dashoffset 0.3s ease'
                                          }}
                                        />
                                      )}
                                    </g>
                                  );
                                })}
                              </svg>
                              
                              {/* Informação central */}
                              <div 
                                className="absolute inset-0 flex flex-col items-center justify-center text-center"
                                style={{
                                  pointerEvents: 'none'
                                }}
                              >
                                {operacoesDia.length === 1 ? (
                                  /* Uma operação: mostrar confirmados/total */
                                  <div 
                                    className="font-bold text-slate-700"
                                    style={{
                                      fontSize: 'clamp(0.7rem, 1.4vw, 1rem)',
                                      lineHeight: '1',
                                      textShadow: '0 1px 3px rgba(255,255,255,0.9)',
                                      fontWeight: '700'
                                    }}
                                  >
                                    {confirmados}/{capacidadeTotal}
                                  </div>
                                ) : (
                                  /* Múltiplas operações: mostrar contador */
                                  <>
                                    <div 
                                      className="text-slate-800"
                                      style={{
                                        fontSize: 'clamp(0.9rem, 1.8vw, 1.2rem)',
                                        lineHeight: '1',
                                        fontWeight: '500',
                                        letterSpacing: '-0.025em',
                                        textShadow: '0 1px 2px rgba(255,255,255,0.7)',
                                        color: '#1e293b'
                                      }}
                                    >
                                      {operacoesDia.length}
                                    </div>
                                    <div 
                                      className="text-slate-600"
                                      style={{
                                        fontSize: 'clamp(0.5rem, 1.0vw, 0.7rem)',
                                        lineHeight: '1',
                                        fontWeight: '400',
                                        letterSpacing: '0.025em',
                                        textShadow: '0 1px 1px rgba(255,255,255,0.6)',
                                        marginTop: '1px',
                                        color: '#64748b',
                                        textTransform: 'uppercase'
                                      }}
                                    >
                                      ops
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Modalidade da operação - Parte inferior do ciclo */}
                        {operacoesDia.length === 1 && (
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                            <div 
                              className="bg-white/95 border border-slate-200 rounded-full px-2.5 py-1 shadow-sm"
                              style={{
                                fontSize: 'clamp(0.55rem, 1.2vw, 0.8rem)',
                                fontWeight: 600,
                                color: '#334155',
                                letterSpacing: '0.03em',
                                textTransform: 'uppercase',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                                border: '1px solid #e2e8f0',
                                minWidth: 'clamp(34px, 6vw, 56px)',
                                textAlign: 'center' as const,
                                backdropFilter: 'blur(2px)'
                              }}
                            >
                              {String(operacoesDia[0].modalidade || '').toUpperCase() === 'BLITZ' 
                                ? 'RADAR' 
                                : String(operacoesDia[0].modalidade || '').toUpperCase()}
                            </div>
                          </div>
                        )}

                        {/* Número do dia - POSICIONAMENTO SEGURO */}
                        <div
                          className={`absolute font-bold rounded-full flex items-center justify-center z-10 ${isToday_
                            ? 'text-blue-700 bg-blue-100'
                            : isComplementoSemana
                              ? 'text-slate-400 bg-white/80'
                              : isDentroDoPeríodo
                                ? 'text-slate-800 bg-white/80'
                                : 'text-slate-500 bg-white/80'
                            }`}
                          style={{
                            top: 'clamp(2px, 0.5vw, 6px)',
                            left: 'clamp(2px, 0.5vw, 6px)',
                            width: 'clamp(16px, 2.8vw, 24px)',
                            height: 'clamp(16px, 2.8vw, 24px)',
                            fontSize: 'clamp(0.6rem, 1.2vw, 0.8rem)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          {format(dia, 'd')}
                        </div>





                        {/* Indicador de operações inativas */}
                        {operacoesDia.some(op => op.inativa_pelo_supervisor) && (
                          <div className="absolute top-1 right-1">
                            <div
                              className="bg-gray-500 text-xs font-bold px-1 py-0.5 rounded transform rotate-12"
                              style={{
                                fontSize: 'clamp(0.5rem, 1vw, 0.6rem)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                color: 'white !important',
                                backgroundColor: '#6b7280'
                              }}
                            >
                              ARQUIVO
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-6 shadow-lg">
                <span className="text-4xl">📅</span>
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
                Selecione uma Janela Operacional
              </h3>

              <p className="text-gray-600 mb-6 max-w-md leading-relaxed">
                Para visualizar as operações no calendário, você precisa primeiro selecionar uma janela operacional no seletor acima.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <span className="text-blue-500 text-lg">💡</span>
                  </div>
                  <div className="text-sm text-blue-700">
                    <p className="font-medium mb-1">Dica:</p>
                    <p>Use o seletor de janela operacional no cabeçalho azul para escolher o período que deseja visualizar.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <div className="text-sm text-gray-600">Carregando operações...</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Inativação de Operações */}
      {janelaSelecionada && (
        <ModalInativacaoOperacoes
          isOpen={modalInativacaoAberto}
          onClose={() => setModalInativacaoAberto(false)}
          janelaId={janelaSelecionada}
          onOperacoesAlteradas={carregarOperacoesSilencioso}
        />
      )}
    </div>
  );
};