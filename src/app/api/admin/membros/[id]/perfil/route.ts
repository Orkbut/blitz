import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para alterar perfil de membro (Membro ↔ Supervisor) - Contexto: Administrativo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ✅ CORREÇÃO: Await params para Next.js 15+
    const resolvedParams = await params;
    const membroId = parseInt(resolvedParams.id);
    const { novoPerfil } = await request.json();

    // Validações básicas
    if (isNaN(membroId)) {
      return NextResponse.json({
        success: false,
        error: 'ID do membro inválido'
      }, { status: 400 });
    }

    if (!novoPerfil || !['Membro', 'Supervisor'].includes(novoPerfil)) {
      return NextResponse.json({
        success: false,
        error: 'Perfil deve ser "Membro" ou "Supervisor"'
      }, { status: 400 });
    }

    // Verificar se o membro existe e está ativo
    const { data: membro, error: membroError } = await supabase
      .from('servidor')
      .select(`
        id,
        matricula,
        nome,
        email,
        perfil,
        ativo,
        regional_id
      `)
      .eq('id', membroId)
      .eq('ativo', true)
      .single();

    // Buscar informações da regional separadamente para evitar problemas de tipo
    let regionalInfo = null;
    if (membro && membro.regional_id) {
      const { data: regional } = await supabase
        .from('regional')
        .select('nome, codigo')
        .eq('id', membro.regional_id)
        .single();
      regionalInfo = regional;
    }

    if (membroError || !membro) {
      return NextResponse.json({
        success: false,
        error: 'Membro não encontrado ou inativo'
      }, { status: 404 });
    }

    // Verificar se já tem o perfil desejado
    if (membro.perfil === novoPerfil) {
      return NextResponse.json({
        success: false,
        error: `Membro já possui o perfil "${novoPerfil}"`
      }, { status: 400 });
    }

    // Atualizar o perfil
    const { data: membroAtualizado, error: updateError } = await supabase
      .from('servidor')
      .update({
        perfil: novoPerfil
      })
      .eq('id', membroId)
      .select(`
        id,
        matricula,
        nome,
        email,
        perfil,
        ativo,
        regional_id
      `)
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar perfil do membro:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar perfil do membro'
      }, { status: 500 });
    }

    // Log da alteração para auditoria
    console.log(`✅ [ADMIN-PERFIL] Perfil alterado:`, {
      membroId,
      matricula: membro.matricula,
      nome: membro.nome,
      perfilAnterior: membro.perfil,
      novoPerfil,
      regional: regionalInfo?.nome,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: {
        membro: membroAtualizado,
        alteracao: {
          perfilAnterior: membro.perfil,
          novoPerfil,
          dataAlteracao: new Date().toISOString()
        }
      },
      message: `Perfil alterado de "${membro.perfil}" para "${novoPerfil}" com sucesso!`,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na API de alteração de perfil:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 