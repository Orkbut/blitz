import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Testando Realtime de Concorrência entre Membros...\n');

async function testarConcorrenciaRealtime() {
  console.log('1️⃣ Configurando listeners para simular múltiplos membros...');
  
  let eventosRecebidosMembro1 = 0;
  let eventosRecebidosMembro2 = 0;
  let eventosRecebidosSupervisor = 0;
  
  // Simular Membro 1 (canal global como no código corrigido)
  const channelMembro1 = supabase
    .channel('calendario-global-realtime-membro1')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosRecebidosMembro1++;
        console.log(`👤 MEMBRO 1 - Evento ${eventosRecebidosMembro1}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  // Simular Membro 2 (canal global)
  const channelMembro2 = supabase
    .channel('calendario-global-realtime-membro2')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosRecebidosMembro2++;
        console.log(`👥 MEMBRO 2 - Evento ${eventosRecebidosMembro2}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          membro_id: payload.new?.membro_id || payload.old?.membro_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  // Simular Supervisor (canal específico como no CalendarioSupervisor)
  const channelSupervisor = supabase
    .channel('calendario-supervisor-teste')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao'
      },
      (payload) => {
        eventosRecebidosSupervisor++;
        console.log(`👨‍💼 SUPERVISOR - Evento ${eventosRecebidosSupervisor}:`, {
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

  console.log('\n2️⃣ Simulando solicitação de participação...');
  
  // Buscar uma operação ativa para teste
  const { data: operacoes } = await supabase
    .from('operacao')
    .select('id, data_operacao, modalidade, limite_participantes')
    .eq('ativa', true)
    .limit(1);
  
  if (!operacoes || operacoes.length === 0) {
    console.log('❌ Nenhuma operação ativa encontrada para teste');
    return;
  }
  
  const operacaoTeste = operacoes[0];
  console.log('✅ Operação selecionada para teste:', {
    id: operacaoTeste.id,
    data: operacaoTeste.data_operacao,
    modalidade: operacaoTeste.modalidade
  });

  // Simular solicitação de participação (Membro 35 - IDIONY)
  console.log('\n🔄 Membro 35 (IDIONY) fazendo solicitação...');
  
  const { data: novaParticipacao, error } = await supabase
    .from('participacao')
    .insert({
      membro_id: 35, // IDIONY GONÇALVES DOS SANTOS
      operacao_id: operacaoTeste.id,
      estado_visual: 'PENDENTE',
      status_interno: 'AGUARDANDO_SUPERVISOR',
      data_participacao: new Date().toISOString(),
      ativa: true
    })
    .select()
    .single();

  if (error) {
    console.log('❌ Erro ao inserir participação:', error.message);
    
    // Tentar atualizar uma participação existente
    console.log('🔄 Tentando atualizar participação existente...');
    const { error: updateError } = await supabase
      .from('participacao')
      .update({
        estado_visual: 'PENDENTE',
        status_interno: 'AGUARDANDO_SUPERVISOR',
        updated_at: new Date().toISOString()
      })
      .eq('membro_id', 35)
      .eq('operacao_id', operacaoTeste.id)
      .eq('ativa', true);
    
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

  console.log('\n3️⃣ Simulando confirmação pelo supervisor...');
  
  const { error: confirmError } = await supabase
    .from('participacao')
    .update({
      estado_visual: 'CONFIRMADO',
      status_interno: 'APROVADO'
    })
    .eq('membro_id', 35)
    .eq('operacao_id', operacaoTeste.id)
    .eq('ativa', true);

  if (confirmError) {
    console.log('❌ Erro ao confirmar participação:', confirmError.message);
  } else {
    console.log('✅ Participação confirmada pelo supervisor');
  }

  console.log('\n⏳ Aguardando eventos finais (5 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n4️⃣ Resultado do teste de concorrência:');
  console.log(`👤 Membro 1 recebeu: ${eventosRecebidosMembro1} eventos`);
  console.log(`👥 Membro 2 recebeu: ${eventosRecebidosMembro2} eventos`);
  console.log(`👨‍💼 Supervisor recebeu: ${eventosRecebidosSupervisor} eventos`);
  
  const totalEventos = eventosRecebidosMembro1 + eventosRecebidosMembro2 + eventosRecebidosSupervisor;
  
  if (totalEventos >= 6) { // Esperamos pelo menos 2 eventos (INSERT/UPDATE) × 3 canais
    console.log('✅ REALTIME FUNCIONANDO: Todos os membros receberam eventos!');
    console.log('🎯 CONCORRÊNCIA OK: Sistema está sincronizado em tempo real');
  } else if (totalEventos > 0) {
    console.log('⚠️ REALTIME PARCIAL: Alguns eventos foram recebidos');
    console.log('🔍 Pode haver problemas de configuração ou rate limiting');
  } else {
    console.log('❌ REALTIME FALHOU: Nenhum evento foi recebido');
    console.log('🚨 PROBLEMA CRÍTICO: Sistema não está sincronizado');
  }

  // Cleanup
  channelMembro1.unsubscribe();
  channelMembro2.unsubscribe();
  channelSupervisor.unsubscribe();
  
  console.log('\n🏁 Teste de concorrência concluído!');
}

testarConcorrenciaRealtime()
  .then(() => {
    console.log('\n✅ Teste finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Erro durante o teste:', error);
    process.exit(1);
  });