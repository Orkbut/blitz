import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ✅ API SOLICITAÇÕES SUPERVISOR - Bounded Context: Administrativo
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // PENDENTE, APROVADA, REJEITADA
    const regionalId = url.searchParams.get('regionalId');

    console.log('🔍 [ADMIN] Buscando solicitações de supervisor:', { status, regionalId });

    let query = supabase
      .from('solicitacao_supervisor')
      .select(`
        id,
        matricula,
        nome,
        email,
        status,
        justificativa,
        data_solicitacao,
        data_analise,
        motivo_rejeicao,
        ativa,
        regional:regional_id(
          id,
          nome,
          codigo
        ),
        analisada_por_servidor:analisada_por(
          id,
          nome,
          matricula
        )
      `)
      .eq('ativa', true)
      .order('data_solicitacao', { ascending: false });

    // Filtros opcionais
    if (status) {
      query = query.eq('status', status);
    }
    if (regionalId) {
      query = query.eq('regional_id', parseInt(regionalId));
    }

    const { data: solicitacoes, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar solicitações:', error);
      throw error;
    }

    // Estatísticas rápidas
    const stats = {
      total: solicitacoes?.length || 0,
      pendentes: solicitacoes?.filter(s => s.status === 'PENDENTE').length || 0,
      aprovadas: solicitacoes?.filter(s => s.status === 'APROVADA').length || 0,
      rejeitadas: solicitacoes?.filter(s => s.status === 'REJEITADA').length || 0
    };

    console.log('✅ [ADMIN] Solicitações encontradas:', stats);

    return NextResponse.json({
      success: true,
      data: solicitacoes || [],
      stats,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao buscar solicitações:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { acao, solicitacaoId, adminId, motivo } = body;

    console.log('🔧 [ADMIN] Processando solicitação:', { acao, solicitacaoId, adminId });

    // Validações básicas
    if (!acao || !solicitacaoId || !adminId) {
      return NextResponse.json({
        success: false,
        error: 'Ação, ID da solicitação e ID do admin são obrigatórios',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    if (acao === 'aprovar') {
      return await aprovarSolicitacao(solicitacaoId, adminId);
    } else if (acao === 'rejeitar') {
      return await rejeitarSolicitacao(solicitacaoId, adminId, motivo);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Ação inválida. Use: aprovar ou rejeitar',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao processar solicitação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo"
    }, { status: 500 });
  }
}

// ✅ FUNÇÃO: Aprovar solicitação
async function aprovarSolicitacao(solicitacaoId: number, adminId: number) {
  try {
    // Usar a função do banco que já criamos
    const { data: resultado, error } = await supabase
      .rpc('aprovar_solicitacao_supervisor', {
        p_solicitacao_id: solicitacaoId,
        p_admin_id: adminId
      });

    if (error) {
      console.error('❌ Erro na função aprovar_solicitacao_supervisor:', error);
      throw error;
    }

    if (!resultado?.success) {
      return NextResponse.json({
        success: false,
        error: resultado?.error || 'Erro ao aprovar solicitação',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    console.log('✅ [ADMIN] Solicitação aprovada:', resultado);

    return NextResponse.json({
      success: true,
      data: resultado,
      message: 'Solicitação aprovada e conta de supervisor criada!',
      boundedContext: "administrativo"
    });

  } catch (error) {
    console.error('❌ Erro ao aprovar solicitação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao aprovar solicitação',
      boundedContext: "administrativo"
    }, { status: 500 });
  }
}

// ✅ FUNÇÃO: Rejeitar solicitação
async function rejeitarSolicitacao(solicitacaoId: number, adminId: number, motivo?: string) {
  try {
    // Verificar se solicitação existe e está pendente
    const { data: solicitacao, error: checkError } = await supabase
      .from('solicitacao_supervisor')
      .select('id, status, matricula, nome')
      .eq('id', solicitacaoId)
      .eq('status', 'PENDENTE')
      .single();

    if (checkError || !solicitacao) {
      return NextResponse.json({
        success: false,
        error: 'Solicitação não encontrada ou já processada',
        boundedContext: "administrativo"
      }, { status: 404 });
    }

    // Rejeitar solicitação
    const { data: solicitacaoRejeitada, error: updateError } = await supabase
      .from('solicitacao_supervisor')
      .update({
        status: 'REJEITADA',
        analisada_por: adminId,
        data_analise: new Date().toISOString(),
        motivo_rejeicao: motivo || 'Sem justificativa fornecida'
      })
      .eq('id', solicitacaoId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao rejeitar solicitação:', updateError);
      throw updateError;
    }

    console.log('✅ [ADMIN] Solicitação rejeitada:', {
      id: solicitacaoRejeitada.id,
      matricula: solicitacaoRejeitada.matricula,
      motivo
    });

    return NextResponse.json({
      success: true,
      data: solicitacaoRejeitada,
      message: 'Solicitação rejeitada com sucesso!',
      boundedContext: "administrativo"
    });

  } catch (error) {
    console.error('❌ Erro ao rejeitar solicitação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao rejeitar solicitação',
      boundedContext: "administrativo"
    }, { status: 500 });
  }
}

// ✅ APROVAR SOLICITAÇÃO - Cria conta supervisor
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, motivo_rejeicao } = body;

    console.log('🔧 [ADMIN] Processando solicitação:', { id, action, motivo_rejeicao });

    if (!id || !action) {
      return NextResponse.json({
        success: false,
        error: 'ID e ação são obrigatórios'
      }, { status: 400 });
    }

    // ✅ BUSCAR SOLICITAÇÃO
    const { data: solicitacao, error: errorBusca } = await supabase
      .from('solicitacao_supervisor')
      .select(`
        id,
        matricula,
        nome,
        email,
        senha_hash,
        regional_id,
        status,
        justificativa
      `)
      .eq('id', id)
      .eq('status', 'PENDENTE')
      .single();

    if (errorBusca || !solicitacao) {
      console.error('❌ [ADMIN] Solicitação não encontrada:', errorBusca);
      return NextResponse.json({
        success: false,
        error: 'Solicitação não encontrada ou já processada'
      }, { status: 404 });
    }

    if (action === 'APROVAR') {
      // ✅ CRIAR CONTA SUPERVISOR
      const { data: novoSupervisor, error: errorCriar } = await supabase
        .from('servidor')
        .insert({
          matricula: solicitacao.matricula,
          nome: solicitacao.nome,
          email: solicitacao.email,
          senha_hash: solicitacao.senha_hash,
          regional_id: solicitacao.regional_id,
          perfil: 'Supervisor',
          ativo: true,
          criado_em: new Date().toISOString()
        })
        .select()
        .single();

      if (errorCriar) {
        console.error('❌ [ADMIN] Erro ao criar supervisor:', errorCriar);
        return NextResponse.json({
          success: false,
          error: `Erro ao criar conta supervisor: ${errorCriar.message}`
        }, { status: 500 });
      }

      // ✅ ATUALIZAR SOLICITAÇÃO COMO APROVADA
      const { error: errorUpdate } = await supabase
        .from('solicitacao_supervisor')
        .update({
          status: 'APROVADA',
          data_analise: new Date().toISOString(),
          analisada_por: 1 // TODO: Pegar ID do admin logado
        })
        .eq('id', id);

      if (errorUpdate) {
        console.error('❌ [ADMIN] Erro ao atualizar solicitação:', errorUpdate);
      }

      console.log('✅ [ADMIN] Supervisor criado com sucesso:', novoSupervisor);
      return NextResponse.json({
        success: true,
        message: 'Solicitação aprovada e conta supervisor criada com sucesso',
        data: novoSupervisor
      });

    } else if (action === 'REJEITAR') {
      // ✅ REJEITAR SOLICITAÇÃO
      const { error: errorRejeitar } = await supabase
        .from('solicitacao_supervisor')
        .update({
          status: 'REJEITADA',
          data_analise: new Date().toISOString(),
          analisada_por: 1, // TODO: Pegar ID do admin logado
          motivo_rejeicao: motivo_rejeicao || 'Não especificado'
        })
        .eq('id', id);

      if (errorRejeitar) {
        console.error('❌ [ADMIN] Erro ao rejeitar solicitação:', errorRejeitar);
        return NextResponse.json({
          success: false,
          error: `Erro ao rejeitar solicitação: ${errorRejeitar.message}`
        }, { status: 500 });
      }

      console.log('✅ [ADMIN] Solicitação rejeitada com sucesso');
      return NextResponse.json({
        success: true,
        message: 'Solicitação rejeitada com sucesso'
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Ação inválida. Use APROVAR ou REJEITAR'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao processar solicitação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 