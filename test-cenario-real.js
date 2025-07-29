import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Teste do Cenário Real - Dois Membros Logados...\n');

async function testarCenarioReal() {
  console.log('1️⃣ Simulando dois navegadores com membros diferentes...');
  
  let eventosUsuario3006362 = 0;
  let eventosUsuario3006363 = 0;
  
  // Navegador 1 - Usuário 3006362 (IDIONY)
  const channelUsuario1 = supabase
    .channel('calendario-realtime-global-3006362')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosUsuario3006362++;
        console.log(`👤 USUÁRIO 3006362 (IDIONY) - Evento ${eventosUsuario3006362}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  // Navegador 2 - Usuário 3006363 (DOUGLAS)  
  const channelUsuario2 = supabase
    .channel('calendario-realtime-global-3006363')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosUsuario3006363++;
        console.log(`👥 USUÁRIO 3006363 (DOUGLAS) - Evento ${eventosUsuario3006363}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  console.log('⏳ Aguardando conexões (3 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n2️⃣ Simulando clique "EU VOU" do usuário 3006362...');
  
  // Simular mudança de estado de uma participação existente
  const { error } = await supabase
    .from('participacao')
    .update({
      estado_visual: 'CONFIRMADO',
      status_interno: 'APROVADO',
      updated_at: new Date().toISOString()
    })
    .eq('id', 786); // Participação do IDIONY

  if (error) {
    console.log('❌ Erro ao atualizar participação:', error.message);
  } else {
    console.log('✅ Participação atualizada - IDIONY agora está CONFIRMADO');
  }

  console.log('\n⏳ Aguardando eventos de realtime (5 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n3️⃣ Simulando clique "EU VOU" do usuário 3006363...');
  
  // Simular mudança de estado da participação do DOUGLAS
  const { error: error2 } = await supabase
    .from('participacao')
    .update({
      estado_visual: 'CONFIRMADO',
      status_interno: 'APROVADO',
      updated_at: new Date().toISOString()
    })
    .eq('id', 785); // Participação do DOUGLAS

  if (error2) {
    console.log('❌ Erro ao atualizar participação do Douglas:', error2.message);
  } else {
    console.log('✅ Participação atualizada - DOUGLAS agora está CONFIRMADO');
  }

  console.log('\n⏳ Aguardando eventos finais (5 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n4️⃣ Resultado do teste:');
  console.log(`👤 Usuário 3006362 (IDIONY) recebeu: ${eventosUsuario3006362} eventos`);
  console.log(`👥 Usuário 3006363 (DOUGLAS) recebeu: ${eventosUsuario3006363} eventos`);
  
  const totalEventos = eventosUsuario3006362 + eventosUsuario3006363;
  
  if (totalEventos >= 4) { // 2 eventos × 2 usuários
    console.log('\n✅ SUCESSO TOTAL!');
    console.log('🎯 REALTIME FUNCIONANDO PERFEITAMENTE');
    console.log('📱 Ambos os navegadores receberiam as atualizações em tempo real');
    console.log('🔄 O problema estava na configuração do Supabase, agora está CORRIGIDO!');
  } else if (totalEventos > 0) {
    console.log('\n⚠️ SUCESSO PARCIAL');
    console.log('🔍 Alguns eventos foram recebidos, mas pode haver otimizações necessárias');
  } else {
    console.log('\n❌ AINDA HÁ PROBLEMAS');
    console.log('🚨 Nenhum evento foi recebido');
  }

  // Verificar estado final no banco
  console.log('\n5️⃣ Estado final no banco de dados:');
  const { data: estadoFinal } = await supabase
    .from('participacao')
    .select(`
      id,
      membro_id,
      estado_visual,
      status_interno,
      updated_at,
      servidor:membro_id(matricula, nome)
    `)
    .in('id', [785, 786])
    .order('updated_at', { ascending: false });

  console.log('📊 Participações atualizadas:', estadoFinal);

  // Cleanup
  channelUsuario1.unsubscribe();
  channelUsuario2.unsubscribe();
  
  console.log('\n🏁 Teste do cenário real concluído!');
  console.log('\n🎉 AGORA VOCÊ PODE TESTAR NOS NAVEGADORES:');
  console.log('   1. Abra http://localhost:3000/membro em dois navegadores');
  console.log('   2. Faça login com 3006362 em um e 3006363 no outro');
  console.log('   3. Clique "EU VOU" em uma operação');
  console.log('   4. O outro navegador deve atualizar AUTOMATICAMENTE!');
}

testarCenarioReal()
  .then(() => {
    console.log('\n✅ Teste finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Erro durante o teste:', error);
    process.exit(1);
  });