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

    const dataInicio = new Date(janelaAtual.dataInicio);
    const dataFim = new Date(janelaAtual.dataFim);

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

    const weekStart = startOfWeek(calendarStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(calendarEnd, { weekStartsOn: 1 });

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
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white sticky top-0 z-50 transition-all duration-300 ease-in-out"
            style={{
              padding: 'clamp(6px, 1vw, 10px) clamp(8px, 1.5vw, 16px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              boxSizing: 'border-box',
              transform: 'translateY(0)',
              opacity: 1
            }}
            id="header-interativo"
          >
            {/* Container Principal - Layout Inteligente Mobile/Desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 transition-all duration-300 ease-in-out">
              
              {/* SEÇÃO PRINCIPAL: Seletor + Período (Mobile: Stack, Desktop: Horizontal) */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 flex-1 min-w-0">
                
                {/* Seletor de Janela - ULTRA COMPACTO */}
                <div className="relative mx-auto" style={{ minWidth: 'clamp(140px, 18vw, 200px)', maxWidth: 'clamp(200px, 25vw, 260px)', order: '2' }}>
                  <select
                    value={janelaSelecionada || ''}
                    onChange={(e) => setJanelaSelecionada(Number(e.target.value) || null)}
                    className="w-full bg-white/25 border border-white/50 text-white focus:outline-none focus:ring-2 focus:ring-white/70 transition-all hover:bg-white/30 appearance-none cursor-pointer backdrop-blur-sm"
                    aria-label="Selecionar janela operacional"
                    style={{
                      padding: 'clamp(6px, 1vw, 8px) clamp(24px, 4vw, 32px) clamp(6px, 1vw, 8px) clamp(10px, 1.8vw, 14px)',
                      borderRadius: 'clamp(4px, 0.8vw, 6px)',
                      fontSize: 'clamp(0.65rem, 1.1vw, 0.75rem)',
                      boxSizing: 'border-box',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      fontWeight: '500',
                      lineHeight: '1.3'
                    }}
                  >
                    <option value="" className="text-gray-900 bg-white">
                      📋 Selecione janela...
                    </option>
                    {janelas.map((janela) => {
                      const periodoFormatado = formatarPeriodoJanela(janela.dataInicio, janela.dataFim);
                      return (
                        <option key={janela.id} value={janela.id} className="text-gray-900 bg-white py-1">
                          📅 #{janela.id} • {periodoFormatado}
                        </option>
                      );
                    })}
                  </select>
                  <div
                    className="absolute top-1/2 transform -translate-y-1/2 pointer-events-none"
                    style={{ right: 'clamp(4px, 0.8vw, 8px)' }}
                  >
                    <svg
                      className="text-white/80"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{
                        width: 'clamp(10px, 1.5vw, 14px)',
                        height: 'clamp(10px, 1.5vw, 14px)'
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
                      Inativar Operações
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

          {/* Grid do Calendário */}
          {janelaSelecionada ? (
            <div className="p-1 sm:p-2 md:p-4 lg:p-6">
              {/* Cabeçalho da semana - Ordem brasileira */}
              <div className="bg-gradient-to-r from-slate-100 to-slate-200 border-b-2 border-slate-300">
                <div className="grid grid-cols-7 gap-0">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((dia) => (
                    <div key={dia} className="p-1 sm:p-1.5 md:p-3 text-center">
                      <span className="text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wider">{dia}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid do calendário profissional */}
              <div className="bg-gradient-to-br from-white to-slate-50 overflow-x-auto">
                <div className="grid grid-cols-7 gap-0 border-l-0 md:border-l border-slate-300 min-w-[280px] xs:min-w-[320px]">
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

                    const diaDaSemana = (dia.getDay() + 6) % 7;
                    const isInicioSemana = diaDaSemana === 0;
                    
                    // Ajustes de responsividade para mobile
                    const cellPadding = 'p-1 xs:p-1.5 sm:p-2 md:p-3';
                    const cellTextSize = 'text-[10px] xs:text-xs sm:text-sm';
                    const cellHeight = 'h-12 xs:h-14 sm:h-16 md:h-20';
                    const cellBorder = 'border-r border-b border-slate-300';
                    const cellBg = isToday_ ? 'bg-blue-50' : isDentroDoPeríodo ? 'bg-white' : 'bg-slate-50';
                    const cellOpacity = isComplementoSemana ? 'opacity-60' : '';
                    const isFimSemana = diaDaSemana === 6;

                    return (
                      <div
                        key={dia.toISOString()}
                        data-calendar-day={format(dia, 'yyyy-MM-dd')}
                        data-has-operations={operacoesDia.length > 0}
                        className={`
                      min-h-[80px] xs:min-h-[100px] sm:min-h-[120px] md:min-h-[150px] border-r border-b md:border-r-2 md:border-b-2 border-slate-300 relative group transition-all duration-300
                      ${temOperacoes ? 'cursor-pointer' : ''}
                      ${isComplementoSemana
                            ? 'bg-gradient-to-br from-slate-100 to-slate-200'
                            : isDentroDoPeríodo
                              ? 'bg-gradient-to-br from-white via-slate-50 to-blue-50 shadow-inner'
                              : 'bg-gradient-to-br from-slate-50 to-slate-100'
                          }
                      ${isToday_ ? 'ring-2 ring-blue-500 ring-inset bg-gradient-to-br from-blue-50 to-blue-100' : ''}
                      ${temOperacoes ? 'hover:shadow-lg hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200' : ''}
                      ${isInicioSemana ? 'border-l-2 border-l-slate-300' : ''}
                      ${isFimSemana ? 'border-r-2 border-r-slate-300' : ''}
                      ${cellPadding} ${cellHeight} ${cellBorder} ${cellBg} ${cellOpacity}
                    `}
                        onClick={() => temOperacoes && onOperacaoClick && onOperacaoClick(operacoesDia)}
                      >
                        {/* Data do dia - COMPACTO COMO CALENDÁRIO SIMPLES */}
                        <div 
                          className={`font-bold ${isToday_
                            ? 'text-blue-700 bg-blue-200'
                            : isComplementoSemana
                              ? 'text-slate-400 bg-white/90'
                              : isDentroDoPeríodo
                                ? 'text-slate-800 bg-white/90'
                                : 'text-slate-500 bg-white/90'
                            }`}
                          style={{
                            fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
                            position: 'absolute',
                            top: 'clamp(2px, 0.5vw, 4px)',
                            left: 'clamp(2px, 0.5vw, 4px)',
                            minWidth: 'clamp(14px, 3vw, 18px)',
                            height: 'clamp(14px, 3vw, 18px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'all 0.2s ease',
                            flexShrink: '0',
                            zIndex: '10',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          {format(dia, 'd')}
                          {isToday_ && <span style={{ marginLeft: '2px', fontSize: '0.6rem' }}>📍</span>}
                        </div>

                        {/* Operações do dia - TÉCNICA DO CALENDÁRIO DOS MEMBROS */}
                        {temOperacoes && (
                          <div
                            style={{
                              flex: '1',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 'clamp(1px, 0.3vw, 2px)',
                              textAlign: 'center',
                              padding: 'clamp(3px, 0.6vw, 6px)',
                              marginTop: 'clamp(8px, 1.5vw, 12px)',
                              height: 'calc(100% - clamp(8px, 1.5vw, 12px))',
                              boxSizing: 'border-box',
                              position: 'relative',
                              overflow: 'visible',
                              width: '100%'
                            }}
                          >
                            {operacoesDia.slice(0, 3).map((operacao) => (
                              <div
                                key={operacao.id}
                                onClick={() => onOperacaoClick([operacao])}
                                className={`
                              relative overflow-hidden transition-all duration-200 
                              hover:shadow-lg hover:scale-[1.02] cursor-pointer
                              ${operacao.modalidade === 'BLITZ'
                                    ? 'bg-gradient-to-br from-red-50 via-red-50 to-red-100 border border-red-200 hover:border-red-300'
                                    : 'bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100 border border-amber-200 hover:border-amber-300'
                                  }
                              ${operacao.inativa_pelo_supervisor ? supervisorStyles['operacao-inativa'] : ''}
                            `}
                                style={{
                                  borderRadius: 'clamp(3px, 0.8vw, 6px)',
                                  padding: 'clamp(2px, 0.5vw, 4px) clamp(3px, 0.7vw, 6px)',
                                  width: '100%',
                                  minHeight: 'clamp(30px, 6vw, 50px)',
                                  boxSizing: 'border-box'
                                }}
                              >
                                {/* Header da operação - TÉCNICA DO CALENDÁRIO DOS MEMBROS */}
                                <div
                                  className="flex items-center justify-center w-full text-center"
                                  style={{
                                    gap: 'clamp(1px, 0.3vw, 2px)',
                                    marginBottom: 'clamp(1px, 0.2vw, 2px)',
                                    padding: 'clamp(1px, 0.2vw, 2px)',
                                    fontSize: 'clamp(0.45rem, 1.2vw, 0.65rem)',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: 'clamp(0.1px, 0.2vw, 0.3px)',
                                    lineHeight: '1.1',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                                      flexShrink: '0'
                                    }}
                                  >
                                    {operacao.modalidade === 'BLITZ' ? '🚨' : '⚖️'}
                                  </span>
                                  <span className={`${operacao.modalidade === 'BLITZ' ? 'text-red-700' : 'text-amber-700'} ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}>
                                    {operacao.modalidade}
                                  </span>
                                </div>

                                {/* Barras de status - TÉCNICA DO CALENDÁRIO DOS MEMBROS */}
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 'clamp(1px, 0.2vw, 2px)',
                                  width: '100%'
                                }}>
                                  {(() => {
                                    const confirmados = operacao.participantes_confirmados || 0;
                                    const solicitacoes = (operacao as any).total_solicitacoes || 0;
                                    const limite = operacao.limite_participantes;

                                    return (
                                      <>
                                        {/* Barra Confirmados - TÉCNICA DO CALENDÁRIO DOS MEMBROS */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5px, 0.1vw, 1px)' }}>
                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            width: '100%'
                                          }}>
                                            <span
                                              className={`text-green-700 flex items-center ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}
                                              style={{
                                                fontSize: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                                                fontWeight: '600',
                                                gap: 'clamp(0.5px, 0.2vw, 1px)',
                                                flexShrink: '1',
                                                minWidth: '0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              <span style={{ fontSize: 'clamp(0.35rem, 1vw, 0.5rem)', flexShrink: '0' }}>✅</span>
                                              <span style={{ minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                Conf.
                                              </span>
                                            </span>
                                            <span
                                              className={`text-green-800 ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}
                                              style={{
                                                fontSize: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                                                fontWeight: '700',
                                                flexShrink: '0',
                                                marginLeft: 'clamp(2px, 0.5vw, 4px)'
                                              }}
                                            >
                                              {confirmados}/{limite}
                                            </span>
                                          </div>
                                          <div
                                            className={`bg-gray-200 rounded-full overflow-hidden ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}
                                            style={{
                                              width: '100%',
                                              height: 'clamp(2px, 0.5vw, 4px)'
                                            }}
                                          >
                                            <div
                                              className={`bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-300 ${operacao.inativa_pelo_supervisor ? 'opacity-50' : ''}`}
                                              style={{
                                                height: '100%',
                                                width: `${limite > 0 ? Math.min(100, (confirmados / limite) * 100) : 0}%`
                                              }}
                                            />
                                          </div>
                                        </div>

                                        {/* Barra Solicitações - TÉCNICA DO CALENDÁRIO DOS MEMBROS */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5px, 0.1vw, 1px)' }}>
                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            width: '100%'
                                          }}>
                                            <span
                                              className={`text-amber-700 flex items-center ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}
                                              style={{
                                                fontSize: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                                                fontWeight: '600',
                                                gap: 'clamp(0.5px, 0.2vw, 1px)',
                                                flexShrink: '1',
                                                minWidth: '0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                              }}
                                            >
                                              <span style={{ fontSize: 'clamp(0.35rem, 1vw, 0.5rem)', flexShrink: '0' }}>⏳</span>
                                              <span style={{ minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                Solic.
                                              </span>
                                            </span>
                                            <span
                                              className={`text-amber-800 ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}
                                              style={{
                                                fontSize: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                                                fontWeight: '700',
                                                flexShrink: '0',
                                                marginLeft: 'clamp(2px, 0.5vw, 4px)'
                                              }}
                                            >
                                              {solicitacoes}
                                            </span>
                                          </div>
                                          <div
                                            className={`bg-gray-200 rounded-full overflow-hidden ${operacao.inativa_pelo_supervisor ? 'opacity-60' : ''}`}
                                            style={{
                                              width: '100%',
                                              height: 'clamp(2px, 0.5vw, 4px)'
                                            }}
                                          >
                                            <div
                                              className={`bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300 ${operacao.inativa_pelo_supervisor ? 'opacity-50' : ''}`}
                                              style={{
                                                height: '100%',
                                                width: `${solicitacoes > 0 ? Math.min(100, (solicitacoes / limite) * 100) : 0}%`
                                              }}
                                            />
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>

                                {/* Efeito hover sutil */}
                                <div className="absolute inset-0 bg-white opacity-0 hover:opacity-5 transition-opacity duration-200 pointer-events-none rounded-md"></div>
                              </div>
                            ))}

                            {/* Indicador de mais operações - TÉCNICA DO CALENDÁRIO DOS MEMBROS */}
                            {operacoesDia.length > 3 && (
                              <div
                                className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 text-center transition-all duration-200 hover:shadow-sm cursor-pointer text-slate-600"
                                style={{
                                  borderRadius: 'clamp(2px, 0.6vw, 4px)',
                                  padding: 'clamp(2px, 0.6vw, 4px) clamp(3px, 0.8vw, 6px)',
                                  fontSize: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: 'clamp(0.1px, 0.2vw, 0.3px)',
                                  minHeight: 'clamp(14px, 3.5vw, 20px)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: '1',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  width: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                +{operacoesDia.length - 3} mais
                              </div>
                            )}
                          </div>
                        )}

                        {/* Indicador para dias sem operações - CONTIDO DENTRO DO QUADRADINHO */}
                        {!temOperacoes && isDentroDoPeríodo && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'clamp(2px, 0.5vw, 4px)',
                              left: 'clamp(2px, 0.5vw, 4px)',
                              right: 'clamp(2px, 0.5vw, 4px)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <div
                              className="bg-gradient-to-r from-emerald-50 to-green-100 border border-emerald-200 text-center shadow-sm"
                              style={{
                                borderRadius: 'clamp(2px, 0.5vw, 4px)',
                                padding: 'clamp(1px, 0.3vw, 2px) clamp(2px, 0.5vw, 4px)',
                                width: '100%',
                                minHeight: 'clamp(12px, 3vw, 18px)',
                                maxHeight: 'clamp(16px, 4vw, 22px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxSizing: 'border-box'
                              }}
                            >
                              <div
                                className="flex items-center justify-center text-emerald-700"
                                style={{
                                  gap: 'clamp(0.5px, 0.2vw, 1px)',
                                  fontSize: 'clamp(0.35rem, 1vw, 0.5rem)',
                                  fontWeight: '600',
                                  lineHeight: '1',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  width: '100%'
                                }}
                              >
                                <span
                                  className="text-emerald-600"
                                  style={{
                                    fontSize: 'clamp(0.3rem, 0.8vw, 0.4rem)',
                                    flexShrink: '0'
                                  }}
                                >
                                  📅
                                </span>
                                <span style={{
                                  minWidth: '0',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontSize: 'clamp(0.35rem, 1vw, 0.5rem)'
                                }}>
                                  Disp.
                                </span>
                              </div>
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