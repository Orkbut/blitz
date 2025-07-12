import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const membroId = parseInt(id);
    
    if (isNaN(membroId)) {
      return NextResponse.json({
        success: false,
        error: 'ID do membro inválido'
      }, { status: 400 });
    }

    // ✅ BUSCAR PARTICIPAÇÕES REAIS DO BANCO
    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select(`
        id,
        status_interno,
        estado_visual,
        data_participacao,
        posicao_fila,
        ativa,
        operacao!inner(
          id,
          data_operacao,
          modalidade,
          tipo,
          turno,
          limite_participantes,
          status
        )
      `)
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar participações:', error);
      throw error;
    }

    // Formatar dados para o frontend
    const participacoesFormatadas = (participacoes || []).map(p => ({
      id: p.id,
      status: p.estado_visual,        // ✅ USAR estado_visual como status principal
      status_interno: p.status_interno,
      estado_visual: p.estado_visual,
      data_participacao: p.data_participacao,
      posicao_fila: p.posicao_fila,
      operacao: {
        id: (p.operacao as any).id,
        modalidade: (p.operacao as any).modalidade,
        tipo: (p.operacao as any).tipo,
        data_operacao: (p.operacao as any).data_operacao,
        turno: (p.operacao as any).turno,
        limite_participantes: (p.operacao as any).limite_participantes
      }
    }));

    return NextResponse.json({
      success: true,
      data: participacoesFormatadas,
      boundedContext: 'agendamento',
      metadata: {
        membroId,
        totalParticipacoes: participacoesFormatadas.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar participações do membro:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: 'agendamento'
    }, { status: 500 });
  }
} 