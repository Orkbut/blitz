'use client';

/**
 * MODAL DE GERENCIAR MEMBROS DO SUPERVISOR
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
 * - O supervisor tem poderes administrativos para gerenciar participações
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { X, Plus, Trash2, Search, Users, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRealtimeUnified } from '@/hooks/useRealtimeUnified';
import { useModal } from '@/hooks/useModal';
import { UniversalModal } from '@/shared/components/ui';
import styles from './GerenciarMembrosModal.module.css';
import { format, parseISO } from 'date-fns';
import { getSupervisorHeaders, formatarDataBR } from '@/lib/auth-utils';

interface Membro {
  id: number;
  nome: string;
  matricula: string;
  perfil: string;
  ativo: boolean;
}

interface OperacaoParticipacao {
  id: number;
  data_operacao: string;
  modalidade: string;
  tipo: string;
  turno: string;
  limite_participantes: number;
  participantes: Array<{
    id: number;
    membro_id: number;
    nome: string;
    matricula: string;
    estado_visual: string;
    status_interno: string;
    posicao_fila?: number;
    data_participacao?: string; // ✅ NOVO: Campo para ordenação cronológica
  }>;
}

interface GerenciarMembrosModalProps {
  onClose: () => void;
  onUpdate: () => void;
  operacaoEspecifica?: any; // ✅ NOVA PROP: Quando vem da aba operações
}

// ✅ COMPONENTE MEMOIZADO: Card de Operação
interface OperacaoCardProps {
  operacao: OperacaoParticipacao;
  isSelected: boolean;
  onSelect: (operacao: OperacaoParticipacao) => void;
  formatarDataCompleta: (data: string) => any;
}

const OperacaoCard = memo<OperacaoCardProps>(({ operacao, isSelected, onSelect, formatarDataCompleta }) => {
  // ✅ MEMOIZAÇÃO: Formatação de data (cálculo pesado)
  const dataInfo = useMemo(() =>
    formatarDataCompleta(operacao.data_operacao),
    [operacao.data_operacao, formatarDataCompleta]
  );

  // ✅ MEMOIZAÇÃO: Contadores de participantes (filtros pesados)
  const { confirmados, naFila, pendentes } = useMemo(() => {
    const participantes = operacao.participantes || [];
    return {
      confirmados: participantes.filter((p: any) =>
        p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP'
      ).length,
      naFila: participantes.filter((p: any) => p.estado_visual === 'NA_FILA').length,
      pendentes: participantes.filter((p: any) => p.estado_visual === 'PENDENTE').length
    };
  }, [operacao.participantes]);

  const handleClick = useCallback(() => {
    onSelect(operacao);
  }, [operacao, onSelect]);

  return (
    <div
      className={`${styles.operacaoCard} ${isSelected ? styles.selecionada : ''}`}
      onClick={handleClick}
    >
      {/* Data em destaque */}
      <div className={styles.dataDestaque}>
        <div className={styles.diaMes}>{dataInfo.diaMes}</div>
        <div className={styles.mesAno}>
          <div className={styles.mes}>{dataInfo.mes}</div>
          <div className={styles.ano}>{dataInfo.ano}</div>
        </div>
        <div className={styles.diaSemana}>{dataInfo.diaSemanaAbrev}</div>
      </div>

      {/* Informações da operação */}
      <div className={styles.operacaoInfo}>
        <div className={styles.operacaoHeader}>
          <div className={`${styles.modalidadeBadge} ${styles[operacao.modalidade.toLowerCase()]}`}>
            {operacao.modalidade}
          </div>
          <div className={`${styles.tipoBadge} ${styles[operacao.tipo.toLowerCase()]}`}>
            {operacao.tipo}
          </div>
        </div>

        <div className={styles.turnoInfo}>
          🕐 <strong>{operacao.turno}</strong>
        </div>

        <div className={styles.participacaoInfo}>
          <div className={styles.participacaoItem}>
            <span className={styles.label}>Confirmados:</span>
            <span className={`${styles.valor} ${styles.confirmados}`}>
              {confirmados}/{operacao.limite_participantes}
            </span>
          </div>

          {naFila > 0 && (
            <div className={styles.participacaoItem}>
              <span className={styles.label}>Na fila:</span>
              <span className={`${styles.valor} ${styles.fila}`}>
                {naFila}
              </span>
            </div>
          )}

          {pendentes > 0 && (
            <div className={styles.participacaoItem}>
              <span className={styles.label}>Pendentes:</span>
              <span className={`${styles.valor} ${styles.pendentes}`}>
                {pendentes}
              </span>
            </div>
          )}

          <div className={styles.totalItem}>
            <span className={styles.totalLabel}>Total solicitações:</span>
            <span className={styles.totalValor}>
              {confirmados + naFila + pendentes}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

OperacaoCard.displayName = 'OperacaoCard';

// ✅ COMPONENTE MEMOIZADO: Card de Membro
interface MembroCardProps {
  membro: Membro;
  participacao: any;
  statusInfo: any;
  loadingStates: Record<string, boolean>;
  onAdicionarMembro: (membroId: number) => void | Promise<void>;
  onAprovarSolicitacao: (participacaoId: number) => void | Promise<void>;
  onRejeitarSolicitacao: (participacaoId: number) => void | Promise<void>;
  onRemoverMembro: (participacaoId: number) => void | Promise<void>;
}

