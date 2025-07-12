import { NextRequest, NextResponse } from 'next/server';

// ✅ API MENSAGENS REGIONAIS - BOUNDED CONTEXT: COMUNICAÇÃO SIMPLES
// Conforme documentação: docs/00 - CASOS DE USO/3 - COMUNICAÇÃO_SIMPLES.txt

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const membroId = url.searchParams.get('membroId') || '1';
    const regionalId = url.searchParams.get('regionalId') || '1';

    // ✅ BUSCAR MENSAGENS ATIVAS DA REGIONAL COM ISOLAMENTO AUTOMÁTICO
    const response = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute_sql',
        query: `
          SELECT mr.*, s.nome as supervisor_nome
          FROM mensagem_regional mr
          JOIN servidor s ON mr.supervisor_id = s.id
          WHERE mr.regional_id = $1 
            AND mr.ativa = true 
            AND (mr.data_expiracao IS NULL OR mr.data_expiracao >= CURRENT_DATE)
          ORDER BY mr.data_criacao DESC
        `,
        params: [regionalId]
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Erro ao buscar mensagens regionais');
    }

    // ✅ TRANSFORMAR PARA FORMATO ESPERADO PELO FRONTEND
    const mensagensFormatadas = result.data.map((msg: any) => ({
      id: msg.id,
      conteudo: msg.conteudo,
      supervisorNome: msg.supervisor_nome,
      dataCriacao: msg.data_criacao,
      dataExpiracao: msg.data_expiracao,
      lida: false, // TODO: verificar se membro já leu
      ativa: msg.ativa
    }));

    return NextResponse.json({
      success: true,
      data: mensagensFormatadas,
      count: mensagensFormatadas.length,
      boundedContext: "comunicacao",
      isolamento: "regional_automatico",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao buscar mensagens regionais:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar mensagens regionais',
      boundedContext: "comunicacao"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // ✅ DADOS CONFORME DOCUMENTAÇÃO DE COMUNICAÇÃO SIMPLES
    const { 
      conteudo, 
      supervisorId = 1,
      regionalId = 1,
      prazoExpiracao = 7 // dias
    } = body;

    // ✅ VALIDAÇÕES OBRIGATÓRIAS
    if (!conteudo || conteudo.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conteúdo da mensagem é obrigatório',
        boundedContext: "comunicacao"
      }, { status: 400 });
    }

    // ✅ VALIDAÇÃO: MÁXIMO 500 CARACTERES CONFORME DOCUMENTAÇÃO
    if (conteudo.length > 500) {
      return NextResponse.json({
        success: false,
        error: 'Mensagem deve ter máximo 500 caracteres',
        limite: 500,
        atual: conteudo.length,
        boundedContext: "comunicacao"
      }, { status: 400 });
    }

    // ✅ CALCULAR DATA DE EXPIRAÇÃO (PADRÃO: 7 DIAS)
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + prazoExpiracao);

    // ✅ CRIAR MENSAGEM REGIONAL VIA MCP SUPABASE
    const response = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute_sql',
        query: `
          INSERT INTO mensagem_regional (
            regional_id, supervisor_id, conteudo, data_expiracao, ativa
          ) VALUES (
            $1, $2, $3, $4, true
          ) RETURNING *
        `,
        params: [
          regionalId,
          supervisorId,
          conteudo.trim(),
          dataExpiracao.toISOString().split('T')[0]
        ]
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error('Erro ao criar mensagem regional');
    }

    const novaMensagem = result.data[0];

    return NextResponse.json({
      success: true,
      data: {
        id: novaMensagem.id,
        conteudo: novaMensagem.conteudo,
        dataCriacao: novaMensagem.data_criacao,
        dataExpiracao: novaMensagem.data_expiracao,
        ativa: novaMensagem.ativa,
        regionalId: novaMensagem.regional_id
      },
      message: 'Mensagem regional criada com sucesso',
      boundedContext: "comunicacao",
      isolamento: "regional_automatico"
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Erro ao criar mensagem regional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao criar mensagem regional',
      boundedContext: "comunicacao"
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const mensagemId = url.searchParams.get('id');

    if (!mensagemId) {
      return NextResponse.json({
        success: false,
        error: 'ID da mensagem é obrigatório',
        boundedContext: "comunicacao"
      }, { status: 400 });
    }

    // ✅ REVOGAR MENSAGEM (TORNAR INATIVA) VIA MCP SUPABASE
    const response = await fetch('http://localhost:3000/api/internal/mcp-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute_sql',
        query: `
          UPDATE mensagem_regional 
          SET ativa = false, data_expiracao = CURRENT_DATE
          WHERE id = $1 
          RETURNING *
        `,
        params: [mensagemId]
      })
    });

    const result = await response.json();
    
    if (!result.success || result.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Mensagem não encontrada',
        boundedContext: "comunicacao"
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem revogada com sucesso',
      boundedContext: "comunicacao"
    });

  } catch (error) {
    console.error('❌ Erro ao revogar mensagem:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao revogar mensagem',
      boundedContext: "comunicacao"
    }, { status: 500 });
  }
} 