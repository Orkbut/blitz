'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Loader2, Sun, Moon } from 'lucide-react';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { OperacaoDialog } from './OperacaoDialog';
import { supabase } from '@/lib/supabase';
// @ts-ignore - react-hot-toast será instalado
import { toast } from 'react-hot-toast';
import styles from './CalendarioSimples.module.css';

interface Operacao {
  id: number;
  dataOperacao: string;
  data_operacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: string;
  horario?: string;
  limiteParticipantes: number;
  limite_participantes: number;
  participantesAtuais?: number;
  participantes_confirmados?: number;
  pessoas_na_fila?: number;
  janelaId: number;
  status: string;
  total_solicitacoes?: number;
  ativa?: boolean;
  excluida_temporariamente?: boolean;
  updated_at?: string;
  janela?: {
    id: number;
    dataInicio: string;
    dataFim: string;
    modalidades: string;
  };
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'PENDENTE' | 'NA_FILA' | 'DISPONIVEL' | 'ADICIONADO_SUP';
    posicao_fila?: number;
  };
}

export const CalendarioSimplesComponent: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [membros, setMembros] = useState<Array<{ id: number, nome: string, matricula: string }>>([]);
  const [membroAtual, setMembroAtual] = useState<string>(() => {
    // Inicializar com ID do membro logado
    if (typeof window !== 'undefined') {
      const membroAuth = localStorage.getItem('membroAuth');
      if (membroAuth) {
        try {
          const userData = JSON.parse(membroAuth);
          return userData.id?.toString() || '1';
        } catch {
          // Fallback para localStorage antigo
        }
      }
      return localStorage.getItem('membroId') || '1';
    }
    return '1';
  });
  const [loadingButtons, setLoadingButtons] = useState<Set<number>>(new Set());
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loadingOperacoes, setLoadingOperacoes] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('calendar-theme') === 'dark';
    }
    return false;
  });

  // Estados para o modal
  const [operacoesPorDia, setOperacoesPorDia] = useState<Record<string, Operacao[]>>({});

  // Fetch das operações
  const fetchOperacoes = useCallback(async () => {
    console.log(`[CalendarioSimples] 📡 Iniciando fetch operações...`);

    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(currentDate);
    const membroId = membroAtual;

    // Só mostrar loading na primeira carga
    if (isInitialLoad) {
      setLoadingOperacoes(true);
    }

    try {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        membroId,
        _t: Date.now().toString()
      });

      const response = await fetch(`/api/unified/operacoes?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[CalendarioSimples] ❌ Resposta não é JSON:', text.substring(0, 200));
        throw new Error('Resposta da API não é JSON válido');
      }

      const data = await response.json();

      if (data.success) {
        console.log(`[CalendarioSimples] ✅ Operações carregadas: ${data.data?.length || 0}`);
        console.log('[CalendarioSimples] 🔍 Primeira operação:', data.data?.[0]);

        const operacoesData = data.data || [];
        setOperacoes(operacoesData);

        // Processar operações por dia para o modal
        const operacoesPorDiaMap: Record<string, Operacao[]> = {};
        operacoesData.forEach((op: Operacao) => {
          const dataKey = format(new Date(op.data_operacao), 'yyyy-MM-dd');
          if (!operacoesPorDiaMap[dataKey]) {
            operacoesPorDiaMap[dataKey] = [];
          }
          operacoesPorDiaMap[dataKey].push(op);
        });
        setOperacoesPorDia(operacoesPorDiaMap);
      } else {
        console.error('[CalendarioSimples] ❌ Erro na resposta:', data.error);
        setOperacoes([]);
        setOperacoesPorDia({});
      }
    } catch (error) {
      console.error('[CalendarioSimples] ❌ Erro no fetch:', error);
      setOperacoes([]);
      // Mostrar toast de erro apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        toast.error('Erro ao carregar operações: ' + (error as Error).message);
      }
    } finally {
      setLoadingOperacoes(false);
      setIsInitialLoad(false);
    }
  }, [currentDate, membroAtual]);

  // Carregar operações quando mudar mês ou membro
  useEffect(() => {
    fetchOperacoes();
  }, [fetchOperacoes]);

  // Função refetch para compatibilidade
  const refetch = useCallback(() => {
    fetchOperacoes();
  }, [fetchOperacoes]);

  // Hook realtime unificado
  const { isConnected } = useRealtimeUnified({
    channelId: `calendario-membro-${membroAtual}`,
    tables: ['operacao', 'participacao'],
    enableRealtime: true,
    enablePolling: false,
    enableFetch: false,
    debug: false,
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;

      if (table === 'operacao') {
        if (eventType === 'UPDATE') {
          const operacaoId = payload.new.id;
          setOperacoes(prev => {
            const novasOperacoes = prev.map(op =>
              op.id === operacaoId ? {
                ...op,
                ativa: payload.new.ativa,
                excluida_temporariamente: payload.new.excluida_temporariamente,
                updated_at: payload.new.updated_at,
                status: payload.new.status,
                limite_participantes: payload.new.limite_participantes,
              } : op
            );

            // Atualizar operacoesPorDia também
            const operacoesPorDiaMap: Record<string, Operacao[]> = {};
            novasOperacoes.forEach((op: Operacao) => {
              const dataKey = format(new Date(op.data_operacao), 'yyyy-MM-dd');
              if (!operacoesPorDiaMap[dataKey]) {
                operacoesPorDiaMap[dataKey] = [];
              }
              operacoesPorDiaMap[dataKey].push(op);
            });
            setOperacoesPorDia(operacoesPorDiaMap);

            return novasOperacoes;
          });
        }
      } else if (table === 'participacao') {
        // Recarregar dados quando participação muda
        fetchOperacoes();
      }
    }, [fetchOperacoes])
  });

  // Tratamento de teclado para fechar modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedDate) {
        setSelectedDate(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDate]);

  // Inicializar membro atual pela autenticação
  useEffect(() => {
    const membroAuth = localStorage.getItem('membroAuth');

    if (!membroAuth) {
      console.error('[CalendarioSimples] ❌ Sem autenticação');
      return;
    }

    try {
      const userData = JSON.parse(membroAuth);

      if (!userData.id || !userData.autenticado) {
        console.error('[CalendarioSimples] ❌ Dados de autenticação inválidos');
        return;
      }

      const novoMembroId = userData.id.toString();
      setMembroAtual(novoMembroId);
      localStorage.setItem('membroId', novoMembroId);
    } catch (error) {
      console.error('[CalendarioSimples] ❌ Erro ao processar autenticação:', error);
    }
  }, []);

  // Navegação do calendário
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Função para alternar tema
  const toggleTheme = () => {
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    localStorage.setItem('calendar-theme', newTheme ? 'dark' : 'light');
  };

  // Função para lidar com clique no dia (abre modal)
  const handleDayClick = (dia: Date, operacoesDia: Operacao[]) => {
    setSelectedDate(dia);
  };

  // Funções auxiliares para gerenciar loading de múltiplos botões
  const setButtonLoading = (operacaoId: number, isLoading: boolean) => {
    setLoadingButtons(prev => {
      const newSet = new Set(prev);
      if (isLoading) {
        newSet.add(operacaoId);
      } else {
        newSet.delete(operacaoId);
      }
      return newSet;
    });
  };

  const isButtonLoading = (operacaoId: number) => {
    return loadingButtons.has(operacaoId);
  };

  // Ações rápidas
  const handleQuickAction = async (operacaoId: number, action: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (isButtonLoading(operacaoId)) return;

    setButtonLoading(operacaoId, true);

    try {
      if (action === 'participar') {
        await handleEuVou(operacaoId);
      } else if (action === 'cancelar') {
        await handleCancelar(operacaoId);
      }
    } catch (error) {
      console.error('Erro na ação rápida:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setButtonLoading(operacaoId, false);
    }
  };

  const handleEuVou = async (operacaoId: number) => {
    try {
      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: operacaoId.toString(),
          membroId: membroAtual
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Participação confirmada!');
        fetchOperacoes(); // Recarregar dados
      } else {
        toast.error(data.error || 'Erro ao confirmar participação');
      }
    } catch (error) {
      console.error('Erro ao confirmar participação:', error);
      toast.error('Erro ao processar solicitação');
    }
  };

  const handleCancelar = async (operacaoId: number) => {
    try {
      const response = await fetch('/api/agendamento/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacaoId, membroId: membroAtual })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Participação cancelada!');
        fetchOperacoes(); // Recarregar dados
      } else {
        toast.error(data.error || 'Erro ao cancelar participação');
      }
    } catch (error) {
      console.error('Erro ao cancelar participação:', error);
      toast.error('Erro ao processar solicitação');
    }
  };

  // Gerar dias do calendário
  const generateCalendarDays = () => {
    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  // Obter operações de um dia específico
  const getOperacoesDia = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const operacoesDia = operacoes.filter(op => {
      const opDate = format(new Date(op.data_operacao), 'yyyy-MM-dd');
      return opDate === dateStr;
    });

    if (operacoesDia.length > 0) {
      console.log(`[CalendarioSimples] 📅 ${dateStr}: ${operacoesDia.length} operações`);
    }

    return operacoesDia;
  };

  // Função para obter estado visual (mesma lógica do OperacaoDialog)
  const getEstadoVisualInfo = (operacao: Operacao) => {
    const estado = operacao.minha_participacao?.estado_visual;

    if (estado === 'CONFIRMADO' || estado === 'ADICIONADO_SUP') {
      return {
        buttonText: 'CANCELAR',
        buttonClass: 'cancel',
        buttonAction: 'cancelar'
      };
    }

    if (estado === 'PENDENTE') {
      return {
        buttonText: 'CANCELAR',
        buttonClass: 'cancel',
        buttonAction: 'cancelar'
      };
    }

    if (estado === 'NA_FILA') {
      return {
        buttonText: 'CANCELAR',
        buttonClass: 'cancel',
        buttonAction: 'cancelar'
      };
    }

    // Se não tem participação, calcular disponibilidade
    const confirmados = operacao.participantes_confirmados || 0;
    const totalSolicitacoes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0;
    const limite = operacao.limite_participantes;

    const totalOcupado = confirmados + totalSolicitacoes;
    const limiteTotal = limite * 2; // Vagas + fila (mesmo tamanho)

    if (totalOcupado < limiteTotal) {
      if (confirmados < limite) {
        return {
          buttonText: 'EU VOU',
          buttonClass: 'participate',
          buttonAction: 'participar'
        };
      } else {
        return {
          buttonText: 'ENTRAR NA FILA',
          buttonClass: 'queue',
          buttonAction: 'participar'
        };
      }
    } else {
      return {
        buttonText: 'LOTADO',
        buttonClass: 'full',
        buttonAction: 'lotado'
      };
    }
  };

  // Renderizar operação única
  const renderSingleOperation = (operacao: Operacao) => {
    const confirmados = operacao.participantes_confirmados || 0;
    const limite = operacao.limite_participantes;
    const pendentes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0;

    const estadoInfo = getEstadoVisualInfo(operacao);

    console.log(`[CalendarioSimples] 🔍 Operação ${operacao.id}:`, {
      estadoVisual: operacao.minha_participacao?.estado_visual,
      confirmados,
      limite,
      pendentes,
      estadoInfo
    });

    return (
      <div className={`${styles.singleOperationInfo} ${styles.responsive}`}>
        <div className={`${styles.operationHeader} ${styles[operacao.modalidade.toLowerCase()]}`}>
          <div className={`${styles.modalidadeName} ${styles[operacao.modalidade.toLowerCase()]}`}>
            {operacao.modalidade}
          </div>
          <div className={styles.participantStats}>
            {confirmados}/{limite}
            {pendentes > 0 && (
              <span className={styles.queueIndicator}>+{pendentes}</span>
            )}
          </div>
        </div>

        <button
          className={`${styles.quickActionButton} ${styles[estadoInfo.buttonClass]} ${styles.responsive}`}
          onClick={(e) => handleQuickAction(operacao.id, estadoInfo.buttonAction, e)}
          disabled={isButtonLoading(operacao.id) || estadoInfo.buttonAction === 'lotado'}
        >
          {isButtonLoading(operacao.id) ? (
            <span className={styles.spinning}>
              <Loader2 size={16} />
            </span>
          ) : (
            estadoInfo.buttonText
          )}
        </button>
      </div>
    );
  };

  // Renderizar múltiplas operações - VERSÃO OTIMIZADA PARA LEGIBILIDADE
  const renderMultipleOperations = (operacoes: Operacao[]) => {
    const maxShow = 2;
    const remaining = operacoes.length - maxShow;

    return (
      <div className={styles.multipleOperations}>
        {operacoes.slice(0, maxShow).map((op, idx) => {
          const confirmados = op.participantes_confirmados || 0;
          const limite = op.limite_participantes;
          const pendentes = op.total_solicitacoes || op.pessoas_na_fila || 0;
          
          // Informação compacta mas clara
          const modalidadeAbrev = op.modalidade === 'BLITZ' ? 'BLZ' : 'BAL';
          const infoParticipantes = `${confirmados}/${limite}`;
          const infoFila = pendentes > 0 ? `+${pendentes}` : '';
          
          return (
            <div key={idx} className={`${styles.operationItem} ${styles[op.modalidade.toLowerCase()]}`}>
              <span className={styles.modalidadeCompact}>{modalidadeAbrev}</span>
              <span className={styles.participantesCompact}>
                {infoParticipantes}
                {infoFila && <span className={styles.filaCompact}>{infoFila}</span>}
              </span>
            </div>
          );
        })}
        {remaining > 0 && (
          <div className={styles.moreOperations}>
            +{remaining} op{remaining > 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className={`${styles.calendarContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* Header com Navegação Integrada */}
      <div className={styles.calendarHeader}>
        <button
          className={styles.navButton}
          onClick={() => navigateMonth('prev')}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={24} />
        </button>

        <div className={styles.monthYear}>
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </div>

        <button
          className={styles.navButton}
          onClick={() => navigateMonth('next')}
          aria-label="Próximo mês"
        >
          <ChevronRight size={24} />
        </button>

        <div className={styles.rightButtons}>
          <button className={styles.todayButton} onClick={goToToday}>
            <Calendar size={16} />
            <span>Hoje</span>
          </button>
        </div>
      </div>

      {/* Dias da Semana */}
      <div className={styles.weekdays}>
        <div>DOM</div>
        <div>SEG</div>
        <div>TER</div>
        <div>QUA</div>
        <div>QUI</div>
        <div>SEX</div>
        <div>SÁB</div>
      </div>

      {/* Grid do Calendário */}
      <div className={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          const operacoesDia = getOperacoesDia(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const hasUniqueOperation = operacoesDia.length === 1;

          return (
            <div
              key={index}
              className={`
                ${styles.dayCell}
                ${!isCurrentMonth ? styles.otherMonth : ''}
                ${isCurrentDay ? styles.currentDay : ''}
              `}
              onClick={() => handleDayClick(day, operacoesDia)}
            >
              <div className={styles.dayNumber}>
                {format(day, 'd')}
              </div>

              {isCurrentMonth && operacoesDia.length > 0 && (
                <div className={styles.operacaoInfo}>
                  {hasUniqueOperation
                    ? renderSingleOperation(operacoesDia[0])
                    : renderMultipleOperations(operacoesDia)
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Operações */}
      {selectedDate && (
        <OperacaoDialog
          date={selectedDate}
          operacoes={operacoesPorDia[format(selectedDate, 'yyyy-MM-dd')] || []}
          onClose={() => setSelectedDate(null)}
          onOperacaoUpdate={refetch}
        />
      )}
    </div>
  );
};