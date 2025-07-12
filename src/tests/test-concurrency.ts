import { createClient } from '@supabase/supabase-js';

// Teste de concorrência para validar constraints
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConcurrentRequests() {
  console.log('🚀 Iniciando teste de concorrência com 20 usuários...\n');
  
  const operacaoId = 1; // ID de teste
  const totalUsuarios = 20;
  const limiteOperacao = 15;
  
  // Simular 20 requisições simultâneas
  const promises = Array.from({ length: totalUsuarios }, (_, i) => {
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
  
  // Executar todas simultaneamente
  const results = await Promise.all(promises);
  
  // Analisar resultados
  const sucessos = results.filter(r => r.success);
  const falhas = results.filter(r => !r.success);
  
  console.log('📊 RESULTADOS DO TESTE:\n');
  console.log(`✅ Confirmados: ${sucessos.length} (esperado: ${limiteOperacao})`);
  console.log(`❌ Rejeitados: ${falhas.length} (esperado: ${totalUsuarios - limiteOperacao})`);
  
  // Verificar se exatamente 15 foram aceitos
  if (sucessos.length === limiteOperacao) {
    console.log('\n🎉 TESTE PASSOU! Constraints funcionando corretamente.');
  } else {
    console.log('\n⚠️ TESTE FALHOU! Race condition detectada.');
    console.log(`Esperado ${limiteOperacao} confirmados, mas ${sucessos.length} foram aceitos.`);
  }
  
  // Mostrar detalhes das falhas
  if (falhas.length > 0) {
    console.log('\n📋 Detalhes das rejeições:');
    falhas.slice(0, 5).forEach(f => {
      console.log(`- Membro ${f.membroId}: ${f.error}`);
    });
  }
}

// Executar teste
testConcurrentRequests().catch(console.error); 