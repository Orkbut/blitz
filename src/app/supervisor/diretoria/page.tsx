'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TabelaOperacoesDiretoria from '@/components/supervisor/TabelaOperacoesDiretoria';
import ExcelViewer from '@/components/supervisor/ExcelViewer';
import { getSupervisorHeaders } from '@/lib/auth-utils';

interface Participante {
  id: number;
  nome: string;
  matricula: string;
  bloqueado: boolean;
}

interface Operacao {
  id: number;
  dataOperacao: string;
  turno: string;
  modalidade: string;
  tipo: string;
  limiteParticipantes: number;
  status: string;
  encaminhadoEm?: string;
  retornoEm?: string;
  decisaoDiretoria?: string;
  motivoDiretoria?: string;
  documentacaoGerada?: any;
  valorTotalDiarias?: number;
  portariaGerada?: any;
  participantes: Participante[];
  totalParticipantes: number;
  membrosBloquados: number;
}

const STATUS_COLORS = {
  'APROVADA': 'bg-green-100 text-green-800',
  'AGUARDANDO_DIRETORIA': 'bg-yellow-100 text-yellow-800',
  'APROVADA_DIRETORIA': 'bg-blue-100 text-blue-800',
  'REJEITADA_DIRETORIA': 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  'APROVADA': 'Aprovada',
  'AGUARDANDO_DIRETORIA': 'Aguardando Diretoria',
  'APROVADA_DIRETORIA': 'Aprovada pela Diretoria',
  'REJEITADA_DIRETORIA': 'Rejeitada pela Diretoria'
};

