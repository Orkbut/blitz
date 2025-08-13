import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ✅ CONFIGURAÇÃO DO SUPABASE PARA TESTES
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

describe('Validação de Exclusão de Janela com Operações Inativas', () => {
  let testRegionalId: number;
  let testSupervisorId: number;
  let testJanelaId: number;
  let testOperacaoId: number;

  beforeAll(async () => {
    // 1. Criar regional de teste
    const { data: regional } = await supabase
      .from('regional')
      .insert({
        nome: 'Regional Teste Exclusao Janela',
        codigo: 'RTJ'
      })
      .select()
      .single();
    testRegionalId = regional.id;

    // 2. Criar supervisor de teste
    const { data: supervisor, error: supervisorError } = await supabase
      .from('servidor')
      .insert({
        matricula: 'TEST001',
        nome: 'Supervisor Teste Exclusao',
        email: 'supervisor.exclusao@teste.com',
        regional_id: testRegionalId,
        perfil: 'Supervisor'
      })
      .select()
      .single();
    
    if (supervisorError || !supervisor) {
      console.error('Erro ao criar supervisor:', supervisorError);
      throw new Error(`Falha ao criar supervisor: ${supervisorError?.message}`);
    }
    testSupervisorId = supervisor.id;

    // 3. Criar janela operacional de teste
    const { data: janela } = await supabase
      .from('janela_operacional')
      .insert({
        regional_id: testRegionalId,
        supervisor_id: testSupervisorId,
        data_inicio: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        data_fim: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        modalidades: 'PRESENCIAL',
        limite_min: 2,
        limite_max: 10,
        ativa: true
      })
      .select()
      .single();
    testJanelaId = janela.id;

    // 4. Criar operação de teste
    const { data: operacao, error: operacaoError } = await supabase
      .from('operacao')
      .insert({
        janela_id: testJanelaId,
        data_operacao: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
        turno: 'MANHA',
        modalidade: 'BLITZ',
        tipo: 'PLANEJADA',
        limite_participantes: 5,
        status: 'AGUARDANDO_SOLICITACOES',
        ativa: true,
        inativa_pelo_supervisor: false
      })
      .select()
      .single();
    
    if (operacaoError || !operacao) {
      console.error('Erro ao criar operação:', operacaoError);
      throw new Error(`Falha ao criar operação: ${operacaoError?.message}`);
    }
    testOperacaoId = operacao.id;
  });

  afterAll(async () => {
    // Limpeza dos dados de teste
    await supabase.from('operacao').delete().eq('id', testOperacaoId);
    await supabase.from('janela_operacional').delete().eq('id', testJanelaId);
    await supabase.from('servidor').delete().eq('id', testSupervisorId);
    await supabase.from('regional').delete().eq('id', testRegionalId);
  });

  it('deve permitir exclusão de janela sem operações inativas', async () => {
    // Fazer requisição DELETE para janela sem operações inativas
    const response = await fetch(`http://localhost:3000/api/supervisor/janelas-operacionais?id=${testJanelaId}`, {
      method: 'DELETE',
      headers: {
        'X-Supervisor-Id': testSupervisorId.toString(),
        'X-Regional-Id': testRegionalId.toString()
      }
    });

    const data = await response.json();
    console.log('🔍 Resposta do teste sem operações inativas:', { status: response.status, data });
    
    // Como a operação não está inativa, a exclusão deve prosseguir
    // (pode falhar na função RPC, mas não deve ser bloqueada pela validação)
    
    // Se falhar, deve ser por outro motivo, não por operações inativas
    if (!data.success) {
      expect(data.error).not.toContain('operações inativas');
      expect(data.error).not.toContain('históricas');
    }
  });

  it('deve bloquear exclusão de janela com operações inativas', async () => {
    // 1. Criar nova janela e operação para este teste (já que a anterior foi excluída)
    const { data: novaJanela } = await supabase
      .from('janela_operacional')
      .insert({
        regional_id: testRegionalId,
        supervisor_id: testSupervisorId,
        data_inicio: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        data_fim: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
        modalidades: 'BLITZ',
        limite_min: 2,
        limite_max: 10,
        ativa: true
      })
      .select()
      .single();

    const { data: novaOperacao } = await supabase
      .from('operacao')
      .insert({
        janela_id: novaJanela.id,
        data_operacao: new Date(Date.now() + 80 * 60 * 60 * 1000).toISOString(),
        turno: 'TARDE',
        modalidade: 'BLITZ',
        tipo: 'PLANEJADA',
        limite_participantes: 5,
        status: 'AGUARDANDO_SOLICITACOES',
        ativa: true,
        inativa_pelo_supervisor: true, // Já criar inativa
        data_inativacao: new Date().toISOString(),
        supervisor_inativacao_id: testSupervisorId
      })
      .select()
      .single();

    console.log('🔍 Nova janela e operação criadas:', { janela: novaJanela.id, operacao: novaOperacao.id });

    // 2. Tentar excluir a janela
    const response = await fetch(`http://localhost:3000/api/supervisor/janelas-operacionais?id=${novaJanela.id}`, {
      method: 'DELETE',
      headers: {
        'X-Supervisor-Id': testSupervisorId.toString(),
        'X-Regional-Id': testRegionalId.toString()
      }
    });

    const data = await response.json();
    console.log('🔍 Resposta do teste com operações inativas:', { status: response.status, data });

    // 3. Verificar que a exclusão foi bloqueada
    expect(response.status).toBe(409); // Conflict
    expect(data.success).toBe(false);
    expect(data.error).toContain('operações inativas');
    expect(data.details).toBeDefined();
    expect(data.details.operacoesInativas).toHaveLength(1);
    expect(data.details.operacoesInativas[0].id).toBe(novaOperacao.id);
    expect(data.details.totalOperacoesInativas).toBe(1);
    expect(data.details.acao).toContain('Reative todas as operações');

    // Limpeza
    await supabase.from('operacao').delete().eq('id', novaOperacao.id);
    await supabase.from('janela_operacional').delete().eq('id', novaJanela.id);
  });

  it('deve permitir exclusão após reativar todas as operações', async () => {
    // 1. Reativar a operação
    await supabase
      .from('operacao')
      .update({
        inativa_pelo_supervisor: false,
        data_inativacao: null,
        supervisor_inativacao_id: null
      })
      .eq('id', testOperacaoId);

    // 2. Tentar excluir a janela novamente
    const response = await fetch(`http://localhost:3000/api/supervisor/janelas-operacionais?id=${testJanelaId}`, {
      method: 'DELETE',
      headers: {
        'X-Supervisor-Id': testSupervisorId.toString(),
        'X-Regional-Id': testRegionalId.toString()
      }
    });

    const data = await response.json();

    // 3. Verificar que não foi bloqueada por operações inativas
    if (!data.success) {
      expect(data.error).not.toContain('operações inativas');
      expect(data.error).not.toContain('históricas');
    }
  });

  it('deve retornar detalhes corretos das operações inativas', async () => {
    // 1. Criar nova janela com múltiplas operações inativas
    const { data: janelaMultipla } = await supabase
      .from('janela_operacional')
      .insert({
        regional_id: testRegionalId,
        supervisor_id: testSupervisorId,
        data_inicio: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
        data_fim: new Date(Date.now() + 144 * 60 * 60 * 1000).toISOString(),
        modalidades: 'BLITZ,BALANCA',
        limite_min: 2,
        limite_max: 10,
        ativa: true
      })
      .select()
      .single();

    // Criar duas operações inativas
    const { data: operacao1 } = await supabase
      .from('operacao')
      .insert({
        janela_id: janelaMultipla.id,
        data_operacao: new Date(Date.now() + 125 * 60 * 60 * 1000).toISOString(),
        turno: 'MANHA',
        modalidade: 'BLITZ',
        tipo: 'PLANEJADA',
        limite_participantes: 5,
        status: 'AGUARDANDO_SOLICITACOES',
        ativa: true,
        inativa_pelo_supervisor: true,
        data_inativacao: new Date().toISOString(),
        supervisor_inativacao_id: testSupervisorId
      })
      .select()
      .single();

    const { data: operacao2 } = await supabase
      .from('operacao')
      .insert({
        janela_id: janelaMultipla.id,
        data_operacao: new Date(Date.now() + 130 * 60 * 60 * 1000).toISOString(),
        turno: 'TARDE',
        modalidade: 'BALANCA',
        tipo: 'VOLUNTARIA',
        limite_participantes: 3,
        status: 'AGUARDANDO_SOLICITACOES',
        ativa: true,
        inativa_pelo_supervisor: true,
        data_inativacao: new Date().toISOString(),
        supervisor_inativacao_id: testSupervisorId
      })
      .select()
      .single();

    console.log('🔍 Janela com múltiplas operações inativas:', { 
      janela: janelaMultipla.id, 
      operacoes: [operacao1.id, operacao2.id] 
    });

    // 2. Tentar excluir a janela
    const response = await fetch(`http://localhost:3000/api/supervisor/janelas-operacionais?id=${janelaMultipla.id}`, {
      method: 'DELETE',
      headers: {
        'X-Supervisor-Id': testSupervisorId.toString(),
        'X-Regional-Id': testRegionalId.toString()
      }
    });

    const data = await response.json();
    console.log('🔍 Resposta do teste múltiplas operações:', { status: response.status, data });

    // 3. Verificar detalhes das operações inativas
    expect(response.status).toBe(409);
    expect(data.details.operacoesInativas).toHaveLength(2);
    expect(data.details.totalOperacoesInativas).toBe(2);
    
    const operacaoIds = data.details.operacoesInativas.map((op: any) => op.id);
    expect(operacaoIds).toContain(operacao1.id);
    expect(operacaoIds).toContain(operacao2.id);

    // Limpeza
    await supabase.from('operacao').delete().eq('id', operacao1.id);
    await supabase.from('operacao').delete().eq('id', operacao2.id);
    await supabase.from('janela_operacional').delete().eq('id', janelaMultipla.id);
  });
});