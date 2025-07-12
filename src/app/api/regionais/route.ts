import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API Pública de Regionais - Para seleção nos portais
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar apenas regionais ativas
    const { data: regionais, error } = await supabase
      .from('regional')
      .select('id, nome, codigo')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: regionais || [],
      count: regionais?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao buscar regionais ativas:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 