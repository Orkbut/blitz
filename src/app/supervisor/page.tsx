'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Operacao, JanelaOperacional, Solicitacao } from '@/shared/types';

import { GerenciarMembrosModal } from '@/components/supervisor/GerenciarMembrosModal';
import { HorarioPopover } from '@/components/supervisor/HorarioPopover';
import { MultiDateCalendar } from '@/components/supervisor/MultiDateCalendar';
import { CriarJanelaModal } from '@/components/supervisor/CriarJanelaModal';
import { CriarOperacaoModal } from '@/components/supervisor/CriarOperacaoModal';
import { CalendarioSupervisor } from '@/components/supervisor/CalendarioSupervisor';
import { ModalOperacaoSupervisor } from '@/components/supervisor/ModalOperacaoSupervisor';

import { ElegantPageLoader } from '@/shared/components/ui/LoadingSpinner';
import { formatarDataBR, formatarDataHoraCompleta, obterDataAtualIguatu, getSupervisorContext, getSupervisorHeaders } from '@/lib/auth-utils';

export default function SupervisorPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // ✅ VERIFICAÇÃO DE AUTENTICAÇÃO PRIMEIRO
  useEffect(() => {
    const checkAuth = () => {
      const supervisorAuth = localStorage.getItem('supervisorAuth');
      
      if (!supervisorAuth) {
        router.push('/supervisor/auth');
        return;
      }

      try {
        const userData = JSON.parse(supervisorAuth);
        if (userData.perfil === 'Supervisor' && userData.regionalId) {
          setIsAuthenticated(true);
        } else {
          router.push('/supervisor/auth');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/supervisor/auth');
        return;
      }
    };

    checkAuth();
  }, [router]);

  // ✅ STATES PARA TODAS AS FUNCIONALIDADES OBRIGATÓRIAS
  const [activeTab, setActiveTab] = useState<'operacoes' | 'janelas' | 'diretoria'>('operacoes');
  const [janelas, setJanelas] = useState<JanelaOperacional[]>([]);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataParaReabrirModal, setDataParaReabrirModal] = useState<string | null>(null);

  // ✅ NOVOS STATES PARA UX MELHORADA DE JUSTIFICATIVAS
  const [justificativasFifo, setJustificativasFifo] = useState<{[key: number]: string}>({});
  const [mostrandoJustificativa, setMostrandoJustificativa] = useState<{[key: number]: boolean}>({});
  const [avisoElegante, setAvisoElegante] = useState<{
    show: boolean;
    tipo: 'erro' | 'sucesso' | 'aviso';
    titulo: string;
    mensagem: string;
  }>({
    show: false,
    tipo: 'erro',
    titulo: '',
    mensagem: ''
  });

  // ✅ STATES PARA CRIAÇÃO DE JANELA (FASE 0 OBRIGATÓRIA)
  const [novaJanela, setNovaJanela] = useState({
    dataInicio: '',
    dataFim: '',
    modalidades: [] as string[],
    limiteMin: 2,
    limiteMax: 30
  });

  // ✅ STATES PARA CRIAÇÃO DE OPERAÇÃO
  const [novaOperacao, setNovaOperacao] = useState({
    janelaId: '',
    data: '',
    modalidade: '',
    tipo: 'PLANEJADA',
    turno: '',
    limite: 15
  });

  // ✅ STATES PARA SELEÇÃO DE DATAS
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ✅ ESTADO PARA HERANÇA DOS LIMITES DA JANELA
  const [limitesJanela, setLimitesJanela] = useState<{
    periodoPermitido?: { dataInicio: string; dataFim: string };
    modalidadesPermitidas?: string[]; // ✅ MANTIDO: API específica de operações usa este nome
    limitesParticipantes?: { minimo: number; maximo: number; padrao: number };
    configuracaoHerdada?: { modalidadeUnica: string | null; temAmbas: boolean };
  }>({});

  // ✅ STATES PARA MENSAGEM REGIONAL
  const [novaMensagem, setNovaMensagem] = useState({
    conteudo: '',
    prazoExpiracao: 7
  });

  // ✅ STATE PARA MODAIS

  const [operacaoParaGerenciar, setOperacaoParaGerenciar] = useState<any>(null);
  const [showCriarJanelaModal, setShowCriarJanelaModal] = useState(false);
  const [showCriarOperacaoModal, setShowCriarOperacaoModal] = useState(false);
  const [operacaoSelecionadaModal, setOperacaoSelecionadaModal] = useState<any>(null);
  
  // ✅ NOVO: STATE PARA MENU DROPDOWN (compatível com mobile)
  const [showDropdownMenu, setShowDropdownMenu] = useState(false);
  
  // ✅ NOVO: STATE PARA MODAL DE HORÁRIO
  const [showHorarioPopover, setShowHorarioPopover] = useState<number | null>(null);
  const [operacaoParaHorario, setOperacaoParaHorario] = useState<any>(null);
  const horarioButtonRefs = useRef<{ [key: number]: React.RefObject<HTMLButtonElement> }>({});

  useEffect(() => {
    carregarDados();
  }, [activeTab]);

  // ✅ CONTROLE DE LOADING INICIAL
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1200); // 1.2 segundos

    return () => clearTimeout(timer);
  }, []);

  // ✅ CARREGAR DADOS CONFORME TAB ATIVA
  const carregarDados = async () => {
    setLoading(true);
    try {
      if (activeTab === 'operacoes') {
        await carregarOperacoes();
        await carregarJanelas(); // Carregar janelas para os selects de criação
      } else if (activeTab === 'janelas') {
        await carregarJanelas();
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CALLBACK MEMOIZADO PARA CARREGAR OPERAÇÕES
  const carregarOperacoes = useCallback(async () => {
    if (activeTab !== 'operacoes') return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor', {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL: Contexto automático do supervisor
      });
      const result = await response.json();
      
      if (result.success) {
        setOperacoes(result.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar operações:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // ✅ CALLBACK MEMOIZADO PARA CARREGAR JANELAS COM CONTEXTO CORRETO
  const carregarJanelas = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        headers: getSupervisorHeaders() // ✅ CONTEXTO AUTOMÁTICO DO SUPERVISOR LOGADO
      });
      const result = await response.json();
      
      if (result.success) {
        setJanelas(result.data || []);
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Carregar', result.error || 'Erro ao carregar janelas');
      }
    } catch (error) {
      console.error('Erro ao carregar janelas:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível carregar as janelas.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ NOVA FUNÇÃO: EXCLUIR JANELA OPERACIONAL COM AUTENTICAÇÃO CORRETA
  const excluirJanela = async (janelaId: number, periodo: string) => {
    const confirmacao = confirm(
      `⚠️ EXCLUIR JANELA OPERACIONAL #${janelaId}?\n\n` +
      `Período: ${periodo}\n\n` +
      `Esta ação irá:\n` +
      `• Excluir PERMANENTEMENTE a janela\n` +
      `• Remover TODAS as operações da janela\n` +
      `• Cancelar TODAS as participações\n` +
      `• Remover TODOS os eventos relacionados\n\n` +
      `⚠️ ESTA AÇÃO NÃO PODE SER DESFEITA!\n\n` +
      `Tem certeza absoluta que deseja continuar?`
    );

    if (!confirmacao) return;

    // Confirmação dupla para operação crítica
    const confirmacaoFinal = confirm(
      `🚨 ÚLTIMA CONFIRMAÇÃO!\n\n` +
      `Você confirma a EXCLUSÃO PERMANENTE da Janela #${janelaId}?\n\n` +
      `TODO o histórico será perdido para sempre!`
    );

    if (!confirmacaoFinal) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/janelas-operacionais?id=${janelaId}`, {
        method: 'DELETE',
        headers: getSupervisorHeaders() // ✅ CONTEXTO AUTOMÁTICO: X-Supervisor-Id e X-Regional-Id
      });

      const result = await response.json();
      
      if (result.success) {
        const impacto = result.data.impacto;
        mostrarAvisoElegante(
          'sucesso', 
          'Janela Excluída!', 
          `Janela #${janelaId} excluída com sucesso. ` +
          `${impacto.operacoesRemovidas} operações, ` +
          `${impacto.participacoesRemovidas} participações e ` +
          `${impacto.eventosRemovidos} eventos foram removidos.`
        );
        await carregarJanelas(); // Recarregar lista
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Excluir', result.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao excluir janela:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível excluir a janela.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ USEEFFECTS PARA CARREGAMENTO INICIAL DOS DADOS
  useEffect(() => {
    if (isAuthenticated) {
      carregarJanelas();
      carregarOperacoes();
      setInitialLoading(false);
    }
  }, [isAuthenticated, carregarJanelas, carregarOperacoes]);

  // ✅ CARREGAR DADOS QUANDO MUDA DE ABA
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'operacoes') {
        carregarOperacoes();
      } else if (activeTab === 'janelas') {
        carregarJanelas();
      }
    }
  }, [activeTab, isAuthenticated, carregarOperacoes, carregarJanelas]);

  // ✅ NOVO: FECHAR MENU DROPDOWN AO CLICAR FORA (compatível com mobile)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDropdownMenu && !target.closest('.dropdown-menu-container')) {
        setShowDropdownMenu(false);
      }
    };

    if (showDropdownMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdownMenu]);

  // ✅ GERENCIAR REFS DOS BOTÕES DE HORÁRIO
  const getHorarioButtonRef = (operacaoId: number) => {
    if (!horarioButtonRefs.current[operacaoId]) {
      horarioButtonRefs.current[operacaoId] = React.createRef<HTMLButtonElement>();
    }
    return horarioButtonRefs.current[operacaoId];
  };

  // ✅ FUNÇÃO PARA FECHAR POPOVER DE HORÁRIO
  const fecharHorarioPopover = () => {
    setShowHorarioPopover(null);
    setOperacaoParaHorario(null);
  };

  // ✅ DEFINIR/ATUALIZAR HORÁRIO DA OPERAÇÃO
  const abrirHorarioPopover = (operacao: any) => {
    setOperacaoParaHorario(operacao);
    setShowHorarioPopover(operacao.id);
    // Fechar modal de operação se estiver aberto
    setOperacaoSelecionadaModal(null);
  };

  const definirHorario = async (horario: string, turno?: string) => {
    if (!operacaoParaHorario) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/operacoes/${operacaoParaHorario.id}/horario`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...getSupervisorContext(),
          horario: horario || null,
          turno: turno || null
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const acao = result.data.acao;
        let titulo = 'Atualizado!';
        let mensagem = '';
        
        switch (acao) {
          case 'horario_e_turno_definidos':
            titulo = 'Horário e Turno Definidos!';
            mensagem = `Horário ${result.data.horario} e turno ${result.data.turno} definidos com sucesso.`;
            break;
          case 'horario_definido':
            titulo = 'Horário Definido!';
            mensagem = `Horário ${result.data.horario} definido com sucesso.`;
            break;
          case 'turno_definido':
            titulo = 'Turno Definido!';
            mensagem = `Turno ${result.data.turno} definido com sucesso.`;
            break;
          case 'removido':
            titulo = 'Removido!';
            mensagem = 'Horário e turno removidos com sucesso.';
            break;
          default:
            titulo = 'Atualizado!';
            mensagem = 'Operação atualizada com sucesso.';
        }
        
        // ✅ OTIMIZAÇÃO: Atualizar apenas a operação específica
        setOperacoes(prevOperacoes => 
          prevOperacoes.map(op => 
            op.id === operacaoParaHorario.id 
              ? { ...op, horario: result.data.horario, turno: result.data.turno }
              : op
          )
        );
        
        // ✅ SALVAR DATA PARA REABRIR MODAL APÓS FECHAR HORÁRIO
        const dataOperacao = operacaoParaHorario.data_operacao.split('T')[0];
        
        mostrarAvisoElegante('sucesso', titulo, mensagem);
        fecharHorarioPopover();
        
        // ✅ PROGRAMAR REABERTURA DO MODAL DA TIMELINE
        setTimeout(() => {
          setDataParaReabrirModal(dataOperacao);
          // Limpar após usar
          setTimeout(() => setDataParaReabrirModal(null), 100);
        }, 300); // Pequeno delay para garantir que o modal de horário feche primeiro
        
        // ✅ REMOVIDO: await carregarOperacoes() - não precisa mais recarregar tudo
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Atualizar', result.error);
      }
    } catch (error) {
      console.error('Erro ao definir horário:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível definir o horário.');
    } finally {
      setLoading(false);
    }
  };

  const removerHorario = async () => {
    if (!operacaoParaHorario) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/operacoes/${operacaoParaHorario.id}/horario`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...getSupervisorContext(),
          horario: null,
          turno: null
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // ✅ OTIMIZAÇÃO: Atualizar apenas a operação específica
        setOperacoes(prevOperacoes => 
          prevOperacoes.map(op => 
            op.id === operacaoParaHorario.id 
              ? { ...op, horario: null, turno: result.data.turno }
              : op
          )
        );
        
        // ✅ SALVAR DATA PARA REABRIR MODAL APÓS FECHAR HORÁRIO
        const dataOperacao = operacaoParaHorario.data_operacao.split('T')[0];
        
        mostrarAvisoElegante('sucesso', 'Horário Removido!', 'Horário removido da operação.');
        fecharHorarioPopover();
        
        // ✅ PROGRAMAR REABERTURA DO MODAL DA TIMELINE
        setTimeout(() => {
          setDataParaReabrirModal(dataOperacao);
          // Limpar após usar
          setTimeout(() => setDataParaReabrirModal(null), 100);
        }, 300); // Pequeno delay para garantir que o modal de horário feche primeiro
        
        // ✅ REMOVIDO: await carregarOperacoes() - não precisa mais recarregar tudo
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Remover Horário', result.error);
      }
    } catch (error) {
      console.error('Erro ao remover horário:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível remover o horário.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ EXCLUIR OPERAÇÃO TEMPORARIAMENTE
  const excluirOperacaoTemporariamente = async (operacaoId: number) => {
    const motivo = prompt(
      `⚠️ EXCLUIR OPERAÇÃO ${operacaoId} TEMPORARIAMENTE?\n\n` +
      `Esta ação irá:\n` +
      `• Ocultar a operação para novos membros\n` +
      `• Cancelar participações pendentes\n` +
      `• Notificar membros confirmados\n` +
      `• Permitir reativação em 24h\n\n` +
      `Digite o motivo da exclusão (mínimo 10 caracteres):`
    );

    if (!motivo || motivo.trim().length < 10) {
      mostrarAvisoElegante('aviso', 'Motivo Obrigatório', 'Digite um motivo com pelo menos 10 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/operacoes/${operacaoId}/excluir-temporariamente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...getSupervisorContext(),
          motivo: motivo.trim() 
        })
      });

      const result = await response.json();
      
      if (result.success) {
        mostrarAvisoElegante('sucesso', 'Operação Excluída!', 
          `Operação excluída temporariamente. ${result.data.participacoesAfetadas} participações afetadas.`);
        await carregarOperacoes();
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Excluir', result.error);
      }
    } catch (error) {
      console.error('Erro ao excluir operação:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível excluir a operação.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ REATIVAR OPERAÇÃO
  const reativarOperacao = async (operacaoId: number) => {
    const confirmacao = confirm(
      `✅ REATIVAR OPERAÇÃO ${operacaoId}?\n\n` +
      `Esta ação irá:\n` +
      `• Tornar a operação visível novamente\n` +
      `• Permitir novas solicitações\n` +
      `• Restaurar o status ativo\n\n` +
      `Confirma a reativação?`
    );

    if (!confirmacao) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/operacoes/${operacaoId}/reativar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getSupervisorContext())
      });

      const result = await response.json();
      
      if (result.success) {
        mostrarAvisoElegante('sucesso', 'Operação Reativada!', 'Operação reativada com sucesso!');
        await carregarOperacoes();
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Reativar', result.error);
      }
    } catch (error) {
      console.error('Erro ao reativar operação:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível reativar a operação.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ CALLBACK MEMOIZADO PARA AVISOS
  const mostrarAvisoElegante = useCallback((tipo: 'erro' | 'sucesso' | 'aviso', titulo: string, mensagem: string) => {
    setAvisoElegante({ show: true, tipo, titulo, mensagem });
    setTimeout(() => {
      setAvisoElegante(prev => ({ ...prev, show: false }));
    }, 5000);
  }, []); // ✅ Função estável

  // ✅ CALLBACK MEMOIZADO PARA CARREGAR OPERAÇÕES
  const carregarOperacoesMemoizado = useCallback(async () => {
    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor', {
        headers: getSupervisorHeaders() // 🚨 ISOLAMENTO REGIONAL: Incluir contexto do supervisor
      });
      const result = await response.json();
      
      if (result.success) {
        const operacoesMapeadas: Operacao[] = result.data.map((op: any) => ({
          id: op.id,
          data_operacao: op.dataOperacao || op.data_operacao,
          modalidade: op.modalidade,
          tipo: op.tipo,
          turno: op.turno,
          horario: op.horario,
          limite_participantes: op.limiteParticipantes || op.limite_participantes,
          status: op.statusReal || op.status,
          ativa: op.ativa ?? true,
          criado_em: op.criadoEm || op.criado_em,
          janela_id: op.janela?.id,
          janela: op.janela,
          regional: op.regional,
          ...(op.excluida_temporariamente !== undefined && { excluida_temporariamente: op.excluida_temporariamente }),
          participantes_confirmados: op.participantes_confirmados || 0,
          pessoas_na_fila: op.pessoas_na_fila || 0
        }));
        
        setOperacoes(operacoesMapeadas);
      } else {
        console.error('❌ Erro no resultado:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar operações:', error);
    }
  }, []); // ✅ Sem dependências, função estável

  // ✅ CALLBACK MEMOIZADO PARA CARREGAR SOLICITAÇÕES
  const carregarSolicitacoesMemoizado = useCallback(async () => {
    try {
      const response = await fetch('/api/supervisor/solicitacoes', {
        headers: getSupervisorHeaders() // 🚨 ISOLAMENTO REGIONAL: Incluir contexto do supervisor
      });
      const result = await response.json();
      
      if (result.success) {
        const solicitacoesDados = result.data.todas || result.data || [];
        
        const solicitacoesFormatadas = solicitacoesDados.map((s: any) => ({
          id: s.id,
          membroNome: s.membroNome,
          membroId: s.membroId || s.membro_id,
          operacaoId: s.operacaoId || s.operacao_id,
          membroMatricula: s.membroMatricula || s.matricula,
          operacao: s.operacao,
          dataOperacao: s.dataOperacao,
          turno: s.turno,
          status: s.status,
          estadoVisual: s.estadoVisual || s.estado_visual || 'PENDENTE',
          timestamp: s.timestamp,
          posicaoFila: s.posicaoFila,
          isNaFila: s.isNaFila,
          isProximoDaFila: s.isProximoDaFila,
          operacaoDetalhes: s.operacaoDetalhes
        }));
        
        setSolicitacoes(solicitacoesFormatadas);
      } else {
        console.error('❌ Erro no resultado:', result.error);
        setSolicitacoes([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar solicitações:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível carregar as solicitações.');
    }
  }, [mostrarAvisoElegante]); // ✅ Dependência memoizada
  
  // ✅ CALLBACKS ESTÁVEIS PARA MODAL - Memoizados conforme best practices React
  const handleGerenciarModalClose = useCallback(() => {
    setOperacaoParaGerenciar(null);
    setOperacaoSelecionadaModal(null);
    carregarOperacoesMemoizado(); 
  }, [carregarOperacoesMemoizado]); // ✅ Dependência estável

  const handleGerenciarModalUpdate = useCallback(() => {
    // ✅ Função estável para atualização da timeline
    carregarOperacoesMemoizado();
    carregarSolicitacoesMemoizado();
  }, [carregarOperacoesMemoizado, carregarSolicitacoesMemoizado]); // ✅ Dependências estáveis

  // ✅ FUNÇÃO PARA LIDAR COM MÚLTIPLAS OPERAÇÕES
  const handleOperacaoClick = (operacoes: Operacao[]) => {
    if (operacoes.length === 0) return;
    
    // Se há apenas uma operação, seleciona direto
    if (operacoes.length === 1) {
      setOperacaoSelecionadaModal(operacoes[0]);
    } else {
      // Se há múltiplas operações, seleciona a primeira por agora
      // TODO: Futuramente pode abrir um modal de seleção
      setOperacaoSelecionadaModal(operacoes[0]);
    }
  };

  // ✅ LOADING INICIAL ELEGANTE
  if (initialLoading) {
    return <ElegantPageLoader title="Sistema RADAR" subtitle="Carregando painel do supervisor..." />;
  }

  // ✅ LOADING INICIAL SE NÃO AUTENTICADO
  if (!isAuthenticated) {
    return <ElegantPageLoader title="Portal do Supervisor" subtitle="Verificando acesso..." />;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* 🎯 HEADER MELHORADO - Mais limpo e organizado */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Brand compacto + Navegação */}
            <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-base sm:text-lg">🎯</span>
                </div>
                <h1 className="text-sm sm:text-lg font-bold text-white truncate">Portal do Supervisor</h1>
              </div>
              
              {/* Navegação integrada */}
              <div className="hidden sm:flex bg-white/10 backdrop-blur rounded-lg p-1">
                <button 
                  onClick={() => setActiveTab('operacoes')}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                    activeTab === 'operacoes'
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  📅 Calendário
                </button>
                <button 
                  onClick={() => setActiveTab('janelas')}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
                    activeTab === 'janelas'
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  🗂️ Janelas
                </button>
              </div>

              {/* Navegação mobile */}
              <div className="sm:hidden flex bg-white/10 backdrop-blur rounded-lg p-1">
                <button 
                  onClick={() => setActiveTab('operacoes')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    activeTab === 'operacoes'
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  📅
                </button>
                <button 
                  onClick={() => setActiveTab('janelas')}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    activeTab === 'janelas'
                      ? 'bg-white/20 text-white'
                      : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  🗂️
                </button>
              </div>
            </div>

            {/* Menu compacto + Usuário */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Menu dropdown - CORRIGIDO para funcionar em mobile */}
              <div className="relative dropdown-menu-container">
                <button 
                  onClick={() => setShowDropdownMenu(!showDropdownMenu)}
                  className="px-2 sm:px-3 py-2 text-xs sm:text-sm bg-white/10 rounded-lg text-white hover:bg-white/20 transition-all flex items-center gap-1"
                >
                  <span className="text-sm">⚙️</span>
                  <span className="hidden sm:inline">Menu</span>
                  <svg 
                    className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showDropdownMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Menu dropdown - agora funciona com clique/toque */}
                {showDropdownMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border py-2 z-50 animate-fade-in">
                    <a 
                      href="/supervisor/diretoria" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      onClick={() => setShowDropdownMenu(false)}
                    >
                      🏛️ Diretoria
                    </a>
                    <a 
                      href="/relatorio-diarias" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      onClick={() => setShowDropdownMenu(false)}
                    >
                      📊 Relatório de Diárias
                    </a>
                    <button 
                      onClick={() => {
                        carregarDados();
                        setShowDropdownMenu(false);
                      }} 
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      🔄 Atualizar Dados
                    </button>
                  </div>
                )}
              </div>

              {/* Usuário com responsividade corrigida */}
              <div className="flex items-center gap-2">
                {/* Versão completa - apenas em telas médias e grandes */}
                <div className="hidden md:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 border border-white/20">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {(() => {
                      const supervisorAuth = localStorage.getItem('supervisorAuth');
                      if (supervisorAuth) {
                        try {
                          const userData = JSON.parse(supervisorAuth);
                          return userData.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        } catch (error) {
                          return 'DA';
                        }
                      }
                      return 'DA';
                    })()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {(() => {
                        const supervisorAuth = localStorage.getItem('supervisorAuth');
                        if (supervisorAuth) {
                          try {
                            const userData = JSON.parse(supervisorAuth);
                            return userData.nome.split(' ').slice(0, 2).join(' ');
                          } catch (error) {
                            return 'Douglas Santos';
                          }
                        }
                        return 'Douglas Santos';
                      })()}
                    </div>
                    <div className="text-xs text-blue-100">
                      {(() => {
                        const supervisorAuth = localStorage.getItem('supervisorAuth');
                        if (supervisorAuth) {
                          try {
                            const userData = JSON.parse(supervisorAuth);
                            return `${userData.matricula} • ${userData.regional?.nome || 'UR Iguatu'}`;
                          } catch (error) {
                            return 'SUP001 • UR Iguatu';
                          }
                        }
                        return 'SUP001 • UR Iguatu';
                      })()}
                    </div>
                  </div>
                </div>

                {/* Versão compacta - apenas em telas pequenas */}
                <div className="md:hidden w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {(() => {
                    const supervisorAuth = localStorage.getItem('supervisorAuth');
                    if (supervisorAuth) {
                      try {
                        const userData = JSON.parse(supervisorAuth);
                        return userData.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                      } catch (error) {
                        return 'DA';
                      }
                    }
                    return 'DA';
                  })()}
                </div>

                {/* Botão sair - sempre visível */}
                <button
                  onClick={() => {
                    if (confirm('Deseja realmente sair do sistema?')) {
                      localStorage.removeItem('supervisorAuth');
                      localStorage.removeItem('membroId');
                      window.location.href = '/';
                    }
                  }}
                  className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Sair do sistema"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ✅ CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-3">
        {/* TAB: OPERAÇÕES */}
        {activeTab === 'operacoes' && (
          <CalendarioSupervisor
            onOperacaoClick={handleOperacaoClick}
            onNovaJanela={() => setShowCriarJanelaModal(true)}
            onNovaOperacao={() => setShowCriarOperacaoModal(true)}
            onRefresh={carregarDados}
            loading={loading}
          />
        )}

        {/* TAB: JANELAS OPERACIONAIS */}
        {activeTab === 'janelas' && (
          <section className="rounded-xl p-6 transition-all duration-300" style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3" style={{
                  background: 'var(--primary-light)'
                }}>
                  <span className="text-xl" style={{ color: 'var(--primary)' }}>🗂️</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    Janelas Operacionais
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {janelas.length} janela{janelas.length !== 1 ? 's' : ''} ativa{janelas.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowCriarJanelaModal(true)}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:shadow-md transition-all duration-200"
                style={{
                  background: 'var(--primary)',
                  border: '1px solid var(--primary)'
                }}
              >
                📅 Nova Janela
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {janelas.map((janela) => (
                <article key={janela.id} className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl" style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
                  border: '2px solid transparent',
                  backgroundClip: 'padding-box',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                  {/* Gradiente decorativo no topo */}
                  <div className="absolute inset-x-0 top-0 h-1" style={{
                    background: janela.status === 'ATIVA' 
                      ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)' 
                      : 'linear-gradient(90deg, #6b7280, #9ca3af, #d1d5db)'
                  }}></div>
                  
                  {/* Header com ícone e status */}
                  <div className="flex items-start justify-between p-6 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg" style={{
                        background: janela.status === 'ATIVA' 
                          ? 'linear-gradient(135deg, #10b981, #059669)' 
                          : 'linear-gradient(135deg, #6b7280, #4b5563)',
                        color: 'white'
                      }}>
                        {janela.status === 'ATIVA' ? '🟢' : '🔴'}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">
                          Janela #{janela.id}
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          📅 {formatarDataBR(janela.dataInicio)} - {formatarDataBR(janela.dataFim)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Botão de excluir - aparece no hover */}
                    <button
                      onClick={() => excluirJanela(janela.id, `${formatarDataBR(janela.dataInicio)} - ${formatarDataBR(janela.dataFim)}`)}
                      disabled={loading}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-200 w-8 h-8 rounded-lg flex items-center justify-center text-white hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                        boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                      }}
                      title="Excluir janela operacional"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <span className="text-sm">🗑️</span>
                      )}
                    </button>
                  </div>
                  
                  {/* Status badge elegante */}
                  <div className="px-6 pb-4">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${
                      janela.status === 'ATIVA' 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        janela.status === 'ATIVA' ? 'bg-green-500' : 'bg-gray-500'
                      }`}></span>
                      {janela.status}
                    </span>
                  </div>
                  
                  {/* Informações principais */}
                  <div className="px-6 pb-6 space-y-4">
                    {/* Modalidades */}
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">⚡</span>
                      </div>
                      <div className="flex-1">
                        <dt className="text-sm font-medium text-gray-700 mb-1">Modalidades</dt>
                        <dd className="flex gap-2 flex-wrap">
                          {janela.modalidades.map((modalidade) => (
                            <span key={modalidade} className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                              modalidade === 'BLITZ' 
                                ? 'bg-red-100 text-red-800 border border-red-200' 
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {modalidade === 'BLITZ' ? '🚨' : '⚖️'} {modalidade}
                            </span>
                          ))}
                        </dd>
                      </div>
                    </div>
                    
                    {/* Regional */}
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                        <span className="text-sm">🏢</span>
                      </div>
                      <div className="flex-1">
                        <dt className="text-sm font-medium text-gray-700">Regional</dt>
                        <dd className="text-sm text-gray-900 font-medium">{janela.regional}</dd>
                      </div>
                    </div>
                    
                    {/* Operações e limites */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
                        <div className="text-2xl font-bold text-blue-700">{janela.operacoesCriadas}</div>
                        <div className="text-xs text-blue-600 font-medium">Operações</div>
                      </div>
                                             <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200">
                                                  <div className="text-2xl font-bold text-emerald-700">{janela.limite_max || 30}</div>
                         <div className="text-xs text-emerald-600 font-medium">Limite Máx</div>
                       </div>
                     </div>
                   </div>
                   
                   {/* Footer com data de criação */}
                   <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                     <div className="flex items-center justify-between text-xs text-gray-500">
                       <span>Criada em {formatarDataBR(janela.criado_em?.split('T')[0] || '')}</span>
                      <span className="flex items-center gap-1">
                        <span>🔧</span>
                        Supervisor
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ✅ AVISO ELEGANTE (SUBSTITUI ALERTS CHATOS) */}
      {avisoElegante.show && (
        <div className="fixed top-20 right-4 z-50 max-w-md" role="alert" aria-live="polite">
          <div className={`rounded-lg shadow-lg p-4 border-l-4 transition-all duration-300 ${
            avisoElegante.tipo === 'sucesso' 
              ? 'border-green-400' 
              : avisoElegante.tipo === 'erro'
              ? 'border-red-400'
              : 'border-yellow-400'
          }`} style={{
            background: avisoElegante.tipo === 'sucesso' 
              ? 'var(--success-light)' 
              : avisoElegante.tipo === 'erro'
              ? 'var(--danger-light)'
              : 'var(--warning-light)',
            border: `1px solid ${
              avisoElegante.tipo === 'sucesso' 
                ? 'var(--success)' 
                : avisoElegante.tipo === 'erro'
                ? 'var(--danger)'
                : 'var(--warning)'
            }`
          }}>
            <div className="flex">
              <div className="flex-shrink-0">
                {avisoElegante.tipo === 'sucesso' && (
                  <div className="w-5 h-5" style={{ color: 'var(--success)' }}>✅</div>
                )}
                {avisoElegante.tipo === 'erro' && (
                  <div className="w-5 h-5" style={{ color: 'var(--danger)' }}>❌</div>
                )}
                {avisoElegante.tipo === 'aviso' && (
                  <div className="w-5 h-5" style={{ color: 'var(--warning)' }}>⚠️</div>
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium`} style={{
                  color: avisoElegante.tipo === 'sucesso' 
                    ? 'var(--success)' 
                    : avisoElegante.tipo === 'erro'
                    ? 'var(--danger)'
                    : 'var(--warning)'
                }}>
                  {avisoElegante.titulo}
                </h3>
                <p className={`mt-1 text-sm`} style={{
                  color: 'var(--text-primary)'
                }}>
                  {avisoElegante.mensagem}
                </p>
              </div>
              <button
                onClick={() => setAvisoElegante(prev => ({ ...prev, show: false }))}
                className={`ml-auto pl-3 inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
                style={{
                  color: avisoElegante.tipo === 'sucesso'
                    ? 'var(--success)'
                    : avisoElegante.tipo === 'erro'
                    ? 'var(--danger)'
                    : 'var(--warning)'
                }}
                aria-label="Fechar notificação"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAIS */}
      
      {/* Modal de Operação Selecionada */}
      {operacaoSelecionadaModal && (
        <ModalOperacaoSupervisor
          operacao={operacaoSelecionadaModal}
          onClose={() => setOperacaoSelecionadaModal(null)}
          onGerenciarMembros={setOperacaoParaGerenciar}
          onDefinirHorario={abrirHorarioPopover}
          onExcluirOperacao={excluirOperacaoTemporariamente}
        />
      )}
      
      {/* Modal de Horário */}
      {showHorarioPopover && operacaoParaHorario && (
        <HorarioPopover
          operacao={operacaoParaHorario}
          buttonRef={getHorarioButtonRef(showHorarioPopover)}
          onClose={fecharHorarioPopover}
          onSave={definirHorario}
          onRemove={removerHorario}
          loading={loading}
        />
      )}

      {/* Modal de Gerenciar Membros */}
      {operacaoParaGerenciar && (
        <GerenciarMembrosModal
          operacaoEspecifica={operacaoParaGerenciar}
          onClose={handleGerenciarModalClose}
          onUpdate={handleGerenciarModalUpdate}
        />
      )}

      {/* Modal Criar Janela */}
      {showCriarJanelaModal && (
        <CriarJanelaModal
          onClose={() => setShowCriarJanelaModal(false)}
          onSuccess={() => {
            carregarJanelas();
          }}
        />
      )}

      {/* Modal Criar Operação */}
      {showCriarOperacaoModal && (
        <CriarOperacaoModal
          onClose={() => setShowCriarOperacaoModal(false)}
          onSuccess={() => {
            carregarOperacoes();
          }}
        />
      )}
    </div>
  );
} 