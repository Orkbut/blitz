import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API de Parâmetros Admin - Bounded Context: Administrativo
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: parametros, error } = await supabase
      .from('parametros_sistema')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nome_parametro', { ascending: true });

    if (error) throw error;

    // ✅ Mapear para o formato esperado pelo frontend
    const parametrosMapeados = (parametros || []).map(p => ({
      id: p.id,
      chave: p.nome_parametro,
      valor: p.valor_atual,
      descricao: p.descricao,
      tipo: p.tipo_valor,
      ativo: p.pode_alterar_runtime,
      categoria: p.categoria
    }));

    return NextResponse.json({
      success: true,
      data: parametrosMapeados,
      count: parametrosMapeados.length,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao buscar parâmetros admin:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await request.json();
    const { id, valor, ativo } = body;

    if (!id || valor === undefined) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID e valor são obrigatórios',
          boundedContext: 'administrativo'
        },
        { status: 400 }
      );
    }

    // ✅ Mapear para campos reais da tabela
    const { data, error } = await supabase
      .from('parametros_sistema')
      .update({ 
        valor_atual: valor.toString(),
        pode_alterar_runtime: ativo !== undefined ? ativo : true,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Parâmetro atualizado:', data);

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        chave: data.nome_parametro,
        valor: data.valor_atual,
        ativo: data.pode_alterar_runtime
      },
      message: 'Parâmetro atualizado com sucesso',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao atualizar parâmetro:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 