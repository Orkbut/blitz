import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operacaoId = searchParams.get('operacao_id');

    if (!operacaoId) {
      return NextResponse.json(
        { error: 'ID da operação é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar fotos da operação
    const { data: fotos, error } = await supabase
      .from('fotos_operacao')
      .select('*')
      .eq('operacao_id', operacaoId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao buscar fotos:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ fotos: fotos || [] });
  } catch (error) {
    console.error('Erro na API de fotos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}