import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase REAL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    console.log('📊 Dashboard Stats: Consultando dados diretamente...');

    // ✅ OPERAÇÕES DISPONÍVEIS (ativas e futuras)
    const { count: operacoesDisponiveis } = await supabase
      .from('operacao')
      .select('*', { count: 'exact', head: true })
      .eq('ativa', true)
      .gte('data_operacao', new Date().toISOString().split('T')[0]);

    // ✅ SERVIDORES ONLINE (ativos no sistema)
    const { count: servidoresOnline } = await supabase
      .from('servidor')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true);

    const stats = {
      operacoesDisponiveis: operacoesDisponiveis || 0,
      servidoresOnline: servidoresOnline || 0,
      timestamp: new Date().toISOString(),
      fonte: 'SUPABASE_DIRETO'
    };

    console.log('✅ Dashboard Stats:', stats);

    return NextResponse.json({
      success: true,
      data: stats,
      boundedContext: 'dashboard'
    });

  } catch (error) {
    console.error('❌ Erro ao buscar stats do dashboard:', error);
    
    // ✅ FALLBACK: Retornar dados padrão em caso de erro
    return NextResponse.json({
      success: true,
      data: {
        operacoesDisponiveis: 0,
        servidoresOnline: 0,
        timestamp: new Date().toISOString(),
        fonte: 'FALLBACK'
      },
      boundedContext: 'dashboard'
    });
  }
} 