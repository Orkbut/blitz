import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const operacaoId = parseInt(id);
    
    if (isNaN(operacaoId)) {
      return NextResponse.json({
        success: false,
        error: 'ID da operação inválido'
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const membroId = parseInt(searchParams.get('membroId') || '1');

    // ✅ BUSCAR APENAS QUEM ESTÁ REALMENTE NA FILA: Não incluir pessoas já confirmadas
    const { data: filaCompleta, error } = await supabase
      .from('participacao')
      .select(`
        id,
        membro_id,
        data_participacao,
        status_interno,
        estado_visual,
        posicao_fila,
        servidor!membro_id(nome, matricula)
      `)
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .in('estado_visual', ['NA_FILA', 'PENDENTE'])
      .order('data_participacao', { ascending: true });

    if (error) {
      console.error('Erro ao buscar fila:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar posição na fila'
      }, { status: 500 });
    }

    // 🎯 CALCULAR POSIÇÃO REAL: Ordem cronológica incluindo pendentes
    const minhaParticipacao = filaCompleta?.find(p => p.membro_id === membroId);
    const minhaPosicao = minhaParticipacao ? 
      filaCompleta.findIndex(p => p.membro_id === membroId) + 1 : null;

    // 📊 ESTATÍSTICAS DA FILA
    const aguardandoAprovacao = filaCompleta?.filter(p => p.status_interno === 'AGUARDANDO_SUPERVISOR').length || 0;
    const aprovados = filaCompleta?.filter(p => p.status_interno === 'APROVADO').length || 0;
    const totalNaFila = filaCompleta?.length || 0;

    // 👥 DETALHES DA FILA (para transparência)
    const filaDetalhada = filaCompleta?.map((p: any, index) => {
      const servidor = Array.isArray(p.servidor) ? p.servidor[0] : p.servidor;
      return {
        posicao: index + 1,
        nome: servidor?.nome || 'Servidor',
        matricula: servidor?.matricula || '',
        status: p.status_interno === 'APROVADO' ? 'APROVADO' : 'AGUARDANDO',
        icone: p.status_interno === 'APROVADO' ? '✅' : '⏳',
        data_solicitacao: p.data_participacao
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: {
        minhaPosicao,
        minhaParticipacao: minhaParticipacao ? {
          status: minhaParticipacao.status_interno,
          estado_visual: minhaParticipacao.estado_visual,
          data_solicitacao: minhaParticipacao.data_participacao
        } : null,
        estatisticas: {
          totalNaFila,
          aguardandoAprovacao,
          aprovados,
          posicaoReal: minhaPosicao
        },
        filaDetalhada,
        transparencia: {
          explicacao: "Fila ordenada cronologicamente por ordem de solicitação",
          legenda: {
            "⏳": "Aguardando aprovação do supervisor", 
            "✅": "Aprovado pelo supervisor"
          }
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API de posição na fila:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 