import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧪 Testando correção do Realtime no Calendário...\n');

async function testarCorrecaoCalendario() {
  console.log('1️⃣ Buscando uma operação para testar...');
  
  // Buscar uma operação ativa
  const { data: operacoes, error } = await supabase
    .from('operacao')
    .select('id, data_operacao, modalidade, limite_participantes')
    .eq('ativa', true)
    .limit(1);
  
  if (error || !operacoes || operacoes.length === 0) {
    console.log('❌ Nenhuma operação encontrada para teste');
    return;
  }
  
  const operacaoTeste = operacoes[0];
  console.log('✅ Operação selecionada:', {
    id: operacaoTeste.id,
    data: operacaoTeste.data_operacao,
    modalidade: operacaoTeste.modalidade,
    limite: operacaoTeste.limite_participantes
  });

  console.log('\n2️⃣ Configurando listeners de Realtime...');
  
  let eventosOperacao = 0;
  let eventosParticipacao = 0;
  
  // Listener para tabela operacao
  const channelOperacao = supabase
    .channel('teste-operacao')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'operacao',
        filter: `id=eq.${operacaoTeste.id}`
      },
      (payload) => {
        eventosOperacao++;
        console.log(`📡 Evento OPERACAO ${eventosOperacao}:`, {
          tipo: payload.eventType,
          operacao_id: payload.new?.id || payload.old?.id,
          status: payload.new?.status,
          ativa: payload.new?.ativa,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  // Listener para tabela participacao
  const channelParticipacao = supabase
    .channel('teste-participacao')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao',
        filter: `operacao_id=eq.${operacaoTeste.id}`
      },
      (payload) => {
        eventosParticipacao++;
        console.log(`📡 Evento PARTICIPACAO ${eventosParticipacao}:`, {
          tipo: payload.eventType,
          participacao_id: payload.new?.id || payload.old?.id,
          operacao_id: payload.new?.operacao_id || payload.old?.operacao_id,
          estado_visual: payload.new?.estado_visual || payload.old?.estado_visual,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        });
      }
    )
    .subscribe();

  console.log('⏳ Aguardando conexão (3 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n3️⃣ Testando API unified/operacoes...');
  
  // Função para buscar dados da API
  const buscarDadosAPI = async () => {
    try {
      const timestamp = Date.now();
      const response = await fetch(`http://localhost:3001/api/unified/operacoes?portal=supervisor&_t=${timestamp}`);
      const result = await response.json();
      
      if (result.success) {
        const operacao = result.data.find(op => op.id === operacaoTeste.id);
        if (operacao) {
          return {
            participantes_confirmados: operacao.participantes_confirmados || 0,
            total_solicitacoes: operacao.total_solicitacoes || 0,
            pessoas_na_fila: operacao.pessoas_na_fila || 0
          };
        }
      }
      return null;
    } catch (error) {
      console.log('❌ Erro ao buscar API:', error.message);
      return null;
    }
  };

  // Buscar estado inicial
  const estadoInicial = await buscarDadosAPI();
  console.log('📊 Estado inicial da operação:', estadoInicial);

  console.log('\n4️⃣ Simulando mudanças para testar realtime...');
  
  // Simular uma participação
  console.log('🔄 Inserindo nova participação...');
  const { data: novaParticipacao, error: errorInsert } = await supabase
    .from('participacao')
    .insert({
      membro_id: 999, // ID de teste
      operacao_id: operacaoTeste.id,
      estado_visual: 'PENDENTE',
      status_interno: 'AGUARDANDO_SUPERVISOR',
      data_participacao: new Date().toISOString(),
      ativa: true
    })
    .select()
    .single();

  if (errorInsert) {
    console.log('❌ Erro ao inserir participação:', errorInsert.message);
  } else {
    console.log('✅ Participação inserida:', novaParticipacao?.id);
  }

  console.log('⏳ Aguardando eventos (5 segundos)...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Verificar se API foi atualizada
  const estadoAposInsert = await buscarDadosAPI();
  console.log('📊 Estado após inserção:', estadoAposInsert);

  // Simular confirmação
  if (novaParticipacao) {
    console.log('\n🔄 Confirmando participação...');
    const { error: errorUpdate } = await supabase
      .from('participacao')
      .update({
        estado_visual: 'CONFIRMADO',
        status_interno: 'CONFIRMADO'
      })
      .eq('id', novaParticipacao.id);

    if (errorUpdate) {
      console.log('❌ Erro ao confirmar participação:', errorUpdate.message);
    } else {
      console.log('✅ Participação confirmada');
    }

    console.log('⏳ Aguardando eventos (5 segundos)...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verificar estado final
    const estadoFinal = await buscarDadosAPI();
    console.log('📊 Estado final:', estadoFinal);

    // Limpar teste
    console.log('\n🧹 Limpando dados de teste...');
    await supabase
      .from('participacao')
      .update({ ativa: false })
      .eq('id', novaParticipacao.id);
  }

  console.log('\n5️⃣ Resultado do teste:');
  console.log(`📊 Eventos de operação recebidos: ${eventosOperacao}`);
  console.log(`📊 Eventos de participação recebidos: ${eventosParticipacao}`);
  
  if (eventosParticipacao > 0) {
    console.log('✅ REALTIME FUNCIONANDO: Eventos de participação detectados');
  } else {
    console.log('❌ PROBLEMA: Nenhum evento de participação recebido');
  }

  if (estadoInicial && estadoAposInsert) {
    const mudouSolicitacoes = estadoAposInsert.total_solicitacoes > estadoInicial.total_solicitacoes;
    if (mudouSolicitacoes) {
      console.log('✅ API ATUALIZADA: Contadores foram atualizados corretamente');
    } else {
      console.log('❌ PROBLEMA: API não refletiu as mudanças');
    }
  }

  // Cleanup
  channelOperacao.unsubscribe();
  channelParticipacao.unsubscribe();
  
  console.log('\n🏁 Teste concluído!');
}

testarCorrecaoCalendario()
  .then(() => {
    console.log('\n✅ Teste finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n❌ Erro durante o teste:', error);
    process.exit(1);
  });