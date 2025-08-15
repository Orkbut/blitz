import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CalculadorDiariasServidor } from '@/utils/calculadorDiariasServidor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * API para calcular quantas diárias cada servidor tem
 * Baseado na lógica da tabela da Diretoria em /supervisor/diretoria
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato') || 'json'; // json | texto
    const janela_id = searchParams.get('janela_id');
    const data_inicio = searchParams.get('data_inicio');
    const data_fim = searchParams.get('data_fim');
    const servidor_id = searchParams.get('servidor_id');

    // ✅ ISOLAMENTO POR REGIONAL: Obter contexto do supervisor
    const supervisorRegionalId = request.headers.get('X-Regional-Id');

    console.log('🔍 Calculando relatório de diárias...');
    console.log('📊 Parâmetros:', { formato, janela_id, data_inicio, data_fim, servidor_id, supervisorRegionalId });

    // 1. BUSCAR OPERAÇÕES (FILTRADAS POR REGIONAL) - SEM FILTRO DE DATA PARA PRESERVAR CONTEXTO
    let queryOperacoes = supabase
      .from('operacao')
      .select(`
        id,
        data_operacao,
        modalidade,
        tipo,
        status,
        janela_id,
        janela:janela_operacional!inner(
          regional_id
        )
      `)
      .eq('ativa', true)
      .eq('tipo', 'PLANEJADA')
      .in('status', ['APROVADA', 'AGUARDANDO_DIRETORIA', 'APROVADA_DIRETORIA', 'AGUARDANDO_SOLICITACOES']);

    // ✅ FILTRAR POR REGIONAL se contexto disponível
    if (supervisorRegionalId) {
      queryOperacoes = queryOperacoes.eq('janela.regional_id', parseInt(supervisorRegionalId));
    }

    // Filtros opcionais (exceto data - será aplicado na calculadora)
    if (janela_id) {
      queryOperacoes = queryOperacoes.eq('janela_id', parseInt(janela_id));
    }

    // ⚠️ REMOVIDO FILTRO DE DATA AQUI - será aplicado na calculadora para preservar contexto das sequências

    const { data: operacoes, error: errorOperacoes } = await queryOperacoes
      .order('data_operacao', { ascending: true });

    if (errorOperacoes) {
      console.error('❌ Erro ao buscar operações:', errorOperacoes);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar operações',
        details: errorOperacoes
      }, { status: 500 });
    }

    console.log('✅ Operações encontradas:', operacoes?.length || 0);

    // 2. BUSCAR PARTICIPAÇÕES CONFIRMADAS PELO SUPERVISOR
    let queryParticipacoes = supabase
      .from('participacao')
      .select(`
        id,
        membro_id,
        operacao_id,
        data_participacao,
        estado_visual,
        ativa,
        servidor:membro_id(
          id,
          nome,
          matricula
        )
      `)
      .eq('ativa', true)
      .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP']); // Apenas participações confirmadas pelo supervisor

    // Filtrar por servidor específico se solicitado
    if (servidor_id) {
      queryParticipacoes = queryParticipacoes.eq('membro_id', parseInt(servidor_id));
    }

    // Filtrar por operações encontradas
    if (operacoes && operacoes.length > 0) {
      const operacaoIds = operacoes.map(op => op.id);
      queryParticipacoes = queryParticipacoes.in('operacao_id', operacaoIds);
    }

    const { data: participacoes, error: errorParticipacoes } = await queryParticipacoes;

    if (errorParticipacoes) {
      console.error('❌ Erro ao buscar participações:', errorParticipacoes);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar participações',
        details: errorParticipacoes
      }, { status: 500 });
    }

    console.log('✅ Participações encontradas:', participacoes?.length || 0);

    // 3. MAPEAR DADOS PARA O FORMATO ESPERADO PELA CALCULADORA
    const operacoesMapeadas = (operacoes || []).map(op => ({
      id: op.id,
      data_operacao: op.data_operacao,
      modalidade: op.modalidade,
      tipo: op.tipo,
      status: op.status
    }));

    const participacoesMapeadas = (participacoes || []).map(p => {
      // O servidor pode vir como array ou objeto único devido ao relacionamento
      const servidorData = Array.isArray(p.servidor) ? p.servidor[0] : p.servidor;

      // Buscar a data da operação correspondente
      const operacaoCorrespondente = operacoesMapeadas.find(op => op.id === p.operacao_id);
      const dataOperacao = operacaoCorrespondente?.data_operacao || p.data_participacao;

      return {
        membro_id: p.membro_id,
        servidor_nome: servidorData?.nome || 'Servidor',
        nome: servidorData?.nome || 'Servidor',
        matricula: servidorData?.matricula || '',
        operacao_id: p.operacao_id,
        data_operacao: dataOperacao, // Usar data da operação, ou data_participacao como fallback
        estado_visual: p.estado_visual,
        ativa: p.ativa
        // Não há campo tipo_participacao na tabela - será assumido como meia diária por padrão
      };
    });

    console.log('🔄 Dados mapeados - Operações:', operacoesMapeadas.length, 'Participações:', participacoesMapeadas.length);

    // 4. CALCULAR ESTATÍSTICAS USANDO A LÓGICA DA TABELA DA DIRETORIA
    // 🔧 PASSANDO FILTROS DE DATA PARA APLICAR NA CALCULADORA (preservando contexto das sequências)
    const estatisticas = CalculadorDiariasServidor.calcularEstatisticasServidores(
      operacoesMapeadas,
      participacoesMapeadas,
      {
        filtroDataInicio: data_inicio || undefined,
        filtroDataFim: data_fim || undefined
      }
    );

    console.log('📈 Estatísticas calculadas para', estatisticas.length, 'servidores');

    // 5. RETORNAR RESPOSTA NO FORMATO SOLICITADO
    if (formato === 'texto') {
      const relatorioTexto = CalculadorDiariasServidor.gerarRelatorioResumo(estatisticas);

      return new NextResponse(relatorioTexto, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }

    // Formato JSON (padrão)
    return NextResponse.json({
      success: true,
      data: {
        parametros: {
          formato,
          janela_id,
          data_inicio,
          data_fim,
          servidor_id
        },
        resumo: {
          total_servidores: estatisticas.length,
          total_operacoes: operacoesMapeadas.length,
          total_participacoes: participacoesMapeadas.length,
          total_diarias_completas: estatisticas.reduce((sum, s) => sum + s.totalDiariasCompletas, 0),
          total_meias_diarias: estatisticas.reduce((sum, s) => sum + s.totalMeiasDiarias, 0),
          total_diarias_equivalentes: estatisticas.reduce((sum, s) => sum + s.totalDiariasEquivalentes, 0)
        },
        servidores: estatisticas,
        relatorio_texto: CalculadorDiariasServidor.gerarRelatorioResumo(estatisticas)
      }
    });

  } catch (error) {
    console.error('❌ Erro geral no relatório de diárias:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}