import { createClient } from '@supabase/supabase-js';

interface Servidor {
  id: number;
  matricula: string;
  nome: string;
  email: string | null;
  perfil: string;
  regional_id: number;
  ativo: boolean;
  criado_em: string;
}

interface ServidorComRegional extends Servidor {
  regional_nome: string;
}

export class SupabaseServidorRepository {
  private supabase;

  constructor() {
    // Configuração do Supabase - em produção, usar variáveis de ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async buscarPorId(id: number): Promise<ServidorComRegional | null> {
    try {
      const { data, error } = await this.supabase
        .from('servidor')
        .select(`
          id, matricula, nome, email, perfil, regional_id, ativo, criado_em,
          regional!inner(nome)
        `)
        .eq('id', id)
        .eq('ativo', true)
        .single();

      if (error || !data) return null;

      const servidor = data as unknown as any;
      return {
        id: servidor.id,
        matricula: servidor.matricula,
        nome: servidor.nome,
        email: servidor.email,
        perfil: servidor.perfil,
        regional_id: servidor.regional_id,
        ativo: servidor.ativo,
        criado_em: servidor.criado_em,
        regional_nome: servidor.regional.nome
      };
    } catch (error) {
      return null;
    }
  }

  async buscarPorMatricula(matricula: string): Promise<ServidorComRegional | null> {
    try {
      const { data, error } = await this.supabase
        .from('servidor')
        .select(`
          id, matricula, nome, email, perfil, regional_id, ativo, criado_em,
          regional!inner(nome)
        `)
        .eq('matricula', matricula)
        .eq('ativo', true)
        .single();

      if (error || !data) return null;

      const servidor = data as unknown as any;
      return {
        id: servidor.id,
        matricula: servidor.matricula,
        nome: servidor.nome,
        email: servidor.email,
        perfil: servidor.perfil,
        regional_id: servidor.regional_id,
        ativo: servidor.ativo,
        criado_em: servidor.criado_em,
        regional_nome: servidor.regional.nome
      };
    } catch (error) {
      return null;
    }
  }

  async contarDiariasNoMes(servidorId: number, ano: number, mes: number): Promise<number> {
    try {
      // Daily counting method logging removed for performance

      // Primeiro e último dia do mês
      const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
      const dataFim = new Date(ano, mes, 0); // Último dia do mês
      const dataFimStr = `${ano}-${mes.toString().padStart(2, '0')}-${dataFim.getDate().toString().padStart(2, '0')}`;

      // Date range logging removed for performance

      // 🔧 CORREÇÃO: Buscar dados detalhados ao invés de apenas count
      const { data: participacoes, error } = await this.supabase
        .from('participacao')
        .select(`
          id,
          tipo_participacao,
          data_participacao,
          operacao_id,
          operacao!inner(
            id,
            modalidade,
            tipo
          )
        `)
        .eq('membro_id', servidorId)
        .eq('ativa', true)
        .eq('estado_visual', 'CONFIRMADO')
        .gte('data_participacao', dataInicio)
        .lte('data_participacao', dataFimStr);

      if (error) {
        // Participation fetch error logging removed for performance
        throw error;
      }

      const participacoesEncontradas = participacoes || [];
      // Participations found logging removed for performance

      // 🔧 CORREÇÃO: Calcular corretamente baseado no tipo_participacao
      let totalDiarias = 0;
      let diariasCompletas = 0;
      let meiasDiarias = 0;

      // Participation details logging removed for performance

      participacoesEncontradas.forEach((p, index) => {
        const operacao = p.operacao as any;
        let valorDiaria = 0;

        if (p.tipo_participacao === 'DIARIA_COMPLETA') {
          valorDiaria = 1.0;
          totalDiarias += 1;
          diariasCompletas += 1;
        } else {
          valorDiaria = 0.5;
          totalDiarias += 0.5;
          meiasDiarias += 1;
        }

        // Individual participation logging removed for performance
      });

      // Final summary logging removed for performance

      // 🔧 CORREÇÃO: Retornar valor correto baseado na regra de negócio
      // Regra: 2 meias-diárias = 1 diária completa para limite mensal
      const totalCalculado = totalDiarias;
      
      // Return value logging removed for performance

      return totalCalculado;
    } catch (error) {
      // Daily counting error logging removed for performance
      return 0;
    }
  }

  async verificarRestricaoTemporal(servidorId: number, dataOperacao: string): Promise<boolean> {
    try {
      // Buscar todas as operações na mesma data
      const { data: operacoesMesmaData, error: errorOperacoes } = await this.supabase
        .from('operacao')
        .select('id')
        .eq('data_operacao', dataOperacao)
        .eq('ativa', true);

      if (errorOperacoes) throw errorOperacoes;
      if (!operacoesMesmaData || operacoesMesmaData.length === 0) return false;

      const operacoesIds = operacoesMesmaData.map(op => op.id);

      // Verificar se tem participação ativa em qualquer operação da mesma data
      const { data, error } = await this.supabase
        .from('participacao')
        .select('id')
        .eq('membro_id', servidorId)
        .eq('ativa', true)
        .in('operacao_id', operacoesIds);

      if (error) throw error;
      return (data && data.length > 0);
    } catch (error) {
      return false; // Em caso de erro, não bloqueia
    }
  }
} 