import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testando conexão com Supabase...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Variáveis de ambiente não configuradas',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Teste 1: Conectar ao Supabase
    console.log('✅ Cliente Supabase criado');

    // Teste 2: Fazer uma consulta simples
    const { data, error, count } = await supabase
      .from('operacao')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      console.error('❌ Erro na consulta:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro na consulta Supabase',
        details: error
      }, { status: 500 });
    }

    console.log('✅ Consulta realizada com sucesso');

    return NextResponse.json({
      success: true,
      message: 'Conexão com Supabase funcionando!',
      details: {
        totalOperacoes: count,
        primeiraOperacao: data?.[0] || null,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno',
      details: (error as Error).message
    }, { status: 500 });
  }
} 