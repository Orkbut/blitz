import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase REAL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ GET - Buscar detalhes da janela para herança de limites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const janelaId = searchParams.get('janelaId');

    if (!janelaId) {
      return NextResponse.json({
        success: false,
        error: 'ID da janela é obrigatório',
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    // ✅ BUSCAR DETALHES DA JANELA PARA HERANÇA
    const { data: janela, error } = await supabase
      .from('janela_operacional')
      .select('id, data_inicio, data_fim, modalidades, limite_min, limite_max, ativa')
      .eq('id', parseInt(janelaId))
      .eq('ativa', true)
      .single();

    if (error || !janela) {
      return NextResponse.json({
        success: false,
        error: 'Janela operacional não encontrada ou inativa',
        boundedContext: 'supervisor'
      }, { status: 404 });
    }

    // ✅ RETORNAR LIMITES PARA HERANÇA NO FRONTEND
    const modalidadesPermitidas = janela.modalidades.split(',');
    
    return NextResponse.json({
      success: true,
      data: {
        janelaId: janela.id,
        periodoPermitido: {
          dataInicio: janela.data_inicio,
          dataFim: janela.data_fim
        },
        modalidadesPermitidas: modalidadesPermitidas,
        limitesParticipantes: {
          minimo: janela.limite_min,
          maximo: janela.limite_max,
          padrao: janela.limite_max
        },
        configuracaoHerdada: {
          modalidadeUnica: modalidadesPermitidas.length === 1 ? modalidadesPermitidas[0] : null,
          temAmbas: modalidadesPermitidas.includes('BLITZ') && modalidadesPermitidas.includes('BALANCA')
        }
      },
      message: 'Limites da janela carregados para herança',
      boundedContext: 'supervisor'
    });

  } catch (error) {
    console.error('❌ Erro ao buscar limites da janela:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: 'supervisor'
    }, { status: 500 });
  }
}

// ✅ API CRIAÇÃO DE OPERAÇÕES - POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { janelaId, data, modalidade, tipo, turno, limite } = body;

    // ✅ VALIDAÇÕES DE ENTRADA
    if (!janelaId || !data || !modalidade) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios não fornecidos',
        required: ['janelaId', 'data', 'modalidade'],
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    // ✅ BUSCAR JANELA OPERACIONAL PARA VALIDAÇÕES
    const { data: janela, error: janelaError } = await supabase
      .from('janela_operacional')
      .select('id, data_inicio, data_fim, modalidades, limite_min, limite_max, ativa')
      .eq('id', parseInt(janelaId))
      .eq('ativa', true)
      .single();

    if (janelaError || !janela) {
      return NextResponse.json({
        success: false,
        error: 'Janela operacional não encontrada ou inativa',
        boundedContext: 'supervisor'
      }, { status: 404 });
    }

    // ✅ VALIDAÇÃO TEMPORAL: Data da operação deve estar dentro do período da janela
    const dataOperacao = new Date(data);
    const dataInicio = new Date(janela.data_inicio);
    const dataFim = new Date(janela.data_fim);
    
    if (dataOperacao < dataInicio || dataOperacao > dataFim) {
      return NextResponse.json({
        success: false,
        error: 'Data da operação fora do período da janela operacional',
        details: {
          dataOperacao: data,
          periodoPermitido: `${janela.data_inicio} até ${janela.data_fim}`,
          regra: 'A operação deve ser criada dentro do período da janela operacional'
        },
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    // ✅ VALIDAÇÃO DE MODALIDADE: Modalidade deve estar permitida na janela
    const modalidadesPermitidas = janela.modalidades.split(',');
    if (!modalidadesPermitidas.includes(modalidade)) {
      return NextResponse.json({
        success: false,
        error: 'Modalidade não permitida para esta janela operacional',
        details: {
          modalidadeSolicitada: modalidade,
          modalidadesPermitidas: modalidadesPermitidas,
          regra: 'A modalidade deve estar configurada na janela operacional'
        },
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    // ✅ HERANÇA DOS LIMITES DA JANELA: Aplicar limites da janela se não especificados
    const limiteParticipantes = limite ? parseInt(limite) : janela.limite_max;
    
    // ✅ VALIDAÇÃO DOS LIMITES: Respeitar min/max da janela
    if (limiteParticipantes < janela.limite_min || limiteParticipantes > janela.limite_max) {
      return NextResponse.json({
        success: false,
        error: 'Limite de participantes fora dos parâmetros da janela',
        details: {
          limiteSolicitado: limiteParticipantes,
          limiteMinimo: janela.limite_min,
          limiteMaximo: janela.limite_max,
          regra: 'O limite deve respeitar os parâmetros da janela operacional'
        },
        boundedContext: 'supervisor'
      }, { status: 400 });
    }

    // ✅ CRIAR OPERAÇÃO NO BANCO SUPABASE COM STATUS CORRETO
    const { data: operacao, error } = await supabase
      .from('operacao')
      .insert({
        janela_id: parseInt(janelaId),
        data_operacao: data,
        modalidade: modalidade,
        tipo: tipo || 'PLANEJADA',
        turno: turno || 'MANHA',
        limite_participantes: limiteParticipantes,
        status: 'AGUARDANDO_SOLICITACOES', // ✅ STATUS CORRETO
        ativa: true,
        criado_em: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('❌ Erro ao criar operação:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao criar operação',
        details: error.message,
        boundedContext: 'supervisor'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: operacao,
      message: 'Operação criada com sucesso',
      boundedContext: 'supervisor',
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Erro na API de criação:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: 'supervisor'
    }, { status: 500 });
  }
} 