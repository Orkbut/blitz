/**
 * Calculadora de Diárias por Servidor
 * 
 * Este utilitário replica a lógica presente em TabelaOperacoesDiretoria.tsx
 * para calcular quantas diárias (completas e meias) cada servidor acumulou
 * baseado nas participações confirmadas em operações.
 */

interface ParticipacaoServidor {
  membro_id: number;
  servidor_id?: number;
  servidor_nome?: string;
  nome?: string;
  matricula?: string;
  operacao_id: number;
  data_operacao: string;
  estado_visual: string;
  ativa: boolean;
  tipo_participacao?: 'DIARIA_COMPLETA' | 'MEIA_DIARIA';
}

interface OperacaoData {
  id: number;
  data_operacao?: string;
  dataOperacao?: string;
  modalidade: string;
  tipo: string;
  status: string;
}

interface EstatisticasServidor {
  servidorId: number;
  nome: string;
  matricula: string;
  totalDiariasCompletas: number;
  totalMeiasDiarias: number;
  totalDiariasEquivalentes: number; // Soma considerando 2 meias = 1 completa
  participacoesConfirmadas: number;
  sequenciasPortaria: SequenciaPortaria[];
}

interface SequenciaPortaria {
  diasOperacao: string[];
  dataInicio: string;
  dataRetorno: string;
  sequencia: string; // D+1, DD+1, DDD+1, etc.
  periodo: string;
  valorDiarias: number; // Quantas diárias esta sequência vale
}

export class CalculadorDiariasServidor {
  
  /**
   * Calcula as estatísticas de diárias para todos os servidores
   * baseado nas operações e participações fornecidas
   */
  static calcularEstatisticasServidores(
    operacoes: OperacaoData[],
    participacoes: ParticipacaoServidor[],
    options?: { filtroDataInicio?: string; filtroDataFim?: string }
  ): EstatisticasServidor[] {
    
    if (!operacoes || operacoes.length === 0 || !participacoes || participacoes.length === 0) {
      return [];
    }

    // 🚨 FILTRAR RIGOROSAMENTE - APENAS participações ATIVAS E CONFIRMADAS
    const participacoesConfirmadas = participacoes.filter(p => {
      const isAtiva = p.ativa === true;
      const isConfirmada = ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual);
      const hasOperacao = p.operacao_id && p.data_operacao;
      
      return isAtiva && isConfirmada && hasOperacao;
    });

    if (participacoesConfirmadas.length === 0) {
      return [];
    }

