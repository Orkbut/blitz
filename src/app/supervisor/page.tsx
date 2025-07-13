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
import TimelineOperacoes from '@/components/supervisor/TimelineOperacoes';
import { ElegantPageLoader } from '@/shared/components/ui/LoadingSpinner';
import { getSupervisorContext, getSupervisorHeaders } from '@/lib/auth-utils';

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

  const [showGerenciarMembrosModal, setShowGerenciarMembrosModal] = useState(false);
  const [operacaoParaGerenciar, setOperacaoParaGerenciar] = useState<any>(null);
  const [showCriarJanelaModal, setShowCriarJanelaModal] = useState(false);
  const [showCriarOperacaoModal, setShowCriarOperacaoModal] = useState(false);
  const [operacaoSelecionadaModal, setOperacaoSelecionadaModal] = useState<any>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<'calendario' | 'timeline'>('calendario');
  
  // ✅ NOVO: STATE PARA MODAL DE HORÁRIO
  const [showHorarioPopover, setShowHorarioPopover] = useState<number | null>(null);
  const [operacaoParaHorario, setOperacaoParaHorario] = useState<any>(null);
  const horarioButtonRefs = useRef<{ [key: number]: React.RefObject<HTMLButtonElement> }>({});

  // ✅ FUNÇÃO PARA FORMATAR DATA NO PADRÃO BRASILEIRO
  const formatarDataBR = (dataISO: string): string => {
    if (!dataISO) return '';
    try {
      const [ano, mes, dia] = dataISO.split('T')[0].split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataISO; // Retorna original se houver erro
    }
  };

  // ✅ FUNÇÃO PARA FORMATAR DATA COMPLETA COM DIA DA SEMANA (TIMEZONE SAFE)
  const formatarDataCompleta = (dataISO: string) => {
    try {
      // ✅ CORREÇÃO: Extrair partes da data sem problemas de timezone
      const dateOnly = dataISO.split('T')[0]; // Remove horário se houver
      const [ano, mes, dia] = dateOnly.split('-').map(Number);
      
      // ✅ CRIAR DATA LOCAL SEM PROBLEMAS DE UTC
      const date = new Date(ano, mes - 1, dia); // mes-1 porque Date usa 0-11 para meses
      
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      const diaSemana = diasSemana[date.getDay()];
      const diaFormatado = dia.toString().padStart(2, '0');
      const mesFormatado = meses[mes - 1]; // mes-1 para acessar array corretamente
      
      return {
        diaMes: diaFormatado,
        mes: mesFormatado,
        ano: ano,
        diaSemana: diaSemana,
        dataCompleta: `${diaFormatado}/${mesFormatado.toLowerCase()}/${ano}`,
        diaSemanaAbrev: diaSemana.substring(0, 3).toUpperCase()
      };
    } catch (error) {
      console.error('❌ [TIMEZONE-SAFE] Erro ao formatar data:', error, 'Data recebida:', dataISO);
      // ✅ FALLBACK: Tentar extrair pelo menos o dia e mês da string
      const match = dataISO.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [_, ano, mes, dia] = match;
        return {
          diaMes: dia,
          mes: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mes) - 1] || 'Jan',
          ano: parseInt(ano),
          diaSemana: 'Indefinido',
          dataCompleta: `${dia}/${mes}/${ano}`,
          diaSemanaAbrev: 'N/A'
        };
      }
      
      return {
        diaMes: '??',
        mes: 'Err',
        ano: new Date().getFullYear(),
        diaSemana: 'Erro',
        dataCompleta: dataISO,
        diaSemanaAbrev: 'ERR'
      };
    }
  };

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

  const carregarJanelas = async () => {
    try {
      // ✅ ISOLAMENTO POR REGIONAL: Usar headers com contexto do supervisor
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();
      
      if (result.success) {
        setJanelas(result.data);
      } else {
        console.error('❌ Erro no resultado:', result.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar janelas:', error);
    }
  };

  const carregarOperacoes = async () => {
    try {
      const response = await fetch('/api/unified/operacoes?portal=supervisor');
      const result = await response.json();
      
              if (result.success) {
        // ✅ MAPEAMENTO PARA INTERFACE CONSOLIDADA
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
          // ✅ PROPRIEDADES OPCIONAIS
          ...(op.excluida_temporariamente !== undefined && { excluida_temporariamente: op.excluida_temporariamente }),
          // ✅ ADICIONANDO PROPRIEDADES DE PARTICIPAÇÃO
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
  };

  const carregarSolicitacoes = async () => {
    try {
      const response = await fetch('/api/supervisor/solicitacoes');
      const result = await response.json();
      
      if (result.success) {
        // ✅ CORREÇÃO: API retorna dados em result.data.todas com campos extras
        const solicitacoesDados = result.data.todas || result.data || [];
        
        // ✅ Mapear campos extras para interface
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
          // ✅ NOVOS CAMPOS PARA CONTROLE FIFO
          posicaoFila: s.posicaoFila,
          isNaFila: s.isNaFila,
          isProximoDaFila: s.isProximoDaFila,
          operacaoDetalhes: s.operacaoDetalhes
        }));
        
        setSolicitacoes(solicitacoesFormatadas);
        
        // Log apenas se houver mudança no número de solicitações
        if (solicitacoesFormatadas.length !== solicitacoes.length) {
          // Removido log desnecessário para produção
        }
      } else {
        console.error('❌ Erro no resultado:', result.error);
        setSolicitacoes([]); // Limpar em caso de erro
      }
    } catch (error) {
      console.error('❌ Erro ao carregar solicitações:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível carregar as solicitações.');
    } finally {
      // Carregamento finalizado
    }
  };

  // ✅ CARREGAR LIMITES DA JANELA PARA HERANÇA AUTOMÁTICA
  const carregarLimitesJanela = async (janelaId: string) => {
    if (!janelaId) {
      setLimitesJanela({});
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/operacoes?janelaId=${janelaId}`);
      const result = await response.json();
      
      if (result.success) {
        setLimitesJanela(result.data);
        
        // ✅ HERANÇA AUTOMÁTICA: Aplicar limites no formulário
        setNovaOperacao(prev => ({
          ...prev,
          // Herdar modalidade se for única
          modalidade: result.data.configuracaoHerdada?.modalidadeUnica || prev.modalidade,
          // Herdar limite padrão
          limite: result.data.limitesParticipantes?.padrao || prev.limite
        }));
        
        console.log('✅ Limites da janela carregados:', result.data);
      } else {
        console.error('❌ Erro ao carregar limites:', result.error);
        setLimitesJanela({});
      }
    } catch (error) {
      console.error('❌ Erro ao carregar limites da janela:', error);
      setLimitesJanela({});
    }
  };

  // ✅ CRIAR JANELA OPERACIONAL (FASE 0 OBRIGATÓRIA)
  const criarJanelaOperacional = async () => {
    if (!novaJanela.dataInicio || !novaJanela.dataFim || novaJanela.modalidades.length === 0) {
      mostrarAvisoElegante('aviso', 'Campos Obrigatórios', 'Preencha todos os campos obrigatórios: datas e modalidades.');
        return;
      }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaJanela)
      });

      const result = await response.json();

      if (result.success) {
        mostrarAvisoElegante('sucesso', 'Janela Criada!', 'Janela operacional criada com sucesso!');
        setNovaJanela({
          dataInicio: '',
          dataFim: '',
          modalidades: [],
          limiteMin: 2,
          limiteMax: 30
        });
        await carregarJanelas();
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Criar', result.error);
      }
    } catch (error) {
      console.error('Erro ao criar janela:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível criar a janela operacional.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ CRIAR OPERAÇÕES (UMA OU MÚLTIPLAS)
  const criarOperacoes = async () => {
    if (!novaOperacao.janelaId || selectedDates.length === 0 || !novaOperacao.modalidade) {
      mostrarAvisoElegante('aviso', 'Campos Obrigatórios', 'Preencha todos os campos: janela, data(s) e modalidade.');
      return;
    }

    setLoading(true);
    try {
      const operacoesCriadas = [];
      const operacoesComErro = [];

      // Criar operações sequencialmente
      for (const data of selectedDates) {
        try {
          const response = await fetch('/api/supervisor/operacoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...novaOperacao,
              data: data
            })
          });

          const result = await response.json();

          if (result.success) {
            operacoesCriadas.push(data);
          } else {
            operacoesComErro.push({ data, error: result.error });
          }
        } catch (error) {
          operacoesComErro.push({ data, error: 'Erro de conexão' });
        }
      }

      // Mostrar resultado
      if (operacoesCriadas.length > 0) {
        const mensagem = selectedDates.length === 1 
          ? 'Operação criada com sucesso!' 
          : `${operacoesCriadas.length} operações criadas com sucesso!`;
        mostrarAvisoElegante('sucesso', 'Sucesso!', mensagem);
      }

      if (operacoesComErro.length > 0) {
        const mensagem = `${operacoesComErro.length} operação(ões) falharam. Primeira falha: ${operacoesComErro[0].error}`;
        mostrarAvisoElegante('erro', 'Algumas Operações Falharam', mensagem);
      }

      // Limpar seleções
      setSelectedDates([]);
              setNovaOperacao({
          janelaId: '',
          data: '',
          modalidade: '',
          tipo: 'PLANEJADA',
          turno: '',
          limite: 15
        });
      
      await carregarOperacoes();
    } catch (error) {
      console.error('Erro ao criar operações:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível criar as operações.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FUNÇÃO PARA CANCELAR SELEÇÃO
  const cancelarSelecao = () => {
    setSelectedDates([]);
  };

  // ✅ PROCESSAR SOLICITAÇÃO (APROVAR/REJEITAR)
  // ✅ FUNÇÃO MELHORADA PARA PROCESSAR SOLICITAÇÕES
  const processarSolicitacao = async (solicitacaoId: number, acao: 'aprovar' | 'rejeitar', motivo?: string) => {
    const solicitacao = solicitacoes.find(s => s.id === solicitacaoId);
    
    if (acao === 'rejeitar' && !motivo) {
      const motivoPrompt = prompt('Motivo da rejeição:');
      if (!motivoPrompt) {
        mostrarAvisoElegante('aviso', 'Motivo Obrigatório', 'Por favor, informe o motivo da rejeição.');
        return;
      }
      motivo = motivoPrompt;
    }

    // ✅ SUPERVISOR TEM PODER TOTAL: Pode aprovar qualquer solicitação
    // Não há validações restritivas

    // ✅ APROVAÇÃO NORMAL (apenas PENDENTE/AGUARDANDO_SUPERVISOR)
    await executarProcessamento(solicitacaoId, acao, motivo || '');
  };

  // ✅ FUNÇÃO AUXILIAR PARA EXECUTAR O PROCESSAMENTO
  const executarProcessamento = async (
    solicitacaoId: number, 
    acao: 'aprovar' | 'rejeitar', 
    motivo: string = '', 
    justificativaQuebraFifo: string = ''
  ) => {
    setLoading(true);
    try {
      // ✅ Usar API PUT específica para processar individual
      const response = await fetch(`/api/supervisor/solicitacoes/${solicitacaoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, motivo, justificativaQuebraFifo })
      });

      const result = await response.json();

      if (result.success) {
        mostrarAvisoElegante('sucesso', 'Sucesso!', 
          result.message || `Solicitação ${acao === 'aprovar' ? 'aprovada' : 'rejeitada'} com sucesso!`);
        
        // ✅ Limpar states relacionados
        setMostrandoJustificativa(prev => ({ ...prev, [solicitacaoId]: false }));
        setJustificativasFifo(prev => ({ ...prev, [solicitacaoId]: '' }));
        
        await carregarSolicitacoes();
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Processar', result.error);
      }
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível processar a solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ ENVIAR MENSAGEM REGIONAL
  const enviarMensagemRegional = async () => {
    if (!novaMensagem.conteudo.trim()) {
      mostrarAvisoElegante('aviso', 'Campo Obrigatório', 'O conteúdo da mensagem é obrigatório.');
      return;
    }

    if (novaMensagem.conteudo.length > 500) {
      mostrarAvisoElegante('aviso', 'Limite Excedido', 'A mensagem deve ter no máximo 500 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/comunicacao/mensagens-regionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaMensagem)
      });

      const result = await response.json();
      
      if (result.success) {
        mostrarAvisoElegante('sucesso', 'Mensagem Enviada!', 'Mensagem regional enviada com sucesso!');
        setNovaMensagem({ conteudo: '', prazoExpiracao: 7 });
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Enviar', result.error);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível enviar a mensagem.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ EXCLUIR JANELA OPERACIONAL (CONFIRMAÇÃO SIMPLES)
  const excluirJanelaOperacional = async (janelaId: number) => {
    // ✅ CONFIRMAÇÃO ÚNICA E SIMPLES
    const confirmacao = confirm(
      `⚠️ EXCLUIR JANELA ${janelaId}?\n\n` +
      `Isso irá deletar PERMANENTEMENTE:\n` +
      `• Todas as operações da janela\n` +
      `• Todas as participações dos membros\n` +
      `• A janela operacional completa\n\n` +
      `❌ Esta ação NÃO pode ser desfeita!\n\n` +
      `Tem certeza que deseja continuar?`
    );

    if (!confirmacao) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/supervisor/janelas-operacionais?id=${janelaId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        const impactoMsg = `Impacto: ${result.data.impacto.participacoesRemovidas} participações e ${result.data.impacto.operacoesRemovidas} operações removidas. Membros afetados: ${result.data.impacto.membrosAfetados.join(', ')}.`;
        mostrarAvisoElegante('sucesso', 'Janela Excluída!', `${result.message} ${impactoMsg}`);
        await carregarJanelas(); // ✅ Recarregar lista para mostrar janela removida
      } else {
        mostrarAvisoElegante('erro', 'Erro ao Excluir', result.error);
      }
    } catch (error) {
      console.error('Erro ao excluir janela:', error);
      mostrarAvisoElegante('erro', 'Erro de Conexão', 'Não foi possível excluir a janela operacional.');
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
      const response = await fetch('/api/unified/operacoes?portal=supervisor');
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
      const response = await fetch('/api/supervisor/solicitacoes');
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
      {/* ✅ HEADER ÚNICO E RESPONSIVO */}
      <header className="sticky top-0 z-40 transition-all duration-300" style={{ 
        background: 'var(--bg-card)', 
        borderBottom: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Título e descrição */}
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                🎯 Portal do Supervisor
              </h1>
              <p className="text-sm lg:text-base" style={{ color: 'var(--text-secondary)' }}>
                Gerencie operações, janelas operacionais e comunicação regional
              </p>
            </div>
            
            {/* Navegação e ações */}
            <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
              {/* Tabs de navegação */}
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('operacoes')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === 'operacoes'
                      ? 'text-white shadow-md'
                      : 'hover:shadow-sm'
                  }`}
                  style={{
                    background: activeTab === 'operacoes' ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: activeTab === 'operacoes' ? 'white' : 'var(--text-primary)',
                    border: `1px solid ${activeTab === 'operacoes' ? 'var(--primary)' : 'var(--border-color)'}`
                  }}
                >
                  🚨 Operações
                </button>
                
                <button
                  onClick={() => setActiveTab('janelas')}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === 'janelas'
                      ? 'text-white shadow-md'
                      : 'hover:shadow-sm'
                  }`}
                  style={{
                    background: activeTab === 'janelas' ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: activeTab === 'janelas' ? 'white' : 'var(--text-primary)',
                    border: `1px solid ${activeTab === 'janelas' ? 'var(--primary)' : 'var(--border-color)'}`
                  }}
                >
                  🗂️ Janelas
                </button>
              </div>
              
              {/* Links para funcionalidades extras */}
              <div className="flex gap-2">
                <a
                  href="/supervisor/diretoria"
                  className="px-3 py-2 text-sm font-medium rounded-lg hover:shadow-md flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  🏛️ Diretoria
                </a>
                
                <a
                  href="/relatorio-diarias"
                  className="px-3 py-2 text-sm font-medium rounded-lg hover:shadow-md flex items-center justify-center transition-all duration-200"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                  title="Contabilização de diárias por servidor"
                >
                  📊 Diárias
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ✅ CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* TAB: OPERAÇÕES */}
        {activeTab === 'operacoes' && (
          <div className="space-y-6">
            {/* Seletor de Modo de Visualização */}
            <section className="flex justify-center">
              <div className="inline-flex bg-white rounded-lg shadow-md border border-gray-200 p-1">
                <button
                  onClick={() => setModoVisualizacao('calendario')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    modoVisualizacao === 'calendario'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📅 Calendário
                </button>
                <button
                  onClick={() => setModoVisualizacao('timeline')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    modoVisualizacao === 'timeline'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  📊 Timeline
                </button>
              </div>
            </section>

            {/* Visualizações */}
            <section>
              {modoVisualizacao === 'calendario' && (
                <CalendarioSupervisor
                  onOperacaoClick={setOperacaoSelecionadaModal}
                  onNovaJanela={() => setShowCriarJanelaModal(true)}
                  onNovaOperacao={() => setShowCriarOperacaoModal(true)}
                  onRefresh={carregarDados}
                  loading={loading}
                />
              )}
              
              {modoVisualizacao === 'timeline' && (
                <TimelineOperacoes
                  operacoes={operacoes}
                  onGerenciarMembros={setOperacaoParaGerenciar}
                  onExcluirOperacao={excluirOperacaoTemporariamente}
                  onReativarOperacao={reativarOperacao}
                  onDefinirHorario={abrirHorarioPopover}
                  onNovaJanela={() => setShowCriarJanelaModal(true)}
                  onNovaOperacao={() => setShowCriarOperacaoModal(true)}
                  dataParaReabrir={dataParaReabrirModal}
                  loading={loading}
                  onRefresh={carregarDados}
                />
              )}
            </section>
          </div>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {janelas.map((janela) => (
                <article key={janela.id} className="rounded-lg p-4 hover:shadow-md transition-all duration-200 group relative" style={{
                  background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-hover) 100%)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        Janela #{janela.id}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        📅 {formatarDataBR(janela.dataInicio)} - {formatarDataBR(janela.dataFim)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        janela.status === 'ATIVA' 
                          ? 'text-green-800' 
                          : 'text-gray-800'
                      }`} style={{
                        background: janela.status === 'ATIVA' ? 'var(--success-light)' : 'var(--bg-hover)',
                        border: `1px solid ${janela.status === 'ATIVA' ? 'var(--success)' : 'var(--border-color)'}`
                      }}>
                        {janela.status}
                      </span>
                      
                      {/* Botão de excluir discreto */}
                      <button
                        onClick={() => excluirJanelaOperacional(janela.id)}
                        disabled={loading}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:shadow-md"
                        style={{ color: 'var(--danger)', background: 'transparent' }}
                        title="⚠️ Excluir janela (remove TODAS as participações)"
                        aria-label={`Excluir janela ${janela.id}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <dl className="space-y-2 text-xs">
                    <div className="flex items-center">
                      <dt className="w-20 font-medium" style={{ color: 'var(--text-secondary)' }}>Modalidades:</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{janela.modalidades.join(', ')}</dd>
                    </div>
                    <div className="flex items-center">
                      <dt className="w-20 font-medium" style={{ color: 'var(--text-secondary)' }}>Regional:</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{janela.regional}</dd>
                    </div>
                    <div className="flex items-center">
                      <dt className="w-20 font-medium" style={{ color: 'var(--text-secondary)' }}>Operações:</dt>
                      <dd style={{ color: 'var(--text-primary)' }}>{janela.operacoesCriadas} criadas</dd>
                    </div>
                  </dl>
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
      {showGerenciarMembrosModal && (
        <GerenciarMembrosModal
          onClose={() => setShowGerenciarMembrosModal(false)}
          onUpdate={() => {
            carregarOperacoes();
            carregarSolicitacoes();
          }}
        />
      )}

      {/* Modal de Operação Específica */}
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