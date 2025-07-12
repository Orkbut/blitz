'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SystemStats {
  totalOperacoes: number;
  totalServidores: number;
  totalParticipacoes: number;
  operacoesAtivas: number;
  servidoresAtivos: number;
  participacoesConfirmadas: number;
  totalRegionais: number;
  regionaisAtivas: number;
  sessoesAtivas: number;
  ultimaAtualizacao: string;
}

interface Parametro {
  id: number;
  chave: string;
  valor: string;
  descricao: string;
  tipo: string;
  ativo: boolean;
}

interface Regional {
  id: number;
  nome: string;
  codigo: string;
  ativo: boolean;
  criado_em: string;
}

// ✅ NOVAS INTERFACES PARA SOLICITAÇÕES DE SUPERVISOR
interface SolicitacaoSupervisor {
  id: number;
  matricula: string;
  nome: string;
  email?: string;
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  justificativa?: string;
  data_solicitacao: string;
  data_analise?: string;
  motivo_rejeicao?: string;
  regional: {
    id: number;
    nome: string;
    codigo: string;
  };
  analisada_por_servidor?: {
    id: number;
    nome: string;
    matricula: string;
  };
}

interface StatsSolicitacoes {
  total: number;
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
}

// ✅ NOVAS INTERFACES PARA RECUPERAÇÃO DE SENHA
interface SolicitacaoRecuperacao {
  id: number;
  matricula: string;
  nome: string;
  perfil: 'Membro' | 'Supervisor';
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA';
  justificativa?: string;
  data_solicitacao: string;
  data_analise?: string;
  motivo_rejeicao?: string;
  nova_senha_temp?: string;
  senha_alterada: boolean;
  regional: {
    id: number;
    nome: string;
    codigo: string;
  };
  analisada_por_servidor?: {
    id: number;
    nome: string;
    matricula: string;
  };
}

interface StatsRecuperacao {
  total: number;
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
}

// ✅ NOVAS INTERFACES PARA MEMBROS DAS REGIONAIS
interface MembroRegional {
  id: number;
  matricula: string;
  nome: string;
  email?: string;
  perfil: 'Membro' | 'Supervisor';
  ativo: boolean;
  criado_em: string;
  regional_id: number;
}

interface DadosRegionalComMembros {
  regional: {
    id: number;
    nome: string;
    codigo: string;
    ativo: boolean;
  };
  membros: MembroRegional[];
  estatisticas: {
    total: number;
    supervisores: number;
    membros: number;
  };
}

// ✅ INTERFACE PARA CONFIGURAÇÕES DE DESENVOLVIMENTO
interface ConfiguracaoDesenvolvimento {
  area_desenvolvimento_ativa: boolean;
}

// ✅ NOVA INTERFACE PARA CONFIGURAÇÕES DE EXCLUSÃO
interface ConfiguracaoExclusao {
  exclusao_membros_ativa: boolean;
}

// ✅ INTERFACE PARA MEMBROS NA LISTAGEM ADMINISTRATIVA
interface MembroAdmin extends MembroRegional {
  regional_nome: string;
  regional_codigo: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'parametros' | 'regionais' | 'sistema' | 'solicitacoes'>('dashboard');
  const [editingParametro, setEditingParametro] = useState<Parametro | null>(null);
  const [editingRegional, setEditingRegional] = useState<Regional | null>(null);
  const [novaRegional, setNovaRegional] = useState({ nome: '', codigo: '' });
  
  // ✅ ESTADOS PARA SOLICITAÇÕES DE SUPERVISOR
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoSupervisor[]>([]);
  const [statsSolicitacoes, setStatsSolicitacoes] = useState<StatsSolicitacoes | null>(null);

  // ✅ ESTADOS PARA RECUPERAÇÃO DE SENHA
  const [recuperacoes, setRecuperacoes] = useState<SolicitacaoRecuperacao[]>([]);
  const [statsRecuperacao, setStatsRecuperacao] = useState<StatsRecuperacao | null>(null);

  // ✅ NOVOS ESTADOS PARA FILTROS E PAGINAÇÃO
  const [filtroSolicitacoes, setFiltroSolicitacoes] = useState<'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'TODAS'>('PENDENTE');
  const [filtroRecuperacoes, setFiltroRecuperacoes] = useState<'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'TODAS'>('PENDENTE');
  const [buscaSolicitacoes, setBuscaSolicitacoes] = useState('');
  const [buscaRecuperacoes, setBuscaRecuperacoes] = useState('');
  const [paginaSolicitacoes, setPaginaSolicitacoes] = useState(1);
  const [paginaRecuperacoes, setPaginaRecuperacoes] = useState(1);
  const [abaSolicitacoes, setAbaSolicitacoes] = useState<'supervisores' | 'recuperacao'>('supervisores');
  const ITENS_POR_PAGINA = 10;

  // ✅ ESTADOS PARA MEMBROS DAS REGIONAIS
  const [membrosRegionais, setMembrosRegionais] = useState<{ [regionalId: number]: DadosRegionalComMembros }>({});
  const [regionalExpandida, setRegionalExpandida] = useState<number | null>(null);
  const [loadingMembros, setLoadingMembros] = useState<{ [regionalId: number]: boolean }>({});

  // ✅ ESTADOS PARA CONFIGURAÇÕES DE DESENVOLVIMENTO
  const [configDesenvolvimento, setConfigDesenvolvimento] = useState<ConfiguracaoDesenvolvimento>({
    area_desenvolvimento_ativa: false
  });

  // ✅ ESTADOS PARA CONFIGURAÇÕES DE EXCLUSÃO
  const [configExclusao, setConfigExclusao] = useState<ConfiguracaoExclusao>({
    exclusao_membros_ativa: false
  });

  // ✅ ESTADO PARA CONTROLE DE CARREGAMENTO
  const [isLoadingData, setIsLoadingData] = useState(false);
  


