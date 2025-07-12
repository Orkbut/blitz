import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ FIX: Aguardar params antes de usar suas propriedades
    const resolvedParams = await params;
    const operacaoId = parseInt(resolvedParams.id);
    const { supervisorId, motivo } = await request.json();

    // Validações básicas
    if (!supervisorId || !motivo?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Supervisor ID e motivo são obrigatórios'
      }, { status: 400 });
    }

    if (motivo.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Motivo deve ter pelo menos 10 caracteres'
      }, { status: 400 });
    }

    // Verificar se supervisor existe e tem permissão
    const { data: supervisor, error: supervisorError } = await supabase
      .from('servidor')
      .select('id, perfil, ativo, nome, matricula')
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
        error: 'Apenas supervisores ativos podem excluir operações'
      }, { status: 403 });
    }

    // Verificar se operação existe e pode ser excluída
    const { data: operacao, error: operacaoError } = await supabase
      .from('operacao')
      .select(`
        id, 
        ativa, 
        excluida_temporariamente,
        data_operacao,
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

    if (!operacao.ativa) {
      return NextResponse.json({
        success: false,
        error: 'Operação já está inativa'
      }, { status: 400 });
    }

    if (operacao.excluida_temporariamente) {
      return NextResponse.json({
        success: false,
        error: 'Operação já está excluída temporariamente'
      }, { status: 400 });
    }

    // Verificar se operação já passou (não pode excluir operações do passado)
    const dataOperacao = new Date(operacao.data_operacao);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataOperacao < hoje) {
      return NextResponse.json({
        success: false,
        error: 'Não é possível excluir operações que já ocorreram'
      }, { status: 400 });
    }

    // ✅ IMPLEMENTAÇÃO MANUAL da exclusão temporária (função RPC não existe)
    // 1. Marcar operação como excluída temporariamente
    const { error: updateError } = await supabase
      .from('operacao')
      .update({
        excluida_temporariamente: true,
        ativa: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', operacaoId);

    if (updateError) {
      console.error('Erro ao atualizar operação:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro interno ao excluir operação'
      }, { status: 500 });
    }

    // 2. Desativar todas as participações da operação
    const { data: participacoesAfetadas, error: participacaoError } = await supabase
      .from('participacao')
      .update({
        ativa: false,
        estado_visual: 'CANCELADO',
        updated_at: new Date().toISOString()
      })
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .select('id, membro_id');

    if (participacaoError) {
      console.error('Erro ao desativar participações:', participacaoError);
      return NextResponse.json({
        success: false,
        error: 'Erro interno ao processar participações'
      }, { status: 500 });
    }

    // 3. ✅ CORRIGIDO: Registrar no histórico usando estrutura atual da tabela
    const dataModificacao = new Date().toISOString();
    const podeReativarAte = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: historicoError } = await supabase
      .from('historico_modificacao')
      .insert({
        entidade: 'operacao',
        entidade_id: operacaoId,
        acao: 'EXCLUSAO_TEMPORARIA',
        dados_anteriores: {
          ativa: true,
          excluida_temporariamente: false,
          participacoes_ativas: participacoesAfetadas?.length || 0
        },
        dados_novos: {
          ativa: false,
          excluida_temporariamente: true,
          motivo: motivo.trim(),
          pode_reativar_ate: podeReativarAte,
          supervisor_exclusao: {
            id: supervisorId,
            nome: supervisor.nome,
            matricula: supervisor.matricula
          }
        },
        usuario_id: supervisorId,
        data_modificacao: dataModificacao
      });

    if (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falha a operação por erro de histórico
    }

    // 4. Registrar justificativa obrigatória
    const { error: justificativaError } = await supabase
      .from('justificativa_obrigatoria')
      .insert({
        contexto: 'EXCLUSAO_OPERACAO',
        referencia_id: operacaoId,
        justificativa: motivo.trim(),
        usuario_id: supervisorId,
        data_criacao: dataModificacao
      });

    if (justificativaError) {
      console.error('Erro ao registrar justificativa:', justificativaError);
      // Não falha a operação por erro de justificativa
    }

    // 5. Registrar evento de auditoria (se a tabela existir)
    try {
      await supabase
        .from('eventos_operacao')
        .insert({
          operacao_id: operacaoId,
          tipo_evento: 'OPERACAO_EXCLUIDA',
          servidor_id: supervisorId,
          servidor_nome: supervisor.nome || 'Supervisor',
          servidor_matricula: supervisor.matricula || 'N/A',
          detalhes: `Operação excluída temporariamente pelo supervisor. Motivo: ${motivo.trim()}`,
          metadata: {
            motivo: motivo.trim(),
            participacoes_afetadas: participacoesAfetadas?.length || 0,
            pode_reativar_ate: podeReativarAte
          },
          icone: '🗑️',
          cor: '#991b1b',
          criado_por: supervisorId
        });
    } catch (eventoError) {
      console.log('Tabela eventos_operacao não encontrada, pulando registro de evento');
    }

    return NextResponse.json({
      success: true,
      data: {
        operacaoId,
        participacoesAfetadas: participacoesAfetadas?.length || 0,
        podeReativarAte: podeReativarAte,
        visivelAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
        motivo: motivo.trim()
      }
    });

  } catch (error) {
    console.error('Erro na exclusão temporária:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 