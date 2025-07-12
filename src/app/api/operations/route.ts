/**
 * 🚀 UNIFIED OPERATIONS API
 * 
 * Replaces 12+ operation-related endpoints:
 * - /supervisor/operacoes (CRUD)
 * - /agendamento/operacoes/[id]/* (histórico, posição, etc.)
 * - /unified/operacoes (current unified)
 * 
 * Actions supported:
 * - list: List operations with filters
 * - get: Get specific operation
 * - create: Create new operation
 * - update: Update operation
 * - delete: Delete operation
 * - history: Get operation history
 * - participants: Get/manage participants
 */

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

interface OperationRequest {
  action: 'list' | 'get' | 'create' | 'update' | 'delete' | 'history' | 'participants';
  operationId?: string;
  data?: any;
  filters?: {
    startDate?: string;
    endDate?: string;
    membroId?: string;
    portal?: 'membro' | 'supervisor' | 'diretoria';
    includeParticipantes?: boolean;
    mode?: 'light' | 'full';
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse action and parameters
    const action = searchParams.get('action') || 'list';
    const operationId = searchParams.get('operationId');
    
    const filters = {
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      membroId: searchParams.get('membroId'),
      portal: searchParams.get('portal') as 'membro' | 'supervisor' | 'diretoria',
      includeParticipantes: searchParams.get('includeParticipantes') === 'true',
      mode: searchParams.get('mode') as 'light' | 'full' || 'full'
    };

    console.log(`🚀 [UNIFIED-OPERATIONS] Action: ${action}, Filters:`, filters);

    switch (action) {
      case 'list':
        return await handleListOperations(filters);
      
      case 'get':
        if (!operationId) {
          return Response.json({ success: false, error: 'operationId required for get action' }, { status: 400 });
        }
        return await handleGetOperation(operationId, filters);
      
      case 'history':
        if (!operationId) {
          return Response.json({ success: false, error: 'operationId required for history action' }, { status: 400 });
        }
        return await handleGetHistory(operationId, filters);
      
      case 'participants':
        if (!operationId) {
          return Response.json({ success: false, error: 'operationId required for participants action' }, { status: 400 });
        }
        return await handleGetParticipants(operationId, filters);
      
      default:
        return Response.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-OPERATIONS] Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: OperationRequest = await request.json();
    const { action, operationId, data } = body;

    console.log(`🚀 [UNIFIED-OPERATIONS] POST Action: ${action}, Data:`, data);

    switch (action) {
      case 'create':
        return await handleCreateOperation(data);
      
      case 'update':
        if (!operationId) {
          return Response.json({ success: false, error: 'operationId required for update action' }, { status: 400 });
        }
        return await handleUpdateOperation(operationId, data);
      
      case 'delete':
        if (!operationId) {
          return Response.json({ success: false, error: 'operationId required for delete action' }, { status: 400 });
        }
        return await handleDeleteOperation(operationId, data);
      
      default:
        return Response.json({ success: false, error: `Unknown POST action: ${action}` }, { status: 400 });
    }

  } catch (error) {
    console.error('🚨 [UNIFIED-OPERATIONS] POST Error:', error);
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// 📋 LIST OPERATIONS - Replaces /unified/operacoes and /supervisor/operacoes
async function handleListOperations(filters: any) {
  console.log(`📋 [LIST-OPERATIONS] Filters:`, filters);
  
  // TEMP-LOG-BANCO-OPT: Monitorar performance da query principal
  const startTime = performance.now();
  console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] Iniciando query principal às ${new Date().toISOString()}`);
  console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] Filtros aplicados: portal=${filters.portal}, includeParticipantes=${filters.includeParticipantes}`);
  
  let query = supabase
    .from('operacao')
    .select(`
      *,
      janela_operacional!inner(*)
    `);

  // Apply filters
  if (filters.startDate && filters.endDate) {
    query = query.gte('data_operacao', filters.startDate)
                 .lte('data_operacao', filters.endDate);
  }

  // Portal-specific logic
  if (filters.portal === 'supervisor') {
    // Supervisor sees all operations
    query = query.eq('ativa', true);
  } else if (filters.portal === 'membro') {
    // Members see only active operations
    query = query.eq('ativa', true)
                 .in('status', ['ATIVA', 'AGUARDANDO_SOLICITACOES']);
  }

