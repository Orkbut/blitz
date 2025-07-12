import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ✅ OTIMIZADO: Função auxiliar para promover o primeiro da fila
async function promoverPrimeiroDaFila(operacaoId: number) {
  // Buscar o primeiro da fila
  const { data: primeiroDaFila, error: filaError } = await supabase
    .from('participacao')
    .select('*')
    .eq('operacao_id', operacaoId)
    .eq('estado_visual', 'NA_FILA')
    .eq('ativa', true)
    .order('posicao_fila', { ascending: true })
    .limit(1)
    .single();

  if (filaError || !primeiroDaFila) {
    return null;
  }

  // Promover para CONFIRMADO
  const { data: promovido, error: promoverError } = await supabase
    .from('participacao')
    .update({
      estado_visual: 'CONFIRMADO',
      status_interno: 'APROVADO',
      posicao_fila: null,
      data_participacao: new Date().toISOString()
    })
    .eq('id', primeiroDaFila.id)
    .select()
    .single();

  if (promoverError) {
    console.error('❌ Erro ao promover participante:', promoverError);
    return null;
  }

  // Reorganizar posições da fila
  await reorganizarFila(operacaoId);

  return promovido;
}

// ✅ OTIMIZADO: Função para reorganizar as posições da fila
async function reorganizarFila(operacaoId: number) {
  // Buscar todos da fila ordenados
  const { data: fila, error: filaError } = await supabase
    .from('participacao')
    .select('id, posicao_fila')
    .eq('operacao_id', operacaoId)
    .eq('estado_visual', 'NA_FILA')
    .eq('ativa', true)
    .order('posicao_fila', { ascending: true });

  if (filaError || !fila || fila.length === 0) {
    return;
  }

  // Atualizar posições sequencialmente
  for (let i = 0; i < fila.length; i++) {
    const novaPosicao = i + 1;
    if (fila[i].posicao_fila !== novaPosicao) {
      await supabase
        .from('participacao')
        .update({ posicao_fila: novaPosicao })
        .eq('id', fila[i].id);
    }
  }
}

// ✅ OTIMIZADO: Função auxiliar para forçar atualização e garantir o realtime
async function forceRealtimeUpdate(operacaoId: number) {
  const { error } = await supabase
    .from('operacao')
    .update({ atualizacao_forcada: new Date().toISOString() })
    .eq('id', operacaoId);

  if (error) {
    console.error(`[FORCE_REALTIME_ERROR] Falha ao forçar update para op ${operacaoId}:`, error);
  }
}

