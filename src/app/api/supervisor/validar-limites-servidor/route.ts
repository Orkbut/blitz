import { NextRequest, NextResponse } from 'next/server';

/**
 * NO-OP seguro: sempre permite a confirmação mantendo o contrato de resposta
 * Preserva o shape esperado pelo frontend para não quebrar fluxos existentes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { servidorId, dataOperacao, tipoOperacao } = body || {};

    // Mantém validação básica de entrada para evitar chamadas inválidas acidentais
    if (!servidorId || !dataOperacao || !tipoOperacao) {
      return NextResponse.json({
        success: false,
        error: 'servidorId, dataOperacao e tipoOperacao são obrigatórios'
      }, { status: 400 });
    }

    // Retorna resultado positivo sempre, com limites "inofensivos"
    return NextResponse.json({
      success: true,
      data: {
        podeConfirmar: true,
        limitesAtuais: {
          atividadesPeriodo10a09: 0,
          diariasNoMes: 0,
          limiteAtividades: 999999,
          limiteDiarias: 999999
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na rota de validação (no-op):', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}