/**
 * Testes para verificação de operações inativas nas APIs de participação
 * 
 * Testa os requisitos:
 * - 5.1: API de solicitação deve verificar inativa_pelo_supervisor
 * - 5.2: API de cancelamento deve verificar inativa_pelo_supervisor  
 * - 5.3: APIs devem retornar erro específico para operações inativas
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('APIs de Participação - Verificação de Operações Inativas', () => {
  let testOperacaoId: number;
  let testMembroId: number;
  let testJanelaId: number;
  let testRegionalId: number;

  beforeEach(async () => {
    // Criar dados de teste
    
    // 1. Criar regional de teste
    const { data: regional } = await supabase
      .from('regional')
      .insert({
        nome: 'Regional Teste Inativacao',
        ativa: true
      })
      .select()
      .single();
    
    testRegionalId = regional.id;

    // 2. Criar membro de teste
    const { data: membro } = await supabase
      .from('servidor')
      .insert({
        nome: 'Membro Teste Inativacao',
        matricula: 'TEST-INATIV-001',
        perfil: 'MEMBRO',
        regional_id: testRegionalId,
        ativo: true
      })
      .select()
      .single();
    
    testMembroId = membro.id;

    // 3. Criar janela operacional de teste
    const { data: janela } = await supabase
      .from('janela_operacional')
      .insert({
        nome: 'Janela Teste Inativacao',
        data_inicio: new Date().toISOString(),
        data_fim: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        regional_id: testRegionalId,
        ativa: true
      })
      .select()
      .single();
    
    testJanelaId = janela.id;

    // 4. Criar operação de teste
    const { data: operacao } = await supabase
      .from('operacao')
      .insert({
        janela_operacional_id: testJanelaId,
        data_operacao: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        modalidade: 'PRESENCIAL',
        tipo: 'OPERACAO',
        turno: 'MANHA',
        limite_participantes: 5,
        ativa: true,
        inativa_pelo_supervisor: false
      })
      .select()
      .single();
    
    testOperacaoId = operacao.id;
  });

  afterEach(async () => {
    // Limpar dados de teste
    await supabase.from('participacao').delete().eq('membro_id', testMembroId);
    await supabase.from('operacao').delete().eq('id', testOperacaoId);
    await supabase.from('janela_operacional').delete().eq('id', testJanelaId);
    await supabase.from('servidor').delete().eq('id', testMembroId);
    await supabase.from('regional').delete().eq('id', testRegionalId);
  });

  describe('API /api/participations - Solicitação de Participação', () => {
    it('deve permitir solicitação em operação ativa', async () => {
      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: testOperacaoId.toString(),
          membroId: testMembroId.toString()
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('deve bloquear solicitação em operação inativa', async () => {
      // Inativar a operação
      await supabase
        .from('operacao')
        .update({
          inativa_pelo_supervisor: true,
          data_inativacao: new Date().toISOString(),
          supervisor_inativacao_id: testMembroId // usando membro como supervisor para teste
        })
        .eq('id', testOperacaoId);

      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: testOperacaoId.toString(),
          membroId: testMembroId.toString()
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(403);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Esta operação está no histórico e não aceita mais solicitações');
      expect(result.codigo_erro).toBe('OPERACAO_INATIVA');
    });
  });

  describe('API /api/eu-vou - Solicitação de Participação', () => {
    it('deve permitir solicitação em operação ativa', async () => {
      const response = await fetch('/api/eu-vou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membroId: testMembroId,
          operacaoId: testOperacaoId
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.sucesso).toBe(true);
    });

    it('deve bloquear solicitação em operação inativa', async () => {
      // Inativar a operação
      await supabase
        .from('operacao')
        .update({
          inativa_pelo_supervisor: true,
          data_inativacao: new Date().toISOString(),
          supervisor_inativacao_id: testMembroId
        })
        .eq('id', testOperacaoId);

      const response = await fetch('/api/eu-vou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membroId: testMembroId,
          operacaoId: testOperacaoId
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(403);
      expect(result.sucesso).toBe(false);
      expect(result.mensagem).toBe('Esta operação está no histórico e não aceita mais solicitações');
      expect(result.tipo).toBe('OPERACAO_INATIVA');
    });
  });

  describe('API /api/participations - Cancelamento de Participação', () => {
    let testParticipacaoId: number;

    beforeEach(async () => {
      // Criar participação de teste
      const { data: participacao } = await supabase
        .from('participacao')
        .insert({
          membro_id: testMembroId,
          operacao_id: testOperacaoId,
          data_participacao: new Date().toISOString(),
          estado_visual: 'CONFIRMADO',
          ativa: true
        })
        .select()
        .single();
      
      testParticipacaoId = participacao.id;
    });

    it('deve permitir cancelamento em operação ativa', async () => {
      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          participationId: testParticipacaoId.toString()
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('deve bloquear cancelamento em operação inativa', async () => {
      // Inativar a operação
      await supabase
        .from('operacao')
        .update({
          inativa_pelo_supervisor: true,
          data_inativacao: new Date().toISOString(),
          supervisor_inativacao_id: testMembroId
        })
        .eq('id', testOperacaoId);

      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          participationId: testParticipacaoId.toString()
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(403);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Esta operação está no histórico e não aceita mais alterações');
      expect(result.codigo_erro).toBe('OPERACAO_INATIVA');
    });
  });

  describe('API /api/agendamento/cancelar - Cancelamento de Participação', () => {
    let testParticipacaoId: number;

    beforeEach(async () => {
      // Criar participação de teste
      const { data: participacao } = await supabase
        .from('participacao')
        .insert({
          membro_id: testMembroId,
          operacao_id: testOperacaoId,
          data_participacao: new Date().toISOString(),
          estado_visual: 'CONFIRMADO',
          ativa: true
        })
        .select()
        .single();
      
      testParticipacaoId = participacao.id;
    });

    it('deve permitir cancelamento em operação ativa', async () => {
      const response = await fetch('/api/agendamento/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membroId: testMembroId,
          operacaoId: testOperacaoId
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('deve bloquear cancelamento em operação inativa', async () => {
      // Inativar a operação
      await supabase
        .from('operacao')
        .update({
          inativa_pelo_supervisor: true,
          data_inativacao: new Date().toISOString(),
          supervisor_inativacao_id: testMembroId
        })
        .eq('id', testOperacaoId);

      const response = await fetch('/api/agendamento/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membroId: testMembroId,
          operacaoId: testOperacaoId
        })
      });

      const result = await response.json();
      
      expect(response.status).toBe(403);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Esta operação está no histórico e não aceita mais alterações');
      expect(result.tipo).toBe('OPERACAO_INATIVA');
    });
  });

  describe('Mensagens de Erro Específicas', () => {
    it('deve retornar mensagem específica para solicitação em operação inativa', async () => {
      await supabase
        .from('operacao')
        .update({
          inativa_pelo_supervisor: true,
          data_inativacao: new Date().toISOString(),
          supervisor_inativacao_id: testMembroId
        })
        .eq('id', testOperacaoId);

      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: testOperacaoId.toString(),
          membroId: testMembroId.toString()
        })
      });

      const result = await response.json();
      
      expect(result.error).toBe('Esta operação está no histórico e não aceita mais solicitações');
    });

    it('deve retornar mensagem específica para cancelamento em operação inativa', async () => {
      // Criar participação primeiro
      const { data: participacao } = await supabase
        .from('participacao')
        .insert({
          membro_id: testMembroId,
          operacao_id: testOperacaoId,
          data_participacao: new Date().toISOString(),
          estado_visual: 'CONFIRMADO',
          ativa: true
        })
        .select()
        .single();

      // Inativar operação
      await supabase
        .from('operacao')
        .update({
          inativa_pelo_supervisor: true,
          data_inativacao: new Date().toISOString(),
          supervisor_inativacao_id: testMembroId
        })
        .eq('id', testOperacaoId);

      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          participationId: participacao.id.toString()
        })
      });

      const result = await response.json();
      
      expect(result.error).toBe('Esta operação está no histórico e não aceita mais alterações');
    });
  });
});