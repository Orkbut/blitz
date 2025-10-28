'use client';

/**
 * MODAL DE OPERAÇÕES DOS MEMBROS
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

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
// @ts-ignore - date-fns será instalado
import { format } from 'date-fns';
// @ts-ignore - date-fns será instalado
import { ptBR } from 'date-fns/locale';
import { X, Users, Clock, AlertCircle, RefreshCw } from 'lucide-react';
// @ts-ignore - react-hot-toast será instalado
import { toast } from 'react-hot-toast';
import styles from './OperacaoDialog.module.css';
import { useRealtime } from '@/hooks/useRealtime';
import FotoOperacaoManager from './FotoOperacaoManager';
import { isSupervisorAuthenticated } from '@/lib/auth-utils';

interface Operacao {
  id: number;
  data_operacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: string;
  horario?: string;
  limite_participantes: number;
  participantes_confirmados?: number;
  pessoas_na_fila?: number;
  total_solicitacoes?: number;
  // Campos para inativação de operações
  inativa_pelo_supervisor?: boolean;
  data_inativacao?: string;
  motivo_inativacao?: string;
  supervisor_inativacao_id?: number;
  participantes_detalhes?: Array<{
    id: number;
    estado_visual?: string;
    servidor: {
      id: number;
      nome: string;
      matricula: string;
    };
  }>;
  fila_detalhes?: Array<{
    id: number;
    posicao: number;
    servidor: {
      id: number;
      nome: string;
      matricula: string;
    };
  }>;
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'PENDENTE' | 'NA_FILA' | 'DISPONIVEL' | 'ADICIONADO_SUP';
    posicao_fila?: number;
    posicao_cronologica?: number;
    transparencia?: {
      explicacao: string;
      total_na_fila_cronologica: number;
    };
  };
}

interface FilaDetalhada {
  posicao: number;
  nome: string;
  matricula: string;
  status: 'APROVADO' | 'AGUARDANDO';
  icone: string;
  data_solicitacao: string;
}

interface EventoHistorico {
  id: string;
  tipo: 'SOLICITACAO' | 'APROVACAO' | 'CANCELAMENTO' | 'ADICAO_SUPERVISOR' | 'REMOCAO_SUPERVISOR';
  servidor_nome: string;
  servidor_matricula: string;
  data_evento: string;
  detalhes?: string;
  icone: string;
  cor: string;
}

interface HistoricoOperacao {
  eventos: EventoHistorico[];
  posicao_atual: number | null;
  total_solicitacoes: number;
  minha_participacao: {
    estado_visual: string;
    data_participacao: string;
  } | null;
}



interface OperacaoDialogProps {
  date: Date;
  operacoes: Operacao[];
  onClose: () => void;
  onOperacaoUpdate: () => void;
}

// Função para calcular turno correto baseado no horário
const getTurnoFromHorario = (horario: string): string => {
  if (!horario) return '';
  
  const [hours] = horario.split(':').map(Number);
  
  if (hours >= 6 && hours < 12) {
    return 'MANHÃ';
  } else if (hours >= 12 && hours < 18) {
    return 'TARDE';
  } else {
    return 'NOITE';
  }
};

export const OperacaoDialog: React.FC<OperacaoDialogProps> = ({
  date,
  operacoes: operacoesIniciais,
  onClose,
  onOperacaoUpdate
}) => {
  // ✅ DEBUG: Rastrear re-renders
  const renderCount = useRef(0);
  const lastPropsRef = useRef({ operacoesLength: 0, dateString: '' });
  renderCount.current += 1;
  
  const currentPropsLength = operacoesIniciais.length;
  const currentDateString = date.toISOString();
  const propsChanged = 
    lastPropsRef.current.operacoesLength !== currentPropsLength ||
    lastPropsRef.current.dateString !== currentDateString;
  
  if (propsChanged) {
    lastPropsRef.current = { operacoesLength: currentPropsLength, dateString: currentDateString };
  }
  
  // ✅ EXTRAIR ID DA AUTENTICAÇÃO (não localStorage)
  const getMembroIdFromAuth = () => {
    try {
      const membroAuth = localStorage.getItem('membroAuth');
      if (membroAuth) {
        const userData = JSON.parse(membroAuth);
        return userData.id?.toString() || '1';
      }
    } catch (error) {
      // Erro silencioso
    }
    return '1'; // Fallback apenas em caso de erro
  };
  
  const membroId = getMembroIdFromAuth();
  
  const [operacoes, setOperacoes] = useState<Operacao[]>(operacoesIniciais);
  const [loading, setLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showParticipantes, setShowParticipantes] = useState<number | null>(null);
  const [filaDetalhada, setFilaDetalhada] = useState<{[key: number]: FilaDetalhada[]}>({});
  const [historicoOperacao, setHistoricoOperacao] = useState<Record<number, HistoricoOperacao>>({});
  const [loadingHistorico, setLoadingHistorico] = useState<Record<number, boolean>>({});
  const [historicoModalAberto, setHistoricoModalAberto] = useState<number | null>(null);
  const [fotoModalAberto, setFotoModalAberto] = useState<number | null>(null);
  
  // 🚀 REALTIME: IDs das operações no modal (memoizados para estabilidade)
  const operacaoIds = useMemo(() => {
    const ids = operacoes.map(op => op.id).sort((a, b) => a - b);
    return ids;
  }, [operacoes]);
  
  // ✅ OTIMIZADO: Logs desnecessários removidos

  // ✅ CALLBACK SIMPLIFICADO: Atualização das operações
  const handleOperacaoUpdate = useCallback(() => {
    if (onOperacaoUpdate) {
      onOperacaoUpdate();
    }
  }, [onOperacaoUpdate]);

  // ✅ CALLBACK ULTRA-ESTÁVEL: Handle novos eventos de histórico
  const handleNovoEvento = useCallback((evento: any) => {
    const operacaoId = evento.operacao_id;
    
    // 💾 CACHE INTELIGENTE: Adicionar evento ao cache local
    setHistoricoOperacao(prev => {
      const historicoAtual = prev[operacaoId];
      
      if (!historicoAtual) {
        return prev;
      }
      
      // Verificar duplicata
      const eventoExiste = historicoAtual.eventos.some(e => e.id === evento.id.toString());
      if (eventoExiste) {
        return prev;
      }
      
      // Adicionar e reordenar
      const eventosAtualizados = [
        ...historicoAtual.eventos,
        {
          id: evento.id.toString(),
          tipo: evento.tipo_evento,
          servidor_nome: evento.servidor_nome,
          servidor_matricula: evento.servidor_matricula,
          data_evento: evento.data_evento,
          detalhes: evento.detalhes || '',
          icone: evento.icone,
          cor: evento.cor
        }
      ].sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime());
      
      return {
        ...prev,
        [operacaoId]: {
          ...historicoAtual,
          eventos: eventosAtualizados
        }
      };
    });
    
    // Forçar atualização visual se modal aberto
    if (historicoModalAberto === operacaoId) {
      setHistoricoModalAberto(null);
      setTimeout(() => setHistoricoModalAberto(operacaoId), 10);
    }
  }, [historicoModalAberto]);

  // ✅ SIMPLIFICADO: Hook agora recebe parâmetros diretamente

  // ✅ MIGRADO: Hook realtime unificado para eventos/histórico
  useRealtime({
    channelId: `eventos-operacoes-${operacaoIds.join('-')}`,
    tables: ['eventos_operacao'],
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;
      
      // Apenas processar INSERTs na tabela eventos_operacao
      if (table === 'eventos_operacao' && eventType === 'INSERT' && payload.new) {
        const novoEvento = payload.new;
        
        // Verificar se é uma operação que estamos monitorando
        if (operacaoIds.length === 0 || operacaoIds.includes(novoEvento.operacao_id)) {
          handleNovoEvento(novoEvento);
        }
      }
    }, [operacaoIds, handleNovoEvento])
  });
  
  // Atualizar operações quando prop mudar
  useEffect(() => {
    setOperacoes(operacoesIniciais);
  }, [operacoesIniciais]);

  // ✅ FUNÇÃO: Refresh suave das operações
  const handleRefresh = async () => {
    if (refreshing) return; // Evita múltiplos refreshes simultâneos
    
    setRefreshing(true);
    
    try {
      // Limpar cache das filas detalhadas e histórico para recarregar
      setFilaDetalhada({});
      setHistoricoOperacao({});
      
      // Chamar a função de update que já existe
      await onOperacaoUpdate();
      
      // Feedback visual discreto
      toast.success('Informações atualizadas!', {
        duration: 2000,
        style: {
          fontSize: '0.875rem',
          padding: '0.5rem 0.75rem'
        }
      });
    } catch (error) {
      toast.error('Erro ao atualizar informações');
    } finally {
      // Pequeno delay para feedback visual do ícone girando
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
    }
  };



  const handleEuVou = async (operacaoId: number) => {
    // Verificar se a operação está inativa
    const operacao = operacoes.find(op => op.id === operacaoId);
    if (operacao?.inativa_pelo_supervisor) {
      toast.error('Esta operação está arquivada e não aceita mais solicitações');
      return;
    }

    // ✅ USAR O ID DA AUTENTICAÇÃO (já extraído no componente)
    const membroIdLocal = membroId;
    setLoading(operacaoId);
    
    try {
      // Usar mesma API do calendário principal
      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: operacaoId.toString(),
          membroId: membroIdLocal
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Participação confirmada!');
        onOperacaoUpdate(); // Recarregar operações
      } else {
        toast.error(data.error || 'Erro ao confirmar participação');
      }
    } catch (error) {
      console.error('Erro ao confirmar participação:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setLoading(null);
    }
  };

  const handleCancelar = async (operacaoId: number) => {
    // Verificar se a operação está inativa
    const operacao = operacoes.find(op => op.id === operacaoId);
    if (operacao?.inativa_pelo_supervisor) {
      toast.error('Esta operação está arquivada e não aceita mais solicitações');
      return;
    }

    // ✅ USAR O ID DA AUTENTICAÇÃO (já extraído no componente)
    const membroIdLocal = membroId;
    
    setLoading(operacaoId);
    
    try {
      const response = await fetch('/api/agendamento/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacaoId, membroId: membroIdLocal })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Participação cancelada!');
        onOperacaoUpdate(); // Recarregar operações
      } else {
        toast.error(data.error || 'Erro ao cancelar participação');
      }
    } catch (error) {
      console.error('Erro ao cancelar participação:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setLoading(null);
    }
  };

  // ✅ FUNÇÃO: Buscar histórico completo da operação para tooltip inteligente
  const buscarHistoricoOperacao = async (operacaoId: number, forceRefresh: boolean = false) => {
    // 🐛 DIAGNÓSTICO: Log de entrada na função
    
    
    // 💾 CACHE INTELIGENTE: Se já temos dados e não é force refresh, retornar
    if (historicoOperacao[operacaoId] && !forceRefresh) {
      return;
    }
    
    setLoadingHistorico(prev => ({ ...prev, [operacaoId]: true }));
    
    try {
      const response = await fetch(`/api/agendamento/operacoes/${operacaoId}/historico?membroId=${membroId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar histórico');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        // 🔥 CACHE ACUMULATIVO: Mesclar eventos novos com existentes
        const eventosExistentes = historicoOperacao[operacaoId]?.eventos || [];
        const eventosNovos = data.data.eventos;
        
        // Criar um Map para evitar duplicatas baseado no ID do evento
        const eventosMap = new Map();
        
        // Adicionar eventos existentes
        eventosExistentes.forEach(evento => {
          eventosMap.set(evento.id, evento);
        });
        
        // Adicionar/atualizar com eventos novos
        eventosNovos.forEach(evento => {
          eventosMap.set(evento.id, evento);
        });
        
        // Converter de volta para array e ordenar por data
        const eventosCombinados = Array.from(eventosMap.values())
          .sort((a, b) => new Date(a.data_evento).getTime() - new Date(b.data_evento).getTime());
        
        setHistoricoOperacao(prev => ({
          ...prev,
          [operacaoId]: {
            ...data.data,
            eventos: eventosCombinados
          }
        }));
      }
    } catch (error) {
      // Erro silencioso
    } finally {
      setLoadingHistorico(prev => {
        const novo = { ...prev };
        delete novo[operacaoId];
        return novo;
      });

    }
  };

  // ✅ NOVO: Funções para controlar a janela do histórico (substituindo tooltip)
  const abrirHistoricoModal = (operacaoId: number) => {

    setHistoricoModalAberto(operacaoId);
    
    // 🔥 SEMPRE buscar dados frescos quando abrir a janela
    buscarHistoricoOperacao(operacaoId, true); // Forçar refresh para obter dados mais recentes
  };

  const fecharHistoricoModal = () => {

    setHistoricoModalAberto(null);
  };

  // ✅ NOVO: Handler para ESC específico da janela do histórico
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // ✅ PRIORIDADE: Fechar janela do histórico primeiro, depois modal principal
        if (historicoModalAberto) {
          event.stopPropagation(); // Evitar que feche o modal principal
          fecharHistoricoModal();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose, historicoModalAberto]);

  // ✅ FUNÇÃO: Determinar ação rápida para operação única
  // 🎯 LÓGICA DO BOTÃO DINÂMICO:
  // 1. "EU VOU" (verde) - quando há vagas diretas disponíveis
  // 2. "ENTRAR NA FILA" (amarelo) - quando vagas estão ocupadas mas há espaço na fila
  // 3. "LOTADO" (vermelho) - quando não há espaço nem na fila (mas mantém clicável para transparência)
  const getEstadoVisualInfo = (operacao: Operacao) => {
    // ✅ OTIMIZADO: Logs removidos (performance)
    
    // Verificar se a operação está inativa
    if (operacao.inativa_pelo_supervisor) {
      return {
        text: 'Operação arquivada',
        className: styles.historico,
        icon: '📁',
        showButton: false,
        buttonText: '',
        buttonAction: '',
        showTooltipDetalhado: true, // ✅ CORREÇÃO: Permitir visualização do histórico em operações arquivadas
        operacaoId: operacao.id,
        posicaoCronologica: null,
        totalNaFila: null,
        isInactive: true
      };
    }
    
    // Primeiro verificar se o usuário já tem participação
    const estado = operacao.minha_participacao?.estado_visual;
    
    if (estado === 'CONFIRMADO' || estado === 'ADICIONADO_SUP') {
      // ✅ CORREÇÃO: Tratar ADICIONADO_SUP igual a CONFIRMADO
      const textoEstado = estado === 'ADICIONADO_SUP' ? 'Adicionado pelo Supervisor' : 'Confirmado';
      
      return {
        text: textoEstado,
        className: styles.confirmado,
        icon: '✅',
        showButton: true,
        buttonText: 'CANCELAR',
        buttonAction: 'cancelar',
        // ✅ NOVA FUNCIONALIDADE: Tooltip sempre visível
        showTooltipDetalhado: true,
        operacaoId: operacao.id,
        posicaoCronologica: operacao.minha_participacao?.posicao_cronologica,
        totalNaFila: operacao.minha_participacao?.transparencia?.total_na_fila_cronologica
      };
    }
    
    if (estado === 'PENDENTE') {
      // ✅ LÓGICA CORRIGIDA: Mostrar posição cronológica de solicitação
      const posicaoCronologica = operacao.minha_participacao?.posicao_cronologica;
      const totalSolicitacoes = operacao.minha_participacao?.transparencia?.total_na_fila_cronologica;
      
      // ✅ OTIMIZADO: Logs removidos (performance)
      
      // Determinar se está nas vagas diretas ou na fila
      const limite = operacao.limite_participantes;
      let textoEstado = '';
      
      if (posicaoCronologica && posicaoCronologica <= limite) {
        // Está nas primeiras posições (vagas diretas)
        textoEstado = `Aguardando aprovação (${posicaoCronologica}º solicitante)`;
      } else if (posicaoCronologica && posicaoCronologica > limite) {
        // Está na fila de espera
        const posicaoNaFila = posicaoCronologica - limite;
        textoEstado = `Na fila de espera (${posicaoNaFila}º da fila)`;
      } else {
        textoEstado = 'Aguardando aprovação';
      }
      
      return {
        text: textoEstado,
        className: styles.pendente,
        icon: '⏳',
        showTooltipDetalhado: true,
        operacaoId: operacao.id,
        posicaoCronologica,
        totalNaFila: totalSolicitacoes,
        showButton: true,
        buttonText: 'CANCELAR',
        buttonAction: 'cancelar'
      };
    }
    
    if (estado === 'NA_FILA') {
      // ✅ OTIMIZADO: Logs removidos (performance)
      return {
        text: 'Na fila de espera',
        className: styles.naFila,
        icon: '⏳',
        showButton: true,
        buttonText: 'CANCELAR',
        buttonAction: 'cancelar',
        // ✅ NOVA FUNCIONALIDADE: Tooltip sempre visível
        showTooltipDetalhado: true,
        operacaoId: operacao.id,
        posicaoCronologica: operacao.minha_participacao?.posicao_cronologica,
        totalNaFila: operacao.minha_participacao?.transparencia?.total_na_fila_cronologica
      };
    }
    
    // Se não tem participação, calcular disponibilidade
    const confirmados = operacao.participantes_confirmados || 0;
    const totalSolicitacoes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0; // ✅ CORREÇÃO: usar total_solicitacoes (inclui PENDENTE)
    const limite = operacao.limite_participantes;
    
    // ✅ OTIMIZADO: Logs removidos (performance)
    
    // ✅ NOVA LÓGICA: Verificar se pode solicitar
    const totalOcupado = confirmados + totalSolicitacoes;
    const limiteTotal = limite * 2; // Vagas + fila (mesmo tamanho)
    
    if (totalOcupado < limiteTotal) {
      if (confirmados < limite) {
        // ✅ OTIMIZADO: Logs removidos (performance)
        return {
          text: 'Disponível',
          className: styles.disponivel,
          icon: '🟢',
          showButton: true,
          buttonText: 'EU VOU',
          buttonAction: 'participar',
          // ✅ NOVA FUNCIONALIDADE: Tooltip sempre visível
          showTooltipDetalhado: true,
          operacaoId: operacao.id,
          posicaoCronologica: null,
          totalNaFila: null
        };
      } else {
        // ✅ OTIMIZADO: Logs removidos (performance)
        return {
          text: 'Fila disponível',
          className: styles.filaDisponivel,
          icon: '🟡',
          showButton: true,
          buttonText: 'ENTRAR NA FILA',
          buttonAction: 'participar',
          // ✅ NOVA FUNCIONALIDADE: Tooltip sempre visível
          showTooltipDetalhado: true,
          operacaoId: operacao.id,
          posicaoCronologica: null,
          totalNaFila: null
        };
      }
    } else {
      // ✅ OTIMIZADO: Logs removidos (performance)
      return {
        text: 'Lotada',
        className: styles.lotada,
        icon: '🔴',
        showButton: false,
        buttonText: '',
        buttonAction: '',
        // ✅ NOVA FUNCIONALIDADE: Tooltip sempre visível
        showTooltipDetalhado: true,
        operacaoId: operacao.id,
        posicaoCronologica: null,
        totalNaFila: null
      };
    }
  };

  // ✅ COMPONENTE: Janela Modal do Histórico (Substituindo o antigo tooltip)
  const TooltipHistorico = ({ operacaoId, posicaoCronologica, totalNaFila }: { 
    operacaoId: number, 
    posicaoCronologica?: number, 
    totalNaFila?: number 
  }) => {
    // ✅ OTIMIZADO: Logs de modal histórico removidos (performance)
    
    const historico = historicoOperacao[operacaoId];
    const isLoading = loadingHistorico[operacaoId] || false;
    
    // 🔍 BUSCAR DADOS DA OPERAÇÃO ESPECÍFICA para mostrar a data
    const operacao = operacoes.find(op => op.id === operacaoId);
    
    // 🎨 FUNÇÃO: Formatar data e hora com fuso horário correto para Iguatu-CE
    const formatarDataHora = (dataISO: string) => {
      // ✅ CORREÇÃO: Usar timezone correto para Iguatu-CE (UTC-3)
      const dataFormatadaComTimezone = new Date(dataISO).toLocaleString('pt-BR', {
        timeZone: 'America/Fortaleza',
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Remover vírgula desnecessária
      return dataFormatadaComTimezone.replace(',', '');
    };

    // 🎨 FUNÇÃO: Formatar data da operação para o cabeçalho
    // CORRIGIDO: Trata datas sem horário para evitar problemas de timezone
    const formatarDataOperacao = (dataOperacao: string) => {
      let dataParaProcessar = dataOperacao;
      // Se a data vem apenas como YYYY-MM-DD, adicionar horário meio-dia
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataOperacao)) {
        dataParaProcessar = `${dataOperacao}T12:00:00`;
      }
      
      const data = new Date(dataParaProcessar);
      return data.toLocaleDateString('pt-BR', {
        timeZone: 'America/Fortaleza',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // 🎯 HANDLER: Click outside NÃO fecha - mantém modal anterior aberto
    const handleClickOutside = (e: React.MouseEvent) => {
      // ✅ CORREÇÃO: Não fechar ao clicar fora - mantém modal anterior aberto
      // Removido o comportamento de fechar para atender ao requisito do usuário
      return;
    };
    
    return (
      <div 
        className={styles.historicoModalOverlay}
        onClick={handleClickOutside}
      >
        <div 
          className={styles.historicoModal}
          onClick={(e) => {
            // ✅ CORREÇÃO CRÍTICA: Evitar que cliques no modal fechem o overlay
            e.stopPropagation();
          }}
        >
          {/* 🎯 CABEÇALHO COM INFORMAÇÕES PRINCIPAIS */}
          <div className={styles.historicoModalHeader}>
            <div className={styles.historicoModalTitle}>
              <strong>📊 Arquivo da Operação</strong>
              {operacao && (
                <span className={styles.historicoModalDataOperacao}>
                  📅 {formatarDataOperacao(operacao.data_operacao)} - {operacao.modalidade} ({operacao.turno})
                </span>
              )}
              {posicaoCronologica && totalNaFila && (
                <span className={styles.historicoModalSubtitle}>
                  Sua posição: {posicaoCronologica}º de {totalNaFila} | Ordem cronológica
                </span>
              )}
            </div>
            {/* 🎯 BOTÃO FECHAR */}
            <button 
              className={styles.historicoModalCloseButton}
              onClick={fecharHistoricoModal}
              aria-label="Fechar arquivo"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* 🎯 CONTEÚDO DO MODAL */}
          <div className={styles.historicoModalContent}>
            {isLoading ? (
              <div className={styles.historicoModalLoading}>
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  ⏳ Carregando arquivo...
                </div>
              </div>
            ) : (historico && historico.eventos.length > 0) ? (
              <div className={styles.historicoLista}>
                <div className={styles.historicoHeader}>
                  <span>📋 {historico.eventos.length} {historico.eventos.length === 1 ? 'evento' : 'eventos'} registrados</span>
                </div>
                
                {/* 🔄 TIMELINE DE EVENTOS - Design profissional */}
                <div className={styles.timelineEventos}>
                  {historico.eventos.slice().reverse().map((evento, index) => {
                    const dataFormatada = formatarDataHora(evento.data_evento);
                    const isUltimoEvento = index === 0;
                    

                    
                    return (
                      <div 
                        key={evento.id}
                        className={`${styles.eventoItem} ${isUltimoEvento ? styles.eventoRecente : ''}`}
                      >
                        {/* 📍 ÍCONE DO EVENTO */}
                        <div 
                          className={styles.eventoIcone}
                          style={{ color: evento.cor }}
                        >
                          {evento.icone}
                        </div>
                        
                        {/* 📝 CONTEÚDO DO EVENTO */}
                        <div className={styles.eventoConteudo}>
                          <div className={styles.eventoServidor}>
                            {evento.servidor_nome} ({evento.servidor_matricula})
                          </div>
                          <div className={styles.eventoDetalhes}>
                            {evento.detalhes}
                          </div>
                          <div className={styles.eventoTempo}>
                            {dataFormatada}
                          </div>
                        </div>
                        
                        {/* 🆕 BADGE PARA ÚLTIMO EVENTO */}
                        {isUltimoEvento && (
                          <div className={styles.badgeRecente}>
                            RECENTE
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* 💡 DICA DE TRANSPARÊNCIA */}
                <div className={styles.dicaTransparencia}>
                  💡 Arquivo atualiza automaticamente com movimentações em tempo real
                </div>
              </div>
            ) : (
              <div className={styles.historicoModalErro}>
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
                  📭 Nenhuma movimentação registrada ainda
                  <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                    Clique no botão novamente para recarregar
                  </div>
                  <div style={{ fontSize: '0.6rem', marginTop: '8px', color: '#9ca3af' }}>
                    [DEBUG] Arquivo: {historico ? 'Sim' : 'Não'} | Eventos: {historico?.eventos?.length || 0}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Operações - {format(date, 'EEEE, dd/MM/yyyy', { locale: ptBR })}</h2>
          <div className={styles.headerActions}>
            <button 
              className={styles.refreshButton}
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Atualizar informações"
              title="Atualizar informações"
            >
              <RefreshCw 
                size={20} 
                className={refreshing ? styles.spinning : ''} 
              />
            </button>
            <button 
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {operacoes.length === 0 ? (
            <div className={styles.emptyState}>
              <AlertCircle size={48} />
              <p>Nenhuma operação disponível nesta data</p>
            </div>
          ) : (
            <div className={styles.operacoesList}>
              {operacoes.map(operacao => {
                const estadoInfo = getEstadoVisualInfo(operacao);
                
                // 🔧 CORREÇÃO: Considerar confirmados + fila para calcular vagas reais
                const confirmados = operacao.participantes_confirmados || 0;
                const naFila = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0; // ✅ CORREÇÃO: usar total_solicitacoes
                const limite = operacao.limite_participantes;
                
                // ✅ LÓGICA CORRIGIDA: Fila pode ter até o mesmo número de vagas
                const vagasDisponiveis = Math.max(0, limite - confirmados);
                const espacoNaFila = Math.max(0, limite - naFila);
                
                // 🎯 NOVA LÓGICA: Determinar se pode participar
                const podeParticipar = vagasDisponiveis > 0 || espacoNaFila > 0;
                const seraConfirmado = vagasDisponiveis > 0;
                const entraNaFila = vagasDisponiveis === 0 && espacoNaFila > 0;
                
                return (
                  <div key={operacao.id} className={`${styles.operacaoCard} ${operacoes.length > 1 ? styles.operacaoCardMultiple : ''}`}>
                    <div className={styles.operacaoHeader}>
                      <div className={styles.modalidadeBadge}>
                        {operacao.modalidade === 'BLITZ' ? '🚨' : '⚖️'} {operacao.modalidade === 'BLITZ' ? 'RADAR' : operacao.modalidade}
                      </div>
                      <div className={`${styles.tipoBadge} ${styles[operacao.tipo.toLowerCase()]}`}>
                        {operacao.tipo}
                      </div>
                    </div>

                    <div className={styles.operacaoInfo}>
                      <div className={styles.infoItem}>
                        <Clock size={16} />
                        <span>
                          {operacao.horario ? (
                            <>Turno: {getTurnoFromHorario(operacao.horario)} ({operacao.horario})</>
                          ) : (
                            <>Turno: {operacao.turno}</>
                          )}
                        </span>
                      </div>
                      
                      <div className={styles.infoItem}>
                        <Users size={16} />
                        <span>
                          {confirmados}/{operacao.limite_participantes} confirmados
                          {(operacao.total_solicitacoes || naFila) > 0 && ` + ${operacao.total_solicitacoes || naFila} na fila`}
                        </span>
                      </div>

                      {!operacao.inativa_pelo_supervisor && (
                        seraConfirmado ? (
                          <div className={styles.vagasRestantes}>
                            ✅ {vagasDisponiveis} {vagasDisponiveis === 1 ? 'vaga disponível' : 'vagas disponíveis'}
                          </div>
                        ) : entraNaFila ? (
                          <div className={styles.vagasRestantes} style={{color: '#f59e0b'}}>
                            ⏳ Operação lotada - Você entrará na fila (posição {naFila + 1})
                          </div>
                        ) : (
                          <div className={styles.vagasRestantes} style={{color: '#ef4444'}}>
                            🚫 Operação completamente lotada (fila também cheia)
                          </div>
                        )
                      )}
                    </div>

                    <div className={styles.operacaoFooter}>
                      {/* ✅ ESTADO VISUAL - Apenas informativo, sem hover */}
                      <div className={`${styles.estadoVisual} ${estadoInfo.className}`}>
                        <span>{estadoInfo.icon}</span>
                        <span>{estadoInfo.text}</span>
                      </div>

                      {/* ✅ NOVO: Container para ícones lado a lado */}
                      <div className={styles.iconesContainer}>
                        {/* Ícone para abrir histórico da operação */}
                        {estadoInfo.showTooltipDetalhado && estadoInfo.operacaoId && (
                          <img 
                            src="/historico-de-saude.png" 
                            alt="Histórico" 
                            className={styles.fotoIcon}
                            onClick={() => abrirHistoricoModal(estadoInfo.operacaoId!)}
                            title="Ver arquivo completo da operação"
                          />
                        )}

                        {/* Ícone para gerenciar fotos da operação */}
                        {(() => {
                          const temParticipacao = operacao.minha_participacao && 
                            ['CONFIRMADO', 'ADICIONADO_SUP'].includes(operacao.minha_participacao.estado_visual);
                          
                          // Verifica se é supervisor através do perfil do membro logado
                          const membroAuth = localStorage.getItem('membroAuth');
                          const eSupervisor = membroAuth ? 
                            JSON.parse(membroAuth).perfil === 'Supervisor' : 
                            isSupervisorAuthenticated();
                          
                          const dataPassou = new Date(operacao.data_operacao) <= new Date();
                          const mostrarCamera = (temParticipacao || eSupervisor) && dataPassou;
                          
                          return mostrarCamera ? (
                            <img 
                              src="/CAMERA.png" 
                              alt="Câmera" 
                              className={styles.fotoIcon}
                              onClick={() => setFotoModalAberto(operacao.id)}
                              title="Gerenciar fotos da operação"
                            />
                          ) : null;
                        })()}
                      </div>

                      {estadoInfo.showButton && (
                        <button
                          onClick={() => {
                            if (estadoInfo.buttonAction === 'cancelar') {
                              handleCancelar(operacao.id);
                            } else {
                              handleEuVou(operacao.id);
                            }
                          }}
                          disabled={loading === operacao.id}
                          className={`${styles.euVouButton} ${
                            estadoInfo.buttonAction === 'cancelar' ? styles.cancelarButton : ''
                          } ${loading === operacao.id ? styles.loading : ''}`}
                        >
                          {loading === operacao.id ? 'Processando...' : estadoInfo.buttonText}
                        </button>
                      )}
                    </div>

                    {/* Botão para mostrar/esconder participantes */}
                    <button
                      className={styles.toggleParticipantes}
                      onClick={() => setShowParticipantes(
                        showParticipantes === operacao.id ? null : operacao.id
                      )}
                    >
                      {showParticipantes === operacao.id ? '▼' : '▶'} 
                      Ver participantes e fila
                    </button>

                    {/* Lista de participantes com lógica corrigida */}
                    {showParticipantes === operacao.id && (
                      <div className={styles.participantesLista}>
                        {/* ✅ CONFIRMADOS - Aprovados pelo supervisor */}
                        {operacao.participantes_detalhes && operacao.participantes_detalhes.length > 0 && (
                          <div className={styles.participantesSection}>
                            <h4>✅ Confirmados pelo supervisor ({operacao.participantes_detalhes.length}):</h4>
                            <ul>
                              {operacao.participantes_detalhes.map((p: any) => (
                                <li key={p.id}>
                                  ✅ {p.servidor?.nome || 'Nome não disponível'} - Mat: {p.servidor?.matricula || 'N/A'}
                                  {p.estado_visual === 'ADICIONADO_SUP' && (
                                    <img 
                                      src="/icons/adicionar-membro.png"
                                      alt="Adicionado pelo supervisor"
                                      className={styles.adicionadoSupervisorIcon}
                                      title="Adicionado diretamente pelo supervisor"
                                    />
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* ⏳ SOLICITAÇÕES PENDENTES - Aguardando decisão do supervisor */}
                        {operacao.fila_detalhes && operacao.fila_detalhes.length > 0 && (
                          <div className={styles.filaSection}>
                            <h4>⏳ Solicitações pendentes ({operacao.fila_detalhes.length}):</h4>
                            <div className={styles.solicitacoesPendentes}>
                              <small>📋 Ordem cronológica de solicitação - Supervisor decide quem aprovar</small>
                              
                              {/* 🔍 ANÁLISE INTELIGENTE DO ESTADO DA OPERAÇÃO */}
                              {(() => {
                                const limite = operacao.limite_participantes;
                                const confirmados = operacao.participantes_confirmados || 0;
                                const pendentes = operacao.fila_detalhes.length;
                                const vagasDisponiveis = Math.max(0, limite - confirmados);
                                const totalParticipantes = confirmados + pendentes;
                                const excedeCapacidade = confirmados > limite;
                                

                                
                                return null;
                              })()}
                              
                              {/* 📊 RESUMO VISUAL DO ESTADO DA FILA */}
                              {(() => {
                                const limite = operacao.limite_participantes;
                                const confirmados = operacao.participantes_confirmados || 0;
                                const pendentes = operacao.fila_detalhes.length;
                                const vagasDisponiveis = Math.max(0, limite - confirmados);
                                const supervisorExcedeuLimite = confirmados > limite;
                                
                                // Caso especial: supervisor excedeu o limite
                                if (supervisorExcedeuLimite && pendentes > 0) {
                                  return (
                                    <div style={{ 
                                      background: '#fee2e2', 
                                      padding: '8px 12px', 
                                      borderRadius: '6px', 
                                      marginBottom: '10px',
                                      fontSize: '0.875rem',
                                      border: '1px solid #fecaca'
                                    }}>
                                      <div>🚨 <strong>Supervisor excedeu o limite original</strong></div>
                                      <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                                        📊 Limite: {limite} | Confirmados: {confirmados} (excesso: +{confirmados - limite})
                                        <br/>
                                        🟡 Todas as {pendentes} solicitações aguardam decisão do supervisor
                                      </div>
                                    </div>
                                  );
                                }
                                
                                // Casos normais
                                if (vagasDisponiveis > 0 && pendentes > 0) {
                                  const comChanceVaga = Math.min(vagasDisponiveis, pendentes);
                                  const naFilaEspera = Math.max(0, pendentes - vagasDisponiveis);
                                  
                                  return (
                                    <div style={{ 
                                      background: '#f3f4f6', 
                                      padding: '8px 12px', 
                                      borderRadius: '6px', 
                                      marginBottom: '10px',
                                      fontSize: '0.875rem'
                                    }}>
                                      <div>💡 <strong>Status atual:</strong></div>
                                      <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                                        🟢 {comChanceVaga} {comChanceVaga === 1 ? 'pessoa tem' : 'pessoas têm'} chance de vaga direta
                                        {naFilaEspera > 0 && (
                                          <>
                                            <br/>
                                            🟡 {naFilaEspera} {naFilaEspera === 1 ? 'pessoa está' : 'pessoas estão'} na fila de espera
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                } else if (vagasDisponiveis === 0 && pendentes > 0) {
                                  return (
                                    <div style={{ 
                                      background: '#fef3c7', 
                                      padding: '8px 12px', 
                                      borderRadius: '6px', 
                                      marginBottom: '10px',
                                      fontSize: '0.875rem'
                                    }}>
                                      <div>⚠️ <strong>Operação sem vagas diretas</strong></div>
                                      <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                                        🟡 Todas as {pendentes} solicitações estão na fila de espera
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return null;
                              })()}
                              
                              <ul>
                                {operacao.fila_detalhes.map((f: any, index: number) => {

                                  
                                  // 🎯 LÓGICA INTELIGENTE: Considerar contexto real da operação
                                  const limite = operacao.limite_participantes;
                                  const confirmados = operacao.participantes_confirmados || 0;
                                  const posicao = index + 1; // Posição na lista de solicitações pendentes
                                  
                                  // ✅ CALCULAR VAGAS DIRETAS DISPONÍVEIS
                                  const vagasDisponiveis = Math.max(0, limite - confirmados);
                                  
                                  // 🔍 DETERMINAR STATUS REAL
                                  // Se há vagas disponíveis, as primeiras posições têm chance de vaga direta
                                  const temChanceVagaDireta = posicao <= vagasDisponiveis;
                                  
                                  // Se não há vagas, todos estão na fila
                                  const definitivamenteNaFila = vagasDisponiveis === 0;
                                  
                                  // Posição real na fila (considerando que não há vagas diretas)
                                  const posicaoRealNaFila = definitivamenteNaFila ? posicao : Math.max(1, posicao - vagasDisponiveis);
                                  

                                  
                                  // 🎨 DETERMINAR COR E TEXTO
                                  let icone = '🟡'; // Padrão: amarelo (fila)
                                  let textoStatus = '';
                                  let classNameExtra = styles.filaEspera;
                                  
                                  if (temChanceVagaDireta && !definitivamenteNaFila) {
                                    // Verde: tem chance real de vaga direta
                                    icone = '🟢';
                                    textoStatus = `${posicao}º - ${f.servidor?.nome || 'Nome não disponível'} - Mat: ${f.servidor?.matricula || 'N/A'} (vaga direta disponível)`;
                                    classNameExtra = styles.vagaDireta;
                                  } else {
                                    // Amarelo: está na fila
                                    icone = '🟡';
                                    if (definitivamenteNaFila) {
                                      textoStatus = `${posicaoRealNaFila}º fila - ${f.servidor?.nome || 'Nome não disponível'} - Mat: ${f.servidor?.matricula || 'N/A'} (aguardando vaga)`;
                                    } else {
                                      textoStatus = `${posicaoRealNaFila}º fila - ${f.servidor?.nome || 'Nome não disponível'} - Mat: ${f.servidor?.matricula || 'N/A'} (fila de espera)`;
                                    }
                                  }
                                  
                                  return (
                                    <li key={f.id} className={classNameExtra}>
                                      {icone} {textoStatus}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        )}
                        
                        {(!operacao.participantes_detalhes || operacao.participantes_detalhes.length === 0) && 
                         (!operacao.fila_detalhes || operacao.fila_detalhes.length === 0) && (
                          <p className={styles.emptyParticipantes}>Nenhuma solicitação ainda</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* ✅ TOOLTIP GLOBAL: Renderizado fora do modal para evitar limitações */}
      {historicoModalAberto && (
        <TooltipHistorico 
          operacaoId={historicoModalAberto}
          posicaoCronologica={operacoes.find(op => op.id === historicoModalAberto)?.minha_participacao?.posicao_cronologica}
          totalNaFila={operacoes.find(op => op.id === historicoModalAberto)?.minha_participacao?.transparencia?.total_na_fila_cronologica}
        />
      )}

      {/* Modal de Fotos */}
      {fotoModalAberto && (
        <FotoOperacaoManager
          operacaoId={fotoModalAberto}
          membroId={parseInt(membroId)}
          onClose={() => setFotoModalAberto(null)}
        />
      )}
    </div>
  );
};