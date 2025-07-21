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

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Plus, Trash2, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRealtimeCentralized } from '@/hooks/useRealtimeCentralized';
import { useModal } from '@/hooks/useModal';
import { UniversalModal } from '@/shared/components/ui';
import styles from './GerenciarMembrosModal.module.css';
import { format, parseISO } from 'date-fns';
import { getSupervisorHeaders } from '@/lib/auth-utils';

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

export const GerenciarMembrosModal: React.FC<GerenciarMembrosModalProps> = ({ onClose, onUpdate, operacaoEspecifica }) => {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [operacoes, setOperacoes] = useState<OperacaoParticipacao[]>([]);
  const [operacaoSelecionada, setOperacaoSelecionada] = useState<OperacaoParticipacao | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(true); // ✅ NOVO: Loading inicial separado
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hook para modais modernos
  const modal = useModal();

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

  // 🚀 REALTIME CENTRALIZADO: Hook para atualizações automáticas - AGORA COM HANDLERS ESTÁVEIS
  const realtimeHook = useRealtimeCentralized({
    enabled: operacaoIds.length > 0 && !loadingInicial,
    debug: false,
    onOperacaoChange: handleOperacaoChange,
    onParticipacaoChange: handleParticipacaoChange,
  });

  useEffect(() => {
    carregarDadosOtimizado();
  }, []);

  // ✅ FUNCIONALIDADE ESC: Fechar modal com ESC
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  // ✅ PREVENIR SCROLL DA PÁGINA ATRÁS
  useEffect(() => {
    // Salvar posição atual do scroll
    const scrollY = window.scrollY;

    // ✅ MONITORAMENTO MÍNIMO - Logs removidos para performance
    const handleResize = () => {
      // Resize handler simplificado sem logs
    };

    window.addEventListener('resize', handleResize);

    // Prevenir scroll no body
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    // ✅ MODAL DIAGNOSTICS REMOVED - Melhor performance

    // Prevenir eventos de scroll no modal
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as Element;
      const modalContent = target.closest(`.${styles.container}`);

      // Se o scroll está acontecendo fora do modal, prevenir
      if (!modalContent) {
        event.preventDefault();
      }
    };

    // Prevenir gestos de toque que causam scroll
    const handleTouchMove = (event: TouchEvent) => {
      const target = event.target as Element;
      const modalContent = target.closest(`.${styles.container}`);

      // Se o toque está acontecendo fora do modal, prevenir
      if (!modalContent) {
        event.preventDefault();
      }
    };

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
  }, []);

  // ✅ AUTO-SELECIONAR operação quando vem da aba operações
  useEffect(() => {
    if (operacaoEspecifica && operacoes.length > 0) {
      const operacaoEncontrada = operacoes.find(op => op.id === operacaoEspecifica.id);
      if (operacaoEncontrada) {
        setOperacaoSelecionada(operacaoEncontrada);
      }
    }
  }, [operacaoEspecifica, operacoes]);

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

  // ✅ FUNÇÃO: Carregar dados otimizados para o modal
  const carregarDadosOtimizado = useCallback(async () => {
    if (!operacaoEspecifica) return;

    // Optimized data loading logging removed for performance
    // Operation ID logging removed for performance

    setLoadingDetalhes(true);

    try {
      // ✅ REQUISIÇÃO OTIMIZADA: Buscar apenas dados essenciais
      const startDate = format(parseISO(operacaoEspecifica.data_operacao), 'yyyy-MM-dd');
      const endDate = startDate;

      const params = new URLSearchParams({
        startDate,
        endDate,
        portal: 'supervisor',
        includeParticipantes: 'true',
        mode: 'light',
        _t: Date.now().toString()
      });

      const url = `/api/unified/operacoes?${params}`;

      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // ✅ ENCONTRAR A OPERAÇÃO ESPECÍFICA
        const operacaoAtualizada = data.data?.find((op: any) => op.id === operacaoEspecifica.id);

        if (operacaoAtualizada) {
          // Operation found logging removed for performance
          // Operation ID logging removed for performance

          // ✅ PROCESSAR PARTICIPANTES POR ESTADO
          const participantes = operacaoAtualizada.participantes || [];

          const confirmados = participantes.filter((p: any) => p.estado_visual === 'CONFIRMADO');
          const pendentes = participantes.filter((p: any) => p.estado_visual === 'PENDENTE' || p.estado_visual === 'NA_FILA');
          const aguardandoSupervisor = participantes.filter((p: any) => p.estado_visual === 'AGUARDANDO_SUPERVISOR');

          // Participants processing logging removed for performance
          // Confirmed count logging removed for performance
          // Pending/queue count logging removed for performance
          // Waiting supervisor count logging removed for performance

          // ✅ ATUALIZAR ESTADOS
          setOperacoes(data.data || []);
          setOperacaoSelecionada(operacaoAtualizada);

          // States updated successfully logging removed for performance

          // ✅ BUSCAR LISTA DE MEMBROS SE NECESSÁRIO
          if (membros.length === 0) {
            // Loading members list logging removed for performance
            await carregarMembros();
          }
        } else {
          console.error('❌ [MODAL-SUPERVISOR] Operação não encontrada:', operacaoEspecifica.id);
          throw new Error(`Operação ${operacaoEspecifica.id} não encontrada`);
        }
      } else {
        throw new Error(data.error || 'Erro ao buscar dados da operação');
      }
    } catch (error) {
      console.error('❌ [MODAL-SUPERVISOR] Erro ao carregar dados:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar dados');
    } finally {
      setLoadingDetalhes(false);
      // Loading finished logging removed for performance

      // 🔍 CRITICAL: Setar loadingInicial para false APÓS carregar tudo
      setLoadingInicial(false);
    }
  }, [operacaoEspecifica, membros.length, carregarMembros]);

  // ✅ BUSCA E ORDENAÇÃO POR GRUPOS: Confirmados primeiro, depois fila, depois demais
  const membrosDisponiveis = useMemo(() => {
    // 🔍 FILTRAR MEMBROS ATIVOS
    let membrosParaExibir = membros.filter(m => {
      if (!m.ativo) return false;

      // Se não há termo de busca, mostra todos os membros ativos
      if (!searchTerm.trim()) return true;

      // Se há termo de busca, filtra por nome ou matrícula
      const termo = searchTerm.toLowerCase().trim();
      return (
        m.nome.toLowerCase().includes(termo) ||
        m.matricula.includes(termo)
      );
    });

    // 🎯 NOVA ORDENAÇÃO POR GRUPOS: Conforme solicitação do usuário
    if (operacaoSelecionada?.participantes) {
      // Sorting diagnosis logging removed for performance
      // Operation ID logging removed for performance
      // Total participants logging removed for performance

      // 🔍 DIAGNÓSTICO ESPECÍFICO: Verificar se as datas estão chegando do backend
      // API participants diagnosis logging removed for performance
      // Individual participant logging removed for performance

      // 📋 SEPARAR PARTICIPANTES POR ESTADO VISUAL
      const participantesConfirmados = operacaoSelecionada.participantes.filter(p => p.estado_visual === 'CONFIRMADO');
      const participantesPendentes = operacaoSelecionada.participantes.filter(p => p.estado_visual === 'PENDENTE');
      const participantesNaFila = operacaoSelecionada.participantes.filter(p => p.estado_visual === 'NA_FILA');

      // Confirmed participants logging removed for performance
      // Pending participants logging removed for performance
      // Queued participants logging removed for performance

      // 📋 ORDENAR POR DATA DE PARTICIPAÇÃO (CRONOLÓGICA) dentro de cada grupo
      const ordenarPorDataParticipacao = (a: any, b: any) => {
        const participacaoA = operacaoSelecionada.participantes?.find(p => p.membro_id === a.id);
        const participacaoB = operacaoSelecionada.participantes?.find(p => p.membro_id === b.id);

        if (participacaoA && participacaoB) {
          const dataA = new Date(participacaoA.data_participacao || 0).getTime();
          const dataB = new Date(participacaoB.data_participacao || 0).getTime();
          return dataA - dataB; // Quem solicitou primeiro vem primeiro
        }

        return a.nome.localeCompare(b.nome);
      };

      const resultado = membrosParaExibir.sort((membroA, membroB) => {
        const participacaoA = operacaoSelecionada.participantes?.find(p => p.membro_id === membroA.id);
        const participacaoB = operacaoSelecionada.participantes?.find(p => p.membro_id === membroB.id);

        // Função para determinar prioridade do grupo
        const obterPrioridadeGrupo = (participacao: any) => {
          if (!participacao) return 3; // DISPONÍVEL = menor prioridade

          switch (participacao.estado_visual) {
            case 'CONFIRMADO': return 1; // CONFIRMADO = maior prioridade (aparece primeiro)
            case 'NA_FILA':
            case 'PENDENTE': return 2; // AGUARDANDO = prioridade média (aparece segundo)
            default: return 3; // OUTROS = menor prioridade
          }
        };

        const prioridadeA = obterPrioridadeGrupo(participacaoA);
        const prioridadeB = obterPrioridadeGrupo(participacaoB);

        // 📊 PRIORIDADE 1: Separar por grupos (confirmados, fila, demais)
        if (prioridadeA !== prioridadeB) {
          return prioridadeA - prioridadeB; // Menor número = maior prioridade
        }

        // 📊 PRIORIDADE 2: Dentro do mesmo grupo, ORDEM CRONOLÓGICA (quem solicitou primeiro)
        if (participacaoA && participacaoB) {
          const dataA = new Date(participacaoA.data_participacao || 0).getTime();
          const dataB = new Date(participacaoB.data_participacao || 0).getTime();

          // Date comparison diagnosis logging removed for performance

          return dataA - dataB; // Quem solicitou primeiro vem primeiro
        }

        // 📊 PRIORIDADE 3: Se não têm participação, ordem alfabética
        return membroA.nome.localeCompare(membroB.nome);
      });

      // 🔍 LOG DA ORDEM FINAL
      // Final order diagnosis logging removed for performance
      // Individual member order logging removed for performance

      return resultado;
    }

    // 📊 FALLBACK: Sem operação selecionada, ordem alfabética simples
    return membrosParaExibir.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [membros, searchTerm, operacaoSelecionada]);

  // 🚨 NOVO: Sistema FIFO com Justificativa
  const adicionarMembro = async (membroId: number, justificativaFifo?: string) => {
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

    setLoading(true);
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
      setLoading(false);
    }
  };

  const removerMembro = async (participacaoId: number) => {
    if (!operacaoSelecionada) return;

    modal.showConfirm(
      '🗑️ Remover Membro',
      'Tem certeza que deseja remover este membro da operação?',
      () => executeRemoverMembro(participacaoId)
    );
  };

  const executeRemoverMembro = async (participacaoId: number) => {

    setLoading(true);
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
      setLoading(false);
    }
  };

  const executeRejeitarSolicitacao = async (participacaoId: number) => {
    if (!operacaoSelecionada) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/solicitacoes/${participacaoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      setLoading(false);
    }
  };

  const rejeitarSolicitacao = async (participacaoId: number) => {
    if (!operacaoSelecionada) return;

    modal.showConfirm(
      '❌ Rejeitar Solicitação',
      'Tem certeza que deseja rejeitar esta solicitação? O membro não poderá participar desta operação.',
      () => executeRejeitarSolicitacao(participacaoId)
    );
  };

  const aprovarSolicitacao = async (participacaoId: number, justificativaFifo?: string) => {
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

    setLoading(true);
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
      setLoading(false);
    }
  };

  const getStatusParticipacao = (participacao: any) => {
    // Participation evaluation logging removed for performance

    if (!participacao) {
      // No participation logging removed for performance
      return { tipo: 'DISPONIVEL', label: null, acoes: ['adicionar'] };
    }

    switch (participacao.estado_visual) {
      case 'CONFIRMADO':
        // Confirmed status logging removed for performance
        return {
          tipo: 'CONFIRMADO',
          label: '✅ Confirmado',
          className: styles.confirmado,
          acoes: ['remover']
        };

      case 'ADICIONADO_SUP':
        // Added by supervisor logging removed for performance
        return {
          tipo: 'ADICIONADO_SUP',
          label: '👑 Adicionado pelo Supervisor',
          className: styles.adicionadoSupervisor,
          acoes: ['remover']
        };

      case 'PENDENTE':
        // Pending status logging removed for performance
        return {
          tipo: 'PENDENTE',
          label: '⏳ Aguardando Aprovação',
          className: styles.pendente,
          acoes: ['aprovar', 'rejeitar']
        };

      case 'NA_FILA':
        // Queue status logging removed for performance
        return {
          tipo: 'NA_FILA',
          label: '⏳ Na Fila',
          className: styles.na_fila,
          acoes: ['aprovar', 'rejeitar']
        };

      default:
        // Unknown status logging removed for performance
        return { tipo: 'DISPONIVEL', label: null, acoes: ['adicionar'] };
    }
  };

  const statusInfo = getStatusParticipacao(operacaoSelecionada?.participantes);

  const formatarData = (data: string) => {
    try {
      // Handle both YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss formats
      const dateOnly = data.split('T')[0];
      const [ano, mes, dia] = dateOnly.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return data; // Return original if formatting fails
    }
  };

  const formatarDataCompleta = (data: string) => {
    try {
      const date = new Date(data);
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      const diaSemana = diasSemana[date.getDay()];
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = meses[date.getMonth()];
      const ano = date.getFullYear();

      return {
        diaMes: dia,
        mes: mes,
        ano: ano,
        diaSemana: diaSemana,
        dataCompleta: `${dia}/${mes.toLowerCase()}/${ano}`,
        diaSemanaAbrev: diaSemana.substring(0, 3).toUpperCase()
      };
    } catch {
      return {
        diaMes: '00',
        mes: 'Jan',
        ano: 2025,
        diaSemana: 'Segunda',
        dataCompleta: data,
        diaSemanaAbrev: 'SEG'
      };
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
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
                  {operacaoEspecifica.modalidade}
                  <strong>{operacaoEspecifica.modalidade} {operacaoEspecifica.tipo}</strong>
                </div>
                <div className={styles.operacaoMeta}>
                  <span className={styles.metaItem}>
                    📅 <strong>{formatarData(operacaoEspecifica.data_operacao)}</strong>
                  </span>
                  <span className={styles.metaItem}>
                    🕐 <strong>{operacaoEspecifica.turno}</strong>
                  </span>
                  <span className={styles.metaItem}>
                    🏢 <strong>{operacaoEspecifica.regional || 'Sem Regional'}</strong>
                  </span>
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
              {operacoes.map(operacao => {
                const dataInfo = formatarDataCompleta(operacao.data_operacao);
                const confirmados = operacao.participantes?.filter((p: any) =>
                  p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP'
                ).length || 0;
                const naFila = operacao.participantes?.filter((p: any) => p.estado_visual === 'NA_FILA').length || 0;
                const pendentes = operacao.participantes?.filter((p: any) => p.estado_visual === 'PENDENTE').length || 0;

                return (
                  <div
                    key={operacao.id}
                    className={`${styles.operacaoCard} ${operacaoSelecionada?.id === operacao.id ? styles.selecionada : ''}`}
                    onClick={() => setOperacaoSelecionada(operacao)}
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
              })}
            </div>
          </div>
        )}

        {operacaoSelecionada && !loadingInicial && (
          <>
            {/* Conteúdo Otimizado - Foco Total nos Membros */}
            <div className={styles.content}>
              <div className={styles.adicionarTab}>
                <div className={styles.searchBox}>
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou matrícula (opcional)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

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
                        const temParticipacao = !!participacao;

                        const obterClasseFundo = () => {
                          // Background color definition logging removed for performance

                          if (!participacao) {
                            // No participation background logging removed for performance
                            return '';
                          }

                          switch (participacao.estado_visual) {
                            case 'CONFIRMADO':
                            case 'ADICIONADO_SUP':
                              // Confirmed/added background logging removed for performance
                              return styles.membroConfirmado;
                            case 'NA_FILA':
                            case 'PENDENTE':
                              // Queue/pending background logging removed for performance
                              return styles.membroAguardando;
                            default:
                              // Unknown state background logging removed for performance
                              return '';
                          }
                        };

                        return (
                          <div key={membro.id} className={`${styles.membroCard} ${obterClasseFundo()}`}>
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
                                    onClick={() => adicionarMembro(membro.id)}
                                    disabled={loading}
                                    className={styles.btnAdicionar}
                                  >
                                    <Plus size={16} />
                                    Adicionar
                                  </button>
                                )}

                                {statusInfo.acoes.includes('aprovar') && participacao && (
                                  <button
                                    onClick={() => aprovarSolicitacao(participacao.id)}
                                    disabled={loading}
                                    className={styles.btnAprovar}
                                  >
                                    ✓ Aprovar
                                  </button>
                                )}

                                {statusInfo.acoes.includes('rejeitar') && participacao && (
                                  <button
                                    onClick={() => rejeitarSolicitacao(participacao.id)}
                                    disabled={loading}
                                    className={styles.btnRejeitar}
                                  >
                                    ✗ Rejeitar
                                  </button>
                                )}

                                {statusInfo.acoes.includes('remover') && participacao && (
                                  <button
                                    onClick={() => removerMembro(participacao.id)}
                                    disabled={loading}
                                    className={styles.btnRemover}
                                  >
                                    <Trash2 size={16} />
                                    Remover
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
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