const MembroCard = memo<MembroCardProps>(({
  membro,
  participacao,
  statusInfo,
  loadingStates,
  onAdicionarMembro,
  onAprovarSolicitacao,
  onRejeitarSolicitacao,
  onRemoverMembro
}) => {
  const temParticipacao = !!participacao;

  const obterClasseFundo = useCallback(() => {
    if (!participacao) {
      return '';
    }

    switch (participacao.estado_visual) {
      case 'CONFIRMADO':
      case 'ADICIONADO_SUP':
        return styles.membroConfirmado;
      case 'NA_FILA':
      case 'PENDENTE':
        return styles.membroAguardando;
      default:
        return '';
    }
  }, [participacao]);

  const handleAdicionar = useCallback(() => {
    onAdicionarMembro(membro.id);
  }, [membro.id, onAdicionarMembro]);

  const handleAprovar = useCallback(() => {
    if (participacao) {
      onAprovarSolicitacao(participacao.id);
    }
  }, [participacao, onAprovarSolicitacao]);

  const handleRejeitar = useCallback(() => {
    if (participacao) {
      onRejeitarSolicitacao(participacao.id);
    }
  }, [participacao, onRejeitarSolicitacao]);

  const handleRemover = useCallback(() => {
    if (participacao) {
      onRemoverMembro(participacao.id);
    }
  }, [participacao, onRemoverMembro]);

  return (
    <div className={`${styles.membroCard} ${obterClasseFundo()}`}>
      <div className={styles.membroInfo}>
        <div className={styles.membroNomeContainer}>
          <h4>{membro.nome}</h4>
          {temParticipacao && participacao.estado_visual !== 'ADICIONADO_SUP' && (
            <span className={styles.posicaoCronologica} title="Solicitou participação">
              📋
            </span>
          )}
        </div>
        <p>Mat: {membro.matricula} • {membro.perfil}</p>
      </div>

      <div className={styles.membroActions}>
        {statusInfo.label && (
          <span className={`${styles.statusBadge} ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        )}

        <div className={styles.actionButtons}>
          {statusInfo.acoes.includes('adicionar') && (
            <button
              onClick={handleAdicionar}
              disabled={loadingStates[`add-${membro.id}`]}
              className={styles.btnAdicionar}
            >
              <Plus size={16} />
              {loadingStates[`add-${membro.id}`] ? 'Adicionando...' : 'Adicionar'}
            </button>
          )}

          {statusInfo.acoes.includes('aprovar') && participacao && (
            <button
              onClick={handleAprovar}
              disabled={loadingStates[`approve-${participacao.id}`]}
              className={styles.btnAprovar}
            >
              {loadingStates[`approve-${participacao.id}`] ? '⏳ Aprovando...' : '✓ Aprovar'}
            </button>
          )}

          {statusInfo.acoes.includes('rejeitar') && participacao && (
            <button
              onClick={handleRejeitar}
              disabled={loadingStates[`reject-${participacao.id}`]}
              className={styles.btnRejeitar}
            >
              {loadingStates[`reject-${participacao.id}`] ? '⏳ Rejeitando...' : '✗ Rejeitar'}
            </button>
          )}

          {statusInfo.acoes.includes('remover') && participacao && (
            <button
              onClick={handleRemover}
              disabled={loadingStates[`remove-${participacao.id}`]}
              className={styles.btnRemover}
            >
              <Trash2 size={16} />
              {loadingStates[`remove-${participacao.id}`] ? 'Removendo...' : 'Remover'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

MembroCard.displayName = 'MembroCard';

// ✅ COMPONENTE MEMOIZADO: Barra de Busca
interface SearchBoxProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const SearchBox = memo<SearchBoxProps>(({ searchTerm, onSearchChange }) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  return (
    <div className={styles.searchBox}>
      <Search size={20} />
      <input
        type="text"
        placeholder="Buscar por nome ou matrícula (opcional)"
        value={searchTerm}
        onChange={handleChange}
      />
    </div>
  );
});

SearchBox.displayName = 'SearchBox';

const GerenciarMembrosModalComponent: React.FC<GerenciarMembrosModalProps> = ({ onClose, onUpdate, operacaoEspecifica }) => {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [operacoes, setOperacoes] = useState<OperacaoParticipacao[]>([]);
  const [operacaoSelecionada, setOperacaoSelecionada] = useState<OperacaoParticipacao | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingInicial, setLoadingInicial] = useState(true); // ✅ NOVO: Loading inicial separado
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [loadingMembros, setLoadingMembros] = useState(false);
  // 🚀 NOVO: Loading individual por ação/participação
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Hook para modais modernos
  const modal = useModal();

  // 🚀 FUNÇÃO OTIMIZADA: Definir loading individual
  const setLoadingState = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  // ✅ HANDLERS DE EVENTOS (declarados primeiro para evitar erros de hoisting)
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const handleResize = useCallback(() => {
    // Resize handler simplificado sem logs
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    const target = event.target as Element;
    const modalContent = target.closest(`.${styles.container}`);

    // Se o scroll está acontecendo fora do modal, prevenir
    if (!modalContent) {
      event.preventDefault();
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    const target = event.target as Element;
    const modalContent = target.closest(`.${styles.container}`);

    // Se o toque está acontecendo fora do modal, prevenir
    if (!modalContent) {
      event.preventDefault();
    }
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // 🚀 REALTIME: Monitorar mudanças nas operações do modal
  const operacaoIds = useMemo(() => {
    if (operacaoEspecifica) {
      return [operacaoEspecifica.id];
    }
    return operacoes.map(op => op.id);
  }, [operacaoEspecifica, operacoes]);

  // 🚀 FUNÇÃO DE ATUALIZAÇÃO MEMOIZADA
  const atualizarOperacoes = useCallback(async () => {
    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor&includeParticipantes=true&mode=light', {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result = await response.json();
      if (result.success) {
        setOperacoes(result.data);
        setOperacaoSelecionada(prev => prev ? result.data.find((op: any) => op.id === prev.id) || null : null);
      } else {
        throw new Error(result.error || 'Resposta inválida da API');
      }
    } catch (error) {
      // Erro silencioso
    }
  }, []); // Sem dependências, totalmente estável

  // 🚀 CALLBACKS DE REALTIME MEMOIZADOS
  const handleOperacaoChange = useCallback((payload: any) => {
    // CORREÇÃO: Remover dependência de loading que pode impedir updates
    atualizarOperacoes();
    onUpdate();
  }, [atualizarOperacoes, onUpdate]);

  const handleParticipacaoChange = useCallback((payload: any) => {
    // CORREÇÃO: Remover dependência de loading que pode impedir updates
    atualizarOperacoes();
    onUpdate();
  }, [atualizarOperacoes, onUpdate]);

  // 🚀 REALTIME UNIFICADO: Migrado para useRealtimeUnified - Hook para atualizações automáticas
  const realtimeHook = useRealtimeUnified({
    channelId: `gerenciar-membros-${operacaoIds.join('-')}`,
    tables: ['operacao', 'participacao'],
    enableRealtime: operacaoIds.length > 0 && !loadingInicial,
    enablePolling: false,
    enableFetch: false,
    debug: false,
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType, payload } = event;

      if (table === 'operacao') {
        handleOperacaoChange(payload);
      } else if (table === 'participacao') {
        handleParticipacaoChange(payload);
      }
    }, [handleOperacaoChange, handleParticipacaoChange])
  });

  useEffect(() => {
    carregarDadosOtimizado();
  }, []);

  // ✅ FUNCIONALIDADE ESC: Fechar modal com ESC (otimizado)
  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  // ✅ PREVENIR SCROLL DA PÁGINA ATRÁS (otimizado)
  useEffect(() => {
    // Salvar posição atual do scroll
    const scrollY = window.scrollY;

    window.addEventListener('resize', handleResize);

    // Prevenir scroll no body
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Cleanup: restaurar scroll quando modal fechar
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';

      // Restaurar posição do scroll
      window.scrollTo(0, scrollY);

      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize, handleWheel, handleTouchMove]);

  // ✅ AUTO-SELECIONAR operação quando vem da aba operações
  useEffect(() => {
    if (operacaoEspecifica && operacoes.length > 0) {
      const operacaoEncontrada = operacoes.find(op => op.id === operacaoEspecifica.id);
      if (operacaoEncontrada) {
        setOperacaoSelecionada(operacaoEncontrada);
      }
    }
  }, [operacaoEspecifica, operacoes]);

  // ✅ MEMOIZAÇÃO: Estatísticas da operação selecionada
  const estatisticasOperacao = useMemo(() => {
    if (!operacaoSelecionada?.participantes) {
      return { confirmados: 0, naFila: 0, pendentes: 0, total: 0 };
    }

    const participantes = operacaoSelecionada.participantes;
    const confirmados = participantes.filter(p =>
      p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP'
    ).length;
    const naFila = participantes.filter(p => p.estado_visual === 'NA_FILA').length;
    const pendentes = participantes.filter(p => p.estado_visual === 'PENDENTE').length;

    return {
      confirmados,
      naFila,
      pendentes,
      total: confirmados + naFila + pendentes,
      vagasDisponiveis: operacaoSelecionada.limite_participantes - confirmados
    };
  }, [operacaoSelecionada]);

  // ✅ MEMOIZAÇÃO: Função de formatação de data (cálculo pesado)
  const formatarDataCompleta = useCallback((data: string) => {
    try {
      const date = new Date(data);
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = date.toLocaleDateString('pt-BR', { month: 'short' });
      const ano = date.getFullYear().toString();
      const diaSemana = date.toLocaleDateString('pt-BR', { weekday: 'long' });

      return {
        diaMes: dia,
        mes: mes.charAt(0).toUpperCase() + mes.slice(1),
        ano,
        diaSemanaAbrev: diaSemana.substring(0, 3).toUpperCase(),
        dataCompleta: `${dia}/${mes.toLowerCase()}/${ano}`
      };
    } catch {
      return {
        diaMes: '??',
        mes: 'Err',
        ano: '????',
        dataCompleta: data,
        diaSemanaAbrev: 'ERR'
      };
    }
  }, []);



  // ✅ CALLBACKS MEMOIZADOS PARA COMPONENTES FILHOS
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleOperacaoSelect = useCallback((operacao: OperacaoParticipacao) => {
    setOperacaoSelecionada(operacao);
  }, []);

  // ✅ FUNÇÃO: Carregar lista de membros
  const carregarMembros = useCallback(async () => {
    setLoadingMembros(true);
    try {
      const response = await fetch('/api/supervisor/membros', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setMembros(data.data || []);
        // Members list updated logging removed for performance
      } else {
        throw new Error(data.error || 'Erro ao buscar membros');
      }
    } catch (error) {
      console.error('❌ [MODAL-SUPERVISOR] Erro ao carregar membros:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar membros');
    } finally {
      setLoadingMembros(false);
      // Members loading finished logging removed for performance
    }
  }, []);

  // ✅ FUNÇÃO SUPER OTIMIZADA: Carregar dados específicos da operação
  const carregarDadosOtimizado = useCallback(async () => {
    if (!operacaoEspecifica) return;

    setLoadingDetalhes(true);

    try {
      // ✅ REQUISIÇÃO OTIMIZADA: Buscar apenas dados essenciais
      const startDate = format(parseISO(operacaoEspecifica.data_operacao), 'yyyy-MM-dd');
      
      const params = new URLSearchParams({
        startDate,
        endDate: startDate,
        portal: 'supervisor',
        includeParticipantes: 'true',
        mode: 'light',
        _t: Date.now().toString()
      });

      const [operacoesResponse, membrosResponse] = await Promise.all([
        fetch(`/api/unified/operacoes?${params}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }),
        // ✅ CARREGAMENTO PARALELO: Buscar membros em paralelo se necessário
        membros.length === 0 ? fetch('/api/supervisor/membros', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...getSupervisorHeaders()
          }
        }) : Promise.resolve(null)
      ]);

      if (!operacoesResponse.ok) {
        throw new Error(`HTTP ${operacoesResponse.status}: ${operacoesResponse.statusText}`);
      }

      const operacoesData = await operacoesResponse.json();

      if (operacoesData.success) {
        // ✅ ENCONTRAR A OPERAÇÃO ESPECÍFICA
        const operacaoAtualizada = operacoesData.data?.find((op: any) => op.id === operacaoEspecifica.id);

        if (operacaoAtualizada) {
          // ✅ ATUALIZAR ESTADOS
          setOperacoes(operacoesData.data || []);
          setOperacaoSelecionada(operacaoAtualizada);

          // ✅ PROCESSAR MEMBROS SE FORAM CARREGADOS EM PARALELO
          if (membrosResponse && membros.length === 0) {
            if (membrosResponse.ok) {
              const membrosData = await membrosResponse.json();
              if (membrosData.success) {
                setMembros(membrosData.data || []);
              }
            }
          }
        } else {
          console.error('❌ [MODAL-SUPERVISOR] Operação não encontrada:', operacaoEspecifica.id);
          throw new Error(`Operação ${operacaoEspecifica.id} não encontrada`);
        }
      } else {
        throw new Error(operacoesData.error || 'Erro ao buscar dados da operação');
      }
    } catch (error) {
      console.error('❌ [MODAL-SUPERVISOR] Erro ao carregar dados:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados');
    } finally {
      setLoadingDetalhes(false);
      setLoadingInicial(false);
    }
  }, [operacaoEspecifica, membros.length]);

  // ✅ MEMOIZAÇÃO SUPER OTIMIZADA: Filtros e ordenação de membros
  const membrosDisponiveis = useMemo(() => {
    // ✅ EARLY RETURN: Se não há membros, retornar array vazio
    if (!membros.length) return [];

    // 🔍 FILTRO COMBINADO: Ativos + busca + ocultar administrador principal
    const termo = searchTerm.toLowerCase().trim();
    const membrosFiltrados = membros.filter(m => {
      if (!m.ativo) return false;
      // 🚫 OCULTAR ADMINISTRADOR PRINCIPAL: Filtrar por matrícula 'unmistk'
      if (m.matricula === 'unmistk') return false;
      if (!termo) return true;
      return m.nome.toLowerCase().includes(termo) || m.matricula.includes(termo);
    });

    // ✅ SEM OPERAÇÃO: Ordem alfabética simples
    if (!operacaoSelecionada?.participantes?.length) {
      return membrosFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    // ✅ COM OPERAÇÃO: Ordenação inteligente super otimizada
    const participantes = operacaoSelecionada.participantes;

    // 📊 MAPA DE PARTICIPAÇÕES (otimizado para lookup O(1))
    const participacaoMap = new Map();
    participantes.forEach(p => participacaoMap.set(p.membro_id, p));

    // 🎯 MAPA DE PRIORIDADES (pré-calculado para performance)
    const prioridadeMap = {
      'CONFIRMADO': 1,
      'ADICIONADO_SUP': 1,
      'NA_FILA': 2,
      'PENDENTE': 2
    };

    // 📋 ORDENAÇÃO SUPER OTIMIZADA
    return membrosFiltrados.sort((membroA, membroB) => {
      const participacaoA = participacaoMap.get(membroA.id);
      const participacaoB = participacaoMap.get(membroB.id);

      const prioridadeA = participacaoA ? (prioridadeMap[participacaoA.estado_visual] || 3) : 3;
      const prioridadeB = participacaoB ? (prioridadeMap[participacaoB.estado_visual] || 3) : 3;

      // 1º: Ordenar por grupo (prioridade)
      if (prioridadeA !== prioridadeB) {
        return prioridadeA - prioridadeB;
      }

      // 2º: Dentro do mesmo grupo, ordenar cronologicamente
      if (participacaoA && participacaoB && participacaoA.data_participacao && participacaoB.data_participacao) {
        const dataA = new Date(participacaoA.data_participacao).getTime();
        const dataB = new Date(participacaoB.data_participacao).getTime();
        if (dataA !== dataB) return dataA - dataB;
      }

      // 3º: Fallback alfabético
      return membroA.nome.localeCompare(membroB.nome);
    });

  }, [membros, searchTerm, operacaoSelecionada?.id, operacaoSelecionada?.participantes]);

  // ✅ FUNÇÃO MEMOIZADA: Sistema FIFO com Justificativa
  const adicionarMembro = useCallback(async (membroId: number, justificativaFifo?: string) => {
    if (!operacaoSelecionada) return;

    // ✅ VALIDAÇÃO DE LIMITES: Verificar se servidor pode ser confirmado
    try {
      const responseValidacao = await fetch('/api/supervisor/validar-limites-servidor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        },
        body: JSON.stringify({
          servidorId: membroId,
          dataOperacao: operacaoSelecionada.data_operacao,
          tipoOperacao: operacaoSelecionada.tipo,
          modalidade: operacaoSelecionada.modalidade
        })
      });

      const validacao = await responseValidacao.json();

      if (validacao.success && !validacao.data.podeConfirmar) {
        modal.showAlert(
          '🚫 Limite Atingido',
          `Não é possível confirmar este servidor:\n\n${validacao.data.motivo}\n\n📊 Situação atual:\n• Atividades período 10→09: ${validacao.data.limitesAtuais.atividadesPeriodo10a09}/${validacao.data.limitesAtuais.limiteAtividades}\n• Diárias no mês: ${validacao.data.limitesAtuais.diariasNoMes}/${validacao.data.limitesAtuais.limiteDiarias}`,
          'error'
        );
        return;
      }
    } catch (error) {
      console.error('❌ Erro na validação de limites:', error);
      // Continuar mesmo com erro na validação para não bloquear totalmente
    }

    // 🎯 VERIFICAR QUEBRA DE FIFO: Se há gente na fila mas ainda há vagas
    const confirmados = operacaoSelecionada.participantes?.filter((p: any) => p.estado_visual === 'CONFIRMADO').length || 0;
    const naFila = operacaoSelecionada.participantes?.filter((p: any) => p.estado_visual === 'NA_FILA' || p.estado_visual === 'PENDENTE') || [];
    const vagasDisponiveis = operacaoSelecionada.limite_participantes - confirmados;

    // ✅ DETECTAR SE É PROMOÇÃO DA FILA
    const participacaoExistente = operacaoSelecionada.participantes?.find(p => p.membro_id === membroId);
    const isPromocaoDaFila = participacaoExistente?.estado_visual === 'NA_FILA';

    // 🚨 DETECÇÃO DE QUEBRA FIFO: Há pessoas na fila + supervisor quer adicionar alguém novo OU promover fora da ordem
    if (naFila.length > 0 && !justificativaFifo && !isPromocaoDaFila) {
      const membroSelecionado = membrosDisponiveis.find(m => m.id === membroId);

      // ⚠️ MOSTRAR AVISO DE FIFO: Com lista das pessoas na fila
      const filaOrdenada = naFila.slice(0, 5); // Primeiros 5 da fila

      const listaFila = filaOrdenada.map((p: any, index: number) =>
        `${index + 1}º - ${p.nome} (${p.matricula})`
      ).join('\n');

      const maisNaFila = naFila.length > 5 ? `\n... e mais ${naFila.length - 5} pessoas` : '';

      modal.showInput(
        '📋 Quebra de Ordem FIFO Detectada',
        `Você está adicionando "${membroSelecionado?.nome}" diretamente, passando na frente de ${naFila.length} pessoa(s) na fila:\n\n${listaFila}${maisNaFila}\n\n🎯 Como supervisor, você tem PODER TOTAL para isso, mas precisa justificar para que as pessoas "furadas" sejam notificadas do motivo:`,
        (justificativa: string) => {
          // Continuar com a adição usando a justificativa
          adicionarMembro(membroId, justificativa.trim());
        },
        () => {
          // Cancelou - não fazer nada
        },
        'Ex: "Servidor com experiência específica necessária para esta operação"',
        '',
        10,
        'Adicionar com Justificativa',
        'Cancelar'
      );
      return; // Interromper execução aqui
    }

    // 🚨 DETECÇÃO DE PROMOÇÃO FORA DE ORDEM: Promovendo alguém que não é o primeiro da fila
    if (isPromocaoDaFila && naFila.length > 1 && !justificativaFifo) {
      const posicaoAtual = participacaoExistente.posicao_fila;
      const membroSelecionado = membrosDisponiveis.find(m => m.id === membroId);

      if (posicaoAtual && posicaoAtual > 1) {
        // Mostrar quem vai ser "furado"
        const pessoasNaFrente = naFila
          .filter(p => p.posicao_fila < posicaoAtual)
          .sort((a, b) => a.posicao_fila - b.posicao_fila)
          .slice(0, 3);

        const listaFurados = pessoasNaFrente.map(p =>
          `${p.posicao_fila}º - ${p.nome} (${p.matricula})`
        ).join('\n');

        modal.showInput(
          '⬆️ Promoção Fora de Ordem Detectada',
          `Você está promovendo "${membroSelecionado?.nome}" da ${posicaoAtual}ª posição, passando na frente de:\n\n${listaFurados}\n\n🎯 Como supervisor, você tem PODER TOTAL para isso, mas precisa justificar para que as pessoas "furadas" sejam notificadas do motivo:`,
          (justificativa: string) => {
            // Continuar com a promoção usando a justificativa
            adicionarMembro(membroId, justificativa.trim());
          },
          () => {
            // Cancelou - não fazer nada
          },
          'Ex: "Servidor precisa chegar mais cedo por questões pessoais"',
          '',
          10,
          'Promover com Justificativa',
          'Cancelar'
        );
        return; // Interromper execução aqui
      }
    }

    // 🚀 OTIMIZAÇÃO: Loading individual por membro
    const loadingKey = `add-${membroId}`;
    setLoadingState(loadingKey, true);
    
    try {
      const response = await fetch('/api/supervisor/gerenciar-participacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        },
        body: JSON.stringify({
          acao: 'adicionar',
          operacaoId: operacaoSelecionada.id,
          membroId: membroId,
          justificativaFifo: justificativaFifo || null
        })
      });

      const result = await response.json();

      if (result.success) {
        await atualizarOperacoes();
        onUpdate();

        // 🎯 FEEDBACK POSITIVO: Informar se houve quebra de FIFO
        if (justificativaFifo) {
          modal.showAlert(
            '✅ Membro Adicionado',
            `Membro adicionado com quebra de FIFO justificada:\n\n"${justificativaFifo}"`,
            'success'
          );
        }
      } else {
        // ✅ Apenas mostrar modal de erro, sem console.error
        modal.showAlert(
          '❌ Erro ao Adicionar',
          result.error || 'Não foi possível adicionar o membro à operação.',
          'error'
        );
      }
    } catch (error) {
      // ✅ Apenas mostrar modal de erro, sem console.error
      modal.showAlert(
        '❌ Erro de Conexão',
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        'error'
      );
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [operacaoSelecionada, membrosDisponiveis, modal, onUpdate, setLoadingState]);

  const removerMembro = useCallback(async (participacaoId: number) => {
    if (!operacaoSelecionada) return;

    modal.showConfirm(
      '🗑️ Remover Membro',
      'Tem certeza que deseja remover este membro da operação?',
      () => executeRemoverMembro(participacaoId)
    );
  }, [operacaoSelecionada, modal]);

  const executeRemoverMembro = useCallback(async (participacaoId: number) => {
    // 🚀 OTIMIZAÇÃO: Loading individual por participação
    const loadingKey = `remove-${participacaoId}`;
    setLoadingState(loadingKey, true);
    
    try {
      const response = await fetch('/api/supervisor/gerenciar-participacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        },
        body: JSON.stringify({
          acao: 'remover',
          participacaoId: participacaoId
        })
      });

      const result = await response.json();
      if (result.success) {
        await atualizarOperacoes();
        onUpdate();
      } else {
        modal.showAlert(
          '❌ Erro ao Remover',
          result.error || 'Não foi possível remover o membro da operação.',
          'error'
        );
      }
    } catch (error) {
      // ✅ Apenas mostrar modal de erro, sem console.error
      modal.showAlert(
        '❌ Erro de Conexão',
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        'error'
      );
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [modal, onUpdate, setLoadingState]);

  const executeRejeitarSolicitacao = useCallback(async (participacaoId: number) => {
    if (!operacaoSelecionada) return;

    // 🚀 OTIMIZAÇÃO: Loading individual por participação
    const loadingKey = `reject-${participacaoId}`;
    setLoadingState(loadingKey, true);
    
    try {
      const response = await fetch(`/api/supervisor/solicitacoes/${participacaoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        },
        body: JSON.stringify({
          acao: 'rejeitar'
        })
      });

      const result = await response.json();
      if (result.success) {
        await atualizarOperacoes();
        onUpdate();

        // ✅ Mostrar mensagem de sucesso
        modal.showAlert(
          '✅ Sucesso',
          'Solicitação rejeitada com sucesso.',
          'success'
        );
      } else {
        // ✅ Apenas mostrar modal de erro, sem console.error
        modal.showAlert(
          '❌ Erro ao Rejeitar',
          result.error || 'Não foi possível rejeitar a solicitação.',
          'error'
        );
      }
    } catch (error) {
      // ✅ Apenas mostrar modal de erro, sem console.error
      modal.showAlert(
        '❌ Erro de Conexão',
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
        'error'
      );
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [modal, onUpdate, setLoadingState]);

  const rejeitarSolicitacao = useCallback(async (participacaoId: number) => {
    if (!operacaoSelecionada) return;

    modal.showConfirm(
      '❌ Rejeitar Solicitação',
      'Tem certeza que deseja rejeitar esta solicitação? O membro não poderá participar desta operação.',
      () => executeRejeitarSolicitacao(participacaoId)
    );
  }, [operacaoSelecionada, modal, executeRejeitarSolicitacao]);

  const aprovarSolicitacao = useCallback(async (participacaoId: number, justificativaFifo?: string) => {
    if (!operacaoSelecionada) return;

    const participacaoParaAprovar = operacaoSelecionada.participantes?.find(p => p.id === participacaoId);
    if (!participacaoParaAprovar) return;

    // ✅ VALIDAÇÃO DE LIMITES: Verificar se servidor pode ser aprovado
    try {
      const responseValidacao = await fetch('/api/supervisor/validar-limites-servidor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        },
        body: JSON.stringify({
          servidorId: participacaoParaAprovar.membro_id,
          dataOperacao: operacaoSelecionada.data_operacao,
          tipoOperacao: operacaoSelecionada.tipo,
          modalidade: operacaoSelecionada.modalidade
        })
      });

      const validacao = await responseValidacao.json();

      if (validacao.success && !validacao.data.podeConfirmar) {
        modal.showAlert(
          '🚫 Limite Atingido',
          `Não é possível aprovar este servidor:\n\n${validacao.data.motivo}\n\n📊 Situação atual:\n• Atividades período 10→09: ${validacao.data.limitesAtuais.atividadesPeriodo10a09}/${validacao.data.limitesAtuais.limiteAtividades}\n• Diárias no mês: ${validacao.data.limitesAtuais.diariasNoMes}/${validacao.data.limitesAtuais.limiteDiarias}`,
          'error'
        );
        return;
      }
    } catch (error) {
      console.error('❌ Erro na validação de limites:', error);
      // Continuar mesmo com erro na validação para não bloquear totalmente
    }

    const naFila = operacaoSelecionada.participantes
      ?.filter((p: any) => p.estado_visual === 'NA_FILA' || p.estado_visual === 'PENDENTE')
      .sort((a, b) => new Date((a as any).data_participacao || 0).getTime() - new Date((b as any).data_participacao || 0).getTime());

    if (naFila && naFila.length > 0 && !justificativaFifo) {
      const primeiroDaFila = naFila[0];
      if (primeiroDaFila.id !== participacaoId) {
        const membroSelecionado = membros.find(m => m.id === participacaoParaAprovar.membro_id);
        const listaNomesFurados = naFila.filter(p => p.id !== participacaoId).slice(0, 3).map((p: any) => p.nome || 'Membro').join(', ');

        modal.showInput(
          '⬆️ Aprovação Fora de Ordem Detectada',
          `Você está aprovando "${membroSelecionado?.nome}" na frente de outros (${listaNomesFurados}, etc.). Por favor, justifique:`,
          (justificativa: string) => { aprovarSolicitacao(participacaoId, justificativa.trim()); },
          () => { }, 'Ex: "Servidor com experiência específica necessária"', '', 10, 'Aprovar com Justificativa', 'Cancelar'
        );
        return;
      }
    }

    // 🚀 OTIMIZAÇÃO: Loading individual por participação
    const loadingKey = `approve-${participacaoId}`;
    setLoadingState(loadingKey, true);
    
    try {
      const payload = {
        acao: 'aprovar',
        justificativaFifo: justificativaFifo || null
      };
      const response = await fetch(`/api/supervisor/solicitacoes/${participacaoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        await atualizarOperacoes();
        onUpdate();
      } else {
        modal.showAlert('❌ Erro ao Aprovar', result.error || 'Não foi possível aprovar a solicitação.', 'error');
      }
    } catch (error) {
      modal.showAlert('❌ Erro de Conexão', 'Não foi possível conectar ao servidor.', 'error');
    } finally {
      setLoadingState(loadingKey, false);
    }
  }, [operacaoSelecionada, membros, modal, onUpdate, setLoadingState]);

  // ✅ MEMOIZAÇÃO OTIMIZADA: Cache de status de participação com limpeza automática
  const statusCache = useMemo(() => new Map(), [operacaoSelecionada?.id]);

  const getStatusParticipacao = useCallback((participacao: any) => {
    // Cache key otimizado
    const cacheKey = participacao ? `${participacao.id}-${participacao.estado_visual}` : 'no-participation';

    // Verificar cache primeiro
    if (statusCache.has(cacheKey)) {
      return statusCache.get(cacheKey);
    }

    // ✅ OTIMIZAÇÃO: Objeto de configuração estático para evitar recriações
    const statusConfig = {
      CONFIRMADO: {
        tipo: 'CONFIRMADO',
        label: '✅ Confirmado',
        className: styles.confirmado,
        acoes: ['remover']
      },
      ADICIONADO_SUP: {
        tipo: 'ADICIONADO_SUP',
        label: '👑 Adicionado pelo Supervisor',
        className: styles.adicionadoSupervisor,
        acoes: ['remover']
      },
      PENDENTE: {
        tipo: 'PENDENTE',
        label: '⏳ Aguardando Aprovação',
        className: styles.pendente,
        acoes: ['aprovar', 'rejeitar']
      },
      NA_FILA: {
        tipo: 'NA_FILA',
        label: '⏳ Na Fila',
        className: styles.na_fila,
        acoes: ['aprovar', 'rejeitar']
      }
    };

    const result = participacao && statusConfig[participacao.estado_visual] 
      ? statusConfig[participacao.estado_visual]
      : { tipo: 'DISPONIVEL', label: null, acoes: ['adicionar'] };

    // Armazenar no cache
    statusCache.set(cacheKey, result);
    return result;
  }, [statusCache, styles]);







  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={handleContainerClick}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h2>
              {operacaoEspecifica ? (
                `👥 Gerenciar Membros`
              ) : (
                'Gerenciar Participações'
              )}
            </h2>

            {/* 🚀 NOVO: Indicador de status do realtime */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: realtimeHook.isConnected ? '#10b981' : '#f59e0b'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: realtimeHook.isConnected ? '#10b981' : '#f59e0b',
                animation: realtimeHook.isConnected ? 'none' : 'pulse 2s infinite'
              }}></div>
              <span>
                {realtimeHook.isConnected ? 'Tempo real ativo' : 'Reconectando...'}
              </span>

            </div>

            {operacaoEspecifica && (
              <div className={styles.operacaoDetails}>
                <div className={styles.operacaoType}>
                  <strong>{operacaoEspecifica.modalidade} {operacaoEspecifica.tipo}</strong>
                </div>
                <div className={styles.metaItem}>
                  <Calendar size={16} /> <span>{formatarDataBR(operacaoEspecifica.data_operacao)}</span>
                </div>
                <div className={styles.metaItem}>
                  <Clock size={16} /> <span>{operacaoEspecifica.turno}</span>
                </div>
              </div>
            )}
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>

        {/* 🔍 LOGS DE RENDERIZAÇÃO */}
        {/* Logs removidos - modal funcionando corretamente */}

        {/* ✅ LOADING ELEGANTE: Mostra skeleton enquanto carrega */}
        {loadingInicial && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
              <p>Carregando informações...</p>
            </div>
          </div>
        )}

        {/* Seleção de Operação - apenas se não há operação específica */}
        {!operacaoEspecifica && !loadingInicial && (
          <div className={styles.operacaoSelector}>
            <h3>1. Selecione a Operação</h3>
            <div className={styles.operacoesList}>
              {operacoes.map(operacao => (
                <OperacaoCard
                  key={operacao.id}
                  operacao={operacao}
                  isSelected={operacaoSelecionada?.id === operacao.id}
                  onSelect={handleOperacaoSelect}
                  formatarDataCompleta={formatarDataCompleta}
                />
              ))}
            </div>
          </div>
        )}

        {operacaoSelecionada && !loadingInicial && (
          <>
            {/* Conteúdo Otimizado - Foco Total nos Membros */}
            <div className={styles.content}>
              <div className={styles.adicionarTab}>
                <SearchBox
                  searchTerm={searchTerm}
                  onSearchChange={handleSearchChange}
                />

                <div className={styles.membrosList}>
                  {membrosDisponiveis.length === 0 ? (
                    <div className={styles.semResultados}>
                      <Users size={48} />
                      {searchTerm.trim() === '' ? (
                        <>
                          <p>Nenhum membro ativo encontrado</p>
                          <p>Verifique se há membros cadastrados no sistema</p>
                        </>
                      ) : (
                        <>
                          <p>Nenhum membro encontrado para "{searchTerm}"</p>
                          <p>Tente buscar por nome ou matrícula</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {membrosDisponiveis.map(membro => {
                        const participacao = operacaoSelecionada.participantes?.find(p => p.membro_id === membro.id);
                        const statusInfo = getStatusParticipacao(participacao);

                        return (
                          <MembroCard
                            key={membro.id}
                            membro={membro}
                            participacao={participacao}
                            statusInfo={statusInfo}
                            loadingStates={loadingStates}
                            onAdicionarMembro={adicionarMembro}
                            onAprovarSolicitacao={aprovarSolicitacao}
                            onRejeitarSolicitacao={rejeitarSolicitacao}
                            onRemoverMembro={removerMembro}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {!operacaoSelecionada && !operacaoEspecifica && (
          <div className={styles.selecionar}>
            <Users size={48} />
            <p>Selecione uma operação para gerenciar participações</p>
          </div>
        )}
      </div>

      {/* Modal Universal para substituir alerts e confirms */}
      <UniversalModal
        isOpen={modal.isOpen}
        config={modal.config}
        onClose={modal.closeModal}
      />
    </div>
  );
};

// ✅ EXPORTAÇÃO MEMOIZADA: Componente principal otimizado
export const GerenciarMembrosModal = memo(GerenciarMembrosModalComponent);