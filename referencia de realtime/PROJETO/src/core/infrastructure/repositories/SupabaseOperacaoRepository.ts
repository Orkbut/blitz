import { supabase } from '../database/supabase';
import { IOperacaoRepository } from '../../application/ports/repositories/IOperacaoRepository';
import { Operacao, OperacaoProps } from '../../domain/entities/Operacao';

export class SupabaseOperacaoRepository implements IOperacaoRepository {

  async buscarPorId(id: number): Promise<Operacao | null> {
    const { data, error } = await supabase
      .from('operacao')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async buscarPorRegional(regionalId: number): Promise<Operacao[]> {
    const { data, error } = await supabase
      .from('operacao')
      .select('*')
      .eq('regional_id', regionalId)
      .eq('ativa', true)
      .order('data_operacao', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async buscarPorData(dataOperacao: Date): Promise<Operacao[]> {
    const dataFormatada = dataOperacao.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('operacao')
      .select('*')
      .eq('data_operacao', dataFormatada)
      .eq('ativa', true)
      .order('id', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async buscarPorPeriodo(dataInicio: Date, dataFim: Date): Promise<Operacao[]> {
    const inicioFormatado = dataInicio.toISOString().split('T')[0];
    const fimFormatado = dataFim.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('operacao')
      .select('*')
      .gte('data_operacao', inicioFormatado)
      .lte('data_operacao', fimFormatado)
      .eq('ativa', true)
      .order('data_operacao', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async buscarAtivas(): Promise<Operacao[]> {
    const { data, error } = await supabase
      .from('operacao')
      .select('*')
      .eq('ativa', true)
      .order('data_operacao', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async salvar(operacao: Operacao): Promise<Operacao> {
    const props = operacao.toProps();
    
    const { data, error } = await supabase
      .from('operacao')
      .insert({
        data_operacao: props.dataOperacao.toISOString().split('T')[0],
        modalidade: props.modalidade,
        tipo: props.tipo,
        regional_id: props.regionalId,
        supervisor_id: props.supervisorId,
        limite_diarias: props.limiteDiarias,
        limite_meias_diarias: props.limiteMeiasDiarias,
        observacoes: props.observacoes,
        ativa: props.ativa,
        criada_em: props.criadaEm.toISOString(),
        atualizada_em: props.atualizadaEm.toISOString()
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao salvar operação: ${error?.message}`);
    }

    return this.mapToEntity(data);
  }

  async atualizar(operacao: Operacao): Promise<void> {
    const props = operacao.toProps();

    const { error } = await supabase
      .from('operacao')
      .update({
        data_operacao: props.dataOperacao.toISOString().split('T')[0],
        modalidade: props.modalidade,
        tipo: props.tipo,
        regional_id: props.regionalId,
        supervisor_id: props.supervisorId,
        limite_diarias: props.limiteDiarias,
        limite_meias_diarias: props.limiteMeiasDiarias,
        observacoes: props.observacoes,
        ativa: props.ativa,
        atualizada_em: new Date().toISOString()
      })
      .eq('id', props.id);

    if (error) {
      throw new Error(`Erro ao atualizar operação: ${error.message}`);
    }
  }

  async deletar(id: number): Promise<void> {
    const { error } = await supabase
      .from('operacao')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar operação: ${error.message}`);
    }
  }

  async contarParticipacoes(operacaoId: number): Promise<number> {
    const { count, error } = await supabase
      .from('participacao')
      .select('*', { count: 'exact', head: true })
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .in('estado_visual', ['CONFIRMADO', 'NA_FILA']);

    if (error) {
      throw new Error(`Erro ao contar participações: ${error.message}`);
    }

    return count || 0;
  }

  async verificarVagasDisponiveis(operacaoId: number): Promise<boolean> {
    // Buscar dados da operação
    const operacao = await this.buscarPorId(operacaoId);
    if (!operacao) {
      return false;
    }

    // Contar participações confirmadas
    const participacoesConfirmadas = await this.contarParticipacoes(operacaoId);
    
    // Calcular total de vagas
    const totalVagas = operacao.limiteDiarias + operacao.limiteMeiasDiarias;
    
    return participacoesConfirmadas < totalVagas;
  }

  async buscarOperacoesDisponiveisParaMembro(
    membroId: number, 
    dataInicio: Date, 
    dataFim: Date
  ): Promise<Operacao[]> {
    // Buscar operações no período
    const operacoes = await this.buscarPorPeriodo(dataInicio, dataFim);
    
    // Filtrar apenas as que têm vagas disponíveis
    const operacoesDisponiveis: Operacao[] = [];
    
    for (const operacao of operacoes) {
      const temVagas = await this.verificarVagasDisponiveis(operacao.id);
      if (temVagas) {
        operacoesDisponiveis.push(operacao);
      }
    }

    return operacoesDisponiveis;
  }

  async obterEstatisticasPorRegional(
    regionalId: number, 
    mes: number, 
    ano: number
  ): Promise<{
    totalOperacoes: number;
    totalParticipacoes: number;
    taxaOcupacao: number;
  }> {
    // Calcular período do mês
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Buscar operações da regional no período
    const operacoes = await this.buscarPorPeriodo(dataInicio, dataFim);
    const operacoesDaRegional = operacoes.filter(op => op.regionalId === regionalId);

    let totalParticipacoes = 0;
    let totalVagasDisponiveis = 0;

    for (const operacao of operacoesDaRegional) {
      const participacoes = await this.contarParticipacoes(operacao.id);
      totalParticipacoes += participacoes;
      totalVagasDisponiveis += (operacao.limiteDiarias + operacao.limiteMeiasDiarias);
    }

    const taxaOcupacao = totalVagasDisponiveis > 0 
      ? (totalParticipacoes / totalVagasDisponiveis) * 100 
      : 0;

    return {
      totalOperacoes: operacoesDaRegional.length,
      totalParticipacoes,
      taxaOcupacao: Number(taxaOcupacao.toFixed(2))
    };
  }

  // Método privado para mapear dados do banco para entidade
  private mapToEntity(data: any): Operacao {
    const props: OperacaoProps = {
      id: data.id,
      dataOperacao: new Date(data.data_operacao),
      modalidade: data.modalidade,
      tipo: data.tipo,
      regionalId: data.regional_id,
      supervisorId: data.supervisor_id,
      limiteDiarias: data.limite_diarias,
      limiteMeiasDiarias: data.limite_meias_diarias,
      observacoes: data.observacoes,
      ativa: data.ativa,
      criadaEm: new Date(data.criada_em),
      atualizadaEm: new Date(data.atualizada_em)
    };

    return Operacao.fromPersistence(props);
  }
} 