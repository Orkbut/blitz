import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase direto - KISS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ✅ SISTEMA DE LOGGING INTELIGENTE - Controla verbosidade
const DEBUG_MODE = process.env.NODE_ENV === 'development';
const logDebug = (message: string, data?: any) => {
  if (DEBUG_MODE) {
    console.log(message, data);
  }
};

const logInfo = (message: string, data?: any) => {
  console.log(message, data);
};

const logError = (message: string, error?: any) => {
  console.error(message, error);
};

export async function GET(request: NextRequest) {
  try {
    // Pega parâmetros do hook
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const membroId = searchParams.get('membroId'); // ⭐ NOVO: ID do membro para participação
    const portal = searchParams.get('portal'); // ✅ NOVO: Detectar se é supervisor
    const includeParticipantes = searchParams.get('includeParticipantes'); // ✅ NOVO: Incluir participantes detalhados
    const includeInactive = searchParams.get('includeInactive'); // 🆕 NOVO: Incluir operações inativas
    const mode = searchParams.get('mode'); // ✅ OTIMIZAÇÃO: Modo light para modal gerenciar
    const janelaId = searchParams.get('janela_id'); // 🆕 NOVO: Filtro por janela operacional
    const tipo = searchParams.get('tipo'); // 🆕 NOVO: Filtro por tipo de operação

    // ✅ OTIMIZADO: Log apenas quando necessário (comentado para reduzir verbosidade)
    // logDebug(`🔍 [API-UNIFIED] Requisição recebida`, {
    //   startDate, endDate, membroId, portal, includeParticipantes, mode, janelaId, tipo
    // });

    // Busca TODAS as operações (ativas + em avaliação) - SOMENTE do banco real
    let selectQuery = `*`;

    // ✅ MODO LIGHT: Query otimizada para o modal gerenciar
    if (mode === 'light' && portal === 'supervisor') {
      selectQuery = `
        *,
        janela:janela_operacional!inner(
          regional:regional_id(nome)
        ),
        participacao!left(
          id,
          membro_id,
          estado_visual,
          status_interno,
          data_participacao,
          ativa
        )
      `;
    } else if (portal === 'diretoria') {
      // ✅ NOVO: Query específica para diretoria com campos necessários
      selectQuery = `
        *,
        janela:janela_operacional(
          *,
          regional:regional_id(id, nome, codigo)
        ),
        participacao!left(
          id,
          membro_id,
          estado_visual,
          status_interno,
          data_participacao,
          ativa,
          bloqueado_diretoria,
          servidor:membro_id(id, nome, matricula)
        )
      `;
    } else {
      // Query completa para outros casos
      selectQuery = `
        *,
        janela:janela_operacional(
          *,
          regional:regional_id(id, nome, codigo)
        ),
        participacao!left(
          id,
          membro_id,
          estado_visual,
          posicao_fila,
          status_interno,
          data_participacao,
          ativa,
          servidor:membro_id(id, nome, matricula)
        )
      `;
    }

    let query = supabase
      .from('operacao')
      .select(selectQuery);
    
    // ✅ FILTRO DE OPERAÇÕES ATIVAS: Incluir inativas apenas se solicitado
    if (includeInactive !== 'true') {
      query = query.eq('ativa', true);
    }

    // ✅ SUPERVISOR: Incluir operações excluídas temporariamente para permitir reativação
    if (portal !== 'supervisor') {
      query = query.eq('excluida_temporariamente', false);
    }

    // ✅ DIRETORIA: Filtrar apenas operações relevantes para diretoria
    if (portal === 'diretoria') {
      query = query.in('status', ['APROVADA', 'AGUARDANDO_DIRETORIA', 'APROVADA_DIRETORIA', 'REJEITADA_DIRETORIA']);
    }

    // ✅ ISOLAMENTO POR REGIONAL: Filtrar operações apenas da regional do membro
    if (membroId && portal !== 'supervisor' && portal !== 'diretoria') {
      // Buscar regional do membro primeiro com nome da regional
      const { data: membro } = await supabase
        .from('servidor')
        .select(`
          regional_id,
          regional:regional_id(id, nome, codigo)
        `)
        .eq('id', membroId)
        .eq('ativo', true)
        .single();

      if (membro?.regional_id) {
        // ✅ CORREÇÃO: Usar uma abordagem diferente para filtrar por regional
        // Primeiro buscar as janelas operacionais da regional do membro
        const { data: janelasRegional } = await supabase
          .from('janela_operacional')
          .select('id')
          .eq('regional_id', membro.regional_id);

        const janelaIds = janelasRegional?.map(j => j.id) || [];

        if (janelaIds.length > 0) {
          // Filtrar operações apenas das janelas da regional do membro
          query = query.in('janela_id', janelaIds);
        } else {
          // Se não há janelas para esta regional, não retornar nenhuma operação
          query = query.eq('id', -1); // Filtro impossível para retornar 0 resultados
        }

        logInfo(`🔒 [ISOLAMENTO] Membro ${membroId} da Regional ${membro.regional_id} (${(membro.regional as any)?.nome || 'Nome não encontrado'}) - operações filtradas por ${janelaIds.length} janelas`);
      }
    }

    // Aplica filtros de data se fornecidos
    if (startDate) {
      query = query.gte('data_operacao', startDate);
    }
    if (endDate) {
      query = query.lte('data_operacao', endDate);
    }

    // 🆕 NOVOS FILTROS: janela_id e tipo
    if (janelaId) {
      query = query.eq('janela_id', parseInt(janelaId));
    }
    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data: operacoes, error } = await query.order('data_operacao', { ascending: true });

    if (error) {
      logError('❌ [API-UNIFIED] Erro ao buscar operações:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }



    // ✅ OTIMIZADO: Log resumido apenas quando necessário
    // if (portal === 'diretoria') {
    //   logInfo(`✅ DIRETORIA: ${operacoes?.length || 0} operações encontradas para análise da diretoria`);
    // } else {
    //   logInfo(`✅ ${operacoes?.length || 0} operações encontradas`);
    // }

    // ✅ OTIMIZAÇÃO CRÍTICA: Processamento eficiente de operações
    const operacoesProcessadas = operacoes?.map((op: any) => {
      // ✅ OTIMIZADO: Filtrar e categorizar participações em uma única passada
      const participacoesAtivas = op.participacao?.filter((p: any) => p.ativa === true) || [];
      
      // ✅ OTIMIZAÇÃO: Categorizar participações em uma única iteração
      const categorias = {
        confirmados: [] as any[],
        pendentes: [] as any[],
        naFila: [] as any[],
        minhaParticipacao: null as any
      };
      
      const membroIdNum = membroId ? parseInt(membroId) : null;
      
      for (const p of participacoesAtivas) {
        // Categorizar por estado
        if (p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP') {
          categorias.confirmados.push(p);
        } else if (p.estado_visual === 'PENDENTE') {
          categorias.pendentes.push(p);
        } else if (p.estado_visual === 'NA_FILA') {
          categorias.naFila.push(p);
        }
        
        // Identificar participação do membro atual
        if (membroIdNum && p.membro_id === membroIdNum) {
          categorias.minhaParticipacao = p;
        }
      }
      
      // ✅ OTIMIZADO: Ordenar solicitações apenas uma vez
      const todasSolicitacoes = [...categorias.pendentes, ...categorias.naFila]
        .sort((a, b) => new Date(a.data_participacao || 0).getTime() - new Date(b.data_participacao || 0).getTime());

      // ✅ OTIMIZADO: Calcular posição cronológica apenas se necessário
      let posicaoCronologica = null;
      if (categorias.minhaParticipacao && op.participacao) {
        const participacoesCronologicas = op.participacao
          .filter((p: any) => p.data_solicitacao)
          .sort((a, b) => new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime());
        
        posicaoCronologica = participacoesCronologicas.findIndex((p: any) => p.id === categorias.minhaParticipacao.id) + 1;
      }
      
      // ✅ OTIMIZADO: Usar valores das categorias
      const participantesConfirmados = categorias.confirmados.length;
      const participantesConfirmadosArray = categorias.confirmados;

      // ✅ FORMATO ESPECIAL PARA SUPERVISOR com includeParticipantes
      if (portal === 'supervisor' && includeParticipantes === 'true') {
        // ✅ OTIMIZADO: Usar participações já ordenadas por data
        const participantesOrdenados = participacoesAtivas
          .sort((a, b) => new Date(a.data_participacao || 0).getTime() - new Date(b.data_participacao || 0).getTime())
          .map((p: any) => mode === 'light' 
            ? {
                id: p.id,
                membro_id: p.membro_id,
                estado_visual: p.estado_visual,
                status_interno: p.status_interno,
                data_participacao: p.data_participacao
              }
            : {
                id: p.id,
                membro_id: p.membro_id,
                nome: p.servidor?.nome || 'Nome não encontrado',
                matricula: p.servidor?.matricula || 'N/A',
                estado_visual: p.estado_visual,
                status_interno: p.status_interno,
                data_participacao: p.data_participacao
              }
          );

        const resultadoSupervisor = {
          id: op.id,
          data_operacao: op.data_operacao,
          modalidade: op.modalidade,
          tipo: op.tipo,
          turno: op.turno || 'N/A',
          horario: op.horario, // ✅ NOVO: Horário específico da operação
          limite_participantes: op.limite_participantes,
          ativa: op.ativa,
          excluida_temporariamente: op.excluida_temporariamente,
          participantes: participantesOrdenados, // ✅ FORMATO ESPERADO PELO MODAL COM ORDENAÇÃO CRONOLÓGICA
          // Campos extras para compatibilidade
          participantes_confirmados: participantesConfirmados,
          pessoas_na_fila: categorias.naFila.length,
          total_solicitacoes: todasSolicitacoes.length,
          // ✅ CORREÇÃO: Adicionar campos mapeados também para supervisor
          dataOperacao: op.data_operacao,
          limiteParticipantes: op.limite_participantes,
          statusReal: op.status || 'Disponível',
          regional: op.janela?.regional?.nome || 'Sem Regional'
        };

        return resultadoSupervisor;
      }

      // ✅ FORMATO ESPECÍFICO PARA DIRETORIA
      if (portal === 'diretoria') {
        // ✅ OTIMIZADO: Calcular bloqueios apenas para confirmados
        const participantesComBloqueio = categorias.confirmados.map((p: any) => ({
          ...p,
          bloqueado: p.bloqueado_diretoria || false
        }));
        
        const membrosBloquados = participantesComBloqueio.filter(p => p.bloqueado).length;

        return {
          id: op.id,
          dataOperacao: op.data_operacao,
          turno: op.turno || 'N/A',
          modalidade: op.modalidade,
          tipo: op.tipo,
          limiteParticipantes: op.limite_participantes,
          status: op.status || 'Disponível',
          // ✅ CAMPOS ESPECÍFICOS DA DIRETORIA
          encaminhado_diretoria_em: op.encaminhado_diretoria_em,
          retorno_diretoria_em: op.retorno_diretoria_em,
          decisao_diretoria: op.decisao_diretoria,
          motivo_diretoria: op.motivo_diretoria,
          // Contadores otimizados
          participantesConfirmados,
          totalParticipantes: participacoesAtivas.length,
          membrosBloquados,
          // Participantes com informações de bloqueio
          participantes: participantesComBloqueio,
          // Compatibilidade
          statusReal: op.status || 'Disponível',
          regional: op.janela?.regional?.nome || 'Sem Regional'
        };
      }

      // ✅ FORMATO PADRÃO OTIMIZADO
      return {
        ...op,
        ativa: op.ativa,
        excluida_temporariamente: op.excluida_temporariamente,
        horario: op.horario,
        participantes_confirmados: participantesConfirmados,
        pessoas_na_fila: categorias.naFila.length,
        total_solicitacoes: todasSolicitacoes.length,
        // ✅ OTIMIZADO: Mapear participações uma única vez
        participacoes: participacoesAtivas.map((p: any) => ({
          id: p.id,
          servidor_id: p.membro_id,
          confirmado: p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP',
          estado_visual: p.estado_visual,
          posicao_fila: p.posicao_fila,
          servidor: {
            id: p.servidor?.id,
            nome: p.servidor?.nome || 'Nome não encontrado',
            matricula: p.servidor?.matricula || 'N/A'
          }
        })),
        // ✅ OTIMIZADO: Usar array já filtrado
        participantes_detalhes: participantesConfirmadosArray.map((p: any) => ({
          id: p.id,
          estado_visual: p.estado_visual,
          servidor: {
            id: p.servidor?.id,
            nome: p.servidor?.nome || 'Nome não encontrado',
            matricula: p.servidor?.matricula || 'N/A'
          }
        })),
        fila_detalhes: todasSolicitacoes,
        minha_participacao: categorias.minhaParticipacao,
        // Campos mapeados
        dataOperacao: op.data_operacao,
        limiteParticipantes: op.limite_participantes,
        statusReal: op.status || 'Disponível',
        regional: op.janela?.regional?.nome || 'Sem Regional'
      };
    }) || [];

    // ✅ OTIMIZADO: Log final comentado para reduzir verbosidade
    // logInfo(`✅ ${operacoesProcessadas.length} operações processadas com sucesso`);

    return NextResponse.json({
      success: true,
      data: operacoesProcessadas
    });
  } catch (error) {
    logError('❌ [API-UNIFIED] Erro na API:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno'
    }, { status: 500 });
  }
}