    // Agrupar participações por servidor
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
    }, {} as Record<number, { nome: string; matricula: string; participacoes: ParticipacaoServidor[] }>);



    // Calcular estatísticas para cada servidor
    const estatisticas: EstatisticasServidor[] = [];

    Object.entries(participacoesPorServidor).forEach(([servidorIdStr, dados]) => {
      const servidorId = Number(servidorIdStr);
      
      // Buscar operações deste servidor com datas corretas
      const operacoesDoServidor = dados.participacoes.map(p => {
        const operacao = operacoes.find(op => op.id === p.operacao_id);
        return {
          ...p,
          data_operacao: operacao?.data_operacao || operacao?.dataOperacao || p.data_operacao,
          operacao
        };
      }).filter(p => p.data_operacao);
      
      // Ordenar por data
      operacoesDoServidor.sort((a, b) => 
        new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime()
      );

      // Calcular sequências consecutivas para PORTARIA MOR (sequência completa)
      const sequenciasPortariaCompleta = this.calcularSequenciasPortaria(operacoesDoServidor);

      // Aplicar filtro de período APENAS para exibição e totais, preservando contexto da sequência
      const filtroInicio = options?.filtroDataInicio ? new Date(options.filtroDataInicio + 'T00:00:00-03:00') : null;
      const filtroFim = options?.filtroDataFim ? new Date(options.filtroDataFim + 'T23:59:59-03:00') : null;

      const sequenciasPortaria = (filtroInicio || filtroFim)
        ? aplicarFiltroSequencias(sequenciasPortariaCompleta, filtroInicio, filtroFim)
        : sequenciasPortariaCompleta;

      // ✅ LÓGICA CORRETA: Calcular totais baseado nas sequências filtradas (quando houver filtro)
      let totalDiariasCompletas = 0;
      let totalMeiasDiarias = 0;
      
      sequenciasPortaria.forEach(sequencia => {
        // Diárias completas = quantidade de dias NA JANELA (após filtro) na sequência
        totalDiariasCompletas += sequencia.diasOperacao.length;
        
        // Meia diária = 1 por sequência somente quando a data de retorno REAL está dentro do filtro
        if (sequencia.sequencia.includes('+ M')) {
          totalMeiasDiarias += 1; // Cada +1 conta como 1 meia diária (0.5)
        }
      });

      // Total de diárias = diárias completas + (meias diárias / 2)
      const totalDiariasEquivalentes = totalDiariasCompletas + (totalMeiasDiarias * 0.5);

      // Participações no período: contar apenas participações cujas datas caem dentro do filtro quando ativo
      let participacoesNoPeriodo = operacoesDoServidor.length;
      if (filtroInicio || filtroFim) {
        participacoesNoPeriodo = operacoesDoServidor.filter(p => {
          const d = new Date(p.data_operacao + 'T00:00:00-03:00');
          const afterStart = filtroInicio ? d.getTime() >= filtroInicio.getTime() : true;
          const beforeEnd = filtroFim ? d.getTime() <= filtroFim.getTime() : true;
          return afterStart && beforeEnd;
        }).length;
      }

      estatisticas.push({
        servidorId,
        nome: dados.nome,
        matricula: dados.matricula,
        totalDiariasCompletas,
        totalMeiasDiarias,
        totalDiariasEquivalentes,
        participacoesConfirmadas: participacoesNoPeriodo,
        sequenciasPortaria
      });
    });

    // Ordenar por total de diárias (maior para menor)
    estatisticas.sort((a, b) => b.totalDiariasEquivalentes - a.totalDiariasEquivalentes);

    return estatisticas;
  }

  /**
   * Calcula as sequências consecutivas de operações para formar PORTARIA MOR
   * Replica a lógica exata de TabelaOperacoesDiretoria.tsx
   */
  private static calcularSequenciasPortaria(
    operacoesDoServidor: any[]
  ): SequenciaPortaria[] {
    
    let sequenciasPortaria: string[][] = [];
    let sequenciaAtual: string[] = [];
    let dataAnterior: Date | null = null;

    operacoesDoServidor.forEach(({ data_operacao }) => {
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

    // Converter para formato de SequenciaPortaria
    const sequenciasFormatadas: SequenciaPortaria[] = [];

    sequenciasPortaria.forEach(sequencia => {
      const diasOperacao = sequencia.sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
      );
      
      // Calcular data do retorno (+1 dia APÓS a última operação)
      const ultimaDataOperacao = new Date(diasOperacao[diasOperacao.length - 1] + 'T00:00:00-03:00');
      const dataRetorno = new Date(ultimaDataOperacao.getTime() + 24 * 60 * 60 * 1000);
      
      // Calcular sequência (D+1, DD+1, DDD+1, etc.)
      const qtdDias = diasOperacao.length;
      const sequenciaStr = 'D'.repeat(qtdDias) + '+ M';
      
      // Formatear período
      const dataInicioCorreta = new Date(diasOperacao[0] + 'T00:00:00-03:00');
      const periodo = `${dataInicioCorreta.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${dataRetorno.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
      
      sequenciasFormatadas.push({
        diasOperacao,
        dataInicio: dataInicioCorreta.toISOString().split('T')[0],
        dataRetorno: dataRetorno.toISOString().split('T')[0],
        sequencia: sequenciaStr,
        periodo,
        valorDiarias: qtdDias + 0.5 // D = qtdDias (diárias inteiras) + 0.5 (+1 meia diária do retorno)
      });
    });

    return sequenciasFormatadas;
  }

  /**
   * Gera um relatório resumido das estatísticas
   */
  static gerarRelatorioResumo(estatisticas: EstatisticasServidor[]): string {
    if (estatisticas.length === 0) {
      return 'Nenhum servidor encontrado com participações confirmadas.';
    }

    let relatorio = '📊 RELATÓRIO DE DIÁRIAS POR SERVIDOR\n';
    relatorio += '=' .repeat(60) + '\n\n';

    estatisticas.forEach((servidor, index) => {
      relatorio += `${index + 1}. ${servidor.nome} (${servidor.matricula})\n`;
      relatorio += `   • Diárias completas: ${servidor.totalDiariasCompletas}\n`;
      relatorio += `   • Meias diárias: ${servidor.totalMeiasDiarias}\n`;
      relatorio += `   • Total equivalente: ${servidor.totalDiariasEquivalentes.toFixed(1)} diárias\n`;
      relatorio += `   • Participações: ${servidor.participacoesConfirmadas}\n`;
      relatorio += `   • Sequências de portaria: ${servidor.sequenciasPortaria.length}\n`;
      
      if (servidor.sequenciasPortaria.length > 0) {
        relatorio += `   • Períodos:\n`;
        servidor.sequenciasPortaria.forEach(seq => {
          relatorio += `     - ${seq.periodo} (${seq.sequencia})\n`;
        });
      }
      
      relatorio += '\n';
    });

    // Estatísticas gerais
    const totalServidores = estatisticas.length;
    const totalDiariasCompletas = estatisticas.reduce((sum, s) => sum + s.totalDiariasCompletas, 0);
    const totalMeiasDiarias = estatisticas.reduce((sum, s) => sum + s.totalMeiasDiarias, 0);
    const totalEquivalente = estatisticas.reduce((sum, s) => sum + s.totalDiariasEquivalentes, 0);

    relatorio += '📈 RESUMO GERAL\n';
    relatorio += '-'.repeat(30) + '\n';
    relatorio += `Total de servidores: ${totalServidores}\n`;
    relatorio += `Total de diárias completas: ${totalDiariasCompletas}\n`;
    relatorio += `Total de meias diárias: ${totalMeiasDiarias}\n`;
    relatorio += `Total equivalente: ${totalEquivalente.toFixed(1)} diárias\n`;

    return relatorio;
  }

  /**
   * Busca estatísticas de um servidor específico
   */
  static obterEstatisticasServidor(
    servidorId: number,
    estatisticas: EstatisticasServidor[]
  ): EstatisticasServidor | null {
    return estatisticas.find(e => e.servidorId === servidorId) || null;
  }
} 


/**
 * Aplica recorte de período às sequências completas preservando o contexto do +1
 */
function aplicarFiltroSequencias(
  sequencias: SequenciaPortaria[],
  filtroInicio: Date | null,
  filtroFim: Date | null
): SequenciaPortaria[] {
  const dentro = (dStr: string) => {
    const d = new Date(dStr + 'T00:00:00-03:00');
    const afterStart = filtroInicio ? d.getTime() >= filtroInicio.getTime() : true;
    const beforeEnd = filtroFim ? d.getTime() <= filtroFim.getTime() : true;
    return afterStart && beforeEnd;
  };

  const resultado: SequenciaPortaria[] = [];

  for (const seq of sequencias) {
    const diasTrim = seq.diasOperacao.filter(dentro);

    // Incluir meia diária (+1) somente se a dataRetorno REAL estiver dentro do período
    const retornoDentro = seq.dataRetorno && dentro(seq.dataRetorno);

    // Se nada do período toca a sequência e o retorno não está dentro, pular
    if (diasTrim.length === 0 && !retornoDentro) continue;

    const qtdDias = diasTrim.length;
    const seqStr = 'D'.repeat(qtdDias) + (retornoDentro ? '+ M' : '');

    // Determinar datas para exibição
    const inicioExib = diasTrim.length > 0 ? diasTrim[0] : seq.dataInicio; // fallback
    const fimExib = retornoDentro ? seq.dataRetorno : (diasTrim.length > 0 ? diasTrim[diasTrim.length - 1] : seq.dataRetorno);

    // Período formatado
    const di = new Date(inicioExib + 'T00:00:00-03:00');
    const df = new Date(fimExib + 'T00:00:00-03:00');
    const periodo = `${di.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${df.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    resultado.push({
      diasOperacao: diasTrim,
      dataInicio: inicioExib,
      dataRetorno: fimExib,
      sequencia: seqStr,
      periodo,
      valorDiarias: qtdDias + (retornoDentro ? 0.5 : 0)
    });
  }

  return resultado;
}