  useEffect(() => {
    verificarAutenticacao();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      carregarDados();
    }
  }, [isAuthenticated]);

  const verificarAutenticacao = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }

      // Validar token com o servidor (opcional)
      const response = await fetch('/api/admin/auth', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Erro na verificação de autenticação:', error);
      localStorage.removeItem('admin_token');
      router.push('/admin/login');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair do portal de administração?')) {
      localStorage.removeItem('admin_token');
      router.push('/admin/login');
    }
  };

  const carregarDados = async () => {
    if (isLoadingData) return; // Evitar múltiplas chamadas simultâneas
    
    setIsLoadingData(true);
    setLoading(true);
    
    try {
      // ✅ USAR Promise.allSettled PARA EVITAR FALHAS EM CASCATA
      const results = await Promise.allSettled([
        fetch('/api/admin/stats').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/parametros').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/regionais').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/solicitacoes-supervisor').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/recuperacao-senha').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/configuracoes/desenvolvimento').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/configuracoes/exclusao').then(r => r.ok ? r.json() : null)
      ]);

      // ✅ PROCESSAR RESULTADOS INDIVIDUALMENTE
      const [statsRes, parametrosRes, regionaisRes, solicitacoesRes, recuperacoesRes, configRes, exclusaoRes] = results;

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setStats(statsRes.value.data);
      }

      if (parametrosRes.status === 'fulfilled' && parametrosRes.value) {
        setParametros(parametrosRes.value.data || []);
      }

      if (regionaisRes.status === 'fulfilled' && regionaisRes.value) {
        setRegionais(regionaisRes.value.data || []);
      }

      if (solicitacoesRes.status === 'fulfilled' && solicitacoesRes.value) {
        setSolicitacoes(solicitacoesRes.value.data || []);
        setStatsSolicitacoes(solicitacoesRes.value.stats || { total: 0, pendentes: 0, aprovadas: 0, rejeitadas: 0 });
      }

      if (recuperacoesRes.status === 'fulfilled' && recuperacoesRes.value) {
        setRecuperacoes(recuperacoesRes.value.data || []);
        setStatsRecuperacao(recuperacoesRes.value.stats || { total: 0, pendentes: 0, aprovadas: 0, rejeitadas: 0 });
      }

            if (configRes.status === 'fulfilled' && configRes.value?.success) {
        setConfigDesenvolvimento(configRes.value.data);
      }



      if (exclusaoRes.status === 'fulfilled' && exclusaoRes.value?.success) {
        setConfigExclusao(exclusaoRes.value.data);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };

  // ✅ FUNÇÃO OTIMIZADA PARA RECARREGAR APENAS SOLICITAÇÕES
  const recarregarSolicitacoes = async () => {
    try {
      const [solicitacoesResponse, recuperacoesResponse] = await Promise.all([
        fetch('/api/admin/solicitacoes-supervisor'),
        fetch('/api/admin/recuperacao-senha')
      ]);

      if (solicitacoesResponse.ok) {
        const solicitacoesData = await solicitacoesResponse.json();
        setSolicitacoes(solicitacoesData.data || []);
        setStatsSolicitacoes(solicitacoesData.stats || { total: 0, pendentes: 0, aprovadas: 0, rejeitadas: 0 });
      }

      if (recuperacoesResponse.ok) {
        const recuperacoesData = await recuperacoesResponse.json();
        setRecuperacoes(recuperacoesData.data || []);
        setStatsRecuperacao(recuperacoesData.stats || { total: 0, pendentes: 0, aprovadas: 0, rejeitadas: 0 });
      }
    } catch (error) {
      console.error('Erro ao recarregar solicitações:', error);
    }
  };

  // ✅ FILTRAR E PAGINAR SOLICITAÇÕES
  const solicitacoesFiltradas = solicitacoes.filter(s => {
    const matchStatus = filtroSolicitacoes === 'TODAS' || s.status === filtroSolicitacoes;
    const matchBusca = !buscaSolicitacoes || 
      s.nome.toLowerCase().includes(buscaSolicitacoes.toLowerCase()) ||
      s.matricula.includes(buscaSolicitacoes);
    return matchStatus && matchBusca;
  });

  const recuperacoesFiltradas = recuperacoes.filter(r => {
    const matchStatus = filtroRecuperacoes === 'TODAS' || r.status === filtroRecuperacoes;
    const matchBusca = !buscaRecuperacoes || 
      r.nome.toLowerCase().includes(buscaRecuperacoes.toLowerCase()) ||
      r.matricula.includes(buscaRecuperacoes);
    return matchStatus && matchBusca;
  });

  const totalPaginasSolicitacoes = Math.ceil(solicitacoesFiltradas.length / ITENS_POR_PAGINA);
  const totalPaginasRecuperacoes = Math.ceil(recuperacoesFiltradas.length / ITENS_POR_PAGINA);

  const solicitacoesPaginadas = solicitacoesFiltradas.slice(
    (paginaSolicitacoes - 1) * ITENS_POR_PAGINA,
    paginaSolicitacoes * ITENS_POR_PAGINA
  );

  const recuperacoesPaginadas = recuperacoesFiltradas.slice(
    (paginaRecuperacoes - 1) * ITENS_POR_PAGINA,
    paginaRecuperacoes * ITENS_POR_PAGINA
  );

  const handleSalvarParametro = async (parametro: Parametro) => {
    try {
      const response = await fetch(`/api/admin/parametros`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: parametro.id,
          valor: parametro.valor,
          ativo: parametro.ativo
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Parâmetro atualizado com sucesso!');
        setEditingParametro(null);
        await carregarDados();
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao salvar parâmetro');
    }
  };



  const handleCriarRegional = async () => {
    if (!novaRegional.nome.trim() || !novaRegional.codigo.trim()) {
      alert('❌ Nome e código são obrigatórios');
      return;
    }

    try {
      const response = await fetch('/api/admin/regionais', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(novaRegional)
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Regional criada com sucesso!');
        setNovaRegional({ nome: '', codigo: '' });
        await carregarDados();
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao criar regional');
    }
  };

  const handleSalvarRegional = async (regional: Regional) => {
    try {
      const response = await fetch('/api/admin/regionais', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(regional)
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Regional atualizada com sucesso!');
        setEditingRegional(null);
        await carregarDados();
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao salvar regional');
    }
  };

  const handleInativarRegional = async (id: number) => {
    if (!confirm('Tem certeza que deseja inativar esta regional? Esta ação não pode ser desfeita se houver dados vinculados.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/regionais?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Regional inativada com sucesso!');
        await carregarDados();
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao inativar regional');
    }
  };

  const handleExcluirRegionalCompleto = async (id: number, nome: string) => {
    // Confirmação dupla para exclusão permanente
    if (!confirm(`⚠️ ATENÇÃO! Você está prestes a EXCLUIR PERMANENTEMENTE a regional "${nome}" e TODOS os dados relacionados a ela.\n\nIsso inclui:\n- Todos os membros e supervisores\n- Todas as operações\n- Todas as participações\n- Todas as janelas operacionais\n- Todo o histórico\n\nEsta ação é IRREVERSÍVEL e não pode ser desfeita.\n\nTem certeza absoluta que deseja continuar?`)) {
      return;
    }

    if (!confirm(`🚨 ÚLTIMA CONFIRMAÇÃO!\n\nVocê confirma a EXCLUSÃO PERMANENTE de:\n"${nome}"\n\nTODOS os dados serão perdidos para sempre!`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/regionais/${id}/excluir`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ ${result.message}\n\nItens excluídos:\n- ${result.data.exclusoesRealizadas.servidores} servidores\n- ${result.data.exclusoesRealizadas.operacoes} operações\n- ${result.data.exclusoesRealizadas.participacoes} participações\n- ${result.data.exclusoesRealizadas.janelas} janelas operacionais\n- Total: ${result.data.totalItensExcluidos} itens`);
        await carregarDados();
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao excluir regional');
    }
  };

  const handleAprovarSolicitacao = async (id: number) => {
    if (!confirm('Tem certeza que deseja aprovar esta solicitação de autorização? Isso criará uma conta de supervisor.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/solicitacoes-supervisor`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          action: 'APROVAR'
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Solicitação aprovada e conta de supervisor criada com sucesso!');
        // ✅ USAR FUNÇÃO OTIMIZADA: Recarregar apenas solicitações
        await recarregarSolicitacoes();
      } else {
        alert(`❌ Erro ao aprovar solicitação: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao aprovar solicitação');
    }
  };

  const handleRejeitarSolicitacao = async (id: number) => {
    const motivo = prompt('Informe o motivo da rejeição (opcional):');
    
    if (!confirm('Tem certeza que deseja rejeitar esta solicitação de autorização?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/solicitacoes-supervisor`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          action: 'REJEITAR',
          motivo_rejeicao: motivo || 'Não especificado'
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Solicitação rejeitada com sucesso!');
        // ✅ USAR FUNÇÃO OTIMIZADA: Recarregar apenas solicitações
        await recarregarSolicitacoes();
      } else {
        alert(`❌ Erro ao rejeitar solicitação: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao rejeitar solicitação');
    }
  };

  // ✅ FUNÇÕES PARA RECUPERAÇÃO DE SENHA
  const handleAprovarRecuperacao = async (id: number) => {
    const novaSenha = prompt('Digite a senha temporária (ou deixe vazio para gerar automaticamente):');
    
    if (!confirm('Tem certeza que deseja aprovar esta recuperação de senha? A senha atual será substituída.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/recuperacao-senha`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          action: 'APROVAR',
          nova_senha_temp: novaSenha?.trim() || undefined
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ Recuperação aprovada! Senha temporária: ${result.data.senhaTemporaria}\n\nInforme esta senha ao usuário.`);
        // ✅ USAR FUNÇÃO OTIMIZADA: Recarregar apenas solicitações
        await recarregarSolicitacoes();
      } else {
        alert(`❌ Erro ao aprovar recuperação: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao aprovar recuperação');
    }
  };

  const handleRejeitarRecuperacao = async (id: number) => {
    const motivo = prompt('Informe o motivo da rejeição (opcional):');
    
    if (!confirm('Tem certeza que deseja rejeitar esta solicitação de recuperação?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/recuperacao-senha`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          action: 'REJEITAR',
          motivo_rejeicao: motivo || 'Não especificado'
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Solicitação de recuperação rejeitada com sucesso!');
        // ✅ USAR FUNÇÃO OTIMIZADA: Recarregar apenas solicitações
        await recarregarSolicitacoes();
      } else {
        alert(`❌ Erro ao rejeitar recuperação: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao rejeitar recuperação');
    }
  };





  // ✅ NOVA FUNÇÃO: Salvar configurações de exclusão
  const salvarConfigExclusao = async () => {
    try {
      const response = await fetch('/api/admin/configuracoes/exclusao', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configExclusao)
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Configurações de exclusão salvas com sucesso!');
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao salvar configurações');
    }
  };

  // ✅ NOVA FUNÇÃO: Excluir membro do sistema
  const excluirMembro = async (membroId: number, nomeMemro: string, regionalId: number) => {
    // Verificar se exclusão está habilitada
    if (!configExclusao.exclusao_membros_ativa) {
      alert('❌ Funcionalidade de exclusão está desabilitada.\n\nHabilite na aba Sistema → Configurações de Exclusão.');
      return;
    }

    const confirmacao = prompt(
      `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\n` +
      `Você está prestes a EXCLUIR COMPLETAMENTE o membro "${nomeMemro}" do sistema.\n\n` +
      `Isso irá:\n` +
      `• Remover todos os dados do membro\n` +
      `• Inativar participações históricas\n` +
      `• Cancelar responsabilidades de supervisão\n\n` +
      `Digite "EXCLUIR" (em maiúsculas) para confirmar:`
    );

    if (confirmacao !== 'EXCLUIR') {
      alert('❌ Exclusão cancelada. É necessário digitar "EXCLUIR" exatamente.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/membros/${membroId}/excluir`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        // Recarregar membros da regional
        await carregarMembrosRegional(regionalId);
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao excluir membro');
      console.error('Erro:', error);
    }
  };

  // ✅ NOVA FUNÇÃO: Carregar membros de uma regional
  const carregarMembrosRegional = async (regionalId: number) => {
    setLoadingMembros(prev => ({ ...prev, [regionalId]: true }));
    
    try {
      const response = await fetch(`/api/admin/regionais/${regionalId}/membros`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMembrosRegionais(prev => ({
            ...prev,
            [regionalId]: result.data
          }));
        } else {
          console.error('Erro ao carregar membros:', result.error);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar membros da regional:', error);
    } finally {
      setLoadingMembros(prev => ({ ...prev, [regionalId]: false }));
    }
  };

  // ✅ NOVA FUNÇÃO: Alterar perfil de um membro
  const alterarPerfilMembro = async (membroId: number, novoPerfil: 'Membro' | 'Supervisor', regionalId: number) => {
    try {
      const response = await fetch(`/api/admin/membros/${membroId}/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ novoPerfil })
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ ${result.message}`);
        // Recarregar membros da regional
        await carregarMembrosRegional(regionalId);
      } else {
        alert(`❌ Erro: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Erro ao alterar perfil do membro');
    }
  };

  // ✅ NOVA FUNÇÃO: Toggle expansão da regional
  const toggleRegionalExpansao = async (regionalId: number) => {
    if (regionalExpandida === regionalId) {
      setRegionalExpandida(null);
    } else {
      setRegionalExpandida(regionalId);
      
      // Carregar membros se ainda não foram carregados
      if (!membrosRegionais[regionalId]) {
        await carregarMembrosRegional(regionalId);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-3xl">⚙️</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Será redirecionado para login
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-50 via-white to-purple-50 border-b-2 border-blue-100 shadow-sm">
        <div className="container mx-auto px-6 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">⚙️</span>
              </div>
            <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent mb-2">
                  Portal do Administrador
                </h1>
                <p className="text-gray-600 text-xl font-medium">Gestão completa do sistema RADAR</p>
            </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Sistema</div>
                    <div className="text-lg font-bold text-green-600">Operacional</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <a 
                  href="/" 
                  className="bg-gray-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  ← Portal
                </a>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  🚪 Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="border-b border-gray-100">
            <nav className="flex space-x-8 px-8 py-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                  className={`py-4 px-4 border-b-2 font-semibold text-sm rounded-t-lg transition-all duration-200 ${
                  activeTab === 'dashboard'
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setActiveTab('parametros')}
                className={`py-4 px-4 border-b-2 font-semibold text-sm rounded-t-lg transition-all duration-200 ${
                  activeTab === 'parametros'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                ⚙️ Parâmetros
              </button>
              <button
                onClick={() => setActiveTab('regionais')}
                className={`py-4 px-4 border-b-2 font-semibold text-sm rounded-t-lg transition-all duration-200 ${
                  activeTab === 'regionais'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                🏢 Regionais ({regionais.length})
              </button>
              <button
                onClick={() => setActiveTab('solicitacoes')}
                className={`py-4 px-4 border-b-2 font-semibold text-sm rounded-t-lg transition-all duration-200 ${
                  activeTab === 'solicitacoes'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                👤 Solicitações {((statsSolicitacoes?.pendentes || 0) + (statsRecuperacao?.pendentes || 0)) > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {(statsSolicitacoes?.pendentes || 0) + (statsRecuperacao?.pendentes || 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('sistema')}
                className={`py-4 px-4 border-b-2 font-semibold text-sm rounded-t-lg transition-all duration-200 ${
                  activeTab === 'sistema'
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                🔧 Sistema
              </button>
            </nav>
          </div>

          <div className="p-8">
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-8">
                {/* Header do Dashboard */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
                  <div className="flex items-center justify-between">
              <div>
                      <h1 className="text-3xl font-bold mb-2">Dashboard do Sistema</h1>
                      <p className="text-blue-100">Visão geral dos dados operacionais</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-blue-200">Última atualização</div>
                      <div className="text-blue-100 font-medium">{stats.ultimaAtualizacao || 'Agora'}</div>
                    </div>
                  </div>
                </div>
                
                {/* Estatísticas Principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card Operações */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">⚙️</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Operações</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-gray-900">{stats.totalOperacoes}</div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Ativas: {stats.operacoesAtivas}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Servidores */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">👥</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Servidores</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-gray-900">{stats.totalServidores}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Ativos: {stats.servidoresAtivos}</span>
                        </div>
                        {stats.sessoesAtivas > 0 && (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-sm text-blue-600 font-medium">Online: {stats.sessoesAtivas}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Card Regionais */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🏢</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Regionais</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-gray-900">{stats.totalRegionais}</div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Ativas: {stats.regionaisAtivas}</span>
                        </div>
                    </div>
                  </div>
                </div>

                  {/* Card Participações */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">📋</span>
                    </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Participações</span>
                    </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold text-gray-900">{stats.totalParticipacoes}</div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Confirmadas: {stats.participacoesConfirmadas}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumo Rápido */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">Resumo Executivo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <span className="text-white text-lg">⚡</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-900">Sistema Ativo</h4>
                          <p className="text-blue-700 text-sm">Operacional</p>
                        </div>
                      </div>
                      <p className="text-blue-800 text-sm">
                        Sistema funcionando normalmente com {stats.operacoesAtivas} operações ativas em execução.
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                          <span className="text-white text-lg">👤</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-900">Usuários Ativos</h4>
                          <p className="text-green-700 text-sm">{stats.servidoresAtivos} cadastrados</p>
                        </div>
                      </div>
                      <p className="text-green-800 text-sm">
                        {stats.sessoesAtivas > 0 ? `${stats.sessoesAtivas} usuários conectados no momento.` : 'Nenhum usuário online no momento.'}
                      </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <span className="text-white text-lg">🌐</span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-purple-900">Cobertura Regional</h4>
                          <p className="text-purple-700 text-sm">{stats.regionaisAtivas} regionais</p>
                        </div>
                      </div>
                      <p className="text-purple-800 text-sm">
                        Sistema implantado em {stats.regionaisAtivas} de {stats.totalRegionais} regionais cadastradas.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'parametros' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Gestão de Parâmetros</h2>
                
                <div className="space-y-4">
                  {parametros.map((parametro) => (
                    <div key={parametro.id} className="border border-gray-200 rounded-lg p-4">
                      {editingParametro?.id === parametro.id ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {parametro.chave}
                            </label>
                            <input
                              type="text"
                              value={editingParametro.valor}
                              onChange={(e) => setEditingParametro({...editingParametro, valor: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <p className="text-sm text-gray-700 mt-1">{parametro.descricao}</p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editingParametro.ativo}
                              onChange={(e) => setEditingParametro({...editingParametro, ativo: e.target.checked})}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-800">Ativo</label>
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSalvarParametro(editingParametro)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                              ✅ Salvar
                            </button>
                            <button
                              onClick={() => setEditingParametro(null)}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                            >
                              ❌ Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-800">{parametro.chave}</h3>
                            <p className="text-sm text-gray-700">{parametro.descricao}</p>
                            <p className="text-lg font-mono text-blue-600 mt-1">{parametro.valor}</p>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-2 ${
                              parametro.ativo ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {parametro.ativo ? 'Ativo' : 'Ativo - - Gerenciar Membros'}
                            </span>
                          </div>
                          <button
                            onClick={() => setEditingParametro(parametro)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'regionais' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Gestão de Regionais</h2>
                
                {/* Formulário para Nova Regional */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Criar Nova Regional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome da Regional
                      </label>
                      <input
                        type="text"
                        value={novaRegional.nome}
                        onChange={(e) => setNovaRegional({...novaRegional, nome: e.target.value})}
                        placeholder="Ex: Regional Centro"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código (XX99)
                      </label>
                      <input
                        type="text"
                        value={novaRegional.codigo}
                        onChange={(e) => setNovaRegional({...novaRegional, codigo: e.target.value.toUpperCase()})}
                        placeholder="Ex: RC01"
                        maxLength={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleCriarRegional}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ➕ Criar Regional
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    💡 O código deve seguir o formato XX99 (duas letras + dois números). Ex: RC01, RN02, RS03
                  </p>
                </div>

                {/* Lista de Regionais com Membros */}
                <div className="space-y-4">
                  {regionais.map((regional) => (
                    <div key={regional.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {editingRegional?.id === regional.id ? (
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome da Regional
                              </label>
                              <input
                                type="text"
                                value={editingRegional.nome}
                                onChange={(e) => setEditingRegional({...editingRegional, nome: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Código
                              </label>
                              <input
                                type="text"
                                value={editingRegional.codigo}
                                onChange={(e) => setEditingRegional({...editingRegional, codigo: e.target.value.toUpperCase()})}
                                maxLength={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editingRegional.ativo}
                              onChange={(e) => setEditingRegional({...editingRegional, ativo: e.target.checked})}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-800">Regional Ativa</label>
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSalvarRegional(editingRegional)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                              ✅ Salvar
                            </button>
                            <button
                              onClick={() => setEditingRegional(null)}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                            >
                              ❌ Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Header da Regional */}
                          <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-4">
                                <button
                                  onClick={() => toggleRegionalExpansao(regional.id)}
                                  className="flex items-center space-x-2 text-left hover:bg-gray-100 rounded-lg p-2 transition-colors"
                                >
                                  <span className={`transform transition-transform duration-200 ${regionalExpandida === regional.id ? 'rotate-90' : ''}`}>
                                    ▶️
                                  </span>
                                  <div>
                                    <h3 className="font-semibold text-gray-800 text-lg">{regional.nome}</h3>
                                    <p className="text-sm text-gray-600">
                                      Código: <span className="font-mono font-semibold">{regional.codigo}</span>
                                      {membrosRegionais[regional.id] && (
                                        <span className="ml-4">
                                          👥 {membrosRegionais[regional.id].estatisticas.total} membros 
                                          ({membrosRegionais[regional.id].estatisticas.supervisores} supervisores)
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </button>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  regional.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {regional.ativo ? '✅ Ativa' : '❌ Inativa'}
                                </span>
                              </div>
                              
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setEditingRegional(regional)}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleExcluirRegionalCompleto(regional.id, regional.nome)}
                                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                  title="Excluir permanentemente esta regional e TODOS os dados relacionados"
                                >
                                  🗑️ Excluir
                                </button>
                                {regional.ativo && (
                                  <button
                                    onClick={() => handleInativarRegional(regional.id)}
                                    className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                                    title="Apenas inativar (não exclui dados)"
                                  >
                                    ⏸️ Inativar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Seção Expandida - Membros da Regional */}
                          {regionalExpandida === regional.id && (
                            <div className="p-4 bg-white">
                              {loadingMembros[regional.id] ? (
                                <div className="flex items-center justify-center py-8">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                  <span className="ml-3 text-gray-600">Carregando membros...</span>
                                </div>
                              ) : membrosRegionais[regional.id] ? (
                                <div>
                                  {/* Estatísticas da Regional */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="bg-blue-50 rounded-lg p-4">
                                      <h4 className="text-sm font-medium text-blue-800">Total de Membros</h4>
                                      <p className="text-2xl font-bold text-blue-600">{membrosRegionais[regional.id].estatisticas.total}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-4">
                                      <h4 className="text-sm font-medium text-green-800">Supervisores</h4>
                                      <p className="text-2xl font-bold text-green-600">{membrosRegionais[regional.id].estatisticas.supervisores}</p>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-4">
                                      <h4 className="text-sm font-medium text-purple-800">Membros Comuns</h4>
                                      <p className="text-2xl font-bold text-purple-600">{membrosRegionais[regional.id].estatisticas.membros}</p>
                                    </div>
                                  </div>

                                  {/* Lista de Membros */}
                                  {membrosRegionais[regional.id].membros.length > 0 ? (
                                    <div className="space-y-3">
                                      <h4 className="font-semibold text-gray-800 mb-4">👥 Membros da Regional</h4>
                                      {membrosRegionais[regional.id].membros.map((membro) => (
                                        <div key={membro.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                          <div className="flex items-center space-x-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                                              membro.perfil === 'Supervisor' ? 'bg-blue-600' : 'bg-gray-600'
                                            }`}>
                                              {membro.perfil === 'Supervisor' ? '👑' : '👤'}
                                            </div>
                                            <div>
                                              <h5 className="font-semibold text-gray-800">{membro.nome}</h5>
                                              <p className="text-sm text-gray-600">
                                                Matrícula: <span className="font-mono">{membro.matricula}</span>
                                                {membro.email && (
                                                  <span className="ml-3">📧 {membro.email}</span>
                                                )}
                                              </p>
                                              <p className="text-xs text-gray-500">
                                                Cadastrado em: {new Date(membro.criado_em).toLocaleDateString('pt-BR')}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center space-x-3">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                              membro.perfil === 'Supervisor' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                              {membro.perfil}
                                            </span>
                                            
                                            <div className="flex space-x-2">
                                              {membro.perfil === 'Supervisor' ? (
                                                <button
                                                  onClick={() => alterarPerfilMembro(membro.id, 'Membro', regional.id)}
                                                  className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                                                  title="Remover como supervisor (manterá como membro)"
                                                >
                                                  ❌ Desativar Supervisor
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => alterarPerfilMembro(membro.id, 'Supervisor', regional.id)}
                                                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                                  title="Promover a supervisor"
                                                >
                                                  ✅ Ativar como Supervisor
                                                </button>
                                              )}

                                              {/* ✅ NOVO: Botão de Exclusão (condicional) */}
                                              {configExclusao.exclusao_membros_ativa && (
                                                <button
                                                  onClick={() => excluirMembro(membro.id, membro.nome, regional.id)}
                                                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                                  title="Excluir membro completamente do sistema"
                                                >
                                                  🗑️ Excluir
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-gray-500">
                                      <div className="text-4xl mb-2">👥</div>
                                      <p className="font-medium">Nenhum membro cadastrado nesta regional</p>
                                      <p className="text-sm mt-1">Os membros aparecerão aqui quando se cadastrarem no sistema.</p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  <p>Erro ao carregar membros da regional.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  
                  {regionais.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nenhuma regional cadastrada ainda.</p>
                      <p className="text-sm mt-1">Use o formulário acima para criar a primeira regional.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'solicitacoes' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">🔐 Gerenciar Solicitações</h2>
                    <p className="text-gray-600 mt-1">
                      Gerencie autorizações de supervisor e recuperações de senha
                    </p>
                  </div>
                  <button
                    onClick={recarregarSolicitacoes}
                    disabled={isLoadingData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {isLoadingData ? '🔄 Carregando...' : '🔄 Atualizar'}
                  </button>
                </div>

                {/* ✅ ABAS PARA TIPOS DE SOLICITAÇÃO */}
                <div className="mb-6">
                  <nav className="flex space-x-8">
                    <button
                      onClick={() => setAbaSolicitacoes('supervisores')}
                      className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                        abaSolicitacoes === 'supervisores'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      🛡️ Supervisores {statsSolicitacoes?.pendentes > 0 && (
                        <span className="ml-1 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                          {statsSolicitacoes.pendentes}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setAbaSolicitacoes('recuperacao')}
                      className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                        abaSolicitacoes === 'recuperacao'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      🔑 Recuperação {statsRecuperacao?.pendentes > 0 && (
                        <span className="ml-1 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                          {statsRecuperacao.pendentes}
                        </span>
                      )}
                    </button>
                  </nav>
                </div>

                {/* ✅ SEÇÃO DE SUPERVISORES */}
                {abaSolicitacoes === 'supervisores' && (
                  <div>
                    {/* Estatísticas e Filtros */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                      {/* Stats */}
                {statsSolicitacoes && (
                        <>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-blue-800">Total</h3>
                      <p className="text-2xl font-bold text-blue-600">{statsSolicitacoes.total}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-yellow-800">Pendentes</h3>
                      <p className="text-2xl font-bold text-yellow-600">{statsSolicitacoes.pendentes}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-green-800">Aprovadas</h3>
                      <p className="text-2xl font-bold text-green-600">{statsSolicitacoes.aprovadas}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-red-800">Rejeitadas</h3>
                      <p className="text-2xl font-bold text-red-600">{statsSolicitacoes.rejeitadas}</p>
                    </div>
                        </>
                      )}
                    </div>

                    {/* ✅ CONTROLES DE FILTRO E BUSCA */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                          <input
                            type="text"
                            placeholder="Nome ou matrícula..."
                            value={buscaSolicitacoes}
                            onChange={(e) => {
                              setBuscaSolicitacoes(e.target.value);
                              setPaginaSolicitacoes(1); // Reset página ao buscar
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="w-full lg:w-48">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={filtroSolicitacoes}
                            onChange={(e) => {
                              setFiltroSolicitacoes(e.target.value as any);
                              setPaginaSolicitacoes(1); // Reset página ao filtrar
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="PENDENTE">🟡 Apenas Pendentes</option>
                            <option value="APROVADA">🟢 Apenas Aprovadas</option>
                            <option value="REJEITADA">🔴 Apenas Rejeitadas</option>
                            <option value="TODAS">📋 Todas</option>
                          </select>
                        </div>
                      </div>
                      {(buscaSolicitacoes || filtroSolicitacoes !== 'PENDENTE') && (
                        <div className="mt-3 text-sm text-gray-600">
                          Mostrando {solicitacoesFiltradas.length} de {solicitacoes.length} solicitações
                          {buscaSolicitacoes && ` • Busca: "${buscaSolicitacoes}"`}
                          {filtroSolicitacoes !== 'TODAS' && ` • Status: ${filtroSolicitacoes}`}
                  </div>
                )}
                    </div>

                    {/* ✅ LISTA DE AUTORIZAÇÕES COM PAGINAÇÃO */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">
                            Solicitações de Autorização
                          </h3>
                          {totalPaginasSolicitacoes > 1 && (
                            <div className="text-sm text-gray-500">
                              Página {paginaSolicitacoes} de {totalPaginasSolicitacoes}
                            </div>
                          )}
                        </div>

                        {solicitacoesPaginadas.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <div className="text-4xl mb-3">
                              {filtroSolicitacoes === 'PENDENTE' ? '🛡️' : '📋'}
                            </div>
                            <p className="font-medium text-lg mb-2">
                              {filtroSolicitacoes === 'PENDENTE' 
                                ? 'Nenhuma autorização pendente' 
                                : `Nenhuma solicitação ${filtroSolicitacoes.toLowerCase()}`
                              }
                            </p>
                            <p className="text-sm">
                              {filtroSolicitacoes === 'PENDENTE' 
                                ? 'Quando alguém tentar criar uma conta supervisor, aparecerá aqui.'
                                : buscaSolicitacoes 
                                  ? 'Tente ajustar os filtros de busca.'
                                  : 'Nenhuma solicitação encontrada com os filtros atuais.'
                              }
                            </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                            {solicitacoesPaginadas.map((solicitacao) => (
                        <div key={solicitacao.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-800 text-lg">{solicitacao.nome}</h4>
                                    <p className="text-sm text-gray-600">
                                      Matrícula: <span className="font-mono font-semibold">{solicitacao.matricula}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Regional: <span className="font-semibold">{solicitacao.regional.nome} ({solicitacao.regional.codigo})</span>
                                    </p>
                              {solicitacao.email && (
                                <p className="text-sm text-gray-600">Email: {solicitacao.email}</p>
                              )}
                            </div>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              solicitacao.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' :
                              solicitacao.status === 'APROVADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {solicitacao.status === 'PENDENTE' ? '⏳ Pendente' :
                               solicitacao.status === 'APROVADA' ? '✅ Aprovada' : '❌ Rejeitada'}
                            </span>
                          </div>

                          <div className="text-sm text-gray-600 mb-3">
                                  <p><strong>Solicitado em:</strong> {new Date(solicitacao.data_solicitacao).toLocaleString('pt-BR')}</p>
                            {solicitacao.justificativa && (
                              <p className="mt-1"><strong>Justificativa:</strong> "{solicitacao.justificativa}"</p>
                            )}
                            {solicitacao.data_analise && (
                              <p className="mt-1"><strong>Analisada em:</strong> {new Date(solicitacao.data_analise).toLocaleString('pt-BR')}</p>
                            )}
                            {solicitacao.analisada_por_servidor && (
                              <p className="mt-1"><strong>Analisada por:</strong> {solicitacao.analisada_por_servidor.nome} ({solicitacao.analisada_por_servidor.matricula})</p>
                            )}
                            {solicitacao.motivo_rejeicao && (
                              <p className="mt-1 text-red-700"><strong>Motivo da Rejeição:</strong> "{solicitacao.motivo_rejeicao}"</p>
                            )}
                          </div>

                          <div className="flex space-x-2">
                            {solicitacao.status === 'PENDENTE' && (
                              <>
                                <button 
                                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                  onClick={() => handleAprovarSolicitacao(solicitacao.id)}
                                >
                                  ✅ Aprovar e Criar Conta
                                </button>
                                <button 
                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                  onClick={() => handleRejeitarSolicitacao(solicitacao.id)}
                                >
                                  ❌ Rejeitar
                                </button>
                              </>
                            )}
                            {solicitacao.status !== 'PENDENTE' && (
                              <div className="text-sm text-gray-500 italic">
                                {solicitacao.status === 'APROVADA' ? 
                                  '✅ Conta supervisor criada com sucesso' : 
                                  '❌ Solicitação rejeitada'
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                        {/* ✅ PAGINAÇÃO */}
                        {totalPaginasSolicitacoes > 1 && (
                          <div className="mt-6 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              Mostrando {((paginaSolicitacoes - 1) * ITENS_POR_PAGINA) + 1} até {Math.min(paginaSolicitacoes * ITENS_POR_PAGINA, solicitacoesFiltradas.length)} de {solicitacoesFiltradas.length}
                </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setPaginaSolicitacoes(Math.max(1, paginaSolicitacoes - 1))}
                                disabled={paginaSolicitacoes === 1}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ← Anterior
                              </button>
                              <span className="px-3 py-2 text-sm text-gray-500">
                                {paginaSolicitacoes} / {totalPaginasSolicitacoes}
                              </span>
                              <button
                                onClick={() => setPaginaSolicitacoes(Math.min(totalPaginasSolicitacoes, paginaSolicitacoes + 1))}
                                disabled={paginaSolicitacoes === totalPaginasSolicitacoes}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Próxima →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ✅ SEÇÃO DE RECUPERAÇÃO DE SENHA */}
                {abaSolicitacoes === 'recuperacao' && (
                  <div>
                    {/* Estatísticas e Filtros */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                      {/* Stats */}
                  {statsRecuperacao && (
                        <>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-800">Total</h3>
                        <p className="text-2xl font-bold text-blue-600">{statsRecuperacao.total}</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-orange-800">Pendentes</h3>
                        <p className="text-2xl font-bold text-orange-600">{statsRecuperacao.pendentes}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-green-800">Aprovadas</h3>
                        <p className="text-2xl font-bold text-green-600">{statsRecuperacao.aprovadas}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-red-800">Rejeitadas</h3>
                        <p className="text-2xl font-bold text-red-600">{statsRecuperacao.rejeitadas}</p>
                      </div>
                        </>
                      )}
                    </div>

                    {/* ✅ CONTROLES DE FILTRO E BUSCA */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                          <input
                            type="text"
                            placeholder="Nome ou matrícula..."
                            value={buscaRecuperacoes}
                            onChange={(e) => {
                              setBuscaRecuperacoes(e.target.value);
                              setPaginaRecuperacoes(1); // Reset página ao buscar
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div className="w-full lg:w-48">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={filtroRecuperacoes}
                            onChange={(e) => {
                              setFiltroRecuperacoes(e.target.value as any);
                              setPaginaRecuperacoes(1); // Reset página ao filtrar
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="PENDENTE">🟡 Apenas Pendentes</option>
                            <option value="APROVADA">🟢 Apenas Aprovadas</option>
                            <option value="REJEITADA">🔴 Apenas Rejeitadas</option>
                            <option value="TODAS">📋 Todas</option>
                          </select>
                        </div>
                      </div>
                      {(buscaRecuperacoes || filtroRecuperacoes !== 'PENDENTE') && (
                        <div className="mt-3 text-sm text-gray-600">
                          Mostrando {recuperacoesFiltradas.length} de {recuperacoes.length} solicitações
                          {buscaRecuperacoes && ` • Busca: "${buscaRecuperacoes}"`}
                          {filtroRecuperacoes !== 'TODAS' && ` • Status: ${filtroRecuperacoes}`}
                    </div>
                  )}
                    </div>

                    {/* ✅ LISTA DE RECUPERAÇÕES COM PAGINAÇÃO */}
                    <div className="bg-white border border-gray-200 rounded-lg">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">
                            Solicitações de Recuperação
                          </h3>
                          {totalPaginasRecuperacoes > 1 && (
                            <div className="text-sm text-gray-500">
                              Página {paginaRecuperacoes} de {totalPaginasRecuperacoes}
                            </div>
                          )}
                        </div>

                        {recuperacoesPaginadas.length === 0 ? (
                          <div className="text-center py-12 text-gray-500">
                            <div className="text-4xl mb-3">
                              {filtroRecuperacoes === 'PENDENTE' ? '🔑' : '📋'}
                            </div>
                            <p className="font-medium text-lg mb-2">
                              {filtroRecuperacoes === 'PENDENTE' 
                                ? 'Nenhuma recuperação pendente' 
                                : `Nenhuma solicitação ${filtroRecuperacoes.toLowerCase()}`
                              }
                            </p>
                            <p className="text-sm">
                              {filtroRecuperacoes === 'PENDENTE' 
                                ? 'Quando alguém esquecer a senha, aparecerá aqui.'
                                : buscaRecuperacoes 
                                  ? 'Tente ajustar os filtros de busca.'
                                  : 'Nenhuma solicitação encontrada com os filtros atuais.'
                              }
                            </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                            {recuperacoesPaginadas.map((recuperacao) => (
                          <div key={recuperacao.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-800 text-lg">{recuperacao.nome}</h4>
                                    <p className="text-sm text-gray-600">
                                      Matrícula: <span className="font-mono font-semibold">{recuperacao.matricula}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Perfil: <span className="font-semibold">{recuperacao.perfil}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Regional: <span className="font-semibold">{recuperacao.regional.nome} ({recuperacao.regional.codigo})</span>
                                    </p>
                              </div>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                recuperacao.status === 'PENDENTE' ? 'bg-orange-100 text-orange-800' :
                                recuperacao.status === 'APROVADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {recuperacao.status === 'PENDENTE' ? '⏳ Pendente' :
                                 recuperacao.status === 'APROVADA' ? '✅ Aprovada' : '❌ Rejeitada'}
                              </span>
                            </div>

                            <div className="text-sm text-gray-600 mb-3">
                                  <p><strong>Solicitado em:</strong> {new Date(recuperacao.data_solicitacao).toLocaleString('pt-BR')}</p>
                              {recuperacao.justificativa && (
                                <p className="mt-1"><strong>Justificativa:</strong> "{recuperacao.justificativa}"</p>
                              )}
                              {recuperacao.data_analise && (
                                <p className="mt-1"><strong>Analisada em:</strong> {new Date(recuperacao.data_analise).toLocaleString('pt-BR')}</p>
                              )}
                              {recuperacao.analisada_por_servidor && (
                                <p className="mt-1"><strong>Analisada por:</strong> {recuperacao.analisada_por_servidor.nome} ({recuperacao.analisada_por_servidor.matricula})</p>
                              )}
                              {recuperacao.motivo_rejeicao && (
                                <p className="mt-1 text-red-700"><strong>Motivo da Rejeição:</strong> "{recuperacao.motivo_rejeicao}"</p>
                              )}
                              {recuperacao.nova_senha_temp && (
                                <p className="mt-1 text-green-700"><strong>Senha Temporária:</strong> {recuperacao.nova_senha_temp} {recuperacao.senha_alterada ? '(Já alterada)' : '(Não alterada)'}</p>
                              )}
                            </div>

                            <div className="flex space-x-2">
                              {recuperacao.status === 'PENDENTE' && (
                                <>
                                  <button 
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                    onClick={() => handleAprovarRecuperacao(recuperacao.id)}
                                  >
                                    ✅ Aprovar e Definir Senha
                                  </button>
                                  <button 
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                                    onClick={() => handleRejeitarRecuperacao(recuperacao.id)}
                                  >
                                    ❌ Rejeitar
                                  </button>
                                </>
                              )}
                              {recuperacao.status !== 'PENDENTE' && (
                                <div className="text-sm text-gray-500 italic">
                                  {recuperacao.status === 'APROVADA' ? 
                                    '✅ Senha temporária definida - informar ao usuário' : 
                                    '❌ Solicitação rejeitada'
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                        {/* ✅ PAGINAÇÃO */}
                        {totalPaginasRecuperacoes > 1 && (
                          <div className="mt-6 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              Mostrando {((paginaRecuperacoes - 1) * ITENS_POR_PAGINA) + 1} até {Math.min(paginaRecuperacoes * ITENS_POR_PAGINA, recuperacoesFiltradas.length)} de {recuperacoesFiltradas.length}
                  </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setPaginaRecuperacoes(Math.max(1, paginaRecuperacoes - 1))}
                                disabled={paginaRecuperacoes === 1}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ← Anterior
                              </button>
                              <span className="px-3 py-2 text-sm text-gray-500">
                                {paginaRecuperacoes} / {totalPaginasRecuperacoes}
                              </span>
                              <button
                                onClick={() => setPaginaRecuperacoes(Math.min(totalPaginasRecuperacoes, paginaRecuperacoes + 1))}
                                disabled={paginaRecuperacoes === totalPaginasRecuperacoes}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Próxima →
                              </button>
                </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'sistema' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-6">Configurações do Sistema</h2>
                
                <div className="space-y-6">
                  {/* ✅ CONFIGURAÇÕES DE DESENVOLVIMENTO - SIMPLIFICADO */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🧪 Área de Desenvolvimento</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Controle simples da visibilidade da seção de desenvolvimento na interface dos membros.
                    </p>
                    
                    <div className="space-y-6">
                      {/* ✅ STATUS SIMPLIFICADO */}
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            configDesenvolvimento.area_desenvolvimento_ativa ? 'bg-green-500' : 'bg-gray-400'
                          }`}></div>
                        <div>
                          <h4 className="font-medium text-gray-800">Status da Área de Desenvolvimento</h4>
                          <p className="text-sm text-gray-600">
                            {configDesenvolvimento.area_desenvolvimento_ativa 
                                ? "Visível para todos os membros"
                                : "Oculta para todos os membros"
                            }
                          </p>
                        </div>
                        </div>
                        <button
                          onClick={async () => {
                            const novoEstado = !configDesenvolvimento.area_desenvolvimento_ativa;
                            
                            setConfigDesenvolvimento({
                              ...configDesenvolvimento,
                              area_desenvolvimento_ativa: novoEstado
                            });
                            
                            try {
                              const response = await fetch('/api/admin/configuracoes/desenvolvimento', {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  area_desenvolvimento_ativa: novoEstado
                                })
                              });

                              const result = await response.json();
                              if (!result.success) {
                                setConfigDesenvolvimento({
                                  ...configDesenvolvimento,
                                  area_desenvolvimento_ativa: !novoEstado
                                });
                                alert(`❌ Erro: ${result.error}`);
                              }
                            } catch (error) {
                              setConfigDesenvolvimento({
                                ...configDesenvolvimento,
                                area_desenvolvimento_ativa: !novoEstado
                              });
                              alert('❌ Erro ao salvar configurações');
                            }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            configDesenvolvimento.area_desenvolvimento_ativa
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {configDesenvolvimento.area_desenvolvimento_ativa ? '🔴 Desativar' : '🟢 Ativar'}
                        </button>
                      </div>


                    </div>
                  </div>

                  {/* ✅ NOVO CARD: Configurações de Exclusão */}
                  <div className="bg-white border border-red-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🗑️ Exclusão de Membros</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Controle a funcionalidade de exclusão completa de membros do sistema. 
                      <span className="text-red-600 font-medium"> Esta é uma operação irreversível!</span>
                    </p>
                    
                    <div className="space-y-4">
                      {/* Toggle Ativar/Desativar Exclusão */}
                      <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                        <div>
                          <h4 className="font-medium text-gray-800">Permitir Exclusão de Membros</h4>
                          <p className="text-sm text-gray-600">
                            {configExclusao.exclusao_membros_ativa 
                              ? "⚠️ Exclusão habilitada - administradores podem excluir membros"
                              : "🔒 Exclusão desabilitada - função de exclusão bloqueada"
                            }
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={configExclusao.exclusao_membros_ativa}
                            onChange={(e) => setConfigExclusao({
                              ...configExclusao,
                              exclusao_membros_ativa: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>

                      {/* Aviso de Segurança */}
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start">
                          <div className="text-yellow-600 mr-3">⚠️</div>
                          <div>
                            <h4 className="text-sm font-medium text-yellow-800">Aviso de Segurança</h4>
                            <p className="text-xs text-yellow-700 mt-1">
                              A exclusão de membros remove permanentemente todos os dados do sistema, 
                              incluindo histórico de participações e auditoria. Use apenas em casos extremos.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Botão Salvar */}
                      <div className="flex justify-end">
                        <button
                          onClick={salvarConfigExclusao}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                        >
                          💾 Salvar Configurações
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card de Arquitetura (mantido) */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Arquitetura</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Clean Architecture:</span>
                        <span className="text-green-600 font-semibold">95% Conformidade</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bounded Contexts:</span>
                        <span className="text-green-600 font-semibold">Implementado</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Domain Services:</span>
                        <span className="text-green-600 font-semibold">Operacional</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Supabase Integration:</span>
                        <span className="text-green-600 font-semibold">100% Funcional</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  );
} 