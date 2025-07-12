import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testRealtimeAndConstraints() {
  console.log(`${colors.cyan}🚀 Iniciando testes de Real-time e Constraints...${colors.reset}\n`);

  // 1. Testar Constraints de Concorrência
  console.log(`${colors.blue}📋 TESTE 1: Constraints de Concorrência${colors.reset}`);
  await testConcurrencyConstraints();

  // 2. Testar Realtime Updates
  console.log(`\n${colors.blue}📋 TESTE 2: Supabase Realtime${colors.reset}`);
  await testRealtimeUpdates();

  // 3. Testar Processamento de Fila
  console.log(`\n${colors.blue}📋 TESTE 3: Processamento Atômico da Fila${colors.reset}`);
  await testQueueProcessing();
}

async function testConcurrencyConstraints() {
  const operacaoId = 1;
  const totalTentativas = 20;
  const limiteEsperado = 15;

  console.log(`Simulando ${totalTentativas} usuários tentando participar simultaneamente...`);
  console.log(`Limite da operação: ${limiteEsperado}\n`);

  // Limpar participações anteriores
  await supabase
    .from('participacao')
    .update({ ativa: false })
    .eq('operacao_id', operacaoId);

  // Simular requisições simultâneas
  const promises = Array.from({ length: totalTentativas }, (_, i) => {
    const membroId = i + 1;
    
    return supabase
      .from('participacao')
      .insert({
        membro_id: membroId,
        operacao_id: operacaoId,
        estado_visual: 'CONFIRMADO',
        status_interno: 'AGUARDANDO_SUPERVISOR',
        data_participacao: new Date().toISOString(),
        ativa: true
      })
      .then(result => ({
        membroId,
        success: !result.error,
        error: result.error?.message
      }));
  });

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const endTime = Date.now();

  // Analisar resultados
  const sucessos = results.filter(r => r.success);
  const falhas = results.filter(r => !r.success);

  console.log(`⏱️  Tempo de execução: ${endTime - startTime}ms\n`);
  console.log(`✅ Confirmados: ${sucessos.length} (esperado: ${limiteEsperado})`);
  console.log(`❌ Rejeitados: ${falhas.length} (esperado: ${totalTentativas - limiteEsperado})`);

  // Verificar integridade
  const { count } = await supabase
    .from('participacao')
    .select('*', { count: 'exact', head: true })
    .eq('operacao_id', operacaoId)
    .eq('ativa', true)
    .eq('estado_visual', 'CONFIRMADO');

  if (count === limiteEsperado) {
    console.log(`\n${colors.green}✅ PASSOU: Constraints funcionando corretamente!${colors.reset}`);
    console.log(`   Exatamente ${limiteEsperado} participantes confirmados no banco.`);
  } else {
    console.log(`\n${colors.red}❌ FALHOU: Race condition detectada!${colors.reset}`);
    console.log(`   ${count} confirmados no banco (esperado: ${limiteEsperado})`);
  }

  // Mostrar algumas mensagens de erro
  console.log(`\n${colors.yellow}📝 Exemplos de rejeições:${colors.reset}`);
  falhas.slice(0, 3).forEach(f => {
    console.log(`   - Membro ${f.membroId}: ${f.error}`);
  });
}

async function testRealtimeUpdates() {
  console.log('Configurando listener de realtime...\n');

  const operacaoId = 1;
  let updateCount = 0;
  const updates: any[] = [];

  // Criar subscription
  const channel = supabase
    .channel('test-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'participacao',
        filter: `operacao_id=eq.${operacaoId}`
      },
      (payload) => {
        updateCount++;
        updates.push(payload);
        const newData = payload.new as any;
        const oldData = payload.old as any;
        console.log(`${colors.cyan}🔄 Update #${updateCount}:${colors.reset}`, {
          event: payload.eventType,
          membroId: newData?.membro_id || oldData?.membro_id,
          estado: newData?.estado_visual
        });
      }
    )
    .subscribe();

  // Aguardar conexão
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n📤 Fazendo alterações para testar realtime...\n');

  // Fazer algumas alterações
  const testMemberId = 999;
  
  // INSERT
  await supabase.from('participacao').insert({
    membro_id: testMemberId,
    operacao_id: operacaoId,
    estado_visual: 'NA_FILA',
    posicao_fila: 5,
    ativa: true
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // UPDATE
  await supabase
    .from('participacao')
    .update({ estado_visual: 'CONFIRMADO', posicao_fila: null })
    .eq('membro_id', testMemberId)
    .eq('operacao_id', operacaoId);

  await new Promise(resolve => setTimeout(resolve, 1000));

  // DELETE (soft delete)
  await supabase
    .from('participacao')
    .update({ ativa: false })
    .eq('membro_id', testMemberId)
    .eq('operacao_id', operacaoId);

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Desconectar
  channel.unsubscribe();

  console.log(`\n${colors.yellow}📊 Resumo do Realtime:${colors.reset}`);
  console.log(`   Total de updates recebidos: ${updateCount}`);
  console.log(`   Eventos: ${updates.map(u => u.eventType).join(', ')}`);

  if (updateCount >= 3) {
    console.log(`\n${colors.green}✅ PASSOU: Realtime funcionando!${colors.reset}`);
  } else {
    console.log(`\n${colors.red}❌ FALHOU: Realtime não está capturando todos os eventos${colors.reset}`);
  }
}

async function testQueueProcessing() {
  console.log('Testando processamento atômico da fila...\n');

  const operacaoId = 2; // Usar operação diferente para não conflitar
  
  // Configurar cenário: operação cheia com fila
  console.log('📝 Configurando cenário de teste...');
  
  // Limpar dados anteriores
  await supabase
    .from('participacao')
    .update({ ativa: false })
    .eq('operacao_id', operacaoId);

  // Criar 15 confirmados (limite cheio)
  for (let i = 1; i <= 15; i++) {
    await supabase.from('participacao').insert({
      membro_id: i,
      operacao_id: operacaoId,
      estado_visual: 'CONFIRMADO',
      ativa: true
    });
  }

  // Criar 5 na fila
  for (let i = 16; i <= 20; i++) {
    await supabase.from('participacao').insert({
      membro_id: i,
      operacao_id: operacaoId,
      estado_visual: 'NA_FILA',
      posicao_fila: i - 15,
      ativa: true
    });
  }

  console.log('✅ Cenário criado: 15 confirmados, 5 na fila\n');

  // Simular cancelamento
  console.log('🚫 Simulando cancelamento do membro 5...');
  
  await supabase
    .from('participacao')
    .update({ ativa: false })
    .eq('membro_id', 5)
    .eq('operacao_id', operacaoId);

  // Aguardar processamento
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verificar se fila foi processada
  const { data: confirmados } = await supabase
    .from('participacao')
    .select('membro_id')
    .eq('operacao_id', operacaoId)
    .eq('ativa', true)
    .eq('estado_visual', 'CONFIRMADO')
    .order('membro_id');

  const { data: naFila } = await supabase
    .from('participacao')
    .select('membro_id, posicao_fila')
    .eq('operacao_id', operacaoId)
    .eq('ativa', true)
    .eq('estado_visual', 'NA_FILA')
    .order('posicao_fila');

  console.log(`\n${colors.yellow}📊 Estado após cancelamento:${colors.reset}`);
  console.log(`   Confirmados: ${confirmados?.length || 0} (esperado: 15)`);
  console.log(`   Na fila: ${naFila?.length || 0} (esperado: 4)`);

  // Verificar se membro 16 foi promovido
  const membro16Promovido = confirmados?.some(p => p.membro_id === 16);

  if (membro16Promovido && confirmados?.length === 15 && naFila?.length === 4) {
    console.log(`\n${colors.green}✅ PASSOU: Fila processada corretamente!${colors.reset}`);
    console.log(`   Membro 16 foi promovido da fila`);
    console.log(`   Posições da fila reordenadas`);
  } else {
    console.log(`\n${colors.red}❌ FALHOU: Processamento da fila com problemas${colors.reset}`);
  }
}

// Executar testes
testRealtimeAndConstraints()
  .then(() => {
    console.log(`\n${colors.cyan}✨ Testes concluídos!${colors.reset}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n${colors.red}💥 Erro nos testes:${colors.reset}`, error);
    process.exit(1);
  }); 