  const { data: operacoes, error } = await query.order('data_operacao', { ascending: true });

  // TEMP-LOG-BANCO-OPT: Medir tempo da query principal
  const queryTime = performance.now() - startTime;
  console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] Query principal executada em ${queryTime.toFixed(2)}ms`);
  console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] Operações retornadas: ${operacoes?.length || 0}`);

  if (error) {
    console.error('🚨 [LIST-OPERATIONS] Database error:', error);
    console.error(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] ERRO após ${queryTime.toFixed(2)}ms:`, error);
    return Response.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  // Include participants if requested
  if (filters.includeParticipantes) {
    // TEMP-LOG-BANCO-OPT: Monitorar queries de participações (críticas para performance)
    const participacoesStartTime = performance.now();
    console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] Buscando participações para ${operacoes.length} operações`);
    
    for (const operacao of operacoes) {
      const operacaoQueryStart = performance.now();
      const { data: participacoes } = await supabase
        .from('participacao')
        .select(`
          *,
          servidor(id, nome, matricula)
        `)
        .eq('operacao_id', operacao.id)
        .eq('ativa', true);

      const operacaoQueryTime = performance.now() - operacaoQueryStart;
      console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] Participações op=${operacao.id}: ${participacoes?.length || 0} em ${operacaoQueryTime.toFixed(2)}ms`);

      operacao.participacoes = participacoes || [];
    }
    
    const totalParticacoesTime = performance.now() - participacoesStartTime;
    console.log(`TEMP-LOG-BANCO-OPT: [LIST-OPERATIONS] TOTAL participações: ${totalParticacoesTime.toFixed(2)}ms`);
  }

  // Member-specific participation data
  if (filters.membroId) {
    for (const operacao of operacoes) {
      const { data: minhaParticipacao } = await supabase
        .from('participacao')
        .select('*')
        .eq('operacao_id', operacao.id)
        .eq('membro_id', filters.membroId)
        .eq('ativa', true)
        .single();

      operacao.minha_participacao = minhaParticipacao;
    }
  }

  console.log(`✅ [LIST-OPERATIONS] Returning ${operacoes.length} operations`);
  return Response.json({
    success: true,
    data: operacoes,
    total: operacoes.length,
    timestamp: new Date().toISOString()
  });
}

// 🔍 GET SINGLE OPERATION - Replaces /supervisor/operacoes/[id]
async function handleGetOperation(operationId: string, filters: any) {
  console.log(`🔍 [GET-OPERATION] ID: ${operationId}`);
  
  const { data: operacao, error } = await supabase
    .from('operacao')
    .select(`
      *,
      janela_operacional(*),
      participacao(
        *,
        servidor(id, nome, matricula)
      )
    `)
    .eq('id', operationId)
    .single();

  if (error || !operacao) {
    return Response.json({ success: false, error: 'Operation not found' }, { status: 404 });
  }

  return Response.json({
    success: true,
    data: operacao,
    timestamp: new Date().toISOString()
  });
}

// 📊 GET HISTORY - Replaces /agendamento/operacoes/[id]/historico
async function handleGetHistory(operationId: string, filters: any) {
  console.log(`📊 [GET-HISTORY] Operation: ${operationId}`);
  
  const { data: eventos, error } = await supabase
    .from('evento_operacao')
    .select('*')
    .eq('operacao_id', operationId)
    .order('data_evento', { ascending: true });

  if (error) {
    return Response.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }

  // Calculate member position if membroId provided
  let posicaoAtual = null;
  let totalSolicitacoes = 0;
  let minhaParticipacao = null;

  if (filters.membroId) {
    const { data: participacao } = await supabase
      .from('participacao')
      .select('*')
      .eq('operacao_id', operationId)
      .eq('membro_id', filters.membroId)
      .eq('ativa', true)
      .single();

    if (participacao) {
      minhaParticipacao = {
        estado_visual: participacao.estado_visual,
        data_participacao: participacao.data_participacao
      };

      // Calculate chronological position
      const { data: todasParticipacoes } = await supabase
        .from('participacao')
        .select('data_participacao')
        .eq('operacao_id', operationId)
        .eq('ativa', true)
        .order('data_participacao', { ascending: true });

      if (todasParticipacoes) {
        totalSolicitacoes = todasParticipacoes.length;
        posicaoAtual = todasParticipacoes.findIndex(p => 
          new Date(p.data_participacao).getTime() === new Date(participacao.data_participacao).getTime()
        ) + 1;
      }
    }
  }

  return Response.json({
    success: true,
    data: {
      eventos: eventos || [],
      posicao_atual: posicaoAtual,
      total_solicitacoes: totalSolicitacoes,
      minha_participacao: minhaParticipacao
    },
    timestamp: new Date().toISOString()
  });
}

// 👥 GET PARTICIPANTS - Replaces /supervisor/membros and related APIs
async function handleGetParticipants(operationId: string, filters: any) {
  console.log(`👥 [GET-PARTICIPANTS] Operation: ${operationId}`);
  
  const { data: participacoes, error } = await supabase
    .from('participacao')
    .select(`
      *,
      servidor(id, nome, matricula, perfil)
    `)
    .eq('operacao_id', operationId)
    .eq('ativa', true)
    .order('data_participacao', { ascending: true });

  if (error) {
    return Response.json({ success: false, error: 'Failed to fetch participants' }, { status: 500 });
  }

  // Separate confirmed vs pending
  const confirmados = participacoes.filter(p => ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual));
  const pendentes = participacoes.filter(p => ['PENDENTE', 'NA_FILA'].includes(p.estado_visual));

  return Response.json({
    success: true,
    data: {
      confirmados,
      pendentes,
      total: participacoes.length
    },
    timestamp: new Date().toISOString()
  });
}

// 🆕 CREATE OPERATION - Replaces /supervisor/operacoes POST
async function handleCreateOperation(data: any) {
  console.log(`🆕 [CREATE-OPERATION] Data:`, data);
  
  const { data: novaOperacao, error } = await supabase
    .from('operacao')
    .insert({
      data_operacao: data.data_operacao,
      modalidade: data.modalidade,
      tipo: data.tipo,
      turno: data.turno,
      horario: data.horario,
      limite_participantes: data.limite_participantes,
      janela_id: data.janela_id,
      status: 'AGUARDANDO_SOLICITACOES',
      ativa: true
    })
    .select()
    .single();

  if (error) {
    console.error('🚨 [CREATE-OPERATION] Error:', error);
    return Response.json({ success: false, error: 'Failed to create operation' }, { status: 500 });
  }

  return Response.json({
    success: true,
    data: novaOperacao,
    message: 'Operation created successfully',
    timestamp: new Date().toISOString()
  });
}

// ✏️ UPDATE OPERATION - Replaces /supervisor/operacoes/[id] PUT
async function handleUpdateOperation(operationId: string, data: any) {
  console.log(`✏️ [UPDATE-OPERATION] ID: ${operationId}, Data:`, data);
  
  const { data: operacaoAtualizada, error } = await supabase
    .from('operacao')
    .update(data)
    .eq('id', operationId)
    .select()
    .single();

  if (error) {
    console.error('🚨 [UPDATE-OPERATION] Error:', error);
    return Response.json({ success: false, error: 'Failed to update operation' }, { status: 500 });
  }

  return Response.json({
    success: true,
    data: operacaoAtualizada,
    message: 'Operation updated successfully',
    timestamp: new Date().toISOString()
  });
}

// 🗑️ DELETE OPERATION - Replaces /supervisor/operacoes/[id]/excluir-temporariamente
async function handleDeleteOperation(operationId: string, data: any) {
  console.log(`🗑️ [DELETE-OPERATION] ID: ${operationId}`);
  
  const isTemporary = data?.temporary !== false;
  
  if (isTemporary) {
    // Soft delete - just mark as inactive
    const { data: operacao, error } = await supabase
      .from('operacao')
      .update({ ativa: false })
      .eq('id', operationId)
      .select()
      .single();

    if (error) {
      return Response.json({ success: false, error: 'Failed to deactivate operation' }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: operacao,
      message: 'Operation temporarily deactivated',
      timestamp: new Date().toISOString()
    });
  } else {
    // Hard delete - actually remove (use with caution)
    const { error } = await supabase
      .from('operacao')
      .delete()
      .eq('id', operationId);

    if (error) {
      return Response.json({ success: false, error: 'Failed to delete operation' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Operation permanently deleted',
      timestamp: new Date().toISOString()
    });
  }
} 