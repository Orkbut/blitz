import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Teste Simples de Realtime...\n');

async function testeRealtimeSimples() {
  console.log('1️⃣ Configurando listener...');
  
  let eventosRecebidos = 0;
  
  const channel = supabase
    .channel('teste-simples')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosRecebidos++;
        console.log(`📡 Evento ${eventosRecebidos} recebido:`, {
          tipo: payload.eventType,
          id: payload.new?.id || payload.old?.id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe((status) => {
      console.log('🔌 Status da conexão:', status);
    });

  console.log('⏳ Aguardando conexão (3 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n2️⃣ Fazendo UPDATE direto no banco...');
  
  const { error } = await supabase
    .from('participacao')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', 786);

  if (error) {
    console.log('❌ Erro no UPDATE:', error.message);
  } else {
    console.log('✅ UPDATE executado com sucesso');
  }

  console.log('\n⏳ Aguardando eventos (10 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n3️⃣ Resultado:');
  if (eventosRecebidos > 0) {
    console.log('✅ REALTIME FUNCIONANDO!');
  } else {
    console.log('❌ REALTIME NÃO FUNCIONOU');
    console.log('🔍 Possíveis causas:');
    console.log('   - Realtime não habilitado no projeto Supabase');
    console.log('   - Problemas de rede/firewall');
    console.log('   - Configuração incorreta da tabela');
  }

  channel.unsubscribe();
  console.log('\n🏁 Teste concluído!');
}

testeRealtimeSimples()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ Erro:', error);
    process.exit(1);
  });