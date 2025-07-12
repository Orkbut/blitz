import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API pública para verificar se área de desenvolvimento deve ser exibida
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar apenas se está ativa
    const { data: config, error } = await supabase
      .from('parametros_sistema')
      .select('valor_atual')
      .eq('nome_parametro', 'area_desenvolvimento_ativa')
      .single();

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return NextResponse.json({
        success: true,
        mostrar: false // Se erro, não mostrar por segurança
      });
    }

    const ativa = config?.valor_atual === 'true';

    return NextResponse.json({
      success: true,
      mostrar: ativa
    });

  } catch (error) {
    console.error('Erro na API de verificação:', error);
    
    return NextResponse.json({
      success: true,
      mostrar: false // Se erro, não mostrar por segurança
    });
  }
} 