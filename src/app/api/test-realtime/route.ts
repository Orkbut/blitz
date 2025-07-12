import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
  
    
    // 1. Verificar se o cliente está configurado
    const clientInfo = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      realtimeConnected: supabase.realtime.isConnected()
    };
    
    console.log('📊 [Test Realtime] Cliente info:', clientInfo);
    
    // 2. Criar um canal de teste
    const testChannel = supabase.channel('test-channel-' + Date.now());
    
    // 3. Configurar listeners
    let receivedEvents: any[] = [];
    
    testChannel
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'operacao' 
        }, 
        (payload) => {
          console.log('🎉 [Test Realtime] Evento recebido:', payload);
          receivedEvents.push({
            type: 'postgres_changes',
            event: payload.eventType,
            table: 'operacao',
            timestamp: new Date().toISOString(),
            data: payload
          });
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participacao'
        },
        (payload) => {
          console.log('🎉 [Test Realtime] Evento recebido:', payload);
          receivedEvents.push({
            type: 'postgres_changes',
            event: payload.eventType,
            table: 'participacao',
            timestamp: new Date().toISOString(),
            data: payload
          });
        }
      );
    
    // 4. Subscrever ao canal
    const subscription = await new Promise((resolve) => {
      testChannel.subscribe((status) => {
        console.log('📡 [Test Realtime] Status da subscription:', status);
        if (status === 'SUBSCRIBED') {
          resolve({ success: true, status });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve({ success: false, status });
        }
      });
      
      // Timeout de 10 segundos
      setTimeout(() => {
        resolve({ success: false, status: 'TIMEOUT' });
      }, 10000);
    });
    
    // 5. Fazer uma pequena alteração para testar
    if ((subscription as any).success) {
      console.log('✅ [Test Realtime] Canal subscrito com sucesso! Fazendo alteração de teste...');
      
      // Buscar uma operação para atualizar
      const { data: operacao } = await supabase
        .from('operacao')
        .select('id')
        .limit(1)
        .single();
      
      if (operacao) {
        // Atualizar para triggar evento
        await supabase
          .from('operacao')
          .update({ 
            updated_at: new Date().toISOString(),
            atualizacao_forcada: new Date().toISOString() 
          })
          .eq('id', operacao.id);
        
        console.log('📝 [Test Realtime] Operação atualizada:', operacao.id);
      }
      
      // Aguardar 2 segundos para receber eventos
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 6. Limpar subscription
    testChannel.unsubscribe();
    
    // 7. Retornar resultado
    const result = {
      success: (subscription as any).success,
      subscription: subscription,
      clientInfo: clientInfo,
      channelState: testChannel.state,
      receivedEvents: receivedEvents,
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 [Test Realtime] Resultado final:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ [Test Realtime] Erro:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Teste de insert para verificar se dispara eventos
    const { data, error } = await supabase
      .from('participacao')
      .insert({
        servidor_id: 1,
        operacao_id: 276,
        estado_participacao: 'SOLICITADO',
        ativa: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Aguardar um pouco e depois deletar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await supabase
      .from('participacao')
      .delete()
      .eq('id', data.id);
    
    return NextResponse.json({
      success: true,
      message: 'Teste de insert/delete concluído',
      data: data
    });
    
  } catch (error) {
    console.error('❌ [Test Realtime POST] Erro:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 