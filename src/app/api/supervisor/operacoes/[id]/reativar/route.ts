import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const operacaoId = parseInt(params.id);
    const { supervisorId } = await request.json();

    // Validações básicas
    if (!supervisorId) {
      return NextResponse.json({
        success: false,
        error: 'Supervisor ID é obrigatório'
      }, { status: 400 });
    }

    // Verificar se supervisor existe e tem permissão
    const { data: supervisor, error: supervisorError } = await supabase
      .from('servidor')
      .select('id, perfil, ativo')
      .eq('id', supervisorId)
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json({
        success: false,
        error: 'Supervisor não encontrado'
      }, { status: 404 });
    }

    if (supervisor.perfil !== 'Supervisor' || !supervisor.ativo) {
      return NextResponse.json({
        success: false,
        error: 'Apenas supervisores ativos podem reativar operações'
      }, { status: 403 });
    }

    // Verificar se operação existe e pode ser reativada
    const { data: operacao, error: operacaoError } = await supabase
      .from('operacao')
      .select(`
        id, 
        ativa, 
        excluida_temporariamente,
        data_exclusao,
        pode_reativar_ate,
        motivo_exclusao,
        participacao(id, membro_id, ativa)
      `)
      .eq('id', operacaoId)
      .single();

    if (operacaoError || !operacao) {
      return NextResponse.json({
        success: false,
        error: 'Operação não encontrada'
      }, { status: 404 });
    }

    if (!operacao.excluida_temporariamente) {
      return NextResponse.json({
        success: false,
        error: 'Operação não está excluída temporariamente'
      }, { status: 400 });
    }

    // Verificar se ainda está dentro do prazo de reativação (24h)
    const agora = new Date();
    const podeReativarAte = new Date(operacao.pode_reativar_ate);

    if (agora > podeReativarAte) {
      return NextResponse.json({
        success: false,
        error: 'Prazo para reativação expirado (24 horas)'
      }, { status: 400 });
    }

    // Executar reativação usando função do banco
    const { data: resultado, error: reativacaoError } = await supabase
      .rpc('reativar_operacao', {
        p_operacao_id: operacaoId,
        p_supervisor_id: supervisorId
      });

    if (reativacaoError) {
      console.error('Erro na reativação:', reativacaoError);
      return NextResponse.json({
        success: false,
        error: 'Erro interno ao reativar operação'
      }, { status: 500 });
    }

    if (!resultado.sucesso) {
      return NextResponse.json({
        success: false,
        error: resultado.erro
      }, { status: 400 });
    }

    // Registrar justificativa de reativação
    await supabase
      .from('justificativa_obrigatoria')
      .insert({
        contexto: 'REATIVACAO_OPERACAO',
        referencia_id: operacaoId,
        justificativa: `Operação reativada pelo supervisor. Motivo original da exclusão: ${operacao.motivo_exclusao}`,
        usuario_id: supervisorId
      });

    // ✅ Realtime atualiza automaticamente via hooks useRealtimeOperacoes

    return NextResponse.json({
      success: true,
      data: {
        operacaoId,
        participacoesReativadas: resultado.participacoes_reativadas,
        motivoExclusaoOriginal: operacao.motivo_exclusao,
        dataExclusao: operacao.data_exclusao
      }
    });

  } catch (error) {
    console.error('Erro na reativação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 