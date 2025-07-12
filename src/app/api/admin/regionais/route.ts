import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API de Regionais Admin - Bounded Context: Administrativo
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: regionais, error } = await supabase
      .from('regional')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: regionais || [],
      count: regionais?.length || 0,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao buscar regionais:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await request.json();
    const { nome, codigo } = body;

    // Validações básicas
    if (!nome || !codigo) {
      return NextResponse.json({
        success: false,
        error: 'Nome e código são obrigatórios',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Validar formato do código (XX99)
    const codigoRegex = /^[A-Z]{2}[0-9]{2}$/;
    if (!codigoRegex.test(codigo)) {
      return NextResponse.json({
        success: false,
        error: 'Código deve estar no formato XX99 (ex: RC01)',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se nome já existe
    const { data: nomeExistente } = await supabase
      .from('regional')
      .select('id')
      .eq('nome', nome)
      .single();

    if (nomeExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma regional com este nome',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se código já existe
    const { data: codigoExistente } = await supabase
      .from('regional')
      .select('id')
      .eq('codigo', codigo)
      .single();

    if (codigoExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma regional com este código',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Criar regional
    const { data: novaRegional, error } = await supabase
      .from('regional')
      .insert({
        nome: nome.trim(),
        codigo: codigo.toUpperCase(),
        ativo: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: novaRegional,
      message: 'Regional criada com sucesso',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao criar regional:', error);
    
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
    const { id, nome, codigo, ativo } = body;

    // Validações básicas
    if (!id || !nome || !codigo) {
      return NextResponse.json({
        success: false,
        error: 'ID, nome e código são obrigatórios',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Validar formato do código (XX99)
    const codigoRegex = /^[A-Z]{2}[0-9]{2}$/;
    if (!codigoRegex.test(codigo)) {
      return NextResponse.json({
        success: false,
        error: 'Código deve estar no formato XX99 (ex: RC01)',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se nome já existe em outra regional
    const { data: nomeExistente } = await supabase
      .from('regional')
      .select('id')
      .eq('nome', nome)
      .neq('id', id)
      .single();

    if (nomeExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe outra regional com este nome',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se código já existe em outra regional
    const { data: codigoExistente } = await supabase
      .from('regional')
      .select('id')
      .eq('codigo', codigo)
      .neq('id', id)
      .single();

    if (codigoExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe outra regional com este código',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Atualizar regional
    const { data: regionalAtualizada, error } = await supabase
      .from('regional')
      .update({
        nome: nome.trim(),
        codigo: codigo.toUpperCase(),
        ativo: ativo !== undefined ? ativo : true
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: regionalAtualizada,
      message: 'Regional atualizada com sucesso',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao atualizar regional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID da regional é obrigatório',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se existem operações ativas vinculadas
    const { data: operacoesAtivas } = await supabase
      .from('operacao')
      .select('id')
      .eq('regional_id', id)
      .eq('ativo', true);

    if (operacoesAtivas && operacoesAtivas.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Não é possível inativar regional com operações ativas',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se existem servidores ativos vinculados
    const { data: servidoresAtivos } = await supabase
      .from('servidor')
      .select('id')
      .eq('regional_id', id)
      .eq('ativo', true);

    if (servidoresAtivos && servidoresAtivos.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Não é possível inativar regional com servidores ativos',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Inativar regional (exclusão lógica)
    const { data: regionalInativada, error } = await supabase
      .from('regional')
      .update({ ativo: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: regionalInativada,
      message: 'Regional inativada com sucesso',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao inativar regional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 