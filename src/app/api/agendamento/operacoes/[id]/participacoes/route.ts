import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const operacaoId = id;

  console.log(`📊 [PARTICIPACOES-API] Buscando participações da operação ${operacaoId}`);

  try {
    // Buscar participações com dados dos servidores
    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select(`
        *,
        servidor:membro_id (
          id,
          nome,
          matricula,
          regional_id
        )
      `)
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: true });

    if (error) {
      console.error('❌ Erro ao buscar participações:', error);
      throw error;
    }

    // Formatar dados para incluir informações do servidor
    const participacoesFormatadas = participacoes?.map(p => ({
      id: p.id,
      membro_id: p.membro_id,
      operacao_id: p.operacao_id,
      estado_visual: p.estado_visual,
      ativa: p.ativa,
      data_participacao: p.data_participacao,
      servidor_nome: p.servidor?.nome || 'Servidor',
      nome: p.servidor?.nome || 'Servidor',
      matricula: p.servidor?.matricula || '',
      regional_id: p.servidor?.regional_id || null
    })) || [];

    console.log(`✅ Participações encontradas: ${participacoesFormatadas.length}`);
    console.log(`📋 Estados: ${participacoesFormatadas.map(p => p.estado_visual).join(', ')}`);

    return NextResponse.json({
      success: true,
      data: participacoesFormatadas
    });

  } catch (error) {
    console.error('❌ Erro ao buscar participações:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 