export default function DiretoriaPage() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [operacoesPlanejadas, setOperacoesPlanejadas] = useState<any[]>([]);
  const [participacoesPlanejadas, setParticipacoesPlanejadas] = useState<any[]>([]);
  const [janelaSelecionada, setJanelaSelecionada] = useState<number | null>(null);
  const [janelasDisponiveis, setJanelasDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJanelas, setLoadingJanelas] = useState(true);
  const [processando, setProcessando] = useState<number | null>(null);
  
  // Estado para controlar a aba ativa
  const [abaAtiva, setAbaAtiva] = useState<'operacoes' | 'planilha'>('operacoes');
  
  // Estados para modais
  const [modalEncaminhar, setModalEncaminhar] = useState<Operacao | null>(null);
  const [modalRetorno, setModalRetorno] = useState<Operacao | null>(null);
  const [decisao, setDecisao] = useState<'APROVADA' | 'REJEITADA'>('APROVADA');
  const [motivo, setMotivo] = useState('');

  // Estados para avisos elegantes
  const [avisoElegante, setAvisoElegante] = useState<{
    tipo: 'sucesso' | 'erro' | 'info';
    titulo: string;
    mensagem: string;
  } | null>(null);

  useEffect(() => {
    carregarOperacoes();
    carregarJanelasDisponiveis();
  }, []);

  // Carregar operações quando a janela selecionada mudar
  useEffect(() => {
    if (janelaSelecionada) {
      carregarOperacoesPlanejadas();
    }
  }, [janelaSelecionada]);

  // 🚨 FUNÇÃO PARA FORÇAR ATUALIZAÇÃO DOS DADOS
  const forcarAtualizacao = () => {
    console.log('🔄 Forçando atualização dos dados...');
    if (janelaSelecionada) {
      carregarOperacoesPlanejadas();
    }
  };

  const mostrarAvisoElegante = (tipo: 'sucesso' | 'erro' | 'info', titulo: string, mensagem: string) => {
    setAvisoElegante({ tipo, titulo, mensagem });
    setTimeout(() => setAvisoElegante(null), 5000);
  };

  const baixarRelatorioTabela = async () => {
    try {
      if (!janelaSelecionada) {
        mostrarAvisoElegante('erro', 'Erro', 'Selecione uma janela operacional primeiro');
        return;
      }

      const response = await fetch(`/api/supervisor/diretoria?formato=texto&janela_id=${janelaSelecionada}`, {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      const texto = await response.text();
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }
      
      const blob = new Blob([texto], { type: 'text/plain; charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabela-diretoria-janela-${janelaSelecionada}-${new Date().toISOString().split('T')[0]}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      mostrarAvisoElegante('sucesso', 'Sucesso', 'Relatório baixado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao baixar relatório:', error);
      mostrarAvisoElegante('erro', 'Erro', 'Erro ao baixar relatório da tabela');
    }
  };

  // ✅ CARREGAR VIA API UNIFICADA - DADOS CONSISTENTES
  const carregarOperacoes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/unified/operacoes?portal=diretoria', {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      const data = await response.json();

      if (data.success) {
        // ✅ MAPEAR DADOS UNIFICADOS PARA FORMATO ESPERADO
        const operacoesMapeadas = data.data.map((op: any) => ({
          id: op.id,
          dataOperacao: op.dataOperacao,
          turno: op.turno,
          modalidade: op.modalidade,
          tipo: op.tipo,
          limiteParticipantes: op.limiteParticipantes,
          status: op.status, // ✅ STATUS DA OPERAÇÃO
          // ✅ CAMPOS DA DIRETORIA - Agora fornecidos pela API unificada
          encaminhadoEm: op.encaminhado_diretoria_em,
          retornoEm: op.retorno_diretoria_em,
          decisaoDiretoria: op.decisao_diretoria,
          motivoDiretoria: op.motivo_diretoria,
          documentacaoGerada: null,
          valorTotalDiarias: null,
          portariaGerada: null,
          participantes: op.participantes || [], // ✅ Participantes da API
          totalParticipantes: op.participantesConfirmados || 0,
          membrosBloquados: op.membrosBloquados || 0
        }));
        
        setOperacoes(operacoesMapeadas);
        console.log(`✅ DIRETORIA: ${operacoesMapeadas.length} operações carregadas via API unificada`);
        console.log('🔍 DIRETORIA: Primeira operação exemplo:', operacoesMapeadas[0]);
      } else {
        mostrarAvisoElegante('erro', 'Erro', 'Erro ao carregar operações');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar operações:', error);
      mostrarAvisoElegante('erro', 'Erro', 'Erro ao conectar com servidor');
    } finally {
      setLoading(false);
    }
  };

  // 🏢 CARREGAR JANELAS OPERACIONAIS DISPONÍVEIS
  const carregarJanelasDisponiveis = async () => {
    try {
      setLoadingJanelas(true);
      console.log('🔍 Carregando janelas operacionais...');
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      const data = await response.json();
      
      console.log('📊 Resposta da API janelas:', data);
      
      if (data.success) {
        // Para cada janela, contar operações PLANEJADAS
        const janelasComContadores = await Promise.all(
          data.data.map(async (janela: any) => {
            try {
              const responseOp = await fetch(`/api/unified/operacoes?janela_id=${janela.id}&tipo=PLANEJADA`, {
                headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
              });
              const dataOp = await responseOp.json();
              
              const totalOperacoesPlanejadas = dataOp.success ? dataOp.data.length : 0;
              
              return {
                ...janela,
                totalOperacoesPlanejadas,
                titulo: `${janela.dataInicio} a ${janela.dataFim}`
              };
            } catch (error) {
              console.error(`❌ Erro ao contar operações da janela ${janela.id}:`, error);
              return {
                ...janela,
                totalOperacoesPlanejadas: 0,
                titulo: `${janela.dataInicio} a ${janela.dataFim}`
              };
            }
          })
        );
        
        console.log('📋 Janelas com contadores:', janelasComContadores);
        
        // Filtrar apenas janelas ativas (todas as janelas, mesmo sem operações)
        const janelasAtivas = janelasComContadores.filter((janela: any) => 
          janela.status === 'ATIVA'
        );
        
        console.log('✅ Janelas ativas encontradas:', janelasAtivas.length);
        
        setJanelasDisponiveis(janelasAtivas);
        
        // Selecionar automaticamente a primeira janela disponível
        if (janelasAtivas.length > 0 && !janelaSelecionada) {
          setJanelaSelecionada(janelasAtivas[0].id);
          console.log('🎯 Janela selecionada automaticamente:', janelasAtivas[0].id);
        }
      } else {
        console.error('❌ Erro na resposta da API:', data.error);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar janelas:', error);
    } finally {
      setLoadingJanelas(false);
    }
  };

  // 📋 CARREGAR OPERAÇÕES PLANEJADAS DA JANELA SELECIONADA
  const carregarOperacoesPlanejadas = async () => {
    if (!janelaSelecionada) return;
    
    try {
      // 🚨 FORÇAR ATUALIZAÇÃO - Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      const responseOp = await fetch(`/api/unified/operacoes?janela_id=${janelaSelecionada}&tipo=PLANEJADA&_t=${timestamp}`, {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      const dataOp = await responseOp.json();
      
      if (dataOp.success) {
        setOperacoesPlanejadas(dataOp.data);
        console.log(`📋 Operações planejadas carregadas: ${dataOp.data.length}`);
        
        // Carregar participações das operações planejadas DIRETAMENTE DO BANCO
        console.log('🔍 Carregando participações das operações planejadas...');
        const todasParticipacoes: any[] = [];
        
        for (const operacao of dataOp.data) {
          try {
            // Buscar participações confirmadas diretamente - FORÇA ATUALIZAÇÃO
            const responseParticipacoes = await fetch(`/api/agendamento/operacoes/${operacao.id}/participacoes?_t=${timestamp}`, {
              headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
            });
            const dataParticipacoes = await responseParticipacoes.json();
            
            if (dataParticipacoes.success && dataParticipacoes.data) {
              // Adicionar as participações com informações da operação
              const participacoesComOperacao = dataParticipacoes.data.map((p: any) => ({
                ...p,
                operacao_id: operacao.id,
                data_operacao: operacao.data_operacao || operacao.dataOperacao
              }));
              todasParticipacoes.push(...participacoesComOperacao);
              console.log(`✅ Operação ${operacao.id}: ${participacoesComOperacao.length} participações carregadas`);
            }
          } catch (error) {
            console.error(`❌ Erro ao carregar participações da operação ${operacao.id}:`, error);
          }
        }
        
        setParticipacoesPlanejadas(todasParticipacoes);
        console.log(`👥 Participações planejadas carregadas: ${todasParticipacoes.length}`);
        
        // 🚨 LOG ESPECÍFICO PARA DOUGLAS SANTOS
        const douglasParticipacoes = todasParticipacoes.filter(p => p.membro_id === 1);
        console.log(`🚨 DOUGLAS SANTOS - Participações carregadas:`, douglasParticipacoes.length);
        console.log(`🚨 DOUGLAS SANTOS - Detalhes:`, douglasParticipacoes.map(p => ({
          operacao_id: p.operacao_id,
          data_operacao: p.data_operacao,
          estado_visual: p.estado_visual,
          ativa: p.ativa
        })));
        
      } else {
        console.error('❌ Erro ao carregar operações planejadas:', dataOp.error);
        setOperacoesPlanejadas([]);
        setParticipacoesPlanejadas([]);
      }
    } catch (error) {
      console.error('❌ Erro ao processar operações planejadas:', error);
      setOperacoesPlanejadas([]);
      setParticipacoesPlanejadas([]);
    }
  };

  const executarAcao = async (operacaoId: number, acao: string, params?: any) => {
    try {
      setProcessando(operacaoId);
      const response = await fetch(`/api/supervisor/operacoes/${operacaoId}/${acao}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
        },
        body: JSON.stringify(params || {})
      });

      const data = await response.json();

      if (data.success) {
        mostrarAvisoElegante('sucesso', 'Sucesso', data.message);
        // Fechar modais
        setModalEncaminhar(null);
        setModalRetorno(null);
        setDecisao('APROVADA');
        setMotivo('');
        // Recarregar dados
        carregarOperacoes();
      } else {
        mostrarAvisoElegante('erro', 'Erro', data.error);
      }
    } catch (error) {
      console.error('❌ Erro ao executar ação:', error);
      mostrarAvisoElegante('erro', 'Erro', 'Erro ao conectar com servidor');
    } finally {
      setProcessando(null);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatarDataHora = (data: string) => {
    return new Date(data).toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando operações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full" style={{ margin: 0, padding: 0 }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href="/supervisor" 
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                ← Voltar
              </Link>
              <div className="ml-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  🏛️ Gestão de Diretoria
                </h1>
                <p className="text-sm text-gray-600">
                  Encaminhar operações e planilhas de diárias
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso Elegante */}
      {avisoElegante && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`p-4 rounded-md ${
            avisoElegante.tipo === 'sucesso' ? 'bg-green-50 border border-green-200' :
            avisoElegante.tipo === 'erro' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {avisoElegante.tipo === 'sucesso' ? (
                  <span className="text-green-400">✅</span>
                ) : avisoElegante.tipo === 'erro' ? (
                  <span className="text-red-400">❌</span>
                ) : (
                  <span className="text-blue-400">⏰</span>
                )}
              </div>
              <div className="ml-3">
                <h3 className={`text-sm font-medium ${
                  avisoElegante.tipo === 'sucesso' ? 'text-green-800' :
                  avisoElegante.tipo === 'erro' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {avisoElegante.titulo}
                </h3>
                <p className={`mt-1 text-sm ${
                  avisoElegante.tipo === 'sucesso' ? 'text-green-600' :
                  avisoElegante.tipo === 'erro' ? 'text-red-600' :
                  'text-blue-600'
                }`}>
                  {avisoElegante.mensagem}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sistema de Abas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setAbaAtiva('operacoes')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                abaAtiva === 'operacoes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🗂️ Operações da Diretoria
            </button>
            <button
              onClick={() => setAbaAtiva('planilha')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                abaAtiva === 'planilha'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Planilha de Diárias
            </button>
          </nav>
        </div>
      </div>

      {/* Conteúdo da Aba Planilha */}
      {abaAtiva === 'planilha' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ExcelViewer 
            filePath="/Pedido+Diária+Padrao+(3)+(8)+(1).xlsx"
            fileName="Pedido de Diária Padrão"
          />
        </div>
      )}

      {/* Conteúdo da Aba Operações */}
      {abaAtiva === 'operacoes' && (
        <>
          {/* Seção: Operações Planejadas */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">📋 Operações Planejadas</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Visualize as operações planejadas por janela operacional
                  </p>
                </div>
                
                {/* Seletor de Janela e Botões de Ação */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={forcarAtualizacao}
                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200 flex items-center space-x-1.5 border border-gray-300"
                    title="Atualizar dados da PORTARIA MOR"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Atualizar</span>
                  </button>
                  
                  {janelaSelecionada && (
                    <button
                      onClick={() => baixarRelatorioTabela()}
                      className="bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-green-700 transition-colors duration-200 flex items-center space-x-1.5"
                      title="Baixar relatório da tabela em formato texto"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Baixar TXT</span>
                    </button>
                  )}
                  
                  <label className="text-sm font-medium text-gray-700">
                    Janela Operacional:
                  </label>
                  
                  {loadingJanelas ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-gray-500">Carregando janelas...</span>
                    </div>
                  ) : janelasDisponiveis.length > 0 ? (
                    <select
                      value={janelaSelecionada || ''}
                      onChange={(e) => setJanelaSelecionada(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Selecione uma janela</option>
                      {janelasDisponiveis.map((janela) => (
                        <option key={janela.id} value={janela.id}>
                          #{janela.id} - {janela.titulo} ({janela.totalOperacoesPlanejadas} operações)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-gray-500 italic">
                      Nenhuma janela operacional ativa encontrada
                    </span>
                  )}
                </div>
              </div>

              {/* Tabela de Operações Planejadas */}
              {janelaSelecionada ? (
                <TabelaOperacoesDiretoria 
                  key={`${janelaSelecionada}-${participacoesPlanejadas.length}-${Date.now()}`}
                  operacoes={operacoesPlanejadas}
                  participacoes={participacoesPlanejadas}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Selecione uma janela operacional para visualizar as operações planejadas</p>
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {operacoes.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">📄</span>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma operação encontrada</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Não há operações para encaminhar ou com retorno da diretoria.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {operacoes.map((operacao) => (
                  <div key={operacao.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="p-6">
                      {/* Header da Operação */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                            #{operacao.id}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[operacao.status as keyof typeof STATUS_COLORS]}`}>
                            {STATUS_LABELS[operacao.status as keyof typeof STATUS_LABELS]}
                          </div>
                          {operacao.membrosBloquados > 0 && (
                            <div className="flex items-center text-red-600 text-sm">
                              🔒 {operacao.membrosBloquados} membros bloqueados
                            </div>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex space-x-2">
                          {operacao.status === 'APROVADA' && (
                            <button
                              onClick={() => setModalEncaminhar(operacao)}
                              disabled={processando === operacao.id}
                              className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
                            >
                              📋 Encaminhar para Diretoria
                            </button>
                          )}

                          {operacao.status === 'AGUARDANDO_DIRETORIA' && (
                            <>
                              <button
                                onClick={() => executarAcao(operacao.id, 'desencaminhar')}
                                disabled={processando === operacao.id}
                                className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                              >
                                ↩️ Desencaminhar
                              </button>
                              <button
                                onClick={() => setModalRetorno(operacao)}
                                disabled={processando === operacao.id}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                              >
                                📝 Registrar Retorno
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Detalhes da Operação */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Data da Operação</p>
                          <p className="font-medium">{formatarData(operacao.dataOperacao)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Modalidade</p>
                          <p className="font-medium">{operacao.modalidade}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Participantes</p>
                          <p className="font-medium">{operacao.totalParticipantes}</p>
                        </div>
                        {operacao.valorTotalDiarias && (
                          <div>
                            <p className="text-sm text-gray-500">Valor Total</p>
                            <p className="font-medium text-green-600">{formatarValor(operacao.valorTotalDiarias)}</p>
                          </div>
                        )}
                      </div>

                      {/* Timeline */}
                      {(operacao.encaminhadoEm || operacao.retornoEm) && (
                        <div className="border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Timeline</h4>
                          <div className="space-y-2">
                            {operacao.encaminhadoEm && (
                              <div className="flex items-center text-sm text-gray-600">
                                ⏰ Encaminhado em: {formatarDataHora(operacao.encaminhadoEm)}
                              </div>
                            )}
                            {operacao.retornoEm && (
                              <div className="flex items-center text-sm text-gray-600">
                                ✅ Retorno em: {formatarDataHora(operacao.retornoEm)}
                                {operacao.decisaoDiretoria === 'REJEITADA' && operacao.motivoDiretoria && (
                                  <span className="ml-2 text-red-600">- {operacao.motivoDiretoria}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Participantes */}
                      {operacao.participantes.length > 0 && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Participantes Aprovados</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {operacao.participantes.map((participante) => (
                              <div key={participante.id} className="flex items-center space-x-2 text-sm">
                                {participante.bloqueado ? '🔒' : '🔓'}
                                <span className={participante.bloqueado ? 'text-red-600' : 'text-gray-900'}>
                                  {participante.nome} ({participante.matricula})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Encaminhar para Diretoria */}
      {modalEncaminhar && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              📋 Encaminhar para Diretoria
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Confirma o encaminhamento da <strong>Operação #{modalEncaminhar.id}</strong> para a diretoria?
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <div className="flex">
                <span className="text-yellow-400 mr-2">🔒</span>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Atenção: Bloqueio Automático</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Todos os <strong>{modalEncaminhar.totalParticipantes} membros</strong> participantes serão 
                    <strong> bloqueados automaticamente</strong> e não poderão cancelar suas participações 
                    até que a operação retorne da diretoria.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm"><strong>Data:</strong> {formatarData(modalEncaminhar.dataOperacao)}</p>
              <p className="text-sm"><strong>Modalidade:</strong> {modalEncaminhar.modalidade}</p>
              <p className="text-sm"><strong>Participantes:</strong> {modalEncaminhar.totalParticipantes}</p>
              <p className="text-sm"><strong>Valor estimado:</strong> {formatarValor(modalEncaminhar.totalParticipantes * 137.78)}</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setModalEncaminhar(null)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => executarAcao(modalEncaminhar.id, 'encaminhar')}
                disabled={processando === modalEncaminhar.id}
                className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
              >
                {processando === modalEncaminhar.id ? 'Encaminhando...' : 'Encaminhar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registrar Retorno */}
      {modalRetorno && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              📝 Registrar Retorno da Diretoria
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Operação #{modalRetorno.id}</strong> - {formatarData(modalRetorno.dataOperacao)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decisão da Diretoria
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="decisao"
                      value="APROVADA"
                      checked={decisao === 'APROVADA'}
                      onChange={(e) => setDecisao(e.target.value as 'APROVADA' | 'REJEITADA')}
                      className="mr-2"
                    />
                    <span className="text-green-700">✅ Aprovada</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="decisao"
                      value="REJEITADA"
                      checked={decisao === 'REJEITADA'}
                      onChange={(e) => setDecisao(e.target.value as 'APROVADA' | 'REJEITADA')}
                      className="mr-2"
                    />
                    <span className="text-red-700">❌ Rejeitada</span>
                  </label>
                </div>
              </div>

              {decisao === 'REJEITADA' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo da Rejeição *
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    placeholder="Descreva o motivo da rejeição..."
                    required
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <span className="text-blue-400 mr-2">🔓</span>
                  <div>
                    <h4 className="text-sm font-medium text-blue-800">Desbloqueio Automático</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Os membros serão automaticamente <strong>desbloqueados</strong> após registrar o retorno.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setModalRetorno(null);
                  setDecisao('APROVADA');
                  setMotivo('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => executarAcao(modalRetorno.id, 'registrar_retorno', { decisao, motivo })}
                disabled={processando === modalRetorno.id || (decisao === 'REJEITADA' && !motivo.trim())}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {processando === modalRetorno.id ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 