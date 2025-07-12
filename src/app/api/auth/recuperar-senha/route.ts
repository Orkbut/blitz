import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ✅ API RECUPERAÇÃO DE SENHA - Solução Simples
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, justificativa } = body;

    console.log('🔑 [RECUPERAÇÃO] Solicitação de recuperação:', { matricula, justificativa });

    // Validações básicas
    if (!matricula?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Matrícula é obrigatória',
        campo: 'matricula'
      }, { status: 400 });
    }

    // ✅ BUSCAR SERVIDOR PELA MATRÍCULA
    const { data: servidor, error: errorServidor } = await supabase
      .from('servidor')
      .select(`
        id,
        matricula,
        nome,
        perfil,
        regional_id,
        ativo,
        regional:regional_id(id, nome, codigo)
      `)
      .eq('matricula', matricula.trim())
      .eq('ativo', true)
      .single();

    if (errorServidor || !servidor) {
      console.error('❌ [RECUPERAÇÃO] Servidor não encontrado:', errorServidor);
      return NextResponse.json({
        success: false,
        error: 'Matrícula não encontrada ou usuário inativo',
        campo: 'matricula'
      }, { status: 404 });
    }

    // ✅ VERIFICAR SE JÁ EXISTE SOLICITAÇÃO PENDENTE
    const { data: solicitacaoExistente } = await supabase
      .from('solicitacao_recuperacao_senha')
      .select('id, status, data_solicitacao')
      .eq('matricula', matricula.trim())
      .eq('status', 'PENDENTE')
      .eq('ativa', true)
      .single();

    if (solicitacaoExistente) {
      return NextResponse.json({
        success: false,
        error: 'Já existe uma solicitação de recuperação pendente para esta matrícula',
        campo: 'matricula',
        detalhes: {
          dataSolicitacao: solicitacaoExistente.data_solicitacao
        }
      }, { status: 400 });
    }

    // ✅ CRIAR SOLICITAÇÃO DE RECUPERAÇÃO
    const { data: novaSolicitacao, error: errorInsert } = await supabase
      .from('solicitacao_recuperacao_senha')
      .insert({
        matricula: servidor.matricula,
        nome: servidor.nome,
        perfil: servidor.perfil,
        regional_id: servidor.regional_id,
        justificativa: justificativa?.trim() || 'Usuário esqueceu a senha',
        status: 'PENDENTE',
        data_solicitacao: new Date().toISOString()
      })
      .select(`
        id,
        matricula,
        nome,
        perfil,
        status,
        data_solicitacao,
        regional:regional_id(nome, codigo)
      `)
      .single();

    if (errorInsert) {
      console.error('❌ [RECUPERAÇÃO] Erro ao criar solicitação:', errorInsert);
      return NextResponse.json({
        success: false,
        error: 'Erro interno ao criar solicitação de recuperação'
      }, { status: 500 });
    }

    console.log('✅ [RECUPERAÇÃO] Solicitação criada:', {
      id: novaSolicitacao.id,
      matricula: novaSolicitacao.matricula,
      nome: novaSolicitacao.nome
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitação de recuperação de senha enviada para análise do administrador',
      data: {
        id: novaSolicitacao.id,
        matricula: novaSolicitacao.matricula,
        nome: novaSolicitacao.nome,
        perfil: novaSolicitacao.perfil,
        status: novaSolicitacao.status,
        dataEnvio: novaSolicitacao.data_solicitacao,
        regional: novaSolicitacao.regional
      }
    }, { status: 201 });

  } catch (error) {
    console.error('❌ [RECUPERAÇÃO] Erro geral:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// ✅ LISTAR SOLICITAÇÕES (PARA ADMIN)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    console.log('📋 [RECUPERAÇÃO] Listando solicitações:', { status });

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
      .eq('ativa', true)
      .order('data_solicitacao', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: solicitacoes, error } = await query;

    if (error) {
      console.error('❌ [RECUPERAÇÃO] Erro ao buscar solicitações:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar solicitações'
      }, { status: 500 });
    }

    // ✅ CALCULAR ESTATÍSTICAS
    const stats = {
      total: solicitacoes?.length || 0,
      pendentes: solicitacoes?.filter(s => s.status === 'PENDENTE').length || 0,
      aprovadas: solicitacoes?.filter(s => s.status === 'APROVADA').length || 0,
      rejeitadas: solicitacoes?.filter(s => s.status === 'REJEITADA').length || 0
    };

    return NextResponse.json({
      success: true,
      data: solicitacoes || [],
      stats
    });

  } catch (error) {
    console.error('❌ [RECUPERAÇÃO] Erro ao listar:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 