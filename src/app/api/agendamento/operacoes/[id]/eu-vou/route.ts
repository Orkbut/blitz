import { NextRequest, NextResponse } from 'next/server';
import { EuVouOrchestrator } from '@/core/domain/services/EuVouOrchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const membroIdLog = new URL(request.url).searchParams.get('membroId') || (await request.clone().json()).membroId || 'N/A';
  const operacaoIdLog = (await params).id;
  console.log(`%c[TEMP-LOG-API-EU-VOU] 🚀 === INÍCIO SOLICITAÇÃO EU VOU === Membro ${membroIdLog} → Op ${operacaoIdLog}`, 'background: #8b5cf6; color: white; font-weight: bold; padding: 4px;');

  try {
    const { id } = await params;
    const operacaoId = parseInt(id);
    
    if (isNaN(operacaoId)) {
      return NextResponse.json({
        success: false,
        error: 'ID da operação inválido',
        boundedContext: "agendamento"
      }, { status: 400 });
    }

    // Obter dados do body da requisição
    console.log(`[TEMP-LOG-API-EU-VOU] 📥 Processando dados da requisição...`);
    const body = await request.json();
    const { membroId, tipoParticipacao = 'DIARIA_COMPLETA' } = body;
    console.log(`[TEMP-LOG-API-EU-VOU] 📋 Dados extraídos: membroId=${membroId}, tipoParticipacao=${tipoParticipacao}`);

    if (!membroId || isNaN(parseInt(membroId))) {
      console.log(`[TEMP-LOG-API-EU-VOU] ❌ ERRO VALIDAÇÃO: ID membro inválido: ${membroId}`);
      return NextResponse.json({
        success: false,
        error: 'ID do membro é obrigatório e deve ser um número',
        boundedContext: "agendamento"
      }, { status: 400 });
    }

    // Usar o EuVouOrchestrator para processar a solicitação
    console.log(`[TEMP-LOG-API-EU-VOU] 🎯 Criando EuVouOrchestrator e executando solicitação...`);
    const orchestrator = new EuVouOrchestrator();
    console.log(`[TEMP-LOG-API-EU-VOU] 🚀 Chamando orchestrator.executar(${parseInt(membroId)}, ${operacaoId})`);
    const resultado = await orchestrator.executar(
      parseInt(membroId),
      operacaoId
    );
    console.log(`[TEMP-LOG-API-EU-VOU] 📊 Resultado do orchestrator:`, resultado);

    return NextResponse.json({
      success: true,
      data: {
        status: resultado.status,
        mensagem: resultado.mensagem,
        detalhes: resultado.detalhes,
        previewDiaria: resultado.previewDiaria,
        posicaoFila: resultado.posicaoFila
      },
      boundedContext: "agendamento",
      cleanArchitecture: {
        domainService: "EuVouOrchestrator",
        validations: "ValidadorParticipacao + CalculadoraDiaria",
        repositories: "SupabaseOperacaoRepository + SupabaseServidorRepository"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API EU VOU:', error);
    console.log(`%c[API-EU-VOU-ERRO] Erro ao processar solicitação do membro ${membroIdLog} para op ${operacaoIdLog}`, 'color: #ef4444; font-weight: bold;', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "agendamento",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET para verificar disponibilidade sem confirmar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const operacaoId = parseInt(id);
    
    if (isNaN(operacaoId)) {
      return NextResponse.json({
        success: false,
        error: 'ID da operação inválido',
        boundedContext: "agendamento"
      }, { status: 400 });
    }

    // TODO: Implementar autenticação real para obter membroId
    const membroId = 1;

    const orchestrator = new EuVouOrchestrator();
    const disponivel = await orchestrator.verificarDisponibilidade(membroId, operacaoId);

    return NextResponse.json({
      success: true,
      data: {
        disponivel,
        operacaoId,
        membroId
      },
      boundedContext: "agendamento",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "agendamento",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 