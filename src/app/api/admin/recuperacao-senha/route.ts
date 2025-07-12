import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ✅ FUNÇÃO HELPER: Limpar solicitações anteriores da mesma matrícula
async function limparSolicitacoesAnteriores(matricula: string) {
  console.log('🧹 [ADMIN-RECUPERAÇÃO] Limpando solicitações anteriores para:', matricula);
  
  const { error } = await supabase
    .from('solicitacao_recuperacao_senha')
    .update({ ativa: false })
    .eq('matricula', matricula)
    .eq('ativa', true);

  if (error) {
    console.error('❌ [ADMIN-RECUPERAÇÃO] Erro ao limpar solicitações anteriores:', error);
  } else {
    console.log('✅ [ADMIN-RECUPERAÇÃO] Solicitações anteriores limpas');
  }
}

// ✅ GERENCIAR RECUPERAÇÃO DE SENHA (ADMIN)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, motivo_rejeicao, nova_senha_temp } = body;

    console.log('🔧 [ADMIN-RECUPERAÇÃO] Processando:', { id, action });

    if (!id || !action) {
      return NextResponse.json({
        success: false,
        error: 'ID e ação são obrigatórios'
      }, { status: 400 });
    }

    // ✅ BUSCAR SOLICITAÇÃO
    const { data: solicitacao, error: errorBusca } = await supabase
      .from('solicitacao_recuperacao_senha')
      .select(`
        id,
        matricula,
        nome,
        perfil,
        regional_id,
        status,
        justificativa
      `)
      .eq('id', id)
      .eq('status', 'PENDENTE')
      .eq('ativa', true)
      .single();

    if (errorBusca || !solicitacao) {
      console.error('❌ [ADMIN-RECUPERAÇÃO] Solicitação não encontrada:', errorBusca);
      return NextResponse.json({
        success: false,
        error: 'Solicitação não encontrada ou já processada'
      }, { status: 404 });
    }

    if (action === 'APROVAR') {
      // ✅ GERAR SENHA TEMPORÁRIA SIMPLES
      const senhaTemp = nova_senha_temp || `temp${solicitacao.matricula}123`;

      // ✅ LIMPAR SOLICITAÇÕES ANTERIORES ANTES DE PROCESSAR
      await limparSolicitacoesAnteriores(solicitacao.matricula);

      // ✅ ATUALIZAR SENHA DO SERVIDOR
      const { error: errorUpdateSenha } = await supabase
        .from('servidor')
        .update({
          senha_hash: senhaTemp // Senha temporária simples
        })
        .eq('matricula', solicitacao.matricula);

      if (errorUpdateSenha) {
        console.error('❌ [ADMIN-RECUPERAÇÃO] Erro ao atualizar senha:', errorUpdateSenha);
        return NextResponse.json({
          success: false,
          error: `Erro ao atualizar senha: ${errorUpdateSenha.message}`
        }, { status: 500 });
      }

      // ✅ CRIAR REGISTRO DE APROVAÇÃO NO HISTÓRICO
      const { error: errorHistorico } = await supabase
        .from('solicitacao_recuperacao_senha')
        .insert({
          matricula: solicitacao.matricula,
          nome: solicitacao.nome,
          perfil: solicitacao.perfil,
          regional_id: solicitacao.regional_id,
          justificativa: solicitacao.justificativa || '',
          status: 'APROVADA',
          data_solicitacao: new Date().toISOString(),
          data_analise: new Date().toISOString(),
          analisada_por: 1, // TODO: Pegar ID do admin logado
          nova_senha_temp: senhaTemp,
          senha_alterada: false,
          ativa: false // Para histórico apenas
        });

      if (errorHistorico) {
        console.error('❌ [ADMIN-RECUPERAÇÃO] Erro ao criar histórico de aprovação:', errorHistorico);
        // Continua mesmo se falhar, pois a senha foi atualizada
      }

      console.log('✅ [ADMIN-RECUPERAÇÃO] Recuperação aprovada:', {
        matricula: solicitacao.matricula,
        senhaTemp: senhaTemp
      });

      return NextResponse.json({
        success: true,
        message: 'Recuperação aprovada e senha temporária definida',
        data: {
          matricula: solicitacao.matricula,
          nome: solicitacao.nome,
          senhaTemporaria: senhaTemp
        }
      });

    } else if (action === 'REJEITAR') {
      // ✅ LIMPAR SOLICITAÇÕES ANTERIORES ANTES DE PROCESSAR
      await limparSolicitacoesAnteriores(solicitacao.matricula);

      // ✅ CRIAR REGISTRO DE REJEIÇÃO NO HISTÓRICO
      const { error: errorHistorico } = await supabase
        .from('solicitacao_recuperacao_senha')
        .insert({
          matricula: solicitacao.matricula,
          nome: solicitacao.nome,
          perfil: solicitacao.perfil,
          regional_id: solicitacao.regional_id,
          justificativa: solicitacao.justificativa || '',
          status: 'REJEITADA',
          data_solicitacao: new Date().toISOString(),
          data_analise: new Date().toISOString(),
          analisada_por: 1, // TODO: Pegar ID do admin logado
          motivo_rejeicao: motivo_rejeicao || 'Não especificado',
          ativa: false // Para histórico apenas
        });

      if (errorHistorico) {
        console.error('❌ [ADMIN-RECUPERAÇÃO] Erro ao criar histórico de rejeição:', errorHistorico);
        return NextResponse.json({
          success: false,
          error: 'Erro ao processar rejeição'
        }, { status: 500 });
      }

      console.log('✅ [ADMIN-RECUPERAÇÃO] Recuperação rejeitada');
      return NextResponse.json({
        success: true,
        message: 'Solicitação de recuperação rejeitada'
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Ação inválida. Use APROVAR ou REJEITAR'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ [ADMIN-RECUPERAÇÃO] Erro geral:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// ✅ LISTAR SOLICITAÇÕES PARA ADMIN (INCLUINDO HISTÓRICO)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    console.log('📋 [ADMIN-RECUPERAÇÃO] Listando para admin:', { status });

    let query = supabase
      .from('solicitacao_recuperacao_senha')
      .select(`
        id,
        matricula,
        nome,
        perfil,
        status,
        justificativa,
        data_solicitacao,
        data_analise,
        motivo_rejeicao,
        nova_senha_temp,
        senha_alterada,
        ativa,
        regional:regional_id(id, nome, codigo),
        analisada_por_servidor:analisada_por(id, nome, matricula)
      `)
      .order('data_solicitacao', { ascending: false });

    // ✅ FILTRAR: Apenas ativas (pendentes) + histórico (inativas processadas)
    if (status === 'PENDENTE') {
      query = query.eq('ativa', true).eq('status', 'PENDENTE');
    } else if (status === 'APROVADA' || status === 'REJEITADA') {
      query = query.eq('ativa', false).eq('status', status);
    } else {
      // TODAS: pendentes ativas + histórico inativo
      query = query.or('ativa.eq.true,and(ativa.eq.false,status.neq.PENDENTE)');
    }

    const { data: solicitacoes, error } = await query;

    if (error) {
      console.error('❌ [ADMIN-RECUPERAÇÃO] Erro ao buscar solicitações:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar solicitações'
      }, { status: 500 });
    }

    // ✅ CALCULAR ESTATÍSTICAS (apenas ativas + histórico válido)
    const todasSolicitacoes = solicitacoes || [];
    const stats = {
      total: todasSolicitacoes.length,
      pendentes: todasSolicitacoes.filter(s => s.ativa && s.status === 'PENDENTE').length,
      aprovadas: todasSolicitacoes.filter(s => !s.ativa && s.status === 'APROVADA').length,
      rejeitadas: todasSolicitacoes.filter(s => !s.ativa && s.status === 'REJEITADA').length
    };

    return NextResponse.json({
      success: true,
      data: todasSolicitacoes,
      stats
    });

  } catch (error) {
    console.error('❌ [ADMIN-RECUPERAÇÃO] Erro ao listar:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 