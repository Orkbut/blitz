import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verificar se é uma chamada autorizada (pode ser um cron job)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'radar-limpeza-2024';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        success: false,
        error: 'Não autorizado'
      }, { status: 401 });
    }

    console.log('🧹 Iniciando limpeza de operações expiradas...');

    // Executar limpeza usando função do banco
    const { data: resultado, error } = await supabase
      .rpc('limpar_operacoes_expiradas');

    if (error) {
      console.error('❌ Erro na limpeza:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao executar limpeza'
      }, { status: 500 });
    }

    console.log(`✅ Limpeza concluída: ${resultado} operações processadas`);

    // Registrar no histórico de sistema
    await supabase
      .from('historico_modificacao')
      .insert({
        entidade: 'sistema',
        entidade_id: 0,
        acao: 'LIMPEZA_AUTOMATICA',
        dados_anteriores: {
          operacoes_limpas: resultado,
          timestamp: new Date().toISOString(),
          tipo: 'operacoes_expiradas_48h'
        },
        usuario_id: null // Sistema automático
      });

    return NextResponse.json({
      success: true,
      data: {
        operacoesLimpas: resultado,
        timestamp: new Date().toISOString(),
        proximaLimpeza: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
      }
    });

  } catch (error) {
    console.error('❌ Erro na limpeza automática:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Endpoint GET para verificar status da limpeza
export async function GET() {
  try {
    // Verificar quantas operações estão pendentes de limpeza
    const { data: operacoesPendentes, error } = await supabase
      .from('operacao')
      .select('id, data_exclusao, visivel_ate')
      .eq('excluida_temporariamente', true)
      .lt('visivel_ate', new Date().toISOString());

    if (error) {
      throw error;
    }

    // Verificar última limpeza
    const { data: ultimaLimpeza, error: limpezaError } = await supabase
      .from('historico_modificacao')
      .select('criado_em, dados_anteriores')
      .eq('acao', 'LIMPEZA_AUTOMATICA')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        operacoesPendentesLimpeza: operacoesPendentes?.length || 0,
        ultimaLimpeza: ultimaLimpeza?.criado_em || null,
        operacoesUltimaLimpeza: ultimaLimpeza?.dados_anteriores?.operacoes_limpas || 0,
        proximaLimpezaRecomendada: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status da limpeza:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 