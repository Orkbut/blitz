import { createClient } from '@supabase/supabase-js';

interface Operacao {
  id: number;
  data_operacao: string;
  modalidade: string;
  tipo: string;
  limite_participantes: number;
  status: string;
  janela_id: number;
  ativa: boolean;
  criado_em: string;
}

interface OperacaoComRegional extends Operacao {
  regional_nome: string;
  regional_id: number;
}

export class SupabaseOperacaoRepository {
  private supabase;

  constructor() {
    // Configuração do Supabase - em produção, usar variáveis de ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async buscarOperacoesAtivas(): Promise<OperacaoComRegional[]> {
    try {
      const { data, error } = await this.supabase
        .from('operacao')
        .select(`
          id, data_operacao, modalidade, tipo, limite_participantes, status, janela_id, ativa, criado_em,
          janela_operacional!inner(regional_id, regional(nome))
        `)
        .eq('ativa', true)
        .order('data_operacao', { ascending: false });

      if (error) throw error;

      return (data as unknown as any[])?.map((op: any) => ({
        id: op.id,
        data_operacao: op.data_operacao,
        modalidade: op.modalidade,
        tipo: op.tipo,
        limite_participantes: op.limite_participantes,
        status: op.status,
        janela_id: op.janela_id,
        ativa: op.ativa,
        criado_em: op.criado_em,
        regional_nome: op.janela_operacional.regional.nome,
        regional_id: op.janela_operacional.regional_id
      })) || [];
    } catch (error) {
      return [];
    }
  }

  async buscarPorId(id: number): Promise<OperacaoComRegional | null> {
    try {
      const { data, error } = await this.supabase
        .from('operacao')
        .select(`
          id, data_operacao, modalidade, tipo, limite_participantes, status, janela_id, ativa, criado_em,
          janela_operacional!inner(regional_id, regional(nome))
        `)
        .eq('id', id)
        .single();

      if (error || !data) return null;

      const operacao = data as unknown as any;
      return {
        id: operacao.id,
        data_operacao: operacao.data_operacao,
        modalidade: operacao.modalidade,
        tipo: operacao.tipo,
        limite_participantes: operacao.limite_participantes,
        status: operacao.status,
        janela_id: operacao.janela_id,
        ativa: operacao.ativa,
        criado_em: operacao.criado_em,
        regional_nome: operacao.janela_operacional.regional.nome,
        regional_id: operacao.janela_operacional.regional_id
      };
    } catch (error) {
      return null;
    }
  }

  async contarParticipantesConfirmados(operacaoId: number): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('participacao')
        .select('*', { count: 'exact', head: true })
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP']); // ✅ CORREÇÃO: Incluir ADICIONADO_SUP

      if (error) throw error;
      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  async verificarParticipacaoExistente(membroId: number, operacaoId: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('participacao')
        .select('id')
        .eq('membro_id', membroId)
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 é "not found"
      return !!data;
    } catch (error) {
      return false;
    }
  }
} 