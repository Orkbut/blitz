import { CalculadorDiariasServidor } from '@/utils/calculadorDiariasServidor';
import { ParametrizacaoService } from '@/core/infrastructure/services/ParametrizacaoService';

interface ResultadoValidacao {
  podeConfirmar: boolean;
  motivo?: string;
  limitesAtuais: {
    atividadesPeriodo10a09: number;
    diariasNoMes: number;
    limiteAtividades: number;
    limiteDiarias: number;
  };
}

interface DadosValidacao {
  servidorId: number;
  dataOperacao: string;
  tipoOperacao: 'PLANEJADA' | 'VOLUNTARIA';
  modalidade?: 'BLITZ' | 'BALANCA';
}

export class ValidadorLimitesServidor {
  private parametrizacaoService: ParametrizacaoService;

  constructor(private supabase: any) {
    this.parametrizacaoService = ParametrizacaoService.getInstance();
  }

  /**
   * ✅ Valida se um servidor pode ter uma nova participação confirmada
   * considerando os limites de atividades (período 10→09) e diárias (mês civil)
   */
  async validarLimites(dados: DadosValidacao): Promise<ResultadoValidacao> {
    try {
      // 1. Buscar parâmetros de limite
      const parametros = await this.parametrizacaoService.buscarParametrosLimite();
      const LIM_ATIV = parametros.limiteCicloFuncional ?? 15;
      const LIM_DIARIAS = parametros.limiteMensalDiarias ?? 15;
      
      // 2. Calcular atividades no período 10→09 (apenas BLITZ/BALANCA, planejada/voluntária)
      const atividadesPeriodoBase = await this.calcularAtividadesPeriodo10a09(
        dados.servidorId, 
        dados.dataOperacao
      );

      // Projeção: incluir esta aprovação na contagem do ciclo
      const atividadesComProjecao = atividadesPeriodoBase + 1;

      // 3. Calcular diárias no mês atual (se for operação que gera diárias)
      let diariasProjetadasNoMes = 0;
      const geraDiarias = this.operacaoGeraDiarias(dados.tipoOperacao);
      
      if (geraDiarias) {
        // Projeta a inclusão do dia atual no cálculo das sequências (meia diária respeitando retorno no mês)
        diariasProjetadasNoMes = await this.calcularDiariasNoMes(
          dados.servidorId, 
          dados.dataOperacao,
          dados.dataOperacao // incluir data atual como participação adicional
        );
      }

      // 4. Montar limites atuais (já com projeção)
      const limitesAtuais = {
        atividadesPeriodo10a09: atividadesComProjecao,
        diariasNoMes: diariasProjetadasNoMes,
        limiteAtividades: LIM_ATIV,
        limiteDiarias: LIM_DIARIAS
      };

      // 5. Validar limite de atividades (sempre aplicado)
      if (atividadesComProjecao > LIM_ATIV) {
        return {
          podeConfirmar: false,
          motivo: `Servidor excederá o limite de ${LIM_ATIV} operações no período 10→09 (${atividadesComProjecao}/${LIM_ATIV}).`,
          limitesAtuais
        };
      }

      // 6. Validar limite de diárias (só se for operação que gera diárias)
      if (geraDiarias) {
        const excedeLimitePadrao = diariasProjetadasNoMes > LIM_DIARIAS;
        const chegaQuinzeMeia = diariasProjetadasNoMes >= 15.5; // regra explícita
        if (excedeLimitePadrao || chegaQuinzeMeia) {
          const regra = chegaQuinzeMeia ? ' (atinge 15,5 no mês)' : '';
          return {
            podeConfirmar: false,
            motivo: `Servidor excederá o limite de ${LIM_DIARIAS} diárias no mês${regra} (${diariasProjetadasNoMes.toFixed(1)}/${LIM_DIARIAS}).`,
            limitesAtuais
          };
        }
      }

      return {
        podeConfirmar: true,
        limitesAtuais
      };

    } catch (error) {
      console.error('❌ Erro na validação de limites:', error);
      
      return {
        podeConfirmar: false,
        motivo: 'Erro interno na validação de limites',
        limitesAtuais: {
          atividadesPeriodo10a09: 0,
          diariasNoMes: 0,
          limiteAtividades: 15,
          limiteDiarias: 15
        }
      };
    }
  }

  /**
   * ✅ Calcula total de atividades do servidor no período 10→09
   */
  private async calcularAtividadesPeriodo10a09(
    servidorId: number, 
    dataOperacao: string
  ): Promise<number> {
    try {
      // Determinar período 10→09 baseado na data da operação
      const dataOp = new Date(dataOperacao);
      const ano = dataOp.getFullYear();
      const mes = dataOp.getMonth(); // 0-11
      
      let dataInicio: Date;
      let dataFim: Date;

      if (dataOp.getDate() >= 10) {
        // Operação após dia 10: período atual (10 deste mês → 09 do próximo)
        dataInicio = new Date(ano, mes, 10);
        dataFim = new Date(ano, mes + 1, 9);
      } else {
        // Operação antes do dia 10: período anterior (10 do mês anterior → 09 deste mês)
        dataInicio = new Date(ano, mes - 1, 10);
        dataFim = new Date(ano, mes, 9);
      }

      // Buscar todas as participações ativas no período
      const { data: participacoes, error } = await this.supabase
        .from('participacao')
        .select(`
          id,
          operacao_id,
          operacao:operacao_id(
            data_operacao,
            tipo,
            modalidade,
            ativa
          )
        `)
        .eq('membro_id', servidorId)
        .eq('ativa', true)
        .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP']);

      if (error) throw error;

      // Filtrar participações no período 10→09 e por modalidade/tipo válidos
      const participacoesPeriodo = (participacoes || []).filter((p: any) => {
        if (!p.operacao?.data_operacao || !p.operacao?.ativa) return false;
        const d = new Date(p.operacao.data_operacao);
        const inWindow = d >= dataInicio && d <= dataFim;
        const modalidadeOk = ['BLITZ', 'BALANCA'].includes(p.operacao.modalidade);
        const tipoOk = ['PLANEJADA', 'VOLUNTARIA'].includes(p.operacao.tipo);
        return inWindow && modalidadeOk && tipoOk;
      });

      console.log(`📊 Servidor ${servidorId}: ${participacoesPeriodo.length} atividades no período 10→09`);
      
      return participacoesPeriodo.length;

    } catch (error) {
      console.error('❌ Erro ao calcular atividades período 10→09:', error);
      return 0;
    }
  }

  /**
   * ✅ Calcula total de diárias do servidor no mês civil atual
   */
  private async calcularDiariasNoMes(
    servidorId: number, 
    dataOperacao: string,
    incluirDiaExtra?: string | null
  ): Promise<number> {
    try {
      const dataOp = new Date(dataOperacao);
      const ano = dataOp.getFullYear();
      const mes = dataOp.getMonth(); // 0-11
      
      // Período do mês civil (01→31)
      const dataInicio = new Date(ano, mes, 1);
      const dataFim = new Date(ano, mes + 1, 0); // último dia do mês
      const inicioStr = dataInicio.toISOString().split('T')[0];
      const fimStr = dataFim.toISOString().split('T')[0];

      // Buscar operações confirmadas no mês (apenas PLANEJADA)
      const { data: operacoes, error: errorOp } = await this.supabase
        .from('operacao')
        .select('id, data_operacao, modalidade, tipo, status')
        .eq('ativa', true)
        .eq('tipo', 'PLANEJADA')
        .gte('data_operacao', inicioStr)
        .lte('data_operacao', fimStr);

      if (errorOp) throw errorOp;

      // Buscar participações confirmadas do servidor
      const { data: participacoes, error: errorPart } = await this.supabase
        .from('participacao')
        .select('membro_id, operacao_id, data_participacao, estado_visual, ativa')
        .eq('membro_id', servidorId)
        .eq('ativa', true)
        .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP']);

      if (errorPart) throw errorPart;

      // Mapear dados para a calculadora
      const operacoesMapeadas = (operacoes || []).map((op: any) => ({
        id: op.id,
        data_operacao: op.data_operacao,
        modalidade: op.modalidade,
        tipo: op.tipo,
        status: op.status
      }));

      let participacoesMapeadas = (participacoes || [])
        .filter((p: any) => operacoesMapeadas.some(op => op.id === p.operacao_id))
        .map((p: any) => {
          const operacao = operacoesMapeadas.find(op => op.id === p.operacao_id);
          return {
            membro_id: p.membro_id,
            nome: 'Servidor',
            matricula: '',
            operacao_id: p.operacao_id,
            data_operacao: operacao?.data_operacao || p.data_participacao,
            estado_visual: p.estado_visual,
            ativa: p.ativa
          };
        });

      // Projeção: incluir o dia extra (operação atual) se aplicável
      if (incluirDiaExtra) {
        const opExtra = operacoesMapeadas.find(op => op.data_operacao === incluirDiaExtra);
        if (opExtra) {
          participacoesMapeadas.push({
            membro_id: servidorId,
            nome: 'Servidor',
            matricula: '',
            operacao_id: opExtra.id,
            data_operacao: opExtra.data_operacao,
            estado_visual: 'CONFIRMADO',
            ativa: true
          });
        }
      }

      // Deduplicar por dia (1 por data)
      const visto = new Set<string>();
      const participacoesUnicasPorDia = participacoesMapeadas.filter(p => {
        const d = p.data_operacao;
        if (!d) return false;
        if (visto.has(d)) return false;
        visto.add(d);
        return true;
      });

      // Usar calculadora existente com recorte do mês civil para considerar a meia do retorno somente se cair dentro do mês
      const estatisticas = CalculadorDiariasServidor.calcularEstatisticasServidores(
        operacoesMapeadas,
        participacoesUnicasPorDia,
        { filtroDataInicio: inicioStr, filtroDataFim: fimStr }
      );

      const estatisticasServidor = estatisticas.find(e => e.servidorId === servidorId);
      const totalDiarias = estatisticasServidor?.totalDiariasEquivalentes || 0;

      console.log(`📊 Servidor ${servidorId}: ${totalDiarias} diárias (projetadas) no mês`);
      
      return Number(totalDiarias.toFixed(1));

    } catch (error) {
      console.error('❌ Erro ao calcular diárias no mês:', error);
      return 0;
    }
  }

  /**
   * ✅ Verifica se o tipo de operação gera diárias
   */
  private operacaoGeraDiarias(tipoOperacao: string): boolean {
    // Operações voluntárias não geram diárias
    return tipoOperacao !== 'VOLUNTARIA';
  }
}