'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { JanelaOperacional } from '@/shared/types';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { getSupervisorHeaders, formatarDataBR, formatarPeriodoJanela, obterDataAtualIguatu } from '@/lib/auth-utils';

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
  total_solicitacoes?: number; // ✅ NOVO: total de solicitações (PENDENTE + NA_FILA) para o calendário
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

interface CalendarioSupervisorProps {
  onOperacaoClick: (operacoes: Operacao[]) => void; // ✅ CORRIGIDO: Aceita array de operações
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [janelas, setJanelas] = useState<JanelaOperacional[]>([]);
  const [janelaSelecionada, setJanelaSelecionada] = useState<number | null>(null);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(false);





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
      // ✅ ISOLAMENTO POR REGIONAL: Usar headers com contexto do supervisor
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();

      if (result.success) {
        setJanelas(result.data);
        // Selecionar primeira janela ativa se não houver seleção
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
      // Usar a mesma API que a página do supervisor usa
      const response = await fetch('/api/unified/operacoes?portal=supervisor', {
        headers: getSupervisorHeaders() // 🚨 ISOLAMENTO REGIONAL: Incluir contexto do supervisor
      });
      const result = await response.json();

      if (result.success) {
        let operacoesData = Array.isArray(result.data) ? result.data : [];

        // Filtrar pela janela selecionada
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

  // 🔇 NOVO: Versão silenciosa para reload de garantia (sem loading visual)
  const carregarOperacoesSilencioso = useCallback(async () => {
    if (!janelaSelecionada) return;

    try {
      // ✅ CACHE BUSTING: Adicionar timestamp para garantir dados frescos
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

  // 🚀 SIMPLES: Função de reload direto
  const reloadDados = useCallback(() => {
    carregarOperacoesSilencioso();
  }, [carregarOperacoesSilencioso]);

  // ✅ CORRIGIDO: Calcular período de visualização mais restrito
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

    // Usar as datas da janela operacional
    const dataInicio = new Date(janelaAtual.dataInicio);
    const dataFim = new Date(janelaAtual.dataFim);

    // ✅ NOVO: Mostrar apenas as semanas que contém as datas da janela
    // Não mostrar semanas inteiras extras se não há operações nelas
    return {
      start: dataInicio,
      end: dataFim
    };
  };

  // 🚀 REALTIME UNIFICADO: Migrado para useRealtimeUnified - A solução que funcionava
  useRealtimeUnified({
    channelId: `calendario-supervisor-${janelaSelecionada}`,
    tables: ['operacao', 'participacao'],
    enableRealtime: true,
    enablePolling: false,
    enableFetch: false,
    debug: false,
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;
      
      // 🚀 SIMPLES E DIRETO: Mudou no banco = recarrega os dados
      console.log(`[CalendarioSupervisor] 📡 ${table} ${eventType} - Recarregando dados...`);
      reloadDados();
    }, [reloadDados])
  });

  const { start: calendarStart, end: calendarEnd } = calcularPeriodoVisualizacao();

  // ✅ CORRIGIDO: Calcular dias incluindo semanas completas apenas quando necessário
  const dias = useMemo(() => {
    if (!janelaSelecionada) return [];

    // Para uma visualização adequada, expandir para incluir semanas completas
    // mas apenas as semanas que realmente contêm dias da janela
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

  // Função para formatar período de visualização baseado na janela selecionada
  const formatarPeriodoVisualizacao = () => {
    if (!janelaSelecionada) {
      return 'Selecione uma janela';
    }

    const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
    if (!janelaAtual) {
      return 'Janela não encontrada';
    }

    // Usar função centralizada com timezone correto de Iguatu-CE
    return formatarPeriodoJanela(janelaAtual.dataInicio, janelaAtual.dataFim);
  };

  // Determinar se uma operação é viável
  const isOperacaoViavel = (operacao: Operacao) => {
    const confirmados = operacao.participantes_confirmados || 0;
    const limite = operacao.limite_participantes;

    // Operação é viável quando tem pelo menos 50% das confirmações necessárias
    // ou um mínimo de 3 confirmados (para operações menores)
    const minimoViabilidade = Math.max(3, Math.ceil(limite * 0.5));
    const viavel = confirmados >= minimoViabilidade;

    // Operation viability logging removed for performance

    return viavel;
  };

  // Renderizar barras de status melhoradas




  return (
    <div className="bg-white min-h-screen">
      {/* Container Principal Responsivo */}
      <div className="w-full max-w-7xl mx-auto px-1 md:px-4">
        <div className="bg-white rounded-none md:rounded-lg shadow-sm md:shadow-lg border-0 md:border border-gray-200 overflow-hidden">
          {/* Cabeçalho integrado com período em destaque */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 md:p-4">
            <div className="space-y-3 md:space-y-0 md:flex md:items-center md:justify-between">
              {/* Seção principal - janela e período */}
              <div className="flex flex-col space-y-3 md:flex-row md:items-center md:space-y-0 md:space-x-6 flex-1">
                {/* Seletor de janela melhorado */}
                <div className="md:min-w-[320px]">
                  <label className="block text-sm font-semibold text-white/90 mb-2">
                    🗂️ Selecionar Janela Operacional
                  </label>
                  <div className="relative">
                    <select
                      value={janelaSelecionada || ''}
                      onChange={(e) => setJanelaSelecionada(Number(e.target.value) || null)}
                      className="w-full px-4 py-3 bg-white/15 border-2 border-white/25 rounded-xl text-sm text-white focus:outline-none focus:ring-3 focus:ring-white/40 focus:border-white/50 transition-all hover:bg-white/20 appearance-none cursor-pointer"
                      aria-label="Selecionar janela operacional"
                    >
                      <option value="" className="text-gray-900 bg-white">
                        📋 Selecione uma janela para visualizar...
                      </option>
                      {janelas.map((janela) => {
                        const periodoFormatado = formatarPeriodoJanela(janela.dataInicio, janela.dataFim);

                        return (
                          <option key={janela.id} value={janela.id} className="text-gray-900 bg-white py-2">
                            📅 Janela #{janela.id} • {periodoFormatado}
                          </option>
                        );
                      })}
                    </select>
                    {/* Seta customizada */}
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Período Destacado Principal - MAIOR E CENTRALIZADO */}
                <div className="flex-1 flex justify-center md:justify-center">
                  <div className="bg-gradient-to-r from-white/20 to-white/30 backdrop-blur rounded-lg px-6 py-4 border border-white/30 shadow-lg min-w-[320px] max-w-[500px]">
                    <div className="text-center">
                      <div className="text-sm font-medium text-white/90 mb-2">📅 Período Ativo</div>
                      <div className="text-lg md:text-xl lg:text-2xl font-bold text-white tracking-wide">
                        {formatarPeriodoVisualizacao()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações Responsivas */}
              <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
                {onNovaJanela && (
                  <button
                    onClick={onNovaJanela}
                    className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="hidden md:inline">📅</span>
                    <span className="md:hidden">📅</span>
                    <span className="hidden sm:inline">Nova Janela</span>
                    <span className="sm:hidden">Janela</span>
                  </button>
                )}

                {onNovaOperacao && (
                  <button
                    onClick={onNovaOperacao}
                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs md:text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="hidden md:inline">➕</span>
                    <span className="md:hidden">➕</span>
                    <span className="hidden sm:inline">Nova Operação</span>
                    <span className="sm:hidden">Operação</span>
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
                    <div key={dia} className="p-1.5 sm:p-2 md:p-3 text-center">
                      <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-600 uppercase tracking-wider">{dia}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid do calendário profissional */}
              <div className="bg-gradient-to-br from-white to-slate-50 overflow-x-auto">
                <div className="grid grid-cols-7 gap-0 border-l-0 md:border-l border-slate-300 min-w-[320px]">
                  {dias.map((dia, index) => {
                    const dataFormatada = format(dia, 'yyyy-MM-dd');
                    const operacoesDia = operacoesPorDia[dataFormatada] || [];
                    const isToday_ = isToday(dia);
                    const temOperacoes = operacoesDia.length > 0;

                    // Verificar se este dia está dentro do período da janela operacional ou é complemento de semana
                    const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
                    let isDentroDoPeríodo = false;

                    if (janelaAtual) {
                      const dataInicio = new Date(janelaAtual.dataInicio);
                      const dataFim = new Date(janelaAtual.dataFim);
                      const diaAtual = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());

                      isDentroDoPeríodo = diaAtual >= dataInicio && diaAtual <= dataFim;
                    }

                    const isComplementoSemana = !isDentroDoPeríodo && !temOperacoes;

                    // Determinar posição na semana para styling (Segunda = 0, Domingo = 6)
                    const diaDaSemana = (dia.getDay() + 6) % 7; // 0=seg, 6=dom
                    const isInicioSemana = diaDaSemana === 0;
                    const isFimSemana = diaDaSemana === 6;

                    return (
                      <div
                        key={dia.toISOString()}
                        data-calendar-day={format(dia, 'yyyy-MM-dd')}
                        data-has-operations={operacoesDia.length > 0}
                        className={`
                      min-h-[110px] sm:min-h-[140px] md:min-h-[180px] lg:min-h-[220px] border-r border-b md:border-r-2 md:border-b-2 border-slate-300 relative group transition-all duration-300
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
                    `}
                        onClick={() => temOperacoes && onOperacaoClick && onOperacaoClick(operacoesDia)}
                      >
                        {/* Data do dia */}
                        <div className={`text-xs md:text-sm p-1 md:p-2 font-bold ${isToday_
                          ? 'text-blue-700 bg-blue-200 rounded-md'
                          : isComplementoSemana
                            ? 'text-slate-400'
                            : isDentroDoPeríodo
                              ? 'text-slate-800'
                              : 'text-slate-500'
                          }`}>
                          {format(dia, 'd')}
                          {isToday_ && <span className="ml-1 text-xs">📍</span>}
                        </div>

                        {/* Operações do dia - Design simplificado e profissional */}
                        {temOperacoes && (
                          <div className="px-1 py-1 space-y-1">
                            {operacoesDia.slice(0, 3).map((operacao) => (
                              <div
                                key={operacao.id}
                                onClick={() => onOperacaoClick([operacao])}
                                className={`
                              relative overflow-hidden rounded-md transition-all duration-200 
                              hover:shadow-lg hover:scale-[1.02] cursor-pointer p-2
                              ${operacao.modalidade === 'BLITZ'
                                    ? 'bg-gradient-to-br from-red-50 via-red-50 to-red-100 border border-red-200 hover:border-red-300'
                                    : 'bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100 border border-amber-200 hover:border-amber-300'
                                  }
                            `}
                              >
                                {/* Header minimalista com apenas modalidade */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm">
                                    {operacao.modalidade === 'BLITZ' ? '🚨' : '⚖️'}
                                  </span>
                                  <span className={`
                                font-bold text-xs tracking-wide
                                ${operacao.modalidade === 'BLITZ' ? 'text-red-700' : 'text-amber-700'}
                              `}>
                                    {operacao.modalidade}
                                  </span>
                                </div>

                                {/* Barras de status compactas */}
                                <div className="space-y-1">
                                  {(() => {
                                    const confirmados = operacao.participantes_confirmados || 0;
                                    const solicitacoes = (operacao as any).total_solicitacoes || 0;
                                    const limite = operacao.limite_participantes;

                                    return (
                                      <>
                                        {/* Barra Confirmados */}
                                        <div className="space-y-0.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                                              <span className="text-[10px]">✅</span>
                                              <span className="hidden sm:inline">Confirmados</span>
                                              <span className="sm:hidden">Conf.</span>
                                            </span>
                                            <span className="text-xs font-bold text-green-800">
                                              {confirmados}/{limite}
                                            </span>
                                          </div>
                                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-300"
                                              style={{ width: `${limite > 0 ? Math.min(100, (confirmados / limite) * 100) : 0}%` }}
                                            />
                                          </div>
                                        </div>

                                        {/* Barra Solicitações - sempre visível */}
                                        <div className="space-y-0.5">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
                                              <span className="text-[10px]">⏳</span>
                                              <span className="hidden sm:inline">Solicitações</span>
                                              <span className="sm:hidden">Solic.</span>
                                            </span>
                                            <span className="text-xs font-bold text-amber-800">
                                              {solicitacoes}
                                            </span>
                                          </div>
                                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300"
                                              style={{ width: `${solicitacoes > 0 ? Math.min(100, (solicitacoes / limite) * 100) : 0}%` }}
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

                            {/* Indicador de mais operações - design minimalista */}
                            {operacoesDia.length > 3 && (
                              <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-md p-1.5 text-center transition-all duration-200 hover:shadow-sm cursor-pointer">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-slate-600 font-bold text-xs">
                                    +{operacoesDia.length - 3}
                                  </span>
                                  <span className="text-slate-500 text-[10px] font-medium">
                                    mais
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Indicador melhorado para dias sem operações dentro do período */}
                        {!temOperacoes && isDentroDoPeríodo && (
                          <div className="absolute bottom-3 left-3 right-3">
                            <div className="bg-gradient-to-r from-emerald-50 to-green-100 border border-emerald-200 rounded-lg p-2 text-center shadow-sm">
                              <div className="flex items-center justify-center space-x-2">
                                <span className="text-emerald-600 text-sm">📅</span>
                                <span className="text-emerald-700 text-xs font-medium">
                                  Disponível
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
            // ✅ MELHORADO: Tela de estado vazio mais informativa e atrativa
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
                    <p>Use o seletor <strong>🗂️ Selecionar Janela Operacional</strong> no cabeçalho azul para escolher o período que deseja visualizar.</p>
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
    </div>
  );
}; 