import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para exclusão completa de membro - Contexto: Administrativo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const membroId = parseInt(params.id);

    if (isNaN(membroId)) {
      return NextResponse.json({
        success: false,
        error: 'ID do membro inválido'
      }, { status: 400 });
    }

    // Verificar se o membro existe
    const { data: membro, error: membroError } = await supabase
      .from('servidor')
      .select('id, matricula, nome, perfil, regional_id')
      .eq('id', membroId)
      .single();

    if (membroError || !membro) {
      return NextResponse.json({
        success: false,
        error: 'Membro não encontrado'
      }, { status: 404 });
    }

    // Verificar se há participações ativas que impediriam a exclusão
    const { data: participacoesAtivas, error: participacoesError } = await supabase
      .from('participacao')
      .select('id, operacao_id')
      .eq('membro_id', membroId)
      .eq('ativa', true);

    if (participacoesError) {
      console.error('Erro ao verificar participações:', participacoesError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao verificar participações do membro'
      }, { status: 500 });
    }

    if (participacoesAtivas && participacoesAtivas.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Não é possível excluir: membro possui ${participacoesAtivas.length} participações ativas em operações`,
        participacoes_ativas: participacoesAtivas.length
      }, { status: 400 });
    }

    // Verificar se é supervisor de alguma operação ativa
    const { data: operacoesSupervisor, error: operacoesError } = await supabase
      .from('janela_operacional')
      .select('id')
      .eq('supervisor_id', membroId)
      .eq('ativa', true);

    if (operacoesError) {
      console.error('Erro ao verificar janelas supervisionadas:', operacoesError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao verificar responsabilidades de supervisão'
      }, { status: 500 });
    }

    if (operacoesSupervisor && operacoesSupervisor.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Não é possível excluir: membro é supervisor de ${operacoesSupervisor.length} janelas operacionais ativas`,
        janelas_ativas: operacoesSupervisor.length
      }, { status: 400 });
    }

    // Exclusão segura - primeiro inativar, depois excluir referências
    
    // 1. Inativar participações históricas (manter histórico mas inativar)
    await supabase
      .from('participacao')
      .update({ ativa: false })
      .eq('membro_id', membroId);

    // 2. Inativar janelas operacionais históricas
    await supabase
      .from('janela_operacional')
      .update({ ativa: false })
      .eq('supervisor_id', membroId);

    // 3. Marcar eventos como inativos (preservar auditoria)
    await supabase
      .from('eventos_operacao')
      .update({ metadata: JSON.stringify({ membro_excluido: true, data_exclusao: new Date().toISOString() }) })
      .eq('servidor_id', membroId);

    // 4. Finalmente, excluir o registro principal
    const { error: deleteError } = await supabase
      .from('servidor')
      .delete()
      .eq('id', membroId);

    if (deleteError) {
      console.error('Erro ao excluir membro:', deleteError);
      return NextResponse.json({
        success: false,
        error: `Erro ao excluir membro: ${deleteError.message}`
      }, { status: 500 });
    }

    // Log da exclusão para auditoria
    console.log(`✅ [ADMIN-EXCLUSAO] Membro excluído:`, {
      membroId,
      matricula: membro.matricula,
      nome: membro.nome,
      perfil: membro.perfil,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Membro ${membro.nome} (${membro.matricula}) excluído com sucesso`,
      data: {
        membro_excluido: {
          id: membro.id,
          nome: membro.nome,
          matricula: membro.matricula,
          perfil: membro.perfil
        }
      },
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API de exclusão de membro:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 