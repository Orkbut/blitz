import { NextRequest, NextResponse } from 'next/server';

/**
 * NO-OP seguro (BATCH): sempre permite confirmação para múltiplos servidores.
 * Mantém o contrato esperado: { success, data: { sucessos, erros, total, processados }, timestamp }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { servidoresIds, dataOperacao, tipoOperacao } = body || {};

    if (!servidoresIds || !Array.isArray(servidoresIds) || servidoresIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'servidoresIds deve ser um array não vazio'
      }, { status: 400 });
    }

    if (!dataOperacao || !tipoOperacao) {
      return NextResponse.json({
        success: false,
        error: 'dataOperacao e tipoOperacao são obrigatórios'
      }, { status: 400 });
    }

    const sucessos = servidoresIds.map((servidorId: number) => ({
      servidorId,
      success: true,
      data: {
        podeConfirmar: true,
        limitesAtuais: {
          atividadesPeriodo10a09: 0,
          diariasNoMes: 0,
          limiteAtividades: 999999,
          limiteDiarias: 999999
        }
      }
    }));

    return NextResponse.json({
      success: true,
      data: {
        sucessos,
        erros: [],
        total: servidoresIds.length,
        processados: sucessos.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [BATCH NO-OP] Erro na validação de limites:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}