import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Testando Realtime com Usuários Reais (3006362 e 3006363)...\n');

async function testarRealtimeUsuariosReais() {
  console.log('1️⃣ Configurando listeners exatamente como no código da aplicação...');
  
  let eventosRecebidosUsuario1 = 0;
  let eventosRecebidosUsuario2 = 0;
  
  // Simular exatamente o canal usado no CalendarioSimplesComponent
  const channelUsuario1 = supabase
    .channel('calendario-realtime-global-user1')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosRecebidosUsuario1++;
        console.log(`👤 USUÁRIO 3006362 - Evento ${eventosRecebidosUsuario1}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          ativa: payload.new?.ativa,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'operacao'
      },
      (payload) => {
        eventosRecebidosUsuario1++;
        console.log(`👤 USUÁRIO 3006362 - Evento OPERACAO ${eventosRecebidosUsuario1}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.id || payload.old?.id,
          ativa: payload.new?.ativa,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  // Segundo usuário com canal diferente (simulando navegador diferente)
  const channelUsuario2 = supabase
    .channel('calendario-realtime-global-user2')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosRecebidosUsuario2++;
        console.log(`👥 USUÁRIO 3006363 - Evento ${eventosRecebidosUsuario2}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          ativa: payload.new?.ativa,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'operacao'
      },
      (payload) => {
        eventosRecebidosUsuario2++;
        console.log(`👥 USUÁRIO 3006363 - Evento OPERACAO ${eventosRecebidosUsuario2}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.id || payload.old?.id,
          ativa: payload.new?.ativa,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  console.log('⏳ Aguardando conexões (3 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n2️⃣ Simulando ação do usuário 3006362 (IDIONY)...');
  
  // Buscar IDs dos usuários
  const { data: usuarios } = await supabase
    .from('servidor')
    .select('id, matricula, nome')
    .in('matricula', ['3006362', '3006363']);
  
  console.log('👥 Usuários encontrados:', usuarios);
  
  const idiony = usuarios?.find(u => u.matricula === '3006362');
  const douglas = usuarios?.find(u => u.matricula === '3006363');
  
  if (!idiony || !douglas) {
    console.log('❌ Usuários não encontrados');
    return;
  }

  // Simular clique "EU VOU" do IDIONY na operação 33 (02/08)
  console.log(`\n🔄 ${idiony.nome} (${idiony.matricula}) fazendo solicitação na operação 33...`);
  
  const { data: novaParticipacao, error } = await supabase
    .from('participacao')
    .insert({
      membro_id: idiony.id,
      operacao_id: 33, // Operação do dia 02/08
      estado_visual: 'PENDENTE',
      status_interno: 'AGUARDANDO_SUPERVISOR',
      data_participacao: new Date().toISOString(),
      ativa: true
    })
    .select()
    .single();

  if (error) {
    console.log('❌ Erro ao inserir participação:', error.message);
    
    // Tentar atualizar participação existente
    console.log('🔄 Tentando atualizar participação existente...');
    const { error: updateError } = await supabase
      .from('participacao')
      .update({
        estado_visual: 'PENDENTE',
        status_interno: 'AGUARDANDO_SUPERVISOR',
        updated_at: new Date().toISOString(),
        ativa: true
      })
      .eq('membro_id', idiony.id)
      .eq('operacao_id', 33);
    
    if (updateError) {
      console.log('❌ Erro no update:', updateError.message);
    } else {
      console.log('✅ Participação atualizada com sucesso');
    }
  } else {
    console.log('✅ Nova participação criada:', novaParticipacao.id);
  }

  console.log('\n⏳ Aguardando eventos de realtime (8 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('\n3️⃣ Simulando ação do usuário 3006363 (DOUGLAS)...');
  
  // Simular clique "EU VOU" do DOUGLAS na mesma operação
  console.log(`\n🔄 ${douglas.nome} (${douglas.matricula}) fazendo solicitação na operação 33...`);
  
  const { data: novaParticipacao2, error: error2 } = await supabase
    .from('participacao')
    .insert({
      membro_id: douglas.id,
      operacao_id: 33,
      estado_visual: 'PENDENTE',
      status_interno: 'AGUARDANDO_SUPERVISOR',
      data_participacao: new Date().toISOString(),
      ativa: true
    })
    .select()
    .single();

  if (error2) {
    console.log('❌ Erro ao inserir participação do Douglas:', error2.message);
    
    // Tentar atualizar
    const { error: updateError2 } = await supabase
      .from('participacao')
      .update({
        estado_visual: 'PENDENTE',
        status_interno: 'AGUARDANDO_SUPERVISOR',
        updated_at: new Date().toISOString(),
        ativa: true
      })
      .eq('membro_id', douglas.id)
      .eq('operacao_id', 33);
    
    if (updateError2) {
      console.log('❌ Erro no update do Douglas:', updateError2.message);
    } else {
      console.log('✅ Participação do Douglas atualizada');
    }
  } else {
    console.log('✅ Nova participação do Douglas criada:', novaParticipacao2.id);
  }

  console.log('\n⏳ Aguardando eventos finais (5 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n4️⃣ Resultado do teste com usuários reais:');
  console.log(`👤 Usuário 3006362 (IDIONY) recebeu: ${eventosRecebidosUsuario1} eventos`);
  console.log(`👥 Usuário 3006363 (DOUGLAS) recebeu: ${eventosRecebidosUsuario2} eventos`);
  
  const totalEventos = eventosRecebidosUsuario1 + eventosRecebidosUsuario2;
  
  if (totalEventos >= 4) { // Esperamos pelo menos 2 eventos × 2 usuários
    console.log('✅ REALTIME FUNCIONANDO: Ambos usuários receberam eventos!');
    console.log('🎯 PROBLEMA PODE ESTAR NO FRONTEND: Verificar processamento dos eventos');
  } else if (totalEventos > 0) {
    console.log('⚠️ REALTIME PARCIAL: Alguns eventos foram recebidos');
    console.log('🔍 Possível problema de configuração ou rate limiting');
  } else {
    console.log('❌ REALTIME FALHOU COMPLETAMENTE: Nenhum evento foi recebido');
    console.log('🚨 PROBLEMA NO SUPABASE REALTIME: Verificar configuração do projeto');
  }

  // Verificar se os dados estão realmente no banco
  console.log('\n5️⃣ Verificando dados no banco após o teste...');
  const { data: participacoesFinais } = await supabase
    .from('participacao')
    .select(`
      id,
      membro_id,
      operacao_id,
      estado_visual,
      ativa,
      updated_at,
      servidor:membro_id(matricula, nome)
    `)
    .eq('operacao_id', 33)
    .eq('ativa', true)
    .in('membro_id', [idiony.id, douglas.id])
    .order('updated_at', { ascending: false });

  console.log('📊 Participações ativas na operação 33:', participacoesFinais);

  // Cleanup
  channelUsuario1.unsubscribe();
  channelUsuario2.unsubscribe();
  
  console.log('\n🏁 Teste com usuários reais concluído!');
}

testarRealtimeUsuariosReais()
  .then(() => {
    console.log('\n✅ Teste finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Erro durante o teste:', error);
    process.exit(1);
  });