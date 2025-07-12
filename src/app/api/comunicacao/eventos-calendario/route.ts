import { NextRequest, NextResponse } from 'next/server';

// ✅ API EVENTOS CALENDÁRIO - BOUNDED CONTEXT: COMUNICAÇÃO SIMPLES
// Conforme documentação: docs/00 - CASOS DE USO/3 - COMUNICAÇÃO_SIMPLES.txt
// 🟢 Verde (#28a745): Operação confirmada/aprovada
// 🟡 Amarelo (#ffc107): Operação modificada ou aguardando diretoria  
// 🔴 Vermelho (#dc3545): Operação cancelada/rejeitada
// 🔵 Azul (#007bff): Entrada automática na Fila de Espera

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const supervisorId = url.searchParams.get('supervisorId') || '1';
    const regionalId = url.searchParams.get('regionalId') || '1';

    // ✅ BUSCAR EVENTOS COM ISOLAMENTO REGIONAL AUTOMÁTICO
    const response = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute_sql',
        query: `
          SELECT ec.*, o.data_operacao, o.modalidade, o.tipo, o.turno,
                 COUNT(p.id) as total_participantes
          FROM evento_calendario ec
          JOIN operacao o ON ec.operacao_id = o.id
          LEFT JOIN participacao p ON o.id = p.operacao_id AND p.ativa = true
          WHERE ec.supervisor_id = $1 AND ec.ativo = true
          GROUP BY ec.id, o.data_operacao, o.modalidade, o.tipo, o.turno
          ORDER BY o.data_operacao ASC
        `,
        params: [supervisorId]
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Erro ao buscar eventos do calendário');
    }

    // ✅ TRANSFORMAR PARA FORMATO ESPERADO PELO CALENDÁRIO ADMINISTRATIVO
    const eventosFormatados = result.data.map((evento: any) => ({
      id: evento.id,
      operacaoId: evento.operacao_id,
      tipoEvento: evento.tipo_evento,
      corEvento: evento.cor_evento,
      dataOperacao: evento.data_operacao,
      modalidade: evento.modalidade,
      tipo: evento.tipo,
      turno: evento.turno,
      totalParticipantes: evento.total_participantes || 0,
      criadoEm: evento.criado_em,
      // ✅ MAPEAMENTO DAS 4 CORES OFICIAIS
      emoji: getEmojiPorCor(evento.cor_evento),
      descricao: getDescricaoPorTipo(evento.tipo_evento)
    }));

    return NextResponse.json({
      success: true,
      data: eventosFormatados,
      count: eventosFormatados.length,
      boundedContext: "comunicacao",
      isolamento: "regional_automatico",
      cores: {
        verde: "#28a745",
        amarelo: "#ffc107", 
        vermelho: "#dc3545",
        azul: "#007bff"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao buscar eventos do calendário:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar eventos do calendário',
      boundedContext: "comunicacao"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // ✅ DADOS CONFORME DOCUMENTAÇÃO DE EVENTOS CALENDÁRIO
    const { 
      operacaoId, 
      tipoEvento, 
      supervisorId = 1 
    } = body;

    // ✅ VALIDAÇÕES OBRIGATÓRIAS
    if (!operacaoId || !tipoEvento) {
      return NextResponse.json({
        success: false,
        error: 'operacaoId e tipoEvento são obrigatórios',
        boundedContext: "comunicacao"
      }, { status: 400 });
    }

    // ✅ VALIDAR TIPO DE EVENTO E DEFINIR COR
    const eventosPermitidos = {
      'APROVADO': '#28a745',      // 🟢 Verde
      'MODIFICADO': '#ffc107',    // 🟡 Amarelo  
      'CANCELADO': '#dc3545',     // 🔴 Vermelho
      'CONVOCADO': '#007bff'      // 🔵 Azul
    };

    if (!eventosPermitidos[tipoEvento as keyof typeof eventosPermitidos]) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de evento inválido',
        tiposPermitidos: Object.keys(eventosPermitidos),
        boundedContext: "comunicacao"
      }, { status: 400 });
    }

    const corEvento = eventosPermitidos[tipoEvento as keyof typeof eventosPermitidos];

    // ✅ VERIFICAR SE JÁ EXISTE EVENTO PARA ESTA OPERAÇÃO (INVARIANTE: UM EVENTO POR OPERAÇÃO)
    const verificarResponse = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute_sql',
        query: `SELECT id FROM evento_calendario WHERE operacao_id = $1 AND ativo = true`,
        params: [operacaoId]
      })
    });

    const verificarResult = await verificarResponse.json();
    
    if (verificarResult.success && verificarResult.data.length > 0) {
      // ✅ ATUALIZAR EVENTO EXISTENTE (MANTER INVARIANTE)
      const atualizarResponse = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_sql',
          query: `
            UPDATE evento_calendario 
            SET tipo_evento = $1, cor_evento = $2, criado_em = CURRENT_TIMESTAMP
            WHERE operacao_id = $3 AND ativo = true
            RETURNING *
          `,
          params: [tipoEvento, corEvento, operacaoId]
        })
      });

      const atualizarResult = await atualizarResponse.json();
      
      if (!atualizarResult.success) {
        throw new Error('Erro ao atualizar evento do calendário');
      }

      return NextResponse.json({
        success: true,
        data: {
          id: atualizarResult.data[0].id,
          operacaoId: atualizarResult.data[0].operacao_id,
          tipoEvento: atualizarResult.data[0].tipo_evento,
          corEvento: atualizarResult.data[0].cor_evento,
          atualizado: true
        },
        message: 'Evento do calendário atualizado com sucesso',
        boundedContext: "comunicacao"
      });
    }

    // ✅ CRIAR NOVO EVENTO VIA MCP SUPABASE
    const response = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute_sql',
        query: `
          INSERT INTO evento_calendario (
            supervisor_id, operacao_id, tipo_evento, cor_evento, ativo
          ) VALUES (
            $1, $2, $3, $4, true
          ) RETURNING *
        `,
        params: [
          supervisorId,
          operacaoId,
          tipoEvento,
          corEvento
        ]
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Erro ao criar evento do calendário');
    }

    const novoEvento = result.data[0];

    return NextResponse.json({
      success: true,
      data: {
        id: novoEvento.id,
        operacaoId: novoEvento.operacao_id,
        tipoEvento: novoEvento.tipo_evento,
        corEvento: novoEvento.cor_evento,
        criadoEm: novoEvento.criado_em
      },
      message: 'Evento do calendário criado com sucesso',
      boundedContext: "comunicacao",
      invariante: "um_evento_por_operacao"
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Erro ao criar evento do calendário:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao criar evento do calendário',
      boundedContext: "comunicacao"
    }, { status: 500 });
  }
}

// ✅ FUNÇÕES AUXILIARES PARA MAPEAMENTO DAS CORES
function getEmojiPorCor(cor: string): string {
  const mapeamento: Record<string, string> = {
    '#28a745': '🟢',  // Verde
    '#ffc107': '🟡',  // Amarelo
    '#dc3545': '🔴',  // Vermelho
    '#007bff': '🔵'   // Azul
  };
  return mapeamento[cor] || '⚫';
}

function getDescricaoPorTipo(tipo: string): string {
  const descricoes: Record<string, string> = {
    'APROVADO': 'Operação confirmada/aprovada',
    'MODIFICADO': 'Operação modificada ou aguardando diretoria',
    'CANCELADO': 'Operação cancelada/rejeitada',
    'CONVOCADO': 'Entrada automática na Fila de Espera'
  };
  return descricoes[tipo] || 'Status desconhecido';
} 