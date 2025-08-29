import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Operacao {
  id: number;
  data_operacao: string;
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  modalidade: string;
  status: string;
  ativa?: boolean;
  excluida_temporariamente?: boolean;
  inativa_pelo_supervisor?: boolean;
}

interface Participacao {
  id: number;
  membro_id: number;
  operacao_id: number;
  estado_visual: string;
  status_interno: string;
  data_participacao: string;
  updated_at: string;
  ativa: boolean;
  operacao?: Operacao;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/membro/[id]/participacoes
 * 
 * Busca participações de um membro em um período específico
 * Usado pelas barras de limites do calendário
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const membroId = resolvedParams.id;
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');
    const includeOperacao = searchParams.get('includeOperacao') === 'true';

    if (!membroId) {
      return NextResponse.json(
        { success: false, error: 'ID do membro é obrigatório' },
        { status: 400 }
      );
    }

    if (!dataInicio || !dataFim) {
      return NextResponse.json(
        { success: false, error: 'Período (dataInicio e dataFim) é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`[API] Buscando participações do membro ${membroId} de ${dataInicio} até ${dataFim}`);
    console.log(`[API] Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
    console.log(`[API] Service Role Key exists: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
    console.log(`[API] Anon Key exists: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);

    let participacoesFiltradas: Participacao[] = [];

    // Usar Supabase para buscar dados reais
    try {
      // Buscar dados reais do Supabase
      let query = supabase
        .from('participacao')
        .select(`
          id,
          membro_id,
          operacao_id,
          estado_visual,
          status_interno,
          data_participacao,
          updated_at,
          ativa${includeOperacao ? ',\n          operacao (\n            id,\n            data_operacao,\n            tipo,\n            modalidade,\n            status,\n            ativa,\n            excluida_temporariamente,\n            inativa_pelo_supervisor\n          )' : ''}
        `)
        .eq('membro_id', membroId)
        .order('data_participacao', { ascending: false });

      if (includeOperacao) {
        query = query.not('operacao', 'is', null);
      }

      const { data: participacoes, error } = await query;

      if (error) {
        console.error('[API] Erro ao buscar participações:', error);
        return NextResponse.json(
          { success: false, error: 'Erro interno do servidor' },
          { status: 500 }
        );
      }

      participacoesFiltradas = (participacoes as unknown as Participacao[]) || [];

      if (includeOperacao && participacoesFiltradas.length > 0) {
        participacoesFiltradas = participacoesFiltradas.filter(p => {
          if (!p.operacao || typeof p.operacao !== 'object') return false;
          if (!p.operacao.data_operacao || typeof p.operacao.data_operacao !== 'string') return false;

          const dataOperacao = p.operacao.data_operacao.substring(0, 10);
          return dataOperacao >= dataInicio && dataOperacao <= dataFim;
        });
      }
    } catch (error) {
      console.error('[API] Erro ao buscar do Supabase:', error);
      return NextResponse.json(
        { success: false, error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    console.log(`[API] Encontradas ${participacoesFiltradas.length} participações`);

    return NextResponse.json({
      success: true,
      data: participacoesFiltradas,
      meta: {
        total: participacoesFiltradas.length,
        periodo: {
          inicio: dataInicio,
          fim: dataFim
        },
        membroId
      }
    });

  } catch (error) {
    console.error('[API] Erro inesperado:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}