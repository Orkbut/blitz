import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { operacaoId } = await request.json();

    if (!operacaoId) {
      return NextResponse.json({
        success: false,
        error: 'ID da operação é obrigatório'
      }, { status: 400 });
    }

    console.log(`🔄 Iniciando reorganização da fila para operação ${operacaoId}`);

    // Buscar todos da fila ordenados por data de entrada
    const { data: fila, error: filaError } = await supabase
      .from('participacao')
      .select('id, membro_id, posicao_fila, data_participacao')
      .eq('operacao_id', operacaoId)
      .eq('estado_visual', 'NA_FILA')
      .eq('ativa', true)
      .order('data_participacao', { ascending: true });

    if (filaError) {
      console.error('❌ Erro ao buscar fila:', filaError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar fila'
      }, { status: 500 });
    }

    if (!fila || fila.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma pessoa na fila para reorganizar',
        data: {
          operacaoId,
          pessoasNaFila: 0
        }
      });
    }

    console.log(`📋 Encontradas ${fila.length} pessoas na fila`);

    // Atualizar posições sequencialmente
    const atualizacoes = [];
    for (let i = 0; i < fila.length; i++) {
      const novaPosicao = i + 1;
      const pessoa = fila[i];
      
      if (pessoa.posicao_fila !== novaPosicao) {
        const { error: updateError } = await supabase
          .from('participacao')
          .update({ posicao_fila: novaPosicao })
          .eq('id', pessoa.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar posição do ID ${pessoa.id}:`, updateError);
        } else {
          atualizacoes.push({
            membroId: pessoa.membro_id,
            posicaoAnterior: pessoa.posicao_fila,
            novaPosicao
          });
        }
      }
    }

    console.log(`✅ Fila reorganizada: ${atualizacoes.length} posições atualizadas`);

    return NextResponse.json({
      success: true,
      message: 'Fila reorganizada com sucesso',
      data: {
        operacaoId,
        pessoasNaFila: fila.length,
        posicoesAtualizadas: atualizacoes
      }
    });

  } catch (error) {
    console.error('❌ Erro ao reorganizar fila:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 