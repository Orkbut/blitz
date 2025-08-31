import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ CLIENTE SUPABASE OFICIAL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';
const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ API PARA EDITAR JANELA OPERACIONAL
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const janelaId = params.id;
    const body = await request.json();
    
    // ✅ Obter contexto do supervisor
    const supervisorId = request.headers.get('X-Supervisor-Id');
    const regionalId = request.headers.get('X-Regional-Id');
    
    if (!supervisorId || !regionalId) {
      return NextResponse.json({
        success: false,
        error: 'Contexto do supervisor não encontrado. Faça login novamente.'
      }, { status: 401 });
    }
    
    const { dataInicio, dataFim, limiteMax } = body;

    // ✅ VALIDAÇÕES BÁSICAS
    if (!dataInicio || !dataFim) {
      return NextResponse.json({
        success: false,
        error: 'Dados obrigatórios: dataInicio, dataFim'
      }, { status: 400 });
    }

    // ✅ Verificar se a janela existe e pertence à regional do supervisor
    const { data: janelaExistente, error: janelaError } = await supabase
      .from('janela_operacional')
      .select('id, regional_id, data_inicio, data_fim, modalidades')
      .eq('id', parseInt(janelaId))
      .eq('regional_id', parseInt(regionalId))
      .eq('ativa', true)
      .single();

    if (janelaError || !janelaExistente) {
      return NextResponse.json({
        success: false,
        error: 'Janela não encontrada ou você não tem permissão para editá-la'
      }, { status: 404 });
    }

    // ❌ VALIDAÇÃO DE SOBREPOSIÇÃO COM OUTRAS JANELAS - DESATIVADA
    // Validação de interposição de períodos foi desativada conforme solicitado
    // const modalidadesArray = janelaExistente.modalidades.split(',');
    
    // // Buscar outras janelas ativas da mesma regional (excluindo a atual)
    // const { data: outrasJanelas, error: validationError } = await supabase
    //   .from('janela_operacional')
    //   .select('id, data_inicio, data_fim, modalidades')
    //   .eq('ativa', true)
    //   .eq('regional_id', parseInt(regionalId))
    //   .neq('id', parseInt(janelaId)); // Excluir a janela atual

    // if (validationError) {
    //   console.error('❌ Erro ao validar sobreposição:', validationError);
    //   return NextResponse.json({
    //     success: false,
    //     error: 'Erro ao validar sobreposição de janelas'
    //   }, { status: 500 });
    // }

    // // Verificar conflitos de sobreposição
    // const conflitos = outrasJanelas?.filter(janela => {
    //   const janelaInicio = new Date(janela.data_inicio);
    //   const janelaFim = new Date(janela.data_fim);
    //   const novaInicio = new Date(dataInicio);
    //   const novaFim = new Date(dataFim);
    //   
    //   // Verificar se há sobreposição temporal
    //   const temSobreposicao = (
    //     (novaInicio <= janelaFim && novaFim >= janelaInicio)
    //   );
    //   
    //   if (!temSobreposicao) return false;
    //   
    //   // Se há sobreposição, verificar se as modalidades conflitam
    //   const modalidadesExistentes = janela.modalidades.split(',');
    //   const temModalidadeComum = modalidadesArray.some(modalidade => 
    //     modalidadesExistentes.includes(modalidade)
    //   );
    //   
    //   return temModalidadeComum;
    // }) || [];

    // if (conflitos.length > 0) {
    //   const conflito = conflitos[0];
    //   const modalidadesConflito = conflito.modalidades.split(',');
    //   const modalidadesComuns = modalidadesArray.filter(m => modalidadesConflito.includes(m));
    //   
    //   return NextResponse.json({
    //     success: false,
    //     error: `Conflito de sobreposição detectado`,
    //     details: {
    //       janelaConflitante: conflito.id,
    //       periodoConflitante: `${conflito.data_inicio} até ${conflito.data_fim}`,
    //       modalidadesConflitantes: modalidadesComuns,
    //       regra: 'Não é permitido editar janelas com sobreposição temporal e modalidades iguais'
    //     }
    //   }, { status: 409 });
    // }

    // ✅ ATUALIZAR JANELA NO BANCO
    const { data: janelaAtualizada, error: updateError } = await supabase
      .from('janela_operacional')
      .update({
        data_inicio: dataInicio,
        data_fim: dataFim,
        limite_max: limiteMax || 30,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', parseInt(janelaId))
      .eq('regional_id', parseInt(regionalId))
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar janela:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao atualizar janela operacional'
      }, { status: 500 });
    }

    // ✅ VERIFICAR IMPACTO EM OPERAÇÕES EXISTENTES
    const { data: operacoesAfetadas, error: operacoesError } = await supabase
      .from('operacao')
      .select('id, data_operacao, modalidade, tipo')
      .eq('janela_id', parseInt(janelaId))
      .eq('ativa', true);

    if (operacoesError) {
      console.error('❌ Erro ao verificar operações:', operacoesError);
    }

    // ✅ Filtrar operações que ficaram fora do novo período
    const operacoesForaPeriodo = operacoesAfetadas?.filter(op => {
      const dataOperacao = new Date(op.data_operacao);
      const novoInicio = new Date(dataInicio);
      const novoFim = new Date(dataFim);
      return dataOperacao < novoInicio || dataOperacao > novoFim;
    }) || [];

    return NextResponse.json({
      success: true,
      data: {
        id: janelaAtualizada.id,
        dataInicio: janelaAtualizada.data_inicio,
        dataFim: janelaAtualizada.data_fim,
        modalidades: janelaAtualizada.modalidades.split(','),
        limiteMax: janelaAtualizada.limite_max,
        status: 'ATIVA'
      },
      impacto: {
        operacoesCriadas: operacoesAfetadas?.length || 0,
        operacoesForaPeriodo: operacoesForaPeriodo.length,
        detalhesOperacoesForaPeriodo: operacoesForaPeriodo.map(op => ({
          id: op.id,
          data: op.data_operacao,
          modalidade: op.modalidade,
          tipo: op.tipo
        }))
      },
      message: 'Janela operacional atualizada com sucesso',
      phase: "EDICAO_JANELA_IMPLEMENTADA",
      boundedContext: "supervisor"
    });

  } catch (error) {
    console.error('❌ Erro ao editar janela operacional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao editar janela operacional'
    }, { status: 500 });
  }
}