import { NextRequest, NextResponse } from 'next/server';
import { EuVouOrchestrator } from '../../../../../core/domain/services/EuVouOrchestrator';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ CORREÇÃO: Await params para Next.js 15+
    const resolvedParams = await params;
    const servidorId = parseInt(resolvedParams.id);

    if (isNaN(servidorId)) {
      return NextResponse.json({
        success: false,
        error: 'ID do servidor inválido'
      }, { status: 400 });
    }

    // Usar o orchestrator para recalcular validações
    const orchestrator = new EuVouOrchestrator();
    const limitesValidacoes = await orchestrator.recalcularValidacoesServidor(servidorId);

    return NextResponse.json({
      success: true,
      data: limitesValidacoes,
      meta: {
        servidorId,
        timestamp: new Date().toISOString(),
        calculadoEm: 'tempo_real'
      }
    });

  } catch (error) {
    console.error('Erro ao buscar limites e validações:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 