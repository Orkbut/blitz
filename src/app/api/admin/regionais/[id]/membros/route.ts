import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para buscar membros de uma regional específica - Contexto: Administrativo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const regionalId = parseInt(params.id);

    if (isNaN(regionalId)) {
      return NextResponse.json({
        success: false,
        error: 'ID da regional inválido'
      }, { status: 400 });
    }

    // Verificar se a regional existe
    const { data: regional, error: regionalError } = await supabase
      .from('regional')
      .select('id, nome, codigo, ativo')
      .eq('id', regionalId)
      .single();

    if (regionalError || !regional) {
      return NextResponse.json({
        success: false,
        error: 'Regional não encontrada'
      }, { status: 404 });
    }

    // Buscar membros da regional com informações completas
    const { data: membros, error: membrosError } = await supabase
      .from('servidor')
      .select(`
        id,
        matricula,
        nome,
        email,
        perfil,
        ativo,
        criado_em,
        regional_id
      `)
      .eq('regional_id', regionalId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (membrosError) {
      console.error('❌ Erro ao buscar membros da regional:', membrosError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar membros da regional'
      }, { status: 500 });
    }

    // Calcular estatísticas
    const totalMembros = membros?.length || 0;
    const supervisores = membros?.filter(m => m.perfil === 'Supervisor').length || 0;
    const membrosComuns = membros?.filter(m => m.perfil === 'Membro').length || 0;

    return NextResponse.json({
      success: true,
      data: {
        regional: {
          id: regional.id,
          nome: regional.nome,
          codigo: regional.codigo,
          ativo: regional.ativo
        },
        membros: membros || [],
        estatisticas: {
          total: totalMembros,
          supervisores,
          membros: membrosComuns
        }
      },
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na API de membros por regional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 