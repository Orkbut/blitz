import { NextRequest, NextResponse } from 'next/server';
import { EuVouOrchestrator } from '@/core/domain/services/EuVouOrchestrator';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const bodyForLog = await request.clone().json();
  console.log(`%c[API-CANCELAR-INICIO] Recebida solicitação de cancelamento:`, 'color: #f97316; font-weight: bold;', bodyForLog);

  console.log('🚨🚨🚨 ======= API /api/agendamento/cancelar: REQUISIÇÃO CHEGOU ======= 🚨🚨🚨');
  console.log('📡 [API] URL:', request.url);
  console.log('📡 [API] Method:', request.method);
  console.log('⏰ [API] Timestamp IMEDIATO:', new Date().toISOString());
  console.error('🔥🔥🔥 LOGS SUPER VISÍVEIS - SE NÃO APARECER, API NÃO ESTÁ EXECUTANDO! 🔥🔥🔥');
  
  try {
    console.log('🚨🚨🚨 ======= API /api/agendamento/cancelar: PROCESSANDO ======= 🚨🚨🚨');
  
    console.log('⏰ [API CANCELAR] Timestamp:', new Date().toISOString());
    console.log('🎯 [API CANCELAR] Esta é a API que DEVERIA usar EuVouOrchestrator CORRIGIDO');
    console.error('🔥🔥🔥 SE ESTES LOGS NÃO APARECEM, ALGO ESTÁ ERRADO! 🔥🔥🔥');
    
    const body = await request.json();
    const { membroId, operacaoId } = body;
    console.log('📋 Dados recebidos:', { membroId, operacaoId });
    console.error('🎯🎯🎯 DADOS RECEBIDOS - membroId:', membroId, 'operacaoId:', operacaoId, '🎯🎯🎯');

    // 🔍 Verificar se a participação existe no banco e se operação está inativa
    const { data: participacao, error: checkError } = await supabase
      .from('participacao')
      .select(`
        *,
        operacao!inner(inativa_pelo_supervisor)
      `)
      .eq('membro_id', membroId)
      .eq('operacao_id', operacaoId)
      .eq('ativa', true);

    // 🔒 VERIFICAR SE OPERAÇÃO ESTÁ INATIVA PELO SUPERVISOR
    if (participacao && participacao.length > 0 && (participacao[0] as any).operacao.inativa_pelo_supervisor) {
      console.log(`📁 [INATIVACAO] Tentativa de cancelar participação em operação inativa ${operacaoId}`);
      return NextResponse.json({
        success: false,
        error: 'Esta operação está no histórico e não aceita mais alterações',
        tipo: 'OPERACAO_INATIVA',
        boundedContext: "agendamento"
      }, { status: 403 });
    }
    
    

    if (!membroId || !operacaoId) {
      return NextResponse.json({
        success: false,
        error: 'ID do membro e da operação são obrigatórios',
        boundedContext: "agendamento"
      }, { status: 400 });
    }

    // Usar o EuVouOrchestrator para cancelar participação
    const orchestrator = new EuVouOrchestrator();
    
    try {
      console.error('🔥🔥🔥 TENTANDO CANCELAR VIA EUVOUORCHESTRATOR 🔥🔥🔥');
      console.log('🔄 [API CANCELAR] Tentando cancelar participação via EuVouOrchestrator...');
      console.log('🎯 [API CANCELAR] Parâmetros: membroId =', parseInt(membroId), ', operacaoId =', parseInt(operacaoId));
      console.log('✅ [API CANCELAR] EuVouOrchestrator foi CORRIGIDO para buscar registro completo primeiro');

      console.error('🚀🚀🚀 CHAMANDO orchestrator.cancelarParticipacao() AGORA! 🚀🚀🚀');
      
      const sucesso = await orchestrator.cancelarParticipacao(parseInt(membroId), parseInt(operacaoId));
      
      console.error('💥💥💥 RESULTADO DO EUVOUORCHESTRATOR:', sucesso, '💥💥💥');
      console.log('📊 [API CANCELAR] Resultado do EuVouOrchestrator.cancelarParticipacao:', sucesso);
      console.log('🚀 [API CANCELAR] Agora devemos aguardar evento DELETE COM operacao_id no realtime!');

      if (sucesso) {
        console.log('🎉 SUCESSO! Participação cancelada com sucesso!');
        console.log('🔥 ESPERANDO EVENTO DELETE NO REALTIME...');
        
        return NextResponse.json({
          success: true,
          data: {
            status: 'CANCELADO',
            mensagem: 'Participação cancelada com sucesso!'
          },
          boundedContext: "agendamento",
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('❌ Cancelamento retornou false - sem sucesso');
        return NextResponse.json({
          success: false,
          error: 'Não foi possível cancelar a participação',
          boundedContext: "agendamento",
          timestamp: new Date().toISOString()
        }, { status: 400 });
      }
    } catch (error: any) {
      console.log('❌ Erro no cancelamento:', error?.message || error);
      
      // 🔒 TRATAMENTO ESPECIAL: Bloqueios da diretoria
      if (error?.message?.startsWith('BLOQUEADO_DIRETORIA:')) {
        const mensagem = error.message.replace('BLOQUEADO_DIRETORIA: ', '');
        console.log('🔒 Participação bloqueada pela diretoria:', mensagem);
        return NextResponse.json({
          success: false,
          error: mensagem,
          tipo: 'BLOQUEADO_DIRETORIA',
          boundedContext: "agendamento",
          timestamp: new Date().toISOString()
        }, { status: 423 }); // 423 = Locked (resource temporarily unavailable)
      }

      // Outros erros
      throw error;
    }

  } catch (error) {
    console.log('💥 [API CANCELAR] ======= ERRO CRÍTICO CAPTURADO =======');
    console.log('💥 [API CANCELAR] Error completo:', error);
    console.log('💥 [API CANCELAR] Error message:', error?.message || 'Sem mensagem');
    console.log('💥 [API CANCELAR] Error stack:', error?.stack || 'Sem stack');
    console.log('💥 [API CANCELAR] Timestamp:', new Date().toISOString());
    console.error('Erro ao cancelar participação:', error);
    console.log(`%c[API-CANCELAR-ERRO] Erro ao processar cancelamento:`, 'color: #ef4444; font-weight: bold;', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "agendamento",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET para testar se a rota está funcionando
export async function GET(request: NextRequest) {
  console.log('🧪 [API CANCELAR] ======= TESTE GET RECEBIDO =======');
  console.log('🧪 [API CANCELAR] URL:', request.url);
  console.log('🧪 [API CANCELAR] Timestamp:', new Date().toISOString());
  console.log('🧪 [API CANCELAR] Rota está FUNCIONANDO e ACESSÍVEL!');
  
  return NextResponse.json({
    success: true,
    message: 'API de cancelamento está funcionando',
    endpoint: '/api/agendamento/cancelar',
    methods: ['POST'],
    timestamp: new Date().toISOString(),
    status: 'ACCESSIBLE'
  });
}