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
  // 1. Testar Constraints de Concorrência
  await testConcurrencyConstraints();

  // 2. Testar Realtime Updates
  await testRealtimeUpdates();

  // 3. Testar Processamento de Fila
  await testQueueProcessing();
}

async function testConcurrencyConstraints() {
  const operacaoId = 1;
  const totalTentativas = 20;
  const limiteEsperado = 15;



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

  // Verificar integridade
  const { count } = await supabase
    .from('participacao')
    .select('*', { count: 'exact', head: true })
    .eq('operacao_id', operacaoId)
    .eq('ativa', true)
    .eq('estado_visual', 'CONFIRMADO');
}

async function testRealtimeUpdates() {
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
      }
    )
    .subscribe();

  // Aguardar conexão
  await new Promise(resolve => setTimeout(resolve, 2000));

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
}

async function testQueueProcessing() {
  const operacaoId = 2; // Usar operação diferente para não conflitar
  
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

  // Simular cancelamento
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

  // Verificar se membro 16 foi promovido
  const membro16Promovido = confirmados?.some(p => p.membro_id === 16);
}

// Executar testes
testRealtimeAndConstraints()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  }); 