// PUT - Aprovar ou rejeitar solicitação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const solicitacaoId = parseInt(id);
    const body = await request.json();
    const { acao, motivo } = body; // acao: 'aprovar' | 'rejeitar'

    if (isNaN(solicitacaoId)) {
      return NextResponse.json({
        success: false,
        error: 'ID da solicitação inválido'
      }, { status: 400 });
    }

    if (!acao || !['aprovar', 'rejeitar'].includes(acao)) {
      return NextResponse.json({
        success: false,
        error: 'Ação deve ser "aprovar" ou "rejeitar"'
      }, { status: 400 });
    }

    // ✅ OTIMIZADO: Log removido (performance)

    // Buscar a solicitação atual para validar
    const { data: solicitacao, error: buscarError } = await supabase
      .from('participacao')
      .select('*')
      .eq('id', solicitacaoId)
      .eq('ativa', true)
      .single();

    if (buscarError || !solicitacao) {
      console.error('❌ Erro ao buscar solicitação:', buscarError);
      return NextResponse.json({
        success: false,
        error: 'Solicitação não encontrada'
      }, { status: 404 });
    }

    // ✅ APROVAÇÃO DIRETA: Supervisor pode aprovar qualquer solicitação
    // Se está NA_FILA, promover para CONFIRMADO (supervisor tem poder total)

    // ✅ SUPERVISOR TEM PODER TOTAL: Pode aprovar qualquer solicitação
    // Remover validações restritivas

    // ✅ LÓGICA DE APROVAÇÃO/REJEIÇÃO
    let novoStatus;
    let novoEstadoVisual;
    let posicaoFila = null;

    if (acao === 'aprovar') {
      // ✅ VERIFICAR SE OPERAÇÃO JÁ ATINGIU LIMITE
      const { data: operacaoInfo, error: operacaoError } = await supabase
        .from('operacao')
        .select(`
          id, 
          limite_participantes,
          participacao!inner(id, estado_visual, ativa)
        `)
        .eq('id', solicitacao.operacao_id)
        .single();

      if (operacaoError) {
        return NextResponse.json({
          success: false,
          error: 'Erro ao verificar operação'
        }, { status: 500 });
      }

      const confirmados = operacaoInfo.participacao.filter((p: any) => 
        (p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP') && p.ativa
      ).length;

      const atingiuLimite = confirmados >= operacaoInfo.limite_participantes;

      // Lógica DEFINITIVA: Supervisor tem poder para ultrapassar o limite.
      // A API sempre tentará confirmar. O "superpoder" no banco de dados permitirá a ação.
      novoStatus = 'APROVADO';
      novoEstadoVisual = 'CONFIRMADO';
      posicaoFila = null; // Aprovado pelo supervisor nunca vai para a fila.

    } else {
      novoStatus = 'REJEITADO';
      novoEstadoVisual = 'DISPONIVEL';
    }

    if (acao === 'rejeitar') {
      console.log('🚨🚨🚨 [API-REJEITAR] INÍCIO DA REJEIÇÃO:', {
        solicitacaoId,
        membroId: solicitacao.membro_id,
        operacaoId: solicitacao.operacao_id,
        estadoAtual: solicitacao.estado_visual,
        timestamp: new Date().toISOString()
      });

      const operacaoId = solicitacao.operacao_id;
              const eraConfirmado = solicitacao.estado_visual === 'CONFIRMADO' || solicitacao.estado_visual === 'ADICIONADO_SUP';
      
      // ✅ OTIMIZADO: Buscar registro completo primeiro, depois deletar por ID
      const { data: participacaoParaDeletar, error: buscarError } = await supabase
        .from('participacao')
        .select('*')
        .eq('id', solicitacaoId)
        .eq('ativa', true)
        .single();

      if (buscarError || !participacaoParaDeletar) {
        console.error(`❌ [REJEITAR] Participação não encontrada:`, buscarError);
        return NextResponse.json({
          success: false,
          error: 'Participação não encontrada',
          details: buscarError?.message
        }, { status: 404 });
      }

      console.log('🔄 [API-REJEITAR] Executando DELETE no banco de dados...', {
        participacaoId: participacaoParaDeletar.id,
        membroId: participacaoParaDeletar.membro_id,
        operacaoId: participacaoParaDeletar.operacao_id
      });

      // ✅ OTIMIZADO: Deletar por ID para payload realtime correto
      const { error: deletarError } = await supabase
        .from('participacao')
        .delete()
        .eq('id', participacaoParaDeletar.id);

      if (deletarError) {
        console.error('❌ [REJEITAR] ERRO NO DELETE SUPABASE:', deletarError);
        
        // ✅ MENSAGENS DE ERRO MAIS ESPECÍFICAS PARA REJEIÇÃO
        let mensagemEspecifica = 'Erro ao processar rejeição';
        
        if (deletarError.code === 'PGRST116') {
          mensagemEspecifica = 'Solicitação não encontrada ou já foi processada';
        } else if (deletarError.message?.includes('foreign key')) {
          mensagemEspecifica = 'Não é possível rejeitar - solicitação possui dependências';
        }
        
        return NextResponse.json({
          success: false,
          error: mensagemEspecifica,
          details: deletarError.message
        }, { status: 500 });
      }

      // 🎯 NOVA LÓGICA: Se era confirmado, uma vaga é aberta. O supervisor decide quem entra.
      let participantePromovido = null;
      if (eraConfirmado) {
        // **PROMOÇÃO AUTOMÁTICA REMOVIDA**
        // Uma vaga foi aberta. O supervisor irá aprovar o próximo participante manualmente.
        // A fila não precisa ser reorganizada neste ponto, pois ninguém da fila foi removido.
        // Apenas a contagem de 'confirmados' diminuiu, o que o frontend irá refletir.
      } else if (solicitacao.estado_visual === 'NA_FILA') {
        // Se um membro que estava na fila foi rejeitado, aí sim a fila precisa ser reorganizada.
        await reorganizarFila(operacaoId);
      }

      console.log('✅ [API-REJEITAR] DELETE executado com SUCESSO! Participação removida do banco.');
      console.log('🔄 [API-REJEITAR] Forçando atualização do real-time...');

      // ✅ Garantia de Realtime
      await forceRealtimeUpdate(operacaoId);

      console.log('🎯 [API-REJEITAR] REJEIÇÃO COMPLETA! Real-time deveria ter disparado eventos.');

      return NextResponse.json({
        success: true,
        message: 'Solicitação rejeitada com sucesso!',
        data: {
          id: solicitacaoId,
          status: 'REJEITADO',
          acao: 'rejeitar',
          motivo: motivo || null,
          deletada: true,
          participantePromovido: null // Garante que nunca haverá promoção automática na resposta
        },
        source: 'SUPABASE_CLIENT_REAL'
      });
    } else {
      // ✅ SUPERVISOR TEM PODER TOTAL: Usar RPC direto para operação segura
      let resultadoRPC, atualizarError;
      try {
        // 🔍 LOG ESTRATÉGICO: Monitorar uso da RPC aprovar_com_poder_supervisor
        // Para análise futura - tooltip foi removido em [DATA]
        console.log(`🔍 [TOOLTIP-MONITORING] RPC aprovar_com_poder_supervisor chamada`, {
          participacao_id: solicitacaoId,
          novo_status: novoStatus,
          novo_estado_visual: novoEstadoVisual,
          timestamp: new Date().toISOString(),
          stackTrace: new Error().stack?.split('\n').slice(0, 3) || []
        });

        // Ativa o modo de "superpoder" do supervisor no nível da sessão
        await supabase.rpc('set_config', { key: 'app.supervisor_override', value: 'true', is_local: true });
        
        const rpcResult = await supabase.rpc('aprovar_com_poder_supervisor', {
          p_participacao_id: solicitacaoId,
          p_novo_status: novoStatus,
          p_novo_estado_visual: novoEstadoVisual,
          p_posicao_fila: posicaoFila
        });
        resultadoRPC = rpcResult.data;
        atualizarError = rpcResult.error;
      } catch (rpcCatchError) {
        console.error('[APROVACAO][RPC][EXCEPTION] Erro ao executar RPC:', rpcCatchError);
        return NextResponse.json({
          success: false,
          error: 'Erro interno ao executar aprovação (RPC)',
          details: rpcCatchError?.message || rpcCatchError
        }, { status: 500 });
      } finally {
        // Garante que o modo de "superpoder" seja desativado ao final da transação
        await supabase.rpc('set_config', { key: 'app.supervisor_override', value: '', is_local: true });
      }

      if (atualizarError) {
        console.error('[APROVACAO][ERRO] Erro retornado pela RPC:', atualizarError);
        return NextResponse.json({
          success: false,
          error: atualizarError.message || 'Erro interno na aprovação',
          details: atualizarError
        }, { status: 500 });
      }

      if (!resultadoRPC || resultadoRPC.length === 0) {
        console.error('[APROVACAO][ERRO] RPC não retornou dados. Resultado:', resultadoRPC);
        return NextResponse.json({
          success: false,
          error: 'Erro interno - nenhum dado retornado pela aprovação',
          details: resultadoRPC
        }, { status: 500 });
      }

      // ✅ OTIMIZADO: Log removido (performance)

      // ✅ Realtime atualiza automaticamente via hooks useRealtimeOperacoes

      // ✅ MENSAGEM INTELIGENTE baseada no resultado
      let mensagemSucesso = 'Solicitação aprovada com sucesso!';
      if (novoEstadoVisual === 'NA_FILA') {
        mensagemSucesso = 'Solicitação aprovada! Membro adicionado à fila de espera.';
      } else if (novoEstadoVisual === 'CONFIRMADO') {
        mensagemSucesso = 'Solicitação aprovada! Membro confirmado na operação.';
      }

      // ✅ Garantia de Realtime
      await forceRealtimeUpdate(solicitacao.operacao_id);

      return NextResponse.json({
        success: true,
        message: mensagemSucesso,
        data: {
          id: resultadoRPC.id,
          status: resultadoRPC.status_interno,
          estado_visual: novoEstadoVisual,
          posicao_fila: posicaoFila,
          acao: 'aprovar',
          motivo: motivo || null
        },
        source: 'SUPABASE_CLIENT_REAL'
      });
    }

  } catch (error) {
    console.error('❌ Erro na API de processamento de solicitações:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 