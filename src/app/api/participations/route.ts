/**
 * 🎯 UNIFIED PARTICIPATIONS API
 * 
 * Replaces 8+ participation-related endpoints:
 * - /agendamento/operacoes/[id]/eu-vou
 * - /agendamento/operacoes/[id]/cancelar
 * - /agendamento/operacoes/[id]/posicao-fila
 * - /agendamento/cancelar
 * - /eu-vou
 * - /supervisor/gerenciar-participacao
 * - /agendamento/membros/[id]/participacoes
 * 
 * Actions supported:
 * - join: Request to join operation ("Eu vou")
 * - cancel: Cancel participation
 * - approve: Supervisor approves participation
 * - reject: Supervisor rejects participation
 * - position: Get queue position
 * - list: List member's participations
 * - manage: Supervisor bulk management
 */

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ValidadorUnico } from '@/core/domain/services/ValidadorUnico';
import { EuVouOrchestratorSimplificado } from '@/core/domain/services/EuVouOrchestratorSimplificado';

interface ParticipationRequest {
  action: 'join' | 'cancel' | 'approve' | 'reject' | 'position' | 'list' | 'manage';
  operationId?: string;
  membroId?: string;
  participationId?: string;
  data?: any;
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string[];
    includeOperacao?: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const action = searchParams.get('action') || 'list';
    const operationId = searchParams.get('operationId');
    const membroId = searchParams.get('membroId');
    const participationId = searchParams.get('participationId');
    
    const filters = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      status: searchParams.get('status')?.split(','),
      includeOperacao: searchParams.get('includeOperacao') === 'true'
    };

    console.log(`🎯 [UNIFIED-PARTICIPATIONS] GET Action: ${action}`);
    console.log(`🎯 [UNIFIED-PARTICIPATIONS] Params: operationId=${operationId}, membroId=${membroId}`);

    switch (action) {
      case 'position':
        if (!operationId || !membroId) {
          return Response.json({ success: false, error: 'operationId and membroId required for position' }, { status: 400 });
        }
        return await handleGetPosition(operationId, membroId);
      
      case 'list':
        if (!membroId) {
          return Response.json({ success: false, error: 'membroId required for list action' }, { status: 400 });
        }
        return await handleListParticipations(membroId, filters);
      
      case 'manage':
        if (!operationId) {
          return Response.json({ success: false, error: 'operationId required for manage action' }, { status: 400 });
        }
        return await handleManageParticipations(operationId, filters);
      
      default:
        return Response.json({ success: false, error: `Unknown GET action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-PARTICIPATIONS] GET Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ParticipationRequest = await request.json();
    const { action, operationId, membroId, participationId, data } = body;

    console.log(`🎯 [UNIFIED-PARTICIPATIONS] POST Action: ${action}`);
    console.log(`🎯 [UNIFIED-PARTICIPATIONS] Params: operationId=${operationId}, membroId=${membroId}`);

    switch (action) {
      case 'join':
        if (!operationId || !membroId) {
          return Response.json({ success: false, error: 'operationId and membroId required for join' }, { status: 400 });
        }
        return await handleJoinOperation(operationId, membroId, data);
      
      case 'cancel':
        if (!participationId && (!operationId || !membroId)) {
          return Response.json({ success: false, error: 'participationId or (operationId + membroId) required for cancel' }, { status: 400 });
        }
        return await handleCancelParticipation(participationId, operationId, membroId, data);
      
      case 'approve':
        if (!participationId) {
          return Response.json({ success: false, error: 'participationId required for approve' }, { status: 400 });
        }
        return await handleApproveParticipation(participationId, data);
      
      case 'reject':
        if (!participationId) {
          return Response.json({ success: false, error: 'participationId required for reject' }, { status: 400 });
        }
        return await handleRejectParticipation(participationId, data);
      
      default:
        return Response.json({ success: false, error: `Unknown POST action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-PARTICIPATIONS] POST Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🎯 JOIN OPERATION - Replaces /agendamento/operacoes/[id]/eu-vou and /eu-vou
async function handleJoinOperation(operationId: string, membroId: string, data?: any) {
  console.log(`🎯 [JOIN-OPERATION] 🚨 ======= EU VOU UNIFIED INICIADO =======`);
  console.log(`🎯 [JOIN-OPERATION] 🎯 Membro: ${membroId}, Operação: ${operationId}`);
  console.log(`🎯 [JOIN-OPERATION] ⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🎯 [JOIN-OPERATION] 🔥 UNIFIED handleJoinOperation foi chamada!`);
  
  // TEMP-LOG-BANCO-OPT: Monitorar performance crítica do "Eu Vou"
  const euVouStartTime = performance.now();
  console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] Iniciando processo às ${new Date().toISOString()}`);
  console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] Params: operationId=${operationId}, membroId=${membroId}`);

  try {
    // 🔄 USANDO O ORQUESTRADOR SIMPLIFICADO (nova arquitetura)
    console.log(`🎯 [JOIN-OPERATION] 📡 Instanciando EuVouOrchestratorSimplificado...`);
    
    const orchestrator = new EuVouOrchestratorSimplificado();
    
    console.log(`🎯 [JOIN-OPERATION] 🎯 Chamando orchestrator.executar(${operationId}, ${membroId})`);
    
    // TEMP-LOG-BANCO-OPT: Medir tempo do orquestrador (inclui validações + insert/update)
    const orchestratorStartTime = performance.now();
    console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] Executando orchestrator.executar...`);
    
    const resultado = await orchestrator.executar(parseInt(operationId), parseInt(membroId));
    
    const orchestratorTime = performance.now() - orchestratorStartTime;
    console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] Orchestrator executado em ${orchestratorTime.toFixed(2)}ms`);
    console.log(`🎯 [JOIN-OPERATION] 📊 Resultado do orchestrator:`, resultado);

    if (resultado.sucesso) {
      console.log(`🎯 [JOIN-OPERATION] ✅ SUCESSO! UNIFIED EU VOU realizado.`);
      
      // TEMP-LOG-BANCO-OPT: Log do tempo total do "Eu Vou" (crítico para UX)
      const euVouTotalTime = performance.now() - euVouStartTime;
      console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] ✅ SUCESSO TOTAL em ${euVouTotalTime.toFixed(2)}ms`);
      console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] Tipo ação: ${resultado.tipoAcao}, Estado: ${resultado.dadosParticipacao?.estado_visual}`);
      
      return Response.json({
        success: true,
        data: {
          mensagem: resultado.mensagem,
          estado_visual: resultado.dadosParticipacao?.estado_visual,
          participacao_id: resultado.dadosParticipacao?.id,
          posicao_fila: resultado.dadosParticipacao?.posicao_fila,
          tipo_acao: resultado.tipoAcao // 'CONFIRMACAO' ou 'SOLICITACAO'
        },
        boundedContext: 'agendamento',
        cleanArchitecture: {
          domain: 'EuVouOrchestrator',
          useCase: 'executar',
          infrastructure: 'supabase'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`🎯 [JOIN-OPERATION] ❌ FALHA: ${resultado.mensagem}`);
      
      // TEMP-LOG-BANCO-OPT: Log de erro com tempo para análise
      const euVouErrorTime = performance.now() - euVouStartTime;
      console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] ❌ FALHA em ${euVouErrorTime.toFixed(2)}ms: ${resultado.mensagem}`);
      console.log(`TEMP-LOG-BANCO-OPT: [EU-VOU] Código erro: ${resultado.codigoErro}`);
      
      return Response.json({
        success: false,
        error: resultado.mensagem,
        codigo_erro: resultado.codigoErro,
        detalhes: resultado.detalhes,
        boundedContext: 'agendamento',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [JOIN-OPERATION] Erro interno:', error);
    
    return Response.json({
      success: false,
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    console.log(`🎯 [JOIN-OPERATION] 🏁 Finalizando UNIFIED JOIN`);
  }
}

// ❌ CANCEL PARTICIPATION - Replaces /agendamento/operacoes/[id]/cancelar and /agendamento/cancelar
async function handleCancelParticipation(participationId?: string, operationId?: string, membroId?: string, data?: any) {
  console.log(`❌ [CANCEL-PARTICIPATION] participationId=${participationId}, operationId=${operationId}, membroId=${membroId}`);

  try {
    let participacaoId = participationId;

    // If participationId not provided, find it by operationId + membroId
    if (!participacaoId && operationId && membroId) {
      const { data: participacao } = await supabase
        .from('participacao')
        .select('id')
        .eq('operacao_id', operationId)
        .eq('membro_id', membroId)
        .eq('ativa', true)
        .single();

      if (!participacao) {
        return Response.json({ success: false, error: 'Participation not found' }, { status: 404 });
      }

      participacaoId = participacao.id.toString();
    }

    if (!participacaoId) {
      return Response.json({ success: false, error: 'Could not determine participation to cancel' }, { status: 400 });
    }

    // Soft delete the participation
    const { data: participacaoCancelada, error } = await supabase
      .from('participacao')
      .update({ 
        ativa: false, 
        data_cancelamento: new Date().toISOString(),
        motivo_cancelamento: data?.motivo || 'Cancelamento via sistema'
      })
      .eq('id', participacaoId)
      .select(`
        *,
        operacao(id, data_operacao, modalidade),
        servidor(id, nome, matricula)
      `)
      .single();

    if (error) {
      console.error('🚨 [CANCEL-PARTICIPATION] Database error:', error);
      return Response.json({ success: false, error: 'Failed to cancel participation' }, { status: 500 });
    }

    // Log the event
    await supabase
      .from('evento_operacao')
      .insert({
        operacao_id: participacaoCancelada.operacao.id,
        membro_id: participacaoCancelada.membro_id,
        tipo_evento: 'PARTICIPACAO_CANCELADA',
        data_evento: new Date().toISOString(),
        detalhes: {
          participacao_id: participacaoId,
          motivo: data?.motivo || 'Cancelamento via sistema'
        }
      });

    console.log(`✅ [CANCEL-PARTICIPATION] Participation ${participacaoId} cancelled successfully`);

    return Response.json({
      success: true,
      data: participacaoCancelada,
      message: 'Participation cancelled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [CANCEL-PARTICIPATION] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 📍 GET POSITION - Replaces /agendamento/operacoes/[id]/posicao-fila
async function handleGetPosition(operationId: string, membroId: string) {
  console.log(`📍 [GET-POSITION] Operation: ${operationId}, Member: ${membroId}`);

  try {
    // Get member's participation
    const { data: minhaParticipacao, error: participacaoError } = await supabase
      .from('participacao')
      .select('*')
      .eq('operacao_id', operationId)
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .single();

    if (participacaoError || !minhaParticipacao) {
      return Response.json({ 
        success: false, 
        error: 'Participation not found' 
      }, { status: 404 });
    }

    // Get all participations for this operation (chronological order)
    const { data: todasParticipacoes, error: filaError } = await supabase
      .from('participacao')
      .select('id, data_participacao, estado_visual, servidor(nome)')
      .eq('operacao_id', operationId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: true });

    if (filaError) {
      console.error('🚨 [GET-POSITION] Error fetching queue:', filaError);
      return Response.json({ success: false, error: 'Failed to fetch queue' }, { status: 500 });
    }

    // Calculate position
    const minhaDataParticipacao = new Date(minhaParticipacao.data_participacao).getTime();
    const posicaoAtual = todasParticipacoes.findIndex(p => 
      new Date(p.data_participacao).getTime() === minhaDataParticipacao
    ) + 1;

    // Separate confirmed vs pending
    const confirmados = todasParticipacoes.filter(p => ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual));
    const pendentes = todasParticipacoes.filter(p => ['PENDENTE', 'NA_FILA'].includes(p.estado_visual));

    return Response.json({
      success: true,
      data: {
        minha_participacao: {
          id: minhaParticipacao.id,
          estado_visual: minhaParticipacao.estado_visual,
          data_participacao: minhaParticipacao.data_participacao,
          posicao_cronologica: posicaoAtual
        },
        fila: {
          total_participacoes: todasParticipacoes.length,
          confirmados: confirmados.length,
          pendentes: pendentes.length,
          minha_posicao: posicaoAtual
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('🚨 [GET-POSITION] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 📋 LIST PARTICIPATIONS - Replaces /agendamento/membros/[id]/participacoes
async function handleListParticipations(membroId: string, filters: any) {
  console.log(`📋 [LIST-PARTICIPATIONS] Member: ${membroId}, Filters:`, filters);

  try {
    let query = supabase
      .from('participacao')
      .select(`
        *,
        operacao(
          id,
          data_operacao,
          modalidade,
          tipo,
          turno,
          status,
          limite_participantes
        )
      `)
      .eq('membro_id', membroId)
      .eq('ativa', true);

    // Apply date filters
    if (filters.startDate && filters.endDate) {
      query = query.gte('operacao.data_operacao', filters.startDate)
                   .lte('operacao.data_operacao', filters.endDate);
    }

    // Apply status filters
    if (filters.status && filters.status.length > 0) {
      query = query.in('estado_visual', filters.status);
    }

    const { data: participacoes, error } = await query.order('data_participacao', { ascending: false });

    if (error) {
      console.error('🚨 [LIST-PARTICIPATIONS] Database error:', error);
      return Response.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Group by status
    const grouped = {
      confirmados: participacoes.filter(p => ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual)),
      pendentes: participacoes.filter(p => ['PENDENTE', 'NA_FILA'].includes(p.estado_visual)),
      cancelados: participacoes.filter(p => p.estado_visual === 'CANCELADO')
    };

    return Response.json({
      success: true,
      data: {
        participacoes,
        grouped,
        total: participacoes.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [LIST-PARTICIPATIONS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 👥 MANAGE PARTICIPATIONS - Replaces /supervisor/gerenciar-participacao
async function handleManageParticipations(operationId: string, filters: any) {
  console.log(`👥 [MANAGE-PARTICIPATIONS] Operation: ${operationId}`);

  try {
    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select(`
        *,
        servidor(id, nome, matricula, perfil),
        operacao(id, limite_participantes, status)
      `)
      .eq('operacao_id', operationId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: true });

    if (error) {
      console.error('🚨 [MANAGE-PARTICIPATIONS] Database error:', error);
      return Response.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Separate by status for management
    const confirmados = participacoes.filter(p => ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual));
    const pendentes = participacoes.filter(p => ['PENDENTE', 'NA_FILA'].includes(p.estado_visual));

    // Calculate available slots
    const limiteParticipantes = participacoes[0]?.operacao?.limite_participantes || 0;
    const vagasDisponiveis = Math.max(0, limiteParticipantes - confirmados.length);

    return Response.json({
      success: true,
      data: {
        operacao_id: operationId,
        limite_participantes: limiteParticipantes,
        vagas_disponiveis: vagasDisponiveis,
        participacoes: {
          confirmados,
          pendentes,
          total: participacoes.length
        },
        acoes_disponiveis: {
          pode_confirmar: vagasDisponiveis > 0 && pendentes.length > 0,
          pode_rejeitar: pendentes.length > 0,
          pode_remover: confirmados.length > 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [MANAGE-PARTICIPATIONS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// ✅ APPROVE PARTICIPATION - Supervisor action
async function handleApproveParticipation(participationId: string, data?: any) {
  // 🔍 LOG ESTRATÉGICO: Monitorar origem das chamadas de aprovação
  // Para análise futura - tooltip foi removido em [DATA]
  console.log(`🔍 [TOOLTIP-MONITORING] API /participations approve chamada`, {
    participationId,
    timestamp: new Date().toISOString(),
    userAgent: data?.userAgent || 'unknown',
    supervisorId: data?.supervisorId || 'unknown',
    motivo: data?.motivo || 'unknown',
    stackTrace: new Error().stack?.split('\n').slice(0, 3) || []
  });

  console.log(`✅ [APPROVE-PARTICIPATION] ID: ${participationId}`);
  console.log(`✅ [APPROVE-PARTICIPATION] Data received:`, data);

  try {
    // 🔍 STEP 1: Verificar se a participação existe
    const { data: participacaoExistente, error: selectError } = await supabase
      .from('participacao')
      .select(`
        *,
        operacao(id, data_operacao, limite_participantes, status),
        servidor(id, nome, matricula)
      `)
      .eq('id', participationId)
      .single();

    if (selectError) {
      console.error('🚨 [APPROVE-PARTICIPATION] Error selecting participation:', selectError);
      return Response.json({ success: false, error: `Participation not found: ${selectError.message}` }, { status: 404 });
    }

    if (!participacaoExistente) {
      console.error('🚨 [APPROVE-PARTICIPATION] Participation not found');
      return Response.json({ success: false, error: 'Participation not found' }, { status: 404 });
    }

    console.log(`✅ [APPROVE-PARTICIPATION] Found participation:`, {
      id: participacaoExistente.id,
      membro_id: participacaoExistente.membro_id,
      operacao_id: participacaoExistente.operacao_id,
      estado_visual: participacaoExistente.estado_visual,
      ativa: participacaoExistente.ativa,
      servidor_nome: participacaoExistente.servidor?.nome
    });

    // 🔍 STEP 2: Verificar se já está confirmado
    if (participacaoExistente.estado_visual === 'CONFIRMADO') {
      console.log(`⚠️ [APPROVE-PARTICIPATION] Already confirmed`);
      return Response.json({ 
        success: false, 
        error: 'Participation is already confirmed' 
      }, { status: 400 });
    }

    // 🔍 STEP 3: Verificar se a participação está ativa
    if (!participacaoExistente.ativa) {
      console.log(`⚠️ [APPROVE-PARTICIPATION] Participation is not active`);
      return Response.json({ 
        success: false, 
        error: 'Cannot approve inactive participation' 
      }, { status: 400 });
    }

    // 🔍 STEP 4: Verificar limite da operação
    const limiteOperacao = participacaoExistente.operacao?.limite_participantes || 0;
    
    const { data: participacoesConfirmadas, error: countError } = await supabase
      .from('participacao')
      .select('id')
      .eq('operacao_id', participacaoExistente.operacao_id)
      .eq('ativa', true)
      .eq('estado_visual', 'CONFIRMADO');

    if (countError) {
      console.error('🚨 [APPROVE-PARTICIPATION] Error counting confirmed participations:', countError);
      return Response.json({ success: false, error: `Error checking limit: ${countError.message}` }, { status: 500 });
    }

    const confirmadosAtual = participacoesConfirmadas?.length || 0;
    console.log(`✅ [APPROVE-PARTICIPATION] Limit check:`, {
      limite: limiteOperacao,
      confirmados_atual: confirmadosAtual,
      pode_confirmar: confirmadosAtual < limiteOperacao
    });

    if (confirmadosAtual >= limiteOperacao) {
      console.log(`⚠️ [APPROVE-PARTICIPATION] Operation limit reached`);
      return Response.json({ 
        success: false, 
        error: `Operation limit reached (${confirmadosAtual}/${limiteOperacao})` 
      }, { status: 400 });
    }

    // 🔍 STEP 5: Tentar atualizar a participação
    console.log(`✅ [APPROVE-PARTICIPATION] Attempting to update participation...`);
    
    const updateData = {
      estado_visual: 'CONFIRMADO'
      // Removido: data_confirmacao e confirmado_por (campos não existem na tabela)
    };
    
    console.log(`✅ [APPROVE-PARTICIPATION] Update data:`, updateData);

    const { data: participacaoAtualizada, error: updateError } = await supabase
      .from('participacao')
      .update(updateData)
      .eq('id', participationId)
      .select(`
        *,
        operacao(id, data_operacao),
        servidor(id, nome, matricula)
      `)
      .single();

    if (updateError) {
      console.error('🚨 [APPROVE-PARTICIPATION] Update error:', updateError);
      return Response.json({ 
        success: false, 
        error: `Failed to approve participation: ${updateError.message}` 
      }, { status: 500 });
    }

    console.log(`✅ [APPROVE-PARTICIPATION] Successfully updated:`, {
      id: participacaoAtualizada.id,
      estado_visual: participacaoAtualizada.estado_visual,
      data_confirmacao: participacaoAtualizada.data_confirmacao
    });

    // 🔍 STEP 6: Tentar registrar o evento
    try {
      console.log(`✅ [APPROVE-PARTICIPATION] Attempting to log event...`);
      
      const { data: evento, error: eventoError } = await supabase
      .from('evento_operacao')
      .insert({
        operacao_id: participacaoAtualizada.operacao.id,
        membro_id: participacaoAtualizada.membro_id,
        tipo_evento: 'PARTICIPACAO_CONFIRMADA',
        data_evento: new Date().toISOString(),
        detalhes: {
          participacao_id: participationId,
          confirmado_por: data?.supervisorId
        }
        })
        .select()
        .single();

      if (eventoError) {
        console.warn('⚠️ [APPROVE-PARTICIPATION] Event logging failed:', eventoError);
        // Não falhar a operação por causa do log de evento
      } else {
        console.log(`✅ [APPROVE-PARTICIPATION] Event logged successfully:`, evento);
      }
    } catch (eventError) {
      console.warn('⚠️ [APPROVE-PARTICIPATION] Event logging exception:', eventError);
      // Não falhar a operação por causa do log de evento
    }

    console.log(`✅ [APPROVE-PARTICIPATION] Operation completed successfully`);

    return Response.json({
      success: true,
      data: participacaoAtualizada,
      message: 'Participation approved successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [APPROVE-PARTICIPATION] General error:', error);
    return Response.json({ 
      success: false, 
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}

// ❌ REJECT PARTICIPATION - Supervisor action
async function handleRejectParticipation(participationId: string, data?: any) {
  console.log(`❌ [REJECT-PARTICIPATION] ID: ${participationId}`);

  try {
    const { data: participacaoRejeitada, error } = await supabase
      .from('participacao')
      .update({ 
        ativa: false,
        data_rejeicao: new Date().toISOString(),
        rejeitado_por: data?.supervisorId || null,
        motivo_rejeicao: data?.motivo || 'Rejeitado pelo supervisor'
      })
      .eq('id', participationId)
      .select(`
        *,
        operacao(id, data_operacao),
        servidor(id, nome, matricula)
      `)
      .single();

    if (error) {
      console.error('🚨 [REJECT-PARTICIPATION] Error:', error);
      return Response.json({ success: false, error: 'Failed to reject participation' }, { status: 500 });
    }

    // Log the event
    await supabase
      .from('evento_operacao')
      .insert({
        operacao_id: participacaoRejeitada.operacao.id,
        membro_id: participacaoRejeitada.membro_id,
        tipo_evento: 'PARTICIPACAO_REJEITADA',
        data_evento: new Date().toISOString(),
        detalhes: {
          participacao_id: participationId,
          rejeitado_por: data?.supervisorId,
          motivo: data?.motivo
        }
      });

    return Response.json({
      success: true,
      data: participacaoRejeitada,
      message: 'Participation rejected successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [REJECT-PARTICIPATION] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 