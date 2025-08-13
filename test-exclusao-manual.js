// Script para testar manualmente a validação de exclusão de janelas
// Execute com: node test-exclusao-manual.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testarExclusaoJanela() {
  console.log('🧪 Iniciando teste manual de exclusão de janela...\n');

  let testRegionalId, testSupervisorId, testJanelaId, testOperacaoId;

  try {
    // 1. Criar dados de teste
    console.log('1️⃣ Criando dados de teste...');
    
    // Regional
    const { data: regional } = await supabase
      .from('regional')
      .insert({
        nome: 'Regional Teste Manual',
        codigo: 'RTM'
      })
      .select()
      .single();
    testRegionalId = regional.id;
    console.log(`✅ Regional criada: ID ${testRegionalId}`);

    // Supervisor
    const { data: supervisor } = await supabase
      .from('servidor')
      .insert({
        matricula: 'TESTMAN001',
        nome: 'Supervisor Teste Manual',
        email: 'supervisor.manual@teste.com',
        regional_id: testRegionalId,
        perfil: 'Supervisor'
      })
      .select()
      .single();
    testSupervisorId = supervisor.id;
    console.log(`✅ Supervisor criado: ID ${testSupervisorId}`);

    // Janela operacional
    const { data: janela } = await supabase
      .from('janela_operacional')
      .insert({
        regional_id: testRegionalId,
        supervisor_id: testSupervisorId,
        data_inicio: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        data_fim: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        modalidades: 'BLITZ',
        l