/**
 * 👨‍💼 UNIFIED SUPERVISOR ACTIONS API
 * 
 * Replaces 6+ supervisor administrative endpoints:
 * - /supervisor/janelas-operacionais
 * - /supervisor/membros
 * - /supervisor/solicitacoes
 * - /supervisor/diretoria
 * - /supervisor/operacoes/[id]/horario
 * - /supervisor/operacoes/[id]/reativar
 * 
 * Actions supported:
 * - manage-windows: CRUD operational windows
 * - manage-members: Member administration
 * - manage-requests: Handle operation requests
 * - diretoria-view: Special diretoria portal view
 * - schedule-operation: Set operation schedules
 * - reactivate-operation: Reactivate deleted operations
 * - bulk-operations: Batch administrative operations
 */

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

interface SupervisorActionRequest {
  action: 'manage-windows' | 'manage-members' | 'manage-requests' | 'diretoria-view' | 'schedule-operation' | 'reactivate-operation' | 'bulk-operations';
  entityId?: string;
  data?: any;
  filters?: {
    startDate?: string;
    endDate?: string;
    regional?: string;
    status?: string[];
    includeDetails?: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const action = searchParams.get('action') || 'manage-windows';
    const entityId = searchParams.get('entityId');
    
    const filters = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      regional: searchParams.get('regional'),
      status: searchParams.get('status')?.split(','),
      includeDetails: searchParams.get('includeDetails') === 'true'
    };

    console.log(`👨‍💼 [UNIFIED-SUPERVISOR] GET Action: ${action}`);
    console.log(`👨‍💼 [UNIFIED-SUPERVISOR] Filters:`, filters);

    switch (action) {
      case 'manage-windows':
        return await handleManageWindows(filters);
      
      case 'manage-members':
        return await handleManageMembers(filters);
      
      case 'manage-requests':
        if (!entityId) {
          return Response.json({ success: false, error: 'entityId (operationId) required for manage-requests' }, { status: 400 });
        }
        return await handleManageRequests(entityId, filters);
      
      case 'diretoria-view':
        return await handleDiretoriaView(filters);
      
      default:
        return Response.json({ success: false, error: `Unknown GET action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-SUPERVISOR] GET Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SupervisorActionRequest = await request.json();
    const { action, entityId, data } = body;

    console.log(`👨‍💼 [UNIFIED-SUPERVISOR] POST Action: ${action}`);
    console.log(`👨‍💼 [UNIFIED-SUPERVISOR] EntityId: ${entityId}`);

    switch (action) {
      case 'manage-windows':
        return await handleCreateOrUpdateWindow(entityId, data);
      
      case 'schedule-operation':
        if (!entityId) {
          return Response.json({ success: false, error: 'entityId (operationId) required for schedule-operation' }, { status: 400 });
        }
        return await handleScheduleOperation(entityId, data);
      
      case 'reactivate-operation':
        if (!entityId) {
          return Response.json({ success: false, error: 'entityId (operationId) required for reactivate-operation' }, { status: 400 });
        }
        return await handleReactivateOperation(entityId, data);
      
      case 'bulk-operations':
        return await handleBulkOperations(data);
      
      default:
        return Response.json({ success: false, error: `Unknown POST action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-SUPERVISOR] POST Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const entityId = searchParams.get('entityId');

    console.log(`👨‍💼 [UNIFIED-SUPERVISOR] DELETE Action: ${action}, EntityId: ${entityId}`);

    switch (action) {
      case 'manage-windows':
        if (!entityId) {
          return Response.json({ success: false, error: 'entityId (windowId) required for delete window' }, { status: 400 });
        }
        return await handleDeleteWindow(entityId);
      
      default:
        return Response.json({ success: false, error: `Unknown DELETE action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-SUPERVISOR] DELETE Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🪟 MANAGE WINDOWS - Replaces /supervisor/janelas-operacionais
async function handleManageWindows(filters: any) {
  console.log(`🪟 [MANAGE-WINDOWS] Listing operational windows`);

  try {
    let query = supabase
      .from('janela_operacional')
      .select(`
        *,
        operacao(
          id,
          data_operacao,
          status,
          ativa,
          participacao(id, estado_visual)
        )
      `)
      .eq('ativa', true);

    // Apply date filters
    if (filters.startDate && filters.endDate) {
      query = query.gte('data_inicio', filters.startDate)
                   .lte('data_fim', filters.endDate);
    }

    const { data: janelas, error } = await query.order('data_inicio', { ascending: true });

    if (error) {
      console.error('🚨 [MANAGE-WINDOWS] Database error:', error);
      return Response.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Calculate statistics for each window
    const janelasComStats = janelas.map(janela => {
      const operacoesAtivas = janela.operacao?.filter(op => op.ativa) || [];
      const totalParticipacoes = operacoesAtivas.reduce((acc, op) => acc + (op.participacao?.length || 0), 0);
      
      return {
        ...janela,
        stats: {
          total_operacoes: operacoesAtivas.length,
          total_participacoes: totalParticipacoes,
          operacoes_ativas: operacoesAtivas.filter(op => op.status === 'ATIVA').length,
          operacoes_aguardando: operacoesAtivas.filter(op => op.status === 'AGUARDANDO_SOLICITACOES').length
        }
      };
    });

    return Response.json({
      success: true,
      data: janelasComStats,
      total: janelasComStats.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [MANAGE-WINDOWS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 👥 MANAGE MEMBERS - Replaces /supervisor/membros
async function handleManageMembers(filters: any) {
  console.log(`👥 [MANAGE-MEMBERS] Listing members for management`);

  try {
    let query = supabase
      .from('servidor')
      .select(`
        *,
        participacao(
          id,
          estado_visual,
          data_participacao,
          operacao(data_operacao, modalidade)
        )
      `)
      .eq('ativo', true);

    // Apply regional filter
    if (filters.regional) {
      query = query.eq('regional', filters.regional);
    }

    const { data: membros, error } = await query.order('nome', { ascending: true });

    if (error) {
      console.error('🚨 [MANAGE-MEMBERS] Database error:', error);
      return Response.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Calculate member statistics
    const membrosComStats = membros.map(membro => {
      const participacoesAtivas = membro.participacao?.filter(p => p.estado_visual !== 'CANCELADO') || [];
      const participacoesConfirmadas = participacoesAtivas.filter(p => ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual));
      const participacoesPendentes = participacoesAtivas.filter(p => ['PENDENTE', 'NA_FILA'].includes(p.estado_visual));

      // Recent activity (last 30 days)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);
      const atividadeRecente = participacoesAtivas.filter(p => 
        new Date(p.data_participacao) >= dataLimite
      );

      return {
        ...membro,
        stats: {
          total_participacoes: participacoesAtivas.length,
          confirmadas: participacoesConfirmadas.length,
          pendentes: participacoesPendentes.length,
          atividade_recente: atividadeRecente.length,
          ultima_participacao: participacoesAtivas[0]?.data_participacao || null
        },
        // Remove participacao details for cleaner response
        participacao: undefined
      };
    });

    return Response.json({
      success: true,
      data: membrosComStats,
      total: membrosComStats.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [MANAGE-MEMBERS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 📋 MANAGE REQUESTS - Replaces /supervisor/solicitacoes
async function handleManageRequests(operationId: string, filters: any) {
  console.log(`📋 [MANAGE-REQUESTS] Operation: ${operationId}`);

  try {
    const { data: solicitacoes, error } = await supabase
      .from('participacao')
      .select(`
        *,
        servidor(id, nome, matricula, perfil, regional),
        operacao(
          id,
          data_operacao,
          modalidade,
          tipo,
          limite_participantes,
          status
        )
      `)
      .eq('operacao_id', operationId)
      .eq('ativa', true)
      .in('estado_visual', ['PENDENTE', 'NA_FILA'])
      .order('data_participacao', { ascending: true });

    if (error) {
      console.error('🚨 [MANAGE-REQUESTS] Database error:', error);
      return Response.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Get current confirmed participants count
    const { data: confirmados, error: confirmedError } = await supabase
      .from('participacao')
      .select('id')
      .eq('operacao_id', operationId)
      .eq('ativa', true)
      .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP']);

    if (confirmedError) {
      console.error('🚨 [MANAGE-REQUESTS] Error counting confirmed:', confirmedError);
    }

    const totalConfirmados = confirmados?.length || 0;
    const limiteParticipantes = solicitacoes[0]?.operacao?.limite_participantes || 0;
    const vagasDisponiveis = Math.max(0, limiteParticipantes - totalConfirmados);

    // Add chronological position to each request
    const solicitacoesComPosicao = solicitacoes.map((solicitacao, index) => ({
      ...solicitacao,
      posicao_fila: index + 1,
      pode_ser_confirmado: index < vagasDisponiveis
    }));

    return Response.json({
      success: true,
      data: {
        operacao: solicitacoes[0]?.operacao,
        solicitacoes: solicitacoesComPosicao,
        estatisticas: {
          total_solicitacoes: solicitacoes.length,
          confirmados_atual: totalConfirmados,
          limite_participantes: limiteParticipantes,
          vagas_disponiveis: vagasDisponiveis,
          pode_confirmar_automatico: vagasDisponiveis > 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [MANAGE-REQUESTS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🏛️ DIRETORIA VIEW - Replaces /supervisor/diretoria
async function handleDiretoriaView(filters: any) {
  console.log(`🏛️ [DIRETORIA-VIEW] Special diretoria portal view`);

  try {
    let query = supabase
      .from('operacao')
      .select(`
        *,
        janela_operacional(*),
        participacao(
          *,
          servidor(id, nome, matricula, regional)
        )
      `)
      .eq('ativa', true);

    // Diretoria specific filters
    if (filters.startDate && filters.endDate) {
      query = query.gte('data_operacao', filters.startDate)
                   .lte('data_operacao', filters.endDate);
    }

    // Include special diretoria fields
    query = query.select(`
      *,
      encaminhado_diretoria_em,
      motivo_encaminhamento_diretoria,
      janela_operacional(*),
      participacao(
        *,
        servidor(id, nome, matricula, regional, perfil)
      )
    `);

    const { data: operacoes, error } = await query.order('data_operacao', { ascending: true });

    if (error) {
      console.error('🚨 [DIRETORIA-VIEW] Database error:', error);
      return Response.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    // Calculate diretoria-specific statistics
    const stats = {
      total_operacoes: operacoes.length,
      encaminhadas_diretoria: operacoes.filter(op => op.encaminhado_diretoria_em).length,
      aguardando_solicitacoes: operacoes.filter(op => op.status === 'AGUARDANDO_SOLICITACOES').length,
      total_participacoes: operacoes.reduce((acc, op) => acc + (op.participacao?.length || 0), 0),
      por_regional: {}
    };

    // Group by regional
    operacoes.forEach(operacao => {
      operacao.participacao?.forEach(participacao => {
        const regional = participacao.servidor?.regional || 'N/A';
        if (!stats.por_regional[regional]) {
          stats.por_regional[regional] = 0;
        }
        stats.por_regional[regional]++;
      });
    });

    return Response.json({
      success: true,
      data: operacoes,
      stats,
      portal: 'diretoria',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [DIRETORIA-VIEW] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🆕 CREATE OR UPDATE WINDOW - Handles POST for manage-windows
async function handleCreateOrUpdateWindow(windowId: string | undefined, data: any) {
  console.log(`🆕 [CREATE-UPDATE-WINDOW] WindowId: ${windowId}, Data:`, data);

  try {
    if (windowId) {
      // Update existing window
      const { data: janelaAtualizada, error } = await supabase
        .from('janela_operacional')
        .update({
          nome: data.nome,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          descricao: data.descricao,
          modalidades_permitidas: data.modalidades_permitidas,
          limite_operacoes_por_dia: data.limite_operacoes_por_dia
        })
        .eq('id', windowId)
        .select()
        .single();

      if (error) {
        console.error('🚨 [CREATE-UPDATE-WINDOW] Update error:', error);
        return Response.json({ success: false, error: 'Failed to update window' }, { status: 500 });
      }

      return Response.json({
        success: true,
        data: janelaAtualizada,
        message: 'Operational window updated successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      // Create new window
      const { data: novaJanela, error } = await supabase
        .from('janela_operacional')
        .insert({
          nome: data.nome,
          data_inicio: data.data_inicio,
          data_fim: data.data_fim,
          descricao: data.descricao,
          modalidades_permitidas: data.modalidades_permitidas || ['PRESENCIAL', 'REMOTO'],
          limite_operacoes_por_dia: data.limite_operacoes_por_dia || 10,
          ativa: true
        })
        .select()
        .single();

      if (error) {
        console.error('🚨 [CREATE-UPDATE-WINDOW] Create error:', error);
        return Response.json({ success: false, error: 'Failed to create window' }, { status: 500 });
      }

      return Response.json({
        success: true,
        data: novaJanela,
        message: 'Operational window created successfully',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('🚨 [CREATE-UPDATE-WINDOW] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🗑️ DELETE WINDOW
async function handleDeleteWindow(windowId: string) {
  console.log(`🗑️ [DELETE-WINDOW] WindowId: ${windowId}`);

  try {
    // Soft delete - mark as inactive
    const { data: janelaDesativada, error } = await supabase
      .from('janela_operacional')
      .update({ ativa: false })
      .eq('id', windowId)
      .select()
      .single();

    if (error) {
      console.error('🚨 [DELETE-WINDOW] Error:', error);
      return Response.json({ success: false, error: 'Failed to delete window' }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: janelaDesativada,
      message: 'Operational window deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [DELETE-WINDOW] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// ⏰ SCHEDULE OPERATION - Replaces /supervisor/operacoes/[id]/horario
async function handleScheduleOperation(operationId: string, data: any) {
  console.log(`⏰ [SCHEDULE-OPERATION] Operation: ${operationId}, Schedule:`, data);

  try {
    const { data: operacaoAgendada, error } = await supabase
      .from('operacao')
      .update({
        horario: data.horario,
        turno: data.turno,
        observacoes_horario: data.observacoes
      })
      .eq('id', operationId)
      .select()
      .single();

    if (error) {
      console.error('🚨 [SCHEDULE-OPERATION] Error:', error);
      return Response.json({ success: false, error: 'Failed to schedule operation' }, { status: 500 });
    }

    // Log the scheduling event
    await supabase
      .from('evento_operacao')
      .insert({
        operacao_id: parseInt(operationId),
        tipo_evento: 'HORARIO_DEFINIDO',
        data_evento: new Date().toISOString(),
        detalhes: {
          horario: data.horario,
          turno: data.turno,
          observacoes: data.observacoes
        }
      });

    return Response.json({
      success: true,
      data: operacaoAgendada,
      message: 'Operation scheduled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [SCHEDULE-OPERATION] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🔄 REACTIVATE OPERATION - Replaces /supervisor/operacoes/[id]/reativar
async function handleReactivateOperation(operationId: string, data: any) {
  console.log(`🔄 [REACTIVATE-OPERATION] Operation: ${operationId}`);

  try {
    const { data: operacaoReativada, error } = await supabase
      .from('operacao')
      .update({ 
        ativa: true,
        data_reativacao: new Date().toISOString(),
        motivo_reativacao: data?.motivo || 'Reativada pelo supervisor'
      })
      .eq('id', operationId)
      .select()
      .single();

    if (error) {
      console.error('🚨 [REACTIVATE-OPERATION] Error:', error);
      return Response.json({ success: false, error: 'Failed to reactivate operation' }, { status: 500 });
    }

    // Log the reactivation event
    await supabase
      .from('evento_operacao')
      .insert({
        operacao_id: parseInt(operationId),
        tipo_evento: 'OPERACAO_REATIVADA',
        data_evento: new Date().toISOString(),
        detalhes: {
          motivo: data?.motivo || 'Reativada pelo supervisor'
        }
      });

    return Response.json({
      success: true,
      data: operacaoReativada,
      message: 'Operation reactivated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [REACTIVATE-OPERATION] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 🔄 BULK OPERATIONS - Batch operations for efficiency
async function handleBulkOperations(data: any) {
  console.log(`🔄 [BULK-OPERATIONS] Type: ${data.type}, Count: ${data.items?.length}`);

  try {
    const { type, items } = data;
    const results = [];

    switch (type) {
      case 'approve-multiple':
        for (const item of items) {
          const { data: participacao, error } = await supabase
            .from('participacao')
            .update({ 
              estado_visual: 'CONFIRMADO',
              data_confirmacao: new Date().toISOString()
            })
            .eq('id', item.participacao_id)
            .select()
            .single();

          results.push({ 
            participacao_id: item.participacao_id, 
            success: !error, 
            error: error?.message,
            data: participacao 
          });
        }
        break;

      case 'reject-multiple':
        for (const item of items) {
          const { data: participacao, error } = await supabase
            .from('participacao')
            .update({ 
              ativa: false,
              data_rejeicao: new Date().toISOString(),
              motivo_rejeicao: item.motivo || 'Rejeitado em lote'
            })
            .eq('id', item.participacao_id)
            .select()
            .single();

          results.push({ 
            participacao_id: item.participacao_id, 
            success: !error, 
            error: error?.message,
            data: participacao 
          });
        }
        break;

      default:
        return Response.json({ success: false, error: `Unknown bulk operation type: ${type}` }, { status: 400 });
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return Response.json({
      success: true,
      data: {
        type,
        total_processed: items.length,
        successful: successCount,
        failed: errorCount,
        results
      },
      message: `Bulk operation completed: ${successCount} successful, ${errorCount} failed`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [BULK-OPERATIONS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 