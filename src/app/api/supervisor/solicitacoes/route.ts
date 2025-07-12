import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { smartLogger } from '@/lib/logger';

// GET - Buscar TODAS as solicitações pendentes de aprovação
export async function GET(request: NextRequest) {
  try {
    // ✅ BUSCA COM JOINS PARA DADOS REAIS - INCLUINDO HISTÓRICO
    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select(`
        *,
        operacao!inner(
          id,
          modalidade,
          tipo,
          data_operacao,
          turno,
          limite_participantes
        ),
        servidor!inner(
          id,
          nome,
          matricula
        )
      `)
      .in('status_interno', ['AGUARDANDO_SUPERVISOR', 'APROVADO', 'REJEITADO'])
      .eq('ativa', true)
      .order('data_participacao', { ascending: false });

    if (error) {
      smartLogger.error('Erro Supabase solicitações:', error);
      throw error;
    }

    // ✅ LOG INTELIGENTE: Só mostra quando há mudanças
    smartLogger.solicitacoes(participacoes?.length || 0);

    // ✅ TRANSFORMAR DADOS REAIS PARA FORMATO ESPERADO PELO FRONTEND
    const solicitacoesFormatadas = (participacoes || []).map((p: any) => ({
      id: p.id,
      membroNome: p.servidor?.nome || `Servidor ${p.membro_id}`,
      membroMatricula: p.servidor?.matricula || '',
      membroId: p.membro_id,
      membro: { 
        id: p.membro_id,
        nome: p.servidor?.nome || `Servidor ${p.membro_id}`,
        matricula: p.servidor?.matricula || '',
        cpf: ''
      },
      operacao: `${p.operacao?.modalidade} ${p.operacao?.tipo} - ${p.operacao?.turno}`,
      operacaoDetalhes: {
        id: p.operacao_id,
        modalidade: p.operacao?.modalidade || 'BALANCA',
        tipo: p.operacao?.tipo || 'PLANEJADA',
        data_operacao: p.operacao?.data_operacao || new Date().toISOString().split('T')[0],
        turno: p.operacao?.turno || 'NOITE',
        limite_participantes: p.operacao?.limite_participantes || 30
      },
      dataOperacao: p.operacao?.data_operacao || new Date().toISOString().split('T')[0],
      turno: p.operacao?.turno || 'NOITE',
      status: p.status_interno,
      estadoVisual: p.estado_visual,
      timestamp: p.data_participacao,
      posicaoFila: p.posicao_fila,
      // ✅ NOVO: Indicadores para ordem FIFO
      isProximoDaFila: p.posicao_fila === 1,
      isNaFila: p.estado_visual === 'NA_FILA',
      ordemChegada: new Date(p.data_participacao).getTime()
    }));

    // ✅ NOVO: Separar por tipo para facilitar interface do supervisor
    const confirmados = solicitacoesFormatadas.filter(s => s.estadoVisual === 'CONFIRMADO');
    const naFila = solicitacoesFormatadas.filter(s => s.estadoVisual === 'NA_FILA')
      .sort((a, b) => (a.posicaoFila || 0) - (b.posicaoFila || 0));
    const historico = solicitacoesFormatadas.filter(s => s.status === 'APROVADO' || s.status === 'REJEITADO');

    return NextResponse.json({
      success: true,
      data: {
        todas: solicitacoesFormatadas,
        confirmados: confirmados,
        naFila: naFila,
        historico: historico,
        proximoDaFila: naFila.find(s => s.posicaoFila === 1) || null
      },
      count: solicitacoesFormatadas.length,
      phase: "DADOS_REAIS_SUPABASE_CORRIGIDO",
      boundedContext: "supervisor",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    smartLogger.error('Erro na API de solicitações:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      phase: "ERRO_BANCO_REAL",
      boundedContext: "supervisor",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// POST - Processar solicitação com validação FIFO
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { solicitacaoId, acao, motivo, justificativaQuebraFifo } = body;

    if (!solicitacaoId || !acao || !['aprovar', 'rejeitar'].includes(acao)) {
      return NextResponse.json({
        success: false,
        error: 'Dados inválidos. Ação deve ser "aprovar" ou "rejeitar"',
        boundedContext: "supervisor"
      }, { status: 400 });
    }

    // ✅ BUSCAR DADOS DA SOLICITAÇÃO
    const { data: solicitacao, error: errorBusca } = await supabase
      .from('participacao')
      .select('*, operacao!inner(id)')
      .eq('id', solicitacaoId)
      .single();

    if (errorBusca || !solicitacao) {
      return NextResponse.json({
        success: false,
        error: 'Solicitação não encontrada',
        boundedContext: "supervisor"
      }, { status: 404 });
    }

    // ✅ VALIDAÇÃO FIFO: Se está na fila e não é o próximo
    if (solicitacao.estado_visual === 'NA_FILA' && solicitacao.posicao_fila > 1 && acao === 'aprovar') {
      if (!justificativaQuebraFifo || justificativaQuebraFifo.trim().length < 10) {
        return NextResponse.json({
          success: false,
          error: 'Justificativa obrigatória para aprovar fora da ordem FIFO (mínimo 10 caracteres)',
          requiresJustification: true,
          posicaoAtual: solicitacao.posicao_fila,
          boundedContext: "supervisor"
        }, { status: 400 });
      }

      // ✅ REGISTRAR QUEBRA DE FIFO PARA AUDITORIA
      await supabase
        .from('historico_modificacao')
        .insert({
          tabela: 'participacao',
          registro_id: solicitacaoId,
          acao: 'QUEBRA_FIFO',
          dados_anteriores: { posicao_fila: solicitacao.posicao_fila },
          dados_novos: { aprovado_fora_ordem: true },
          justificativa: justificativaQuebraFifo,
          usuario_id: 1, // TODO: Pegar do contexto de autenticação
          timestamp: new Date().toISOString()
        });
    }

    let novoStatus = '';
    let novoEstadoVisual = '';
    
    if (acao === 'aprovar') {
      novoStatus = 'APROVADO';
      novoEstadoVisual = 'CONFIRMADO';
    } else {
      novoStatus = 'REJEITADO';
      novoEstadoVisual = 'DISPONIVEL';
    }

    if (acao === 'rejeitar') {
      const operacaoId = solicitacao.operacao_id;
              const eraConfirmado = solicitacao.estado_visual === 'CONFIRMADO' || solicitacao.estado_visual === 'ADICIONADO_SUP';
      
      // ✅ CORREÇÃO REALTIME: Buscar registro completo primeiro, depois deletar por ID
      await supabase
        .from('participacao')
        .delete()
        .eq('id', solicitacaoId);  // ✅ DELETE POR ID = PAYLOAD REALTIME COM operacao_id!

      // 🎯 NOVA LÓGICA: Se era confirmado, uma vaga é aberta. O supervisor decide.
      let participantePromovido = null;
      if (eraConfirmado) {
        // **PROMOÇÃO AUTOMÁTICA REMOVIDA**
        // Uma vaga foi aberta. O supervisor irá aprovar o próximo participante manualmente.
      } else if (solicitacao.estado_visual === 'NA_FILA') {
        // Se um membro que estava na fila foi rejeitado, aí sim a fila precisa ser reorganizada.
        await reorganizarFila(operacaoId);
      }

      return NextResponse.json({
        success: true,
        data: {
          id: solicitacaoId,
          status: 'REJEITADO',
          estadoVisual: 'DISPONIVEL',
          acao: 'rejeitar',
          deletada: true,
          timestamp: new Date().toISOString(),
          participantePromovido: null // Garante que a resposta não inclua promoção
        },
        message: 'Solicitação rejeitada com sucesso',
        boundedContext: "supervisor"
      });
    } else {
      // ✅ APROVAR: Atualizar normalmente
      const { data, error } = await supabase
        .from('participacao')
        .update({
          status_interno: novoStatus,
          estado_visual: novoEstadoVisual,
          posicao_fila: null, // Limpar fila quando aprovado
          ativa: true
        })
        .eq('id', solicitacaoId)
        .select()
        .single();

      if (error) {
        smartLogger.error('Erro ao processar aprovação:', error);
        return NextResponse.json({
          success: false,
          error: 'Erro ao processar aprovação',
          boundedContext: "supervisor"
        }, { status: 500 });
      }

      smartLogger.success(`Solicitação aprovada - ID: ${solicitacaoId}`);

      // ✅ SE APROVOU ALGUÉM DA FILA, REORGANIZAR POSIÇÕES
      if (solicitacao.estado_visual === 'NA_FILA') {
        await reorganizarFilaAposAprovacao(solicitacao.operacao_id, solicitacao.posicao_fila);
      }

      return NextResponse.json({
        success: true,
        data: {
          id: data.id,
          status: novoStatus,
          estadoVisual: novoEstadoVisual,
          acao: 'aprovar',
          quebrouFifo: solicitacao.estado_visual === 'NA_FILA' && solicitacao.posicao_fila > 1,
          justificativaQuebraFifo: justificativaQuebraFifo || null,
          timestamp: new Date().toISOString()
        },
        message: 'Solicitação aprovada com sucesso',
        boundedContext: "supervisor"
      });
    }

  } catch (error) {
    smartLogger.error('Erro ao processar solicitação:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "supervisor",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// ✅ FUNÇÃO AUXILIAR: Reorganizar fila após aprovação
async function reorganizarFilaAposAprovacao(operacaoId: number, posicaoRemovida: number) {
  try {
    // Atualizar posições de quem estava depois na fila
    const { error } = await supabase.rpc('reorganizar_fila_apos_aprovacao', {
      operacao_id: operacaoId,
      posicao_removida: posicaoRemovida
    });

    if (error) {
      // Fallback: fazer manualmente se a função RPC não existir
      const { data: filaRestante } = await supabase
        .from('participacao')
        .select('id, posicao_fila')
        .eq('operacao_id', operacaoId)
        .eq('estado_visual', 'NA_FILA')
        .gt('posicao_fila', posicaoRemovida)
        .order('posicao_fila', { ascending: true });

      if (filaRestante) {
        for (const item of filaRestante) {
          await supabase
            .from('participacao')
            .update({ posicao_fila: item.posicao_fila - 1 })
            .eq('id', item.id);
        }
      }
    }

    smartLogger.success(`Fila reorganizada após aprovação - operação ${operacaoId}`);
  } catch (error) {
    smartLogger.error('Erro ao reorganizar fila:', error);
  }
}

// ✅ FUNÇÃO AUXILIAR: Promover o primeiro da fila
async function promoverPrimeiroDaFila(operacaoId: number) {
  try {
    // Buscar o primeiro da fila
    const { data: primeiroDaFila, error } = await supabase
      .from('participacao')
      .select('*')
      .eq('operacao_id', operacaoId)
      .eq('estado_visual', 'NA_FILA')
      .order('posicao_fila', { ascending: true })
      .limit(1);

    if (error || !primeiroDaFila || primeiroDaFila.length === 0) {
      smartLogger.error('Erro ao buscar primeiro da fila:', error);
      return null;
    }

    const primeiro = primeiroDaFila[0];

    // Atualizar status do primeiro da fila
    const { data: atualizado, error: atualizarError } = await supabase
      .from('participacao')
      .update({
        status_interno: 'APROVADO',
        estado_visual: 'CONFIRMADO',
        posicao_fila: null,
        ativa: true
      })
      .eq('id', primeiro.id)
      .select()
      .single();

    if (atualizarError) {
      smartLogger.error('Erro ao atualizar status do primeiro da fila:', atualizarError);
      return null;
    }

    smartLogger.success(`Primeiro da fila promovido - ID: ${primeiro.id}, Membro: ${primeiro.membro_id}`);
    
    // Reorganizar a fila restante
    await reorganizarFilaAposAprovacao(operacaoId, 1);

    return primeiro;
  } catch (error) {
    smartLogger.error('Erro ao promover primeiro da fila:', error);
    return null;
  }
}

// ✅ FUNÇÃO AUXILIAR: Reorganizar fila
async function reorganizarFila(operacaoId: number) {
  try {
    // Buscar todos os participantes da fila ordenados por posição
    const { data: participantes, error } = await supabase
      .from('participacao')
      .select('id, posicao_fila')
      .eq('operacao_id', operacaoId)
      .eq('estado_visual', 'NA_FILA')
      .eq('ativa', true)
      .order('posicao_fila', { ascending: true });

    if (error || !participantes || participantes.length === 0) {
      smartLogger.debug('Nenhum participante na fila para reorganizar');
      return;
    }

    // Reorganizar fila sequencialmente (1, 2, 3, ...)
    for (let i = 0; i < participantes.length; i++) {
      const novaPosicao = i + 1;
      if (participantes[i].posicao_fila !== novaPosicao) {
        await supabase
          .from('participacao')
          .update({ posicao_fila: novaPosicao })
          .eq('id', participantes[i].id);
      }
    }

    smartLogger.success(`Fila reorganizada - ${participantes.length} posições atualizadas na operação ${operacaoId}`);
  } catch (error) {
    smartLogger.error('Erro ao reorganizar fila:', error);
  }
} 