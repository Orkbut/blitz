import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

interface InativarMultiplasRequest {
  operacaoIds: number[];
  inativar: boolean; // true = inativar, false = reativar
  motivo?: string;
}

// ✅ POST - Inativar/Reativar múltiplas operações
export async function POST(request: NextRequest) {
  try {
    const body: InativarMultiplasRequest = await request.json();
    const { operacaoIds, inativar, motivo } = body;

    // ✅ OBTER ID DO SUPERVISOR DOS HEADERS
    const supervisorIdHeader = request.headers.get('X-Supervisor-Id');
    const supervisorId = supervisorIdHeader ? parseInt(supervisorIdHeader) : null;

    if (!supervisorId) {
      return NextResponse.json({
        success: false,
        error: 'ID do supervisor não encontrado nos headers de autenticação',
        boundedContext: 'supervisor'
      }, { status: 401 });
    }

    // ✅ VALIDAÇÕES DE ENTRADA
    if (!operacaoIds || !Array.isArray(operacaoIds) || operacaoIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Array de IDs de operações é obrigatório',
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    if (typeof inativar !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Campo "inativar" deve ser boolean (true para inativar, false para reativar)',
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    // ✅ VALIDAR SE TODAS AS OPERAÇÕES EXISTEM E ESTÃO ATIVAS
    const { data: operacoesExistentes, error: validationError } = await supabase
      .from('operacao')
      .select('id, data_operacao, modalidade, turno, inativa_pelo_supervisor')
      .in('id', operacaoIds)
      .eq('ativa', true);

    if (validationError) {
      console.error('❌ Erro ao validar operações:', validationError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao validar operações',
        details: validationError.message,
        boundedContext: 'supervisor'
      }, { status: 500 });
    }

    // ✅ VERIFICAR SE TODAS AS OPERAÇÕES FORAM ENCONTRADAS
    const operacoesEncontradas = operacoesExistentes?.map(op => op.id) || [];
    const operacoesNaoEncontradas = operacaoIds.filter(id => !operacoesEncontradas.includes(id));
    
    if (operacoesNaoEncontradas.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Algumas operações não foram encontradas ou estão inativas',
        operacoesNaoEncontradas,
        boundedContext: 'supervisor'
      }, { status: 404 });
    }

    // ✅ PREPARAR DADOS PARA ATUALIZAÇÃO
    const agora = new Date().toISOString();
    const dadosAtualizacao = inativar ? {
      inativa_pelo_supervisor: true,
      data_inativacao: agora,
      motivo_inativacao: motivo || null,
      supervisor_inativacao_id: supervisorId // Sempre definido quando inativar = true
    } : {
      inativa_pelo_supervisor: false,
      data_inativacao: null,
      motivo_inativacao: null,
      supervisor_inativacao_id: null
    };

    // ✅ ATUALIZAR OPERAÇÕES NO BANCO
    const { data: operacoesAtualizadas, error: updateError } = await supabase
      .from('operacao')
      .update(dadosAtualizacao)
      .in('id', operacaoIds)
      .select('id, data_operacao, modalidade, turno, inativa_pelo_supervisor, data_inativacao');

    if (updateError) {
      console.error('❌ Erro ao atualizar operações:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar operações',
        details: updateError.message,
        boundedContext: 'supervisor'
      }, { status: 500 });
    }

    // ✅ RESPOSTA DE SUCESSO
    const acao = inativar ? 'inativadas' : 'reativadas';
    const totalOperacoes = operacoesAtualizadas?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        operacoesProcessadas: totalOperacoes,
        operacoes: operacoesAtualizadas,
        acao: acao
      },
      message: `${totalOperacoes} operação(ões) ${acao} com sucesso`,
      boundedContext: 'supervisor',
      timestamp: agora
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro na API de inativação múltipla:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: 'supervisor'
    }, { status: 500 });
  }
}