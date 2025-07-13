import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ CLIENTE SUPABASE OFICIAL - OBRIGATÓRIO EM PRODUÇÃO
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ API JANELAS OPERACIONAIS - FASE 0 OBRIGATÓRIA
// Conforme documentação: docs/00 - CASOS DE USO/0 - SUPERVISOR_DISPONIBILIZAÇÃO.txt

export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO POR REGIONAL: Obter contexto do supervisor
    const supervisorId = request.headers.get('X-Supervisor-Id');
    const regionalId = request.headers.get('X-Regional-Id');
    
    let query = supabase
      .from('janela_operacional')
      .select(`
        id,
        data_inicio,
        data_fim,
        modalidades,
        limite_min,
        limite_max,
        ativa,
        criado_em,
        regional!inner(nome)
      `)
      .eq('ativa', true);

    // ✅ FILTRAR POR REGIONAL se contexto disponível
    if (regionalId) {
      query = query.eq('regional_id', parseInt(regionalId));
    }

    const { data: janelas, error } = await query.order('criado_em', { ascending: false });

    if (error) {
      console.error('❌ Erro Supabase:', error);
      throw error;
    }

    // ✅ CONTAR OPERAÇÕES REAIS PARA CADA JANELA
    const janelasComOperacoes = await Promise.all(
      (janelas || []).map(async (janela) => {
        const { count } = await supabase
          .from('operacao')
          .select('*', { count: 'exact', head: true })
          .eq('janela_id', janela.id)
          .eq('ativa', true);

        return {
          id: janela.id,
          dataInicio: janela.data_inicio,
          dataFim: janela.data_fim,
          modalidades: janela.modalidades.split(','),
          status: janela.ativa ? 'ATIVA' : 'INATIVA',
          operacoesCriadas: count || 0,
          regional: janela.regional ? (janela.regional as unknown as Record<string, unknown>).nome as string : 'N/A',
          limiteMin: janela.limite_min,
          limiteMax: janela.limite_max,
          criadoEm: janela.criado_em
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: janelasComOperacoes,
      count: janelasComOperacoes.length,
      phase: "DADOS_REAIS_SUPABASE",
      boundedContext: "configuracao",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao buscar janelas operacionais:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar janelas operacionais',
      phase: "ERRO_BANCO_REAL",
      boundedContext: "configuracao"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      dataInicio, 
      dataFim, 
      modalidades, 
      limiteMin = 2, 
      limiteMax = 30,
      regionalId = 5, // ✅ UR IGUATU (ID válido)
      supervisorId = 1 // ✅ DOUGLAS ALBERTO DOS SANTOS
    } = body;

    // ✅ VALIDAÇÕES BÁSICAS
    if (!dataInicio || !dataFim || !modalidades) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios: dataInicio, dataFim, modalidades'
      }, { status: 400 });
    }



    // ✅ VALIDAÇÃO DE SOBREPOSIÇÃO DE JANELAS
    const modalidadesArray = Array.isArray(modalidades) ? modalidades : [modalidades];
    
    // Buscar janelas existentes que se sobrepõem ao período
    const { data: janelasExistentes, error: validationError } = await supabase
      .from('janela_operacional')
      .select('id, data_inicio, data_fim, modalidades')
      .eq('ativa', true)
      .eq('regional_id', regionalId);

    if (validationError) {
      console.error('❌ Erro ao validar sobreposição:', validationError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao validar sobreposição de janelas'
      }, { status: 500 });
    }

    // Verificar conflitos de sobreposição
    const conflitos = janelasExistentes?.filter(janela => {
      const janelaInicio = new Date(janela.data_inicio);
      const janelaFim = new Date(janela.data_fim);
      const novaInicio = new Date(dataInicio);
      const novaFim = new Date(dataFim);
      
      // Verificar se há sobreposição temporal
      const temSobreposicao = (
        (novaInicio <= janelaFim && novaFim >= janelaInicio)
      );
      
      if (!temSobreposicao) return false;
      
      // Se há sobreposição, verificar se as modalidades conflitam
      const modalidadesExistentes = janela.modalidades.split(',');
      const temModalidadeComum = modalidadesArray.some(nova => 
        modalidadesExistentes.includes(nova)
      );
      
      return temModalidadeComum;
    }) || [];

    if (conflitos.length > 0) {
      const conflito = conflitos[0];
      const modalidadesConflito = conflito.modalidades.split(',');
      const modalidadesComuns = modalidadesArray.filter(m => modalidadesConflito.includes(m));
      
      return NextResponse.json({
        success: false,
        error: `Conflito de sobreposição detectado`,
        details: {
          janelaConflitante: conflito.id,
          periodoConflitante: `${conflito.data_inicio} até ${conflito.data_fim}`,
          modalidadesConflitantes: modalidadesComuns,
          regra: 'Não é permitido criar janelas com sobreposição temporal e modalidades iguais'
        }
      }, { status: 409 });
    }

    // ✅ CRIAR JANELA REAL NO SUPABASE
    const { data: novaJanela, error } = await supabase
      .from('janela_operacional')
      .insert({
        regional_id: regionalId,
        supervisor_id: supervisorId,
        data_inicio: dataInicio,
        data_fim: dataFim,
        modalidades: Array.isArray(modalidades) ? modalidades.join(',') : modalidades,
        limite_min: limiteMin,
        limite_max: limiteMax,
        ativa: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar janela:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: novaJanela.id,
        dataInicio: novaJanela.data_inicio,
        dataFim: novaJanela.data_fim,
        modalidades: novaJanela.modalidades.split(','),
        status: 'ATIVA',
        operacoesCriadas: 0
      },
      message: 'Janela operacional criada com sucesso no banco real',
      phase: "CRIACAO_REAL_SUPABASE",
      boundedContext: "configuracao"
    });

  } catch (error) {
    console.error('❌ Erro ao criar janela operacional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao criar janela operacional'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const janelaId = searchParams.get('id');



    if (!janelaId) {
      return NextResponse.json({
        success: false,
        error: 'ID da janela é obrigatório'
      }, { status: 400 });
    }

    // 1. Verificar se a janela existe
    const { data: janela, error: janelaError } = await supabase
      .from('janela_operacional')
      .select('id, data_inicio, data_fim, modalidades')
      .eq('id', janelaId)
      .eq('ativa', true)
      .single();

    if (janelaError || !janela) {
      console.log('❌ [DELETE] Janela não encontrada');
      return NextResponse.json({
        success: false,
        error: 'Janela não encontrada ou inativa'
      }, { status: 404 });
    }

    console.log(`✅ [DELETE] Janela encontrada. Executando exclusão com superpoder...`);

    // 2. Executar exclusão usando função de superpoder
    const { data: resultado, error: superpoderError } = await supabase
      .rpc('excluir_janela_superpoder', { p_janela_id: parseInt(janelaId) });

    if (superpoderError) {
      console.error('❌ [DELETE] Erro na função de superpoder:', superpoderError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao executar exclusão',
        details: superpoderError.message
      }, { status: 500 });
    }

    if (!resultado || !resultado.success) {
      console.error('❌ [DELETE] Função retornou erro:', resultado);
      return NextResponse.json({
        success: false,
        error: resultado?.error || 'Erro desconhecido na exclusão',
        details: resultado?.message
      }, { status: 500 });
    }

    console.log(`✅ [DELETE] ${resultado.message}`);

    return NextResponse.json({
      success: true,
      data: {
        janelaExcluida: {
          id: resultado.janela_id,
          periodo: `${resultado.janela_info.data_inicio} - ${resultado.janela_info.data_fim}`,
          modalidades: resultado.janela_info.modalidades.split(',')
        },
        impacto: {
          participacoesRemovidas: resultado.impacto.participacoes_removidas,
          operacoesRemovidas: resultado.impacto.operacoes_removidas,
          eventosRemovidos: resultado.impacto.eventos_removidos,
          membrosAfetados: [] // Dados serão preenchidos pela função se necessário
        }
      },
      message: resultado.message,
      phase: "EXCLUSAO_COM_SUPERPODER_IMPLEMENTADO"
    });

  } catch (error) {
    console.error('❌ [DELETE] Erro inesperado:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao excluir janela operacional',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // 🧪 ENDPOINT DE TESTE PARA VERIFICAR A FUNÇÃO RPC
    const { searchParams } = new URL(request.url);
    const janelaId = searchParams.get('test-id');
    
    if (!janelaId) {
      return NextResponse.json({
        success: false,
        error: 'ID da janela é obrigatório para teste'
      }, { status: 400 });
    }

    console.log(`🧪 [TESTE] Testando função RPC para janela ${janelaId}`);
    
    // Testar a função RPC diretamente
    const { data: resultado, error: superpoderError } = await supabase
      .rpc('excluir_janela_superpoder', { p_janela_id: parseInt(janelaId) });
    
    console.log(`🧪 [TESTE] Resultado:`, {
      resultado,
      superpoderError,
      hasError: !!superpoderError,
      hasData: !!resultado
    });
    
    return NextResponse.json({
      success: true,
      test: 'Função RPC testada via API',
      data: {
        resultado,
        superpoderError,
        hasError: !!superpoderError,
        hasData: !!resultado
      }
    });
    
  } catch (error) {
    console.error('❌ [TESTE] Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro no teste da função RPC',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 