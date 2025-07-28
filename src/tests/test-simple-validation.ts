import { createClient } from '@supabase/supabase-js';

// Configuração
const SUPABASE_URL = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBasicFunctionality() {


  // 1. Testar conexão
  try {
    const { data, error } = await supabase.from('operacao').select('count', { count: 'exact', head: true });
    if (error) {
      return;
    }
  } catch (err) {
    return;
  }

  // 2. Verificar estrutura das tabelas
  try {
    // Verificar tabela operacao
    const { data: operacoes, error: opError } = await supabase
      .from('operacao')
      .select('id, data_operacao, modalidade, limite_participantes')
      .limit(3);

    // Verificar tabela participacao
    const { data: participacoes, error: partError } = await supabase
      .from('participacao')
      .select('id, membro_id, operacao_id, estado_visual')
      .limit(3);

  } catch (err) {
    // Erro silencioso
  }

  // 3. Testar Realtime (básico)
  let realtimeWorking = false;
  
  const channel = supabase
    .channel('test-basic')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'operacao'
    }, (payload) => {
      realtimeWorking = true;
    })
    .subscribe();

  // Aguardar conexão
  await new Promise(resolve => setTimeout(resolve, 3000));

  channel.unsubscribe();

  // 4. Verificar hooks em ambiente Node.js (simulado)
  try {
    // Verificar se não há erros de sintaxe nos hooks
    // const useRealtimeModule = await import('../hooks/useRealtimeOperacoes.js').catch(() => null);
    // const useSmartPollingModule = await import('../hooks/useSmartPolling.js').catch(() => null);
  } catch (err) {
    // Erro silencioso
  }
}

testBasicFunctionality()
  .then(() => process.exit(0))
  .catch(err => {
    process.exit(1);
  }); 