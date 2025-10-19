import { supabase, Participacao } from '../database/supabase';
import { IParticipacaoRepository } from '../../application/ports/repositories/IParticipacaoRepository';

export class ParticipacaoRepository implements IParticipacaoRepository {
  
  async buscarPorMembro(membroId: number): Promise<Participacao[]> {
    const { data, error } = await supabase
      .from('participacao')
      .select(`
        *,
        operacao:operacao_id (
          id,
          data_operacao,
          modalidade,
          tipo
        )
      `)
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar participações do membro: ${error.message}`);
    }

    return data || [];
  }

  async buscarPorOperacao(operacaoId: number): Promise<Participacao[]> {
    const { data, error } = await supabase
      .from('participacao')
      .select(`
        *,
        servidor:membro_id (
          id,
          nome,
          matricula
        )
      `)
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar participações da operação: ${error.message}`);
    }

    return data || [];
  }

  async existeParticipacao(membroId: number, operacaoId: number): Promise<boolean> {
    const { data, error } = await supabase
      .from('participacao')
      .select('id')
      .eq('membro_id', membroId)
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`Erro ao verificar participação: ${error.message}`);
    }

    return !!data;
  }

  async salvar(participacao: Omit<Participacao, 'id'>): Promise<Participacao> {
    const { data, error } = await supabase
      .from('participacao')
      .insert(participacao)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar participação: ${error.message}`);
    }

    return data;
  }

  async atualizar(id: number, dados: Partial<Participacao>): Promise<void> {
    const { error } = await supabase
      .from('participacao')
      .update(dados)
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao atualizar participação: ${error.message}`);
    }
  }

  async buscarPorId(id: number): Promise<Participacao | null> {
    const { data, error } = await supabase
      .from('participacao')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar participação: ${error.message}`);
    }

    return data || null;
  }

  async contarParticipacoesPorPeriodo(
    membroId: number, 
    dataInicio: Date, 
    dataFim: Date
  ): Promise<number> {
    const { count, error } = await supabase
      .from('participacao')
      .select('*', { count: 'exact', head: true })
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .gte('data_participacao', dataInicio.toISOString())
      .lte('data_participacao', dataFim.toISOString());

    if (error) {
      throw new Error(`Erro ao contar participações: ${error.message}`);
    }

    return count || 0;
  }

  async verificarCicloFuncional(membroId: number, dataOperacao: Date): Promise<boolean> {
    // Buscar parâmetro do ciclo funcional
    const { data: parametro, error: errorParam } = await supabase
      .from('parametros_sistema')
      .select('valor_atual')
      .eq('nome_parametro', 'LIMITE_CICLO_FUNCIONAL')
      .single();

    if (errorParam) {
      throw new Error(`Erro ao buscar parâmetro ciclo funcional: ${errorParam.message}`);
    }

    const limiteCiclo = parseInt(parametro.valor_atual);
    
    // Calcular data limite (dataOperacao - limiteCiclo dias)
    const dataLimite = new Date(dataOperacao);
    dataLimite.setDate(dataLimite.getDate() - limiteCiclo);

    // Verificar última participação
    const { data, error } = await supabase
      .from('participacao')
      .select('data_participacao')
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .gte('data_participacao', dataLimite.toISOString())
      .order('data_participacao', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Erro ao verificar ciclo funcional: ${error.message}`);
    }

    // Se não há participações recentes, está liberado
    if (!data || data.length === 0) {
      return true;
    }

    // Verificar se a última participação está dentro do ciclo funcional
    const ultimaParticipacao = new Date(data[0].data_participacao);
    const diasEntre = Math.floor((dataOperacao.getTime() - ultimaParticipacao.getTime()) / (1000 * 60 * 60 * 24));
    
    return diasEntre >= limiteCiclo;
  }
} 