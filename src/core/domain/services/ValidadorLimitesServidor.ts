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
  tipoOperacao: 'PLANEJADA' | 'VOLUNTARIA' | 'BLITZ' | 'BALANCA';
  modalidade?: string;
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
      console.log('🔍 Validando limites para servidor:', dados.servidorId);

      // 1. Buscar parâmetros de limite
      const parametros = await this.parametrizacaoService.buscarParametrosLimite();
      
      // 2. Calcular atividades no período 10→09
      const atividadesPeriodo = await this.calcularAtividadesPeriodo10a09(
        dados.servidorId, 
        dados.dataOperacao
      );

      // 3. Calcular diárias no mês atual (se for operação que gera diárias)
      let diariasNoMes = 0;
      const geraraDiarias = this.operacaoGeraDiarias(dados.tipoOperacao);
      
      if (geraraDiarias) {
        diariasNoMes = await this.calcularDiariasNoMes(
          dados.servidorId, 
          dados.dataOperacao
        );
      }

      // 4. Verificar limites
      const limitesAtuais = {
        atividadesPeriodo10a09: atividadesPeriodo,
        diariasNoMes: diariasNoMes,
        limiteAtividades: parametros.limiteCicloFuncional,
        limiteDiarias: parametros.limiteMensalDiarias
      };

      // 5. Validar limite de atividades (sempre aplicado)
      if (atividadesPeriodo >= parametros.limiteCicloFuncional) {
        return {
          podeConfirmar: false,
          motivo: `Servidor atingiu limite de ${parametros.limiteCicloFuncional} atividades no período 10→09`,
          limitesAtuais
        };
      }

      // 6. Validar limite de diárias (só se for operação que gera diárias)
      if (geraraDiarias && diariasNoMes >= parametros.limiteMensalDiarias) {
        return {
          podeConfirmar: false,
          motivo: `Servidor atingiu limite de ${parametros.limiteMensalDiarias} diárias no mês`,
          limitesAtuais
        };
      }

      console.log('✅ Validação aprovada:', limitesAtuais);

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

      // Filtrar participações no período 10→09
      const participacoesPeriodo = (participacoes || []).filter(p => {
        if (!p.operacao?.data_operacao || !p.operacao?.ativa) return false;
        
        const dataOp = new Date(p.operacao.data_operacao);
        return dataOp >= dataInicio && dataOp <= dataFim;
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
    dataOperacao: string
  ): Promise<number> {
    try {
      const dataOp = new Date(dataOperacao);
      const ano = dataOp.getFullYear();
      const mes = dataOp.getMonth(); // 0-11
      
      // Período do mês civil (01→31)
      const dataInicio = new Date(ano, mes, 1);
      const dataFim = new Date(ano, mes + 1, 0); // último dia do mês

      // Buscar operações confirmadas no mês
      const { data: operacoes, error: errorOp } = await this.supabase
        .from('operacao')
        .select('id, data_operacao, modalidade, tipo, status')
        .eq('ativa', true)
        .eq('tipo', 'PLANEJADA')
        .gte('data_operacao', dataInicio.toISOString().split('T')[0])
        .lte('data_operacao', dataFim.toISOString().split('T')[0]);

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
      const operacoesMapeadas = (operacoes || []).map(op => ({
        id: op.id,
        data_operacao: op.data_operacao,
        modalidade: op.modalidade,
        tipo: op.tipo,
        status: op.status
      }));

      const participacoesMapeadas = (participacoes || [])
        .filter(p => operacoesMapeadas.some(op => op.id === p.operacao_id))
        .map(p => {
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

      // Usar calculadora existente
      const estatisticas = CalculadorDiariasServidor.calcularEstatisticasServidores(
        operacoesMapeadas,
        participacoesMapeadas
      );

      const estatisticasServidor = estatisticas.find(e => e.servidorId === servidorId);
      const totalDiarias = estatisticasServidor?.totalDiariasEquivalentes || 0;

      console.log(`📊 Servidor ${servidorId}: ${totalDiarias} diárias no mês`);
      
      return Math.floor(totalDiarias); // Arredondar para baixo

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