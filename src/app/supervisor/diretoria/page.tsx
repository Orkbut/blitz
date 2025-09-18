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
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
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

  // 🎯 FUNÇÃO PARA GERAR RELATÓRIO USANDO A MESMA LÓGICA DA TABELA
  const gerarRelatorioLocal = (operacoes: any[], participacoes: any[], janelaId: number) => {
    // Buscar informações da janela para o título
    const janela = janelasDisponiveis.find(j => j.id === janelaId);
    const tituloJanela = janela ? `Janela Operacional #${janela.numero} - ${janela.descricao}` : `Janela Operacional #${janelaId}`;
    
    // 🎯 FORMATAÇÃO VISUAL MELHORADA DAS DATAS
    const formatarPeriodoVisual = (dataInicio: string, dataFim: string) => {
      const mesesAbrev = {
        '01': 'JAN', '02': 'FEV', '03': 'MAR', '04': 'ABR',
        '05': 'MAI', '06': 'JUN', '07': 'JUL', '08': 'AGO',
        '09': 'SET', '10': 'OUT', '11': 'NOV', '12': 'DEZ'
      };
      
      // Converter datas do formato YYYY-MM-DD para formato visual
      const [anoInicio, mesInicio, diaInicio] = dataInicio.split('-');
      const [anoFim, mesFim, diaFim] = dataFim.split('-');
      
      const mesInicioAbrev = mesesAbrev[mesInicio as keyof typeof mesesAbrev] || mesInicio;
      const mesFimAbrev = mesesAbrev[mesFim as keyof typeof mesesAbrev] || mesFim;
      
      return `${mesInicioAbrev} ${diaInicio}-${mesInicio}-${anoInicio} a ${mesFimAbrev} ${diaFim}-${mesFim}-${anoFim}`;
    };
    
    const periodoJanela = janela ? formatarPeriodoVisual(janela.dataInicio, janela.dataFim) : 'Período não definido';

    // 🚨 FILTRAR RIGOROSAMENTE - APENAS participações ATIVAS E CONFIRMADAS (mesma lógica da tabela)
    const participacoesConfirmadas = participacoes.filter(p => {
      const isAtiva = p.ativa === true;
      const isConfirmada = ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual);
      const hasOperacao = p.operacao_id && p.data_operacao;
      
      return isAtiva && isConfirmada && hasOperacao;
    });

    if (participacoesConfirmadas.length === 0) {
      return `${tituloJanela}\n${periodoJanela}\n\nNenhuma participação confirmada encontrada.`;
    }

    // Agrupar participações por servidor (mesma lógica da tabela)
    const participacoesPorServidor = participacoesConfirmadas.reduce((acc, participacao) => {
      const servidorId = participacao.membro_id || participacao.servidor_id;
      const nome = participacao.servidor_nome || participacao.nome || 'Servidor';
      const matricula = participacao.matricula || '';
      
      if (!acc[servidorId]) {
        acc[servidorId] = {
          nome,
          matricula,
          participacoes: []
        };
      }
      
      acc[servidorId].participacoes.push(participacao);
      return acc;
    }, {} as Record<number, any>);

    // Calcular PORTARIA MOR para cada servidor (mesma lógica da tabela)
    const portarias: any[] = [];

    Object.entries(participacoesPorServidor).forEach(([servidorIdStr, dados]: [string, any]) => {
      const servidorId = Number(servidorIdStr);
      
      // Buscar operações deste servidor
      const operacoesDoServidor = dados.participacoes.map((p: any) => {
        const operacao = operacoes.find(op => op.id === p.operacao_id);
        return {
          ...p,
          data_operacao: operacao?.data_operacao || operacao?.dataOperacao || p.data_operacao,
          operacao
        };
      }).filter((p: any) => p.data_operacao);

      // Ordenar por data
      operacoesDoServidor.sort((a: any, b: any) => 
        new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime()
      );

      // Agrupar em sequências consecutivas para formar PORTARIA MOR
      let sequenciasPortaria: string[][] = [];
      let sequenciaAtual: string[] = [];
      let dataAnterior: Date | null = null;

      operacoesDoServidor.forEach(({ data_operacao }: any) => {
        const dataAtual = new Date(data_operacao);
      
        if (dataAnterior && dataAtual.getTime() - dataAnterior.getTime() > 24 * 60 * 60 * 1000) {
          // Nova sequência - finalizar a anterior
          if (sequenciaAtual.length > 0) {
            sequenciasPortaria.push([...sequenciaAtual]);
          }
          sequenciaAtual = [data_operacao];
        } else {
          sequenciaAtual.push(data_operacao);
        }
        
        dataAnterior = dataAtual;
      });

      // Finalizar última sequência
      if (sequenciaAtual.length > 0) {
        sequenciasPortaria.push([...sequenciaAtual]);
      }

      // Criar PORTARIA MOR para cada sequência
      sequenciasPortaria.forEach(sequencia => {
        const diasOperacao = sequencia.sort((a, b) => 
          new Date(a).getTime() - new Date(b).getTime()
        );
        
        // Calcular data do retorno (+1 dia APÓS a última operação)
        const ultimaDataOperacao = new Date(diasOperacao[diasOperacao.length - 1] + 'T00:00:00-03:00');
        const dataRetorno = new Date(ultimaDataOperacao.getTime() + 24 * 60 * 60 * 1000);
        
        // Calcular sequência (D+1, DD+1, DDD+1, etc.)
        const qtdDias = diasOperacao.length;
        const sequenciaStr = 'D'.repeat(qtdDias) + '+1';
        
        // Formatear período com timezone correto
        const dataInicioCorreta = new Date(diasOperacao[0] + 'T00:00:00-03:00');
        const periodo = `${dataInicioCorreta.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${dataRetorno.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        
        // Criar chave de agrupamento baseada na sequência e período
        const chaveAgrupamento = `${sequenciaStr}_${periodo}`;
        
        portarias.push({
          servidorId,
          nome: dados.nome,
          matricula: dados.matricula,
          diasOperacao,
          dataRetorno: dataRetorno.toISOString().split('T')[0],
          sequencia: sequenciaStr,
          periodo,
          chaveAgrupamento
        });
      });
    });

    // Agrupar PORTARIA MOR por chave de agrupamento (mesmo período + sequência)
    const grupos = portarias.reduce((acc, portaria) => {
      if (!acc[portaria.chaveAgrupamento]) {
        acc[portaria.chaveAgrupamento] = {
          periodo: portaria.periodo,
          sequencia: portaria.sequencia,
          servidores: []
        };
      }
      
      acc[portaria.chaveAgrupamento].servidores.push(portaria);
      return acc;
    }, {} as Record<string, { periodo: string; sequencia: string; servidores: any[] }>);

    // 🎯 DETERMINAR MODALIDADES DINAMICAMENTE
    const modalidadesOperacoes = [...new Set(operacoes.map(op => op.modalidade).filter(Boolean))];
    
    let tipoOperacao = 'OPERAÇÃO';
    if (modalidadesOperacoes.length === 1) {
      if (modalidadesOperacoes[0] === 'BLITZ') {
        tipoOperacao = 'OPERAÇÃO RADAR';
      } else if (modalidadesOperacoes[0] === 'BALANCA') {
        tipoOperacao = 'OPERAÇÃO PESAGEM';
      }
    } else if (modalidadesOperacoes.length === 2 && 
               modalidadesOperacoes.includes('BLITZ') && 
               modalidadesOperacoes.includes('BALANCA')) {
      tipoOperacao = 'OPERAÇÃO RADAR E PESAGEM';
    } else if (modalidadesOperacoes.length > 0) {
      // Fallback para casos não previstos
      const modalidadesTexto = modalidadesOperacoes.map(m => 
        m === 'BLITZ' ? 'RADAR' : m === 'BALANCA' ? 'PESAGEM' : m
      ).join(' E ');
      tipoOperacao = `OPERAÇÃO ${modalidadesTexto}`;
    }

    // Gerar texto do relatório no formato simplificado
    let relatorio = '';
    
    // Cabeçalho centralizado dinâmico
    relatorio += '========================================';
    relatorio += `            ${tipoOperacao}\n`;
    relatorio += `                ${periodoJanela.toUpperCase()}\n`;
    relatorio += '========================================\n\n';

    // Ordenar grupos por período (data de início)
    const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => {
      const dataA = new Date((a as any).periodo.split(' a ')[0].split('/').reverse().join('-'));
      const dataB = new Date((b as any).periodo.split(' a ')[0].split('/').reverse().join('-'));
      return dataA.getTime() - dataB.getTime();
    });

    gruposOrdenados.forEach(([chave, grupo]) => {
      // Extrair apenas as datas do período (remover ano se presente)
      const periodoLimpo = (grupo as any).periodo.replace(/\/\d{4}/g, '');
      relatorio += `DIAS: ${periodoLimpo}\n`;
      
      // Ordenar servidores por nome
      const servidoresOrdenados = (grupo as any).servidores.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      
      servidoresOrdenados.forEach((servidor: any, index: number) => {
        relatorio += `${index + 1}. ✓ ${servidor.nome}\n`;
        relatorio += `   Mat.: ${servidor.matricula}\n`;
      });
      
      relatorio += '\n';
    });

    return relatorio;
  };

  // Função para detectar se é dispositivo móvel
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const compartilharRelatorio = async () => {
    try {
      if (!janelaSelecionada) {
        mostrarAvisoElegante('erro', 'Erro', 'Selecione uma janela operacional primeiro');
        return;
      }

      if (operacoesPlanejadas.length === 0 || participacoesPlanejadas.length === 0) {
        mostrarAvisoElegante('erro', 'Erro', 'Nenhum dado disponível para gerar relatório');
        return;
      }

      setLoadingRelatorio(true);
      
      // 🎯 USAR OS MESMOS DADOS DA TABELA - Gerar relatório localmente
      const texto = gerarRelatorioLocal(operacoesPlanejadas, participacoesPlanejadas, janelaSelecionada);
      
      // Copiar para área de transferência
      await navigator.clipboard.writeText(texto);
      
      // Detectar dispositivo e usar protocolo apropriado
      const textoEncoded = encodeURIComponent(texto);
      let whatsappUrl: string;
      
      if (isMobileDevice()) {
        // Para dispositivos móveis, usar protocolo whatsapp:// para abrir o app nativo
        whatsappUrl = `whatsapp://send?text=${textoEncoded}`;
      } else {
        // Para desktop, usar WhatsApp Web
        whatsappUrl = `https://web.whatsapp.com/send?text=${textoEncoded}`;
      }
      
      // Abrir WhatsApp
      window.open(whatsappUrl, '_blank');
      
      const mensagem = isMobileDevice() 
        ? 'Relatório copiado e WhatsApp aberto! Cole o texto ou use o texto pré-preenchido.' 
        : 'Relatório copiado e WhatsApp Web aberto! Cole o texto ou use o texto pré-preenchido.';
      mostrarAvisoElegante('sucesso', 'Sucesso', mensagem);
    } catch (error) {
      console.error('❌ Erro ao compartilhar relatório:', error);
      mostrarAvisoElegante('erro', 'Erro', 'Erro ao gerar relatório para compartilhamento');
    } finally {
      setLoadingRelatorio(false);
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
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center min-w-0 flex-1">
              <Link 
                href="/supervisor" 
                className="flex items-center text-gray-600 hover:text-gray-900 flex-shrink-0"
              >
                ← Voltar
              </Link>
              <div className="ml-4 sm:ml-6 min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  🏛️ Gestão de Diretoria
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  Encaminhar operações e planilhas de diárias
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso Elegante */}
      {avisoElegante && (
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8 pt-4">
          <div className={`p-3 sm:p-4 rounded-md ${
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
              <div className="ml-3 min-w-0 flex-1">
                <h3 className={`text-sm font-medium ${
                  avisoElegante.tipo === 'sucesso' ? 'text-green-800' :
                  avisoElegante.tipo === 'erro' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {avisoElegante.titulo}
                </h3>
                <p className={`mt-1 text-sm break-words ${
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
      <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8 pt-4">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
            <button
              onClick={() => setAbaAtiva('operacoes')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                abaAtiva === 'operacoes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🗂️ Operações da Diretoria
            </button>
            <button
              onClick={() => setAbaAtiva('planilha')}
              className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
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
        <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8 py-6 overflow-x-hidden">
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
          <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8 pt-6 overflow-x-hidden">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">📋 Operações Planejadas</h2>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                    Visualize as operações planejadas por janela operacional
                  </p>
                </div>
                
                {/* Seletor de Janela e Botões de Ação */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 min-w-0">
                  <button
                    onClick={forcarAtualizacao}
                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200 flex items-center justify-center space-x-1.5 border border-gray-300 whitespace-nowrap flex-shrink-0"
                    title="Atualizar dados da PORTARIA MOR"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Atualizar</span>
                  </button>
                  
                  {janelaSelecionada && (
                    <button
                      onClick={() => compartilharRelatorio()}
                      disabled={loading || loadingJanelas || loadingRelatorio || !operacoesPlanejadas.length}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center justify-center space-x-1.5 whitespace-nowrap flex-shrink-0 shadow-sm ${
                        loading || loadingJanelas || loadingRelatorio || !operacoesPlanejadas.length
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md'
                      }`}
                      title={loading || loadingJanelas || loadingRelatorio || !operacoesPlanejadas.length 
                        ? 'Aguarde o carregamento dos dados para gerar o relatório' 
                        : 'Compartilhar relatório no WhatsApp'}
                    >
                      {loadingRelatorio ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current"></div>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                      )}
                      <span>WhatsApp</span>
                    </button>
                  )}
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap flex-shrink-0">
                      Janela Operacional:
                    </label>
                    
                    {loadingJanelas ? (
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 flex-shrink-0"></div>
                        <span className="text-xs sm:text-sm text-gray-500 truncate">Carregando janelas...</span>
                      </div>
                    ) : janelasDisponiveis.length > 0 ? (
                      <select
                        value={janelaSelecionada || ''}
                        onChange={(e) => setJanelaSelecionada(Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0 max-w-full"
                      >
                        <option value="">Selecione uma janela</option>
                        {janelasDisponiveis.map((janela) => (
                          <option key={janela.id} value={janela.id}>
                            #{janela.id} - {janela.titulo} ({janela.totalOperacoesPlanejadas} operações)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs sm:text-sm text-gray-500 italic truncate">
                        Nenhuma janela operacional ativa encontrada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabela de Operações Planejadas */}
              {janelaSelecionada ? (
                <div className="overflow-x-auto">
                  <TabelaOperacoesDiretoria 
                    key={`${janelaSelecionada}-${participacoesPlanejadas.length}-${Date.now()}`}
                    operacoes={operacoesPlanejadas}
                    participacoes={participacoesPlanejadas}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm break-words">Selecione uma janela operacional para visualizar as operações planejadas</p>
                </div>
              )}
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-8 py-8 overflow-x-hidden">

            {operacoes.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">📄</span>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma operação encontrada</h3>
                {/* Removidos: descrição e contêiner extra conforme solicitado */}
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