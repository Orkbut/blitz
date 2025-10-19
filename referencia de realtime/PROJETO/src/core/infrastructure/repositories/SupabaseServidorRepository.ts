import { supabase } from '../database/supabase';
import { IServidorRepository } from '../../application/ports/repositories/IServidorRepository';
import { Servidor, ServidorProps } from '../../domain/entities/Servidor';

export class SupabaseServidorRepository implements IServidorRepository {

  async buscarPorId(id: number): Promise<Servidor | null> {
    const { data, error } = await supabase
      .from('servidor')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async buscarPorEmail(email: string): Promise<Servidor | null> {
    const { data, error } = await supabase
      .from('servidor')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async buscarPorMatricula(matricula: string): Promise<Servidor | null> {
    const { data, error } = await supabase
      .from('servidor')
      .select('*')
      .eq('matricula', matricula)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToEntity(data);
  }

  async buscarPorRegional(regionalId: number): Promise<Servidor[]> {
    const { data, error } = await supabase
      .from('servidor')
      .select('*')
      .eq('regional_id', regionalId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async buscarAtivos(): Promise<Servidor[]> {
    const { data, error } = await supabase
      .from('servidor')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async buscarPorPerfil(perfil: 'Membro' | 'Supervisor' | 'Administrador'): Promise<Servidor[]> {
    const { data, error } = await supabase
      .from('servidor')
      .select('*')
      .eq('perfil', perfil)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToEntity(item));
  }

  async salvar(servidor: Servidor): Promise<Servidor> {
    const props = servidor.toJSON();
    
    const { data, error } = await supabase
      .from('servidor')
      .insert({
        nome: props.nome,
        email: props.email,
        matricula: props.matricula,
        perfil: props.perfil,
        regional_id: props.regionalId,
        ativo: props.ativo,
        criado_em: props.criadoEm.toISOString(),
        atualizado_em: props.atualizadoEm.toISOString()
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao salvar servidor: ${error?.message}`);
    }

    return this.mapToEntity(data);
  }

  async atualizar(servidor: Servidor): Promise<void> {
    const props = servidor.toJSON();

    const { error } = await supabase
      .from('servidor')
      .update({
        nome: props.nome,
        email: props.email,
        matricula: props.matricula,
        perfil: props.perfil,
        regional_id: props.regionalId,
        ativo: props.ativo,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', props.id);

    if (error) {
      throw new Error(`Erro ao atualizar servidor: ${error.message}`);
    }
  }

  async deletar(id: number): Promise<void> {
    const { error } = await supabase
      .from('servidor')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao deletar servidor: ${error.message}`);
    }
  }

  async contarMembrosPorRegional(regionalId: number): Promise<number> {
    const { count, error } = await supabase
      .from('servidor')
      .select('*', { count: 'exact', head: true })
      .eq('regional_id', regionalId)
      .eq('perfil', 'Membro')
      .eq('ativo', true);

    if (error) {
      throw new Error(`Erro ao contar membros: ${error.message}`);
    }

    return count || 0;
  }

  async verificarDisponibilidade(membroId: number, dataOperacao: Date): Promise<boolean> {
    const dataFormatada = dataOperacao.toISOString().split('T')[0];

    // Verificar se já tem participação confirmada na data
    const { count, error } = await supabase
      .from('participacao')
      .select('*', { count: 'exact', head: true })
      .eq('membro_id', membroId)
      .eq('data_participacao', dataFormatada)
      .eq('estado_visual', 'CONFIRMADO')
      .eq('ativa', true);

    if (error) {
      throw new Error(`Erro ao verificar disponibilidade: ${error.message}`);
    }

    // Está disponível se não tem participação confirmada
    return (count || 0) === 0;
  }

  async buscarMembrosDisponiveis(regionalId: number, dataOperacao: Date): Promise<Servidor[]> {
    // Buscar todos os membros da regional
    const membros = await this.buscarPorRegional(regionalId);
    const membrosAtivos = membros.filter(m => m.toJSON().perfil === 'Membro');

    // Filtrar apenas os disponíveis na data
    const membrosDisponiveis: Servidor[] = [];
    
    for (const membro of membrosAtivos) {
      const disponivel = await this.verificarDisponibilidade(Number(membro.toJSON().id), dataOperacao);
      if (disponivel) {
        membrosDisponiveis.push(membro);
      }
    }

    return membrosDisponiveis;
  }

  async verificarLimiteCicloFuncional(
    membroId: number, 
    dataInicio: Date, 
    dataFim: Date
  ): Promise<boolean> {
    
    // ✅ LOGS COMENTADOS PARA REDUZIR VERBOSIDADE
    // console.log('===========================================================');
    // console.log(`Membro ID: ${membroId}`);
    // console.log(`Período: ${dataInicio.toISOString().split('T')[0]} até ${dataFim.toISOString().split('T')[0]}`);
    // console.log('');

    const inicioFormatado = dataInicio.toISOString().split('T')[0];
    const fimFormatado = dataFim.toISOString().split('T')[0];

    // 🔧 CORREÇÃO: Buscar dados detalhados ao invés de apenas count
    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select('tipo_participacao, data_participacao')
      .eq('membro_id', membroId)
      .gte('data_participacao', inicioFormatado)
      .lte('data_participacao', fimFormatado)
      .eq('estado_visual', 'CONFIRMADO')
      .eq('ativa', true);

    if (error) {
      console.error('❌ Erro ao verificar limite do ciclo:', error);
      throw new Error(`Erro ao verificar limite do ciclo: ${error.message}`);
    }

    const participacoesEncontradas = participacoes || [];
    // console.log(`📊 Participações encontradas: ${participacoesEncontradas.length}`);

    // 🔧 CORREÇÃO: Calcular corretamente baseado no tipo_participacao
    let totalDiarias = 0;
    let diariasCompletas = 0;
    let meiasDiarias = 0;

    participacoesEncontradas.forEach(p => {
      if (p.tipo_participacao === 'DIARIA_COMPLETA') {
        totalDiarias += 1;
        diariasCompletas += 1;
      } else {
        totalDiarias += 0.5;
        meiasDiarias += 1;
      }
    });

    // console.log('📊 CONTAGEM:');
    // console.log(`  Diárias completas: ${diariasCompletas} (${diariasCompletas * 1.0} diárias)`);
    // console.log(`  Meias diárias: ${meiasDiarias} (${meiasDiarias * 0.5} diárias)`);
    // console.log(`  TOTAL: ${totalDiarias} diárias`);

    // Assumir limite de 15 para ciclo funcional (pode ser parametrizado)
    const limite = 15;
    const podeParticipar = totalDiarias < limite;
    
    // console.log(`📋 LIMITE CICLO FUNCIONAL: ${limite} diárias`);
    // console.log(`✅ PODE PARTICIPAR: ${podeParticipar} (${totalDiarias} < ${limite})`);
    // console.log('===========================================================');
    // console.log('');

    return podeParticipar;
  }

  async verificarLimiteMensal(
    membroId: number, 
    mes: number, 
    ano: number
  ): Promise<boolean> {
    
    // ✅ LOGS COMENTADOS PARA REDUZIR VERBOSIDADE
    // console.log('==================================================');
    // console.log(`Membro ID: ${membroId}`);
    // console.log(`Período: ${mes}/${ano}`);
    // console.log('');

    // Calcular período do mês
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0);
    
    const inicioFormatado = dataInicio.toISOString().split('T')[0];
    const fimFormatado = dataFim.toISOString().split('T')[0];

    // console.log(`📅 Período: ${inicioFormatado} até ${fimFormatado}`);

    // 🔧 CORREÇÃO: Buscar dados detalhados ao invés de apenas count
    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select('tipo_participacao, data_participacao')
      .eq('membro_id', membroId)
      .gte('data_participacao', inicioFormatado)
      .lte('data_participacao', fimFormatado)
      .eq('estado_visual', 'CONFIRMADO')
      .eq('ativa', true);

    if (error) {
      console.error('❌ Erro ao verificar limite mensal:', error);
      throw new Error(`Erro ao verificar limite mensal: ${error.message}`);
    }

    const participacoesEncontradas = participacoes || [];
    // console.log(`📊 Participações encontradas: ${participacoesEncontradas.length}`);

    // 🔧 CORREÇÃO: Calcular corretamente baseado no tipo_participacao
    let totalDiarias = 0;
    let diariasCompletas = 0;
    let meiasDiarias = 0;

    participacoesEncontradas.forEach(p => {
      if (p.tipo_participacao === 'DIARIA_COMPLETA') {
        totalDiarias += 1;
        diariasCompletas += 1;
      } else {
        totalDiarias += 0.5;
        meiasDiarias += 1;
      }
    });

    // console.log('📊 CONTAGEM:');
    // console.log(`  Diárias completas: ${diariasCompletas} (${diariasCompletas * 1.0} diárias)`);
    // console.log(`  Meias diárias: ${meiasDiarias} (${meiasDiarias * 0.5} diárias)`);
    // console.log(`  TOTAL: ${totalDiarias} diárias`);

    // Assumir limite mensal de 15 (pode ser parametrizado)
    const limite = 15;
    const podeParticipar = totalDiarias < limite;
    
    // console.log(`📋 LIMITE MENSAL: ${limite} diárias`);
    // console.log(`✅ PODE PARTICIPAR: ${podeParticipar} (${totalDiarias} < ${limite})`);
    // console.log('==================================================');
    // console.log('');

    return podeParticipar;
  }

  async obterEstatisticasParticipacao(
    membroId: number, 
    mes: number, 
    ano: number
  ): Promise<{
    totalParticipacoes: number;
    totalDiarias: number;
    valorTotal: number;
  }> {
    // Calcular período do mês
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0);
    
    const inicioFormatado = dataInicio.toISOString().split('T')[0];
    const fimFormatado = dataFim.toISOString().split('T')[0];

    // Buscar participações do membro no mês
    const { data, error } = await supabase
      .from('participacao')
      .select('*')
      .eq('membro_id', membroId)
      .gte('data_participacao', inicioFormatado)
      .lte('data_participacao', fimFormatado)
      .eq('estado_visual', 'CONFIRMADO')
      .eq('ativa', true);

    if (error) {
      throw new Error(`Erro ao obter estatísticas: ${error.message}`);
    }

    const participacoes = data || [];
    
    let totalDiarias = 0;
    let valorTotal = 0;

    for (const participacao of participacoes) {
      if (participacao.tipo_participacao === 'DIARIA_COMPLETA') {
        totalDiarias += 1;
      } else {
        totalDiarias += 0.5; // Meia diária
      }
      
      valorTotal += participacao.valor_diaria || 0;
    }

    return {
      totalParticipacoes: participacoes.length,
      totalDiarias,
      valorTotal
    };
  }

  // Método privado para mapear dados do banco para entidade
  private mapToEntity(data: any): Servidor {
    const props: ServidorProps = {
      id: data.id,
      nome: data.nome,
      email: data.email,
      matricula: data.matricula,
      perfil: data.perfil,
      regionalId: data.regional_id,
      ativo: data.ativo,
      criadoEm: new Date(data.criado_em),
      atualizadoEm: new Date(data.atualizado_em)
    };

    return Servidor.fromPersistence(props);
  }
} 