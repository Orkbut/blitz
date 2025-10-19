import { ValidadorParticipacao as IValidadorParticipacao } from './EuVouOrchestrator';
import { CicloFuncional } from '../value-objects/CicloFuncional';
import { ParametrizacaoService } from '../../infrastructure/services/ParametrizacaoService';

export interface ValidadorDependencies {
  participacaoRepository: any; // Será tipado depois
  parametrizacaoService: ParametrizacaoService;
}

export interface ValidacaoResult {
  podeParticipar: boolean;
  motivos: string[];
}

export class ValidadorParticipacao implements IValidadorParticipacao {
  
  constructor(private dependencies: ValidadorDependencies) {}

  async validar(membroId: number, operacaoId: number): Promise<ValidacaoResult> {
    try {
      // Buscar dados da operação para obter a data
      const supabase = this.dependencies.parametrizacaoService.getSupabaseClient();
      const { data: operacao, error } = await supabase
        .from('operacao')
        .select('data_operacao, regional_id')
        .eq('id', operacaoId)
        .single();

      if (error || !operacao) {
        return {
          podeParticipar: false,
          motivos: ['Operação não encontrada']
        };
      }

      const dataOperacao = new Date(operacao.data_operacao);
      const regionalId = operacao.regional_id || 1;

      // Executar validação completa
      const resultado = await this.validarParticipacaoCompleta(
        membroId,
        operacaoId,
        dataOperacao,
        regionalId
      );

      return {
        podeParticipar: resultado.valida,
        motivos: resultado.motivos
      };

    } catch (error) {
      console.error('Erro na validação geral:', error);
      return {
        podeParticipar: false,
        motivos: ['Erro interno do sistema']
      };
    }
  }

  async validarCicloFuncional(membroId: number, dataOperacao: Date): Promise<boolean> {
    try {
      // Obter ciclo funcional atual baseado na data da operação
      const cicloFuncional = CicloFuncional.createFromDate(dataOperacao);
      
      // Verificar se a data da operação está dentro do ciclo
      if (!cicloFuncional.contemData(dataOperacao)) {
        return false;
      }

      // Obter limite de participações no ciclo (parâmetro configurável)
      const limiteCiclo = await this.dependencies.parametrizacaoService.obterLimiteCicloFuncional();
      
      // Buscar participações ativas do membro no período do ciclo
      const participacoesNoCiclo = await this.contarParticipacoesCiclo(
        membroId, 
        cicloFuncional.dataInicio, 
        cicloFuncional.dataFim
      );

      // Validar se não excede o limite (padrão: 15 atividades)
      return participacoesNoCiclo < limiteCiclo;
      
    } catch (error) {
      console.error('Erro ao validar ciclo funcional:', error);
      return false;
    }
  }

  async validarLimiteMensal(membroId: number, mes: number, ano: number): Promise<boolean> {
    try {
      // Obter limite mensal de diárias (parâmetro configurável)
      const limiteMensal = await this.dependencies.parametrizacaoService.obterParametro<number>('LIMITE_MENSAL_DIARIAS');
      
      // Calcular período do mês
      const dataInicio = new Date(ano, mes - 1, 1);
      const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);

      // Contar participações no mês
      const participacoesMensais = await this.contarParticipacoesCiclo(
        membroId, 
        dataInicio, 
        dataFim
      );

      // Validar se não excede o limite mensal (padrão: 15 diárias)
      return participacoesMensais < limiteMensal;
      
    } catch (error) {
      console.error('Erro ao validar limite mensal:', error);
      return false;
    }
  }

  async validarExclusividadeDiaria(membroId: number, dataOperacao: Date): Promise<boolean> {
    try {
      // Normalizar data para comparação (apenas dia/mês/ano)
      const dataComparacao = new Date(dataOperacao);
      dataComparacao.setHours(0, 0, 0, 0);
      
      const dataInicio = new Date(dataComparacao);
      const dataFim = new Date(dataComparacao);
      dataFim.setHours(23, 59, 59, 999);

      // Verificar se já possui participação confirmada na data
      const participacoesDia = await this.contarParticipacoesCiclo(
        membroId, 
        dataInicio, 
        dataFim
      );

      // Regra: máximo 1 operação por dia
      return participacoesDia === 0;
      
    } catch (error) {
      console.error('Erro ao validar exclusividade diária:', error);
      return false;
    }
  }

  async validarVagasDisponiveis(operacaoId: number): Promise<boolean> {
    try {
      // Buscar dados da operação via repository (será implementado)
      const operacao = await this.buscarOperacao(operacaoId);
      if (!operacao) {
        return false;
      }

      // Contar participações confirmadas na operação
      const participacoesConfirmadas = await this.contarParticipacaoOperacao(operacaoId);
      
      // Calcular total de vagas (diárias + meias diárias)
      const totalVagas = operacao.limiteDiarias + operacao.limiteMeiasDiarias;
      
      // Verificar se há vagas disponíveis
      return participacoesConfirmadas < totalVagas;
      
    } catch (error) {
      console.error('Erro ao validar vagas disponíveis:', error);
      return false;
    }
  }

  // Validações adicionais específicas do domínio
  async validarPrazoMinimo(dataOperacao: Date): Promise<boolean> {
    try {
      const prazoMinimo = await this.dependencies.parametrizacaoService.obterPrazoMinAgendamento();
      
      const hoje = new Date();
      const diffTime = dataOperacao.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays >= prazoMinimo;
      
    } catch (error) {
      console.error('Erro ao validar prazo mínimo:', error);
      return false;
    }
  }



  // Métodos auxiliares privados
  private async contarParticipacoesCiclo(
    membroId: number, 
    dataInicio: Date, 
    dataFim: Date
  ): Promise<number> {
    try {
      // Conectar ao Supabase para buscar participações reais
      const supabase = this.dependencies.parametrizacaoService.getSupabaseClient();
      
      const { data, error } = await supabase
        .from('participacao')
        .select(`
          id,
          operacao:operacao_id (
            data_operacao
          )
        `)
        .eq('membro_id', membroId)
        .eq('ativa', true)
        .in('estado_visual', ['CONFIRMADO', 'NA_FILA']);

      if (error) {
        console.error('Erro ao contar participações do ciclo:', error);
        return 0;
      }

      if (!data) return 0;

      // Filtrar participações dentro do período
      const participacoesPeriodo = data.filter(p => {
        if (!p.operacao?.data_operacao) return false;
        
        const dataOp = new Date(p.operacao.data_operacao);
        return dataOp >= dataInicio && dataOp <= dataFim;
      });

      return participacoesPeriodo.length;
      
    } catch (error) {
      console.error('Erro ao contar participações do ciclo:', error);
      return 0;
    }
  }

  private async contarParticipacaoOperacao(operacaoId: number): Promise<number> {
    try {
      const supabase = this.dependencies.parametrizacaoService.getSupabaseClient();
      
      const { data, error } = await supabase
        .from('participacao')
        .select('id')
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .in('estado_visual', ['CONFIRMADO']);

      if (error) {
        console.error('Erro ao contar participação da operação:', error);
        return 0;
      }

      return data?.length || 0;
      
    } catch (error) {
      console.error('Erro ao contar participação da operação:', error);
      return 0;
    }
  }

  private async buscarOperacao(operacaoId: number): Promise<any> {
    try {
      const supabase = this.dependencies.parametrizacaoService.getSupabaseClient();
      
      const { data, error } = await supabase
        .from('operacao')
        .select('id, limite_diarias, limite_meias_diarias')
        .eq('id', operacaoId)
        .single();

      if (error || !data) {
        console.error('Erro ao buscar operação:', error);
        return {
          limiteDiarias: 10,
          limiteMeiasDiarias: 5
        };
      }

      return {
        limiteDiarias: data.limite_diarias || 10,
        limiteMeiasDiarias: data.limite_meias_diarias || 5
      };
      
    } catch (error) {
      console.error('Erro ao buscar operação:', error);
      return {
        limiteDiarias: 10,
        limiteMeiasDiarias: 5
      };
    }
  }



  // Método utilitário para validação completa
  async validarParticipacaoCompleta(
    membroId: number, 
    operacaoId: number, 
    dataOperacao: Date,
    regionalId: number
  ): Promise<{
    valida: boolean;
    motivos: string[];
  }> {
    const motivos: string[] = [];

    // Executar todas as validações
    const [
      cicloValido,
      limiteValido,
      exclusividadeValida,
      vagasDisponiveis,
      prazoValido
    ] = await Promise.all([
      this.validarCicloFuncional(membroId, dataOperacao),
      this.validarLimiteMensal(membroId, dataOperacao.getMonth() + 1, dataOperacao.getFullYear()),
      this.validarExclusividadeDiaria(membroId, dataOperacao),
      this.validarVagasDisponiveis(operacaoId),
      this.validarPrazoMinimo(dataOperacao)
    ]);

    if (!cicloValido) {
      motivos.push('Limite de 15 atividades no ciclo funcional atingido');
    }

    if (!limiteValido) {
      motivos.push('Limite mensal de diárias atingido');
    }

    if (!exclusividadeValida) {
      motivos.push('Já possui operação confirmada nesta data');
    }

    if (!vagasDisponiveis) {
      motivos.push('Não há vagas disponíveis na operação');
    }

    if (!prazoValido) {
      motivos.push('Operação deve ser agendada com antecedência mínima');
    }

    return {
      valida: motivos.length === 0,
      motivos
    };
  }
} 