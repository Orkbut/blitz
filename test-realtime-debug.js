import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 Iniciando teste de diagnóstico do Realtime...\n');

async function diagnosticarRealtime() {
  console.log('1️⃣ Testando conexão básica com o banco...');
  
  try {
    const { data, error } = await supabase
      .from('operacao')
      .select('id, data_operacao, modalidade')
      .limit(3);
    
    if (error) {
      console.log('❌ Erro na conexão básica:', error.message);
      return;
    }
    
    console.log('✅ Conexão básica OK. Operações encontradas:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('📋 Exemplo de operação:', {
        id: data[0].id,
        data: data[0].data_operacao,
        modalidade: data[0].modalidade
      });
    }
  } catch (err) {
    console.log('❌ Erro na conexão:', err.message);
    return;
  }

  console.log('\n2️⃣ Testando subscription do Realtime...');
  
  let eventosRecebidos = 0;
  const eventos = [];
  
  const channel = supabase
    .channel('teste-diagnostico')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'operacao'
      },
      (payload) => {
        eventosRecebidos++;
        eventos.push({
          evento: payload.eventType,
          tabela: payload.table,
          timestamp: new Date().toISOString(),
          dados: payload.new || payload.old
        });
        
        console.log(`📡 Evento ${eventosRecebidos} recebido:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.id || payload.old?.id,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe((status) => {
      console.log('🔌 Status da subscription:', status);
    });

  console.log('⏳ Aguardando conexão do Realtime (5 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n3️⃣ Testando se eventos são disparados...');
  
  // Fazer uma alteração para testar se o realtime funciona
  try {
    const { data: operacaoTeste } = await supabase
      .from('operacao')
      .select('id')
      .limit(1)
      .single();
    
    if (operacaoTeste) {
      console.log(`🔄 Fazendo update na operação ${operacaoTeste.id} para testar realtime...`);
      
      const { error: updateError } = await supabase
        .from('operacao')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', operacaoTeste.id);
      
      if (updateError) {
        console.log('❌ Erro no update:', updateError.message);
      } else {
        console.log('✅ Update executado com sucesso');
      }
    }
  } catch (err) {
    console.log('❌ Erro ao fazer update de teste:', err.message);
  }

  console.log('⏳ Aguardando eventos do Realtime (10 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n4️⃣ Resultado do diagnóstico:');
  console.log(`📊 Total de eventos recebidos: ${eventosRecebidos}`);
  
  if (eventosRecebidos > 0) {
    console.log('✅ REALTIME FUNCIONANDO CORRETAMENTE!');
    console.log('📋 Eventos recebidos:', eventos);
  } else {
    console.log('❌ PROBLEMA IDENTIFICADO: Nenhum evento foi recebido');
    console.log('🔍 Possíveis causas:');
    console.log('   - Realtime não está habilitado no Supabase');
    console.log('   - Problemas de rede/firewall');
    console.log('   - Configuração incorreta das tabelas');
    console.log('   - Rate limiting ativo');
  }

  // Testar também a tabela participacao
  console.log('\n5️⃣ Testando tabela participacao...');
  
  const channelParticipacao = supabase
    .channel('teste-participacao')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        console.log('📡 Evento participacao recebido:', {
          tipo: payload.eventType,
          participacao_id: payload.new?.id || payload.old?.id,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id
        });
      }
    )
    .subscribe();

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Cleanup
  channel.unsubscribe();
  channelParticipacao.unsubscribe();
  
  console.log('\n🏁 Diagnóstico concluído!');
}

diagnosticarRealtime()
  .then(() => {
    console.log('\n✅ Teste finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Erro durante o teste:', error);
    process.exit(1);
  });