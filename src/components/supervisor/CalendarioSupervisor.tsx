'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { JanelaOperacional } from '@/shared/types';
import { useRealtimeCentralized } from '@/hooks/useRealtimeCentralized';
import { getSupervisorHeaders } from '@/lib/auth-utils';

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
  onOperacaoClick: (operacao: Operacao) => void;
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

  // ✅ FUNÇÃO: Obter dados do usuário logado
  const getUserData = () => {
    try {
      const supervisorAuth = localStorage.getItem('supervisorAuth');
      if (supervisorAuth) {
        const userData = JSON.parse(supervisorAuth);
        return {
          nome: userData.nome,
          matricula: userData.matricula,
          regionalId: userData.regionalId
        };
      }
    } catch (error) {
      console.error('Erro ao obter dados do usuário:', error);
    }
    return null;
  };

  const userData = getUserData();

  // ✅ FUNÇÃO: Logout
  const handleLogout = () => {
    if (confirm('Deseja realmente sair do sistema?')) {
      localStorage.removeItem('supervisorAuth');
      localStorage.removeItem('membroId');
      window.location.href = '/';
    }
  };

  // Garantir que operacoes seja sempre um array válido
  const operacoesSeguras = Array.isArray(operacoes) ? operacoes : [];

  // 🚀 REALTIME CENTRALIZADO: Hook específico para calendário supervisor
  useRealtimeCentralized({
    enabled: true,
    debug: false, // ✅ CORRIGIDO: Debug desativado - sistema deve funcionar sem logs
    onOperacaoChange: (payload) => {
      // Realtime operation change logging removed for performance
      if (janelaSelecionada) {
        carregarOperacoes();
      }
    },
    onParticipacaoChange: (payload) => {
      // Realtime participation change logging removed for performance
      if (janelaSelecionada) {
        carregarOperacoes();
      }
    }
  });

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
      console.error('Erro ao carregar janelas:', error);
    }
  };

  const carregarOperacoes = async () => {
    if (!janelaSelecionada) return;
    
    setLoading(true);
    try {
      // Usar a mesma API que a página do supervisor usa
      const response = await fetch('/api/unified/operacoes?portal=supervisor');
      const result = await response.json();
      
      if (result.success) {
        let operacoesData = Array.isArray(result.data) ? result.data : [];
        
        // Filtrar APENAS por janela selecionada (mostrar todas as operações da janela)
        if (janelaSelecionada) {
          operacoesData = operacoesData.filter((op: any) => op.janela_id === janelaSelecionada);
        }
        
        setOperacoes(operacoesData);
      } else {
        console.error('Erro na API:', result.error);
        setOperacoes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar operações:', error);
      setOperacoes([]);
    } finally {
      setLoading(false);
    }
  };

  // Gerar dias do calendário baseado na janela operacional selecionada
  const calcularPeriodoVisualizacao = () => {
    if (!janelaSelecionada) {
      // Se não há janela selecionada, mostrar mês atual
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 })
      };
    }

    const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
    if (!janelaAtual) {
      // Fallback se janela não encontrada
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 1 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 1 })
      };
    }

    // Usar as datas da janela operacional
    const dataInicio = new Date(janelaAtual.dataInicio);
    const dataFim = new Date(janelaAtual.dataFim);

    // Ajustar para mostrar semana completa
    // Se começa na terça, mostrar desde segunda
    // Se termina na quinta, mostrar até domingo
    const inicioVisualizacao = startOfWeek(dataInicio, { weekStartsOn: 1 });
    const fimVisualizacao = endOfWeek(dataFim, { weekStartsOn: 1 });

    return {
      start: inicioVisualizacao,
      end: fimVisualizacao
    };
  };

  const { start: calendarStart, end: calendarEnd } = calcularPeriodoVisualizacao();
  const dias = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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

    // Sempre mostrar as datas da janela operacional no formato solicitado
    const dataInicio = new Date(janelaAtual.dataInicio);
    const dataFim = new Date(janelaAtual.dataFim);

    return `📅 ${format(dataInicio, 'dd/MM/yyyy')} - ${format(dataFim, 'dd/MM/yyyy')}`;
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

  // Renderizar barrinhas de status
  const renderStatusBars = (operacao: Operacao) => {
    const confirmados = operacao.participantes_confirmados || 0;
    const solicitacoes = (operacao as any).total_solicitacoes || 0; // ✅ CORRIGIDO: usar total_solicitacoes para mostrar todas as solicitações
    const limite = operacao.limite_participantes;

    // Status bars render logging removed for performance

    const barData = [
      { 
        key: 'confirmados', 
        label: 'Confirmados', 
        value: confirmados, 
        color: 'bg-green-600', 
        textColor: 'text-green-900',
        percentage: limite > 0 ? (confirmados / limite) * 100 : 0
      },
      { 
        key: 'solicitacoes', 
        label: 'Solicitações', 
        value: solicitacoes, 
        color: 'bg-amber-500', 
        textColor: 'text-amber-900',
        percentage: solicitacoes > 0 ? Math.min(100, (solicitacoes / limite) * 100) : 0
      }
    ];

    return (
      <div className="space-y-1.5 text-[11px]">
        {barData.map((bar) => (
          <div 
            key={bar.key}
            className="flex items-center gap-1.5 group relative"
          >
            <div className="w-full h-2 bg-gray-400 rounded-full flex-1 relative overflow-hidden shadow-inner border border-gray-500">
              <div 
                className={`h-full ${bar.color} rounded-full transition-all duration-300 shadow-sm`}
                style={{ width: `${bar.percentage}%` }}
            ></div>
            </div>
            <span className={`${bar.textColor} font-bold min-w-0 text-[11px] w-5 text-right bg-white/80 px-1 py-0.5 rounded text-center`}>
              {bar.value}
            </span>
          </div>
        ))}
        </div>
    );
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50">
      {/* Header Discreto do Usuário */}
      {userData && (
        <header className={styles.userHeader}>
          <div className={styles.userHeaderContent}>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar} style={{ background: '#16a34a' }}>
                {userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{userData.nome}</span>
                <span className={styles.userMatricula}>Mat. {userData.matricula} • Supervisor</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className={styles.logoutButton}
              title="Sair do sistema"
            >
              Sair
            </button>
          </div>
        </header>
      )}

      {/* Container Principal */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
          {/* Header Profissional */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Título e Seleção de Janela */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                📅
              </div>
              Calendário de Operações
            </h2>
            
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-blue-100">Janela Operacional:</label>
              <select
                value={janelaSelecionada || ''}
                onChange={(e) => setJanelaSelecionada(Number(e.target.value))}
                className="px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-sm text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
              >
                <option value="" className="text-gray-900">Selecione uma janela</option>
                {janelas.map((janela) => {
                  const dataInicio = new Date(janela.dataInicio);
                  const dataFim = new Date(janela.dataFim);
                  const periodoFormatado = `📅 ${format(dataInicio, 'dd/MM/yyyy')} - ${format(dataFim, 'dd/MM/yyyy')}`;
                  
                  return (
                    <option key={janela.id} value={janela.id} className="text-gray-900">
                      {periodoFormatado}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Ações e Período */}
          <div className="flex flex-col sm:flex-row items-end gap-4">
            {/* Botões de Ação */}
            <div className="flex gap-2">
              {onNovaJanela && (
                <button
                  onClick={onNovaJanela}
                  className="px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition-all duration-200 flex items-center gap-2"
                >
                  📅 Nova Janela
                </button>
              )}
              
              {onNovaOperacao && (
                <button
                  onClick={onNovaOperacao}
                  className="px-4 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition-all duration-200 flex items-center gap-2"
                >
                  ➕ Nova Operação
                </button>
              )}
              
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={loading || externalLoading}
                  className="px-3 py-2 bg-white/10 backdrop-blur border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading || externalLoading ? '⏳' : '🔄'}
                </button>
              )}
            </div>

            {/* Período de Visualização */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-2">
              <div className="text-sm font-medium text-blue-100">Período</div>
              <div className="text-lg font-bold">
                {formatarPeriodoVisualizacao()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid do Calendário */}
      {janelaSelecionada ? (
        <div className="p-6">
          {/* Indicadores de Mês - apenas meses da janela operacional */}
          <div className="mb-6">
            {(() => {
              if (!janelaSelecionada) return null;
              
              const janelaAtual = janelas.find(j => j.id === janelaSelecionada);
              if (!janelaAtual) return null;

              const dataInicio = new Date(janelaAtual.dataInicio);
              const dataFim = new Date(janelaAtual.dataFim);
              
              const mesesUnicos = new Set();
              const indicadores: React.ReactElement[] = [];
              
              // Gerar apenas meses que fazem parte da janela operacional
              let mesAtual = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), 1);
              const ultimoMes = new Date(dataFim.getFullYear(), dataFim.getMonth(), 1);
              
              while (mesAtual <= ultimoMes) {
                const mesAno = format(mesAtual, 'yyyy-MM');
                if (!mesesUnicos.has(mesAno)) {
                  mesesUnicos.add(mesAno);
                  const mesNome = format(mesAtual, 'MMMM yyyy', { locale: ptBR });
                  
                  indicadores.push(
                    <div key={mesAno} className="inline-flex items-center gap-2 mr-4 mb-2">
                      <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-sm"></div>
                      <span className="text-sm font-semibold text-gray-700 capitalize">
                        {mesNome}
                      </span>
                    </div>
                  );
                }
                
                // Avançar para o próximo mês
                mesAtual.setMonth(mesAtual.getMonth() + 1);
              }
              
              return indicadores.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                  <span className="text-xs font-medium text-gray-600 mr-2">Meses:</span>
                  {indicadores}
                </div>
              ) : null;
            })()}
          </div>

          {/* Grid do calendário */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="grid grid-cols-7 gap-0 relative">
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
                
                // Determinar posição na semana para styling
                const diaDaSemana = (dia.getDay() + 6) % 7; // 0=seg, 6=dom
                const isInicioSemana = diaDaSemana === 0;
                const isFimSemana = diaDaSemana === 6;

                return (
                  <div 
                    key={dia.toISOString()} 
                    data-calendar-day={format(dia, 'yyyy-MM-dd')}
                    data-has-operations={operacoesDia.length > 0}
                    className={`
                      min-h-[160px] border-r border-b border-gray-200 relative group
                      ${isInicioSemana ? 'border-l-0' : ''}
                      ${isFimSemana ? 'border-r-0' : ''}
                      ${temOperacoes ? 'cursor-pointer hover:bg-blue-50/50' : ''}
                      ${isComplementoSemana ? 'bg-gray-50/50' : 'bg-white'}
                      ${isDentroDoPeríodo && !temOperacoes ? 'bg-gray-50/30' : ''}
                      ${isToday_ ? 'bg-gradient-to-br from-blue-100 to-blue-50 ring-2 ring-blue-400 ring-inset' : ''}
                      transition-all duration-200
                    `}
                    onClick={() => operacoesDia.length > 0 && onOperacaoClick(operacoesDia[0])}
                  >
                    {/* Hachuras para dias de complemento de semana */}
                    {isComplementoSemana && (
                      <div 
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            45deg,
                            #e5e7eb 0px,
                            #e5e7eb 1px,
                            transparent 1px,
                            transparent 10px
                          )`
                        }}
                      />
                    )}
                    
                    {/* Header do dia - COMPACTO */}
                    <div className="p-2 border-b border-gray-100 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className={`
                          text-base font-bold
                          ${isToday_ ? 'text-blue-700' : 
                            temOperacoes ? 'text-gray-900' : 
                            isComplementoSemana ? 'text-gray-300' :
                            'text-gray-400'}
                        `}>
                          {format(dia, 'd')}
                        </div>
                        
                        {/* Nome do dia da semana */}
                        <div className={`
                          text-[10px] font-medium uppercase tracking-wide
                          ${isToday_ ? 'text-blue-600' : 
                            temOperacoes ? 'text-gray-500' : 
                            'text-gray-400'}
                        `}>
                          {format(dia, 'EEE', { locale: ptBR })}
                        </div>
                      </div>
                      
                      {/* Indicador de hoje */}
                      {isToday_ && (
                        <div className="absolute top-1 right-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </div>

                    {/* Operações do dia - SEM TOOLTIP */}
                    <div className="p-2 space-y-2 relative z-10">
                      {operacoesDia.length > 0 && (
                        <div className="space-y-2">
                          {operacoesDia.map((operacao) => {
                            const operacaoViavel = isOperacaoViavel(operacao);
                            
                            return (
                              <div
                                key={operacao.id}
                                className={`p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 hover:from-blue-100 hover:to-blue-200 transition-all duration-200 shadow-sm relative group ${
                                  operacaoViavel 
                                    ? 'border-green-500 ring-2 ring-green-200' 
                                    : 'border-blue-500'
                                }`}
                                role="button"
                                tabIndex={0}
                                aria-label={`Operação ${operacao.modalidade} - ${operacao.turno} - ${format(new Date(operacao.data_operacao), 'dd/MM/yyyy')}. ${operacao.participantes_confirmados || 0} confirmados de ${operacao.limite_participantes}. ${operacaoViavel ? 'Operação viável.' : ''} Clique para gerenciar.`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOperacaoClick(operacao);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onOperacaoClick(operacao);
                                  }
                                }}
                              >
                                {/* Modalidade e turno */}
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-bold text-blue-800">
                                    {operacao.modalidade}
                                  </span>
                                  <span className="text-xs font-medium text-blue-600 bg-white/70 px-2 py-1 rounded-md">
                                    {operacao.turno}
                                  </span>
                                </div>

                                {/* Barrinhas de status */}
                                {renderStatusBars(operacao)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500">
          <div className="text-lg font-medium mb-2">📅 Selecione uma janela</div>
          <p className="text-sm">Escolha uma janela operacional para visualizar as operações no calendário</p>
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