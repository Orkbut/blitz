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
      .select(selectQuery)
      .eq('ativa', true);

    // ✅ SUPERVISOR: Incluir operações excluídas temporariamente para permitir reativação
    if (portal !== 'supervisor') {
      query = query.eq('excluida_temporariamente', false);
    }

    // ✅ DIRETORIA: Filtrar apenas operações relevantes para diretoria
    if (portal === 'diretoria') {
      query = query.in('status', ['APROVADA', 'AGUARDANDO_DIRETORIA', 'APROVADA_DIRETORIA', 'REJEITADA_DIRETORIA']);
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
    
    // Retorna dados REAIS do banco
    // ✅ CORRIGINDO CONTAGEM DE PARTICIPANTES
    const operacoesProcessadas = operacoes?.map((op: any) => {
      
      // ✅ OTIMIZADO: Log comentado para reduzir verbosidade
      // logDebug(`🔍 Processando operação ${op.id}`, {
      //   totalParticipacoes: op.participacao?.length || 0,
      //   participacoesAtivas: op.participacao?.filter((p: any) => p.ativa === true).length || 0
      // });
      
      // Filtrar apenas participações ATIVAS primeiro
      const participacoesAtivas = op.participacao?.filter((p: any) => p.ativa === true) || [];
      
      // Contar participantes confirmados (incluindo adicionados pelo supervisor)
      const participantesConfirmados = participacoesAtivas.filter(
                    (p: any) => p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP'
      );
      
      // ✅ NOVA LÓGICA: Contar solicitações pendentes (não mais "na fila")
      const solicitacoesPendentes = participacoesAtivas.filter(
        (p: any) => p.estado_visual === 'PENDENTE'
      );
      
      // ✅ CONTAR TAMBÉM NA_FILA para compatibilidade
      const naFila = participacoesAtivas.filter(
        (p: any) => p.estado_visual === 'NA_FILA'
      );
      
      // ✅ OTIMIZADO: Ordenar por data de participação para garantir ordem cronológica
      const todasSolicitacoes = [...solicitacoesPendentes, ...naFila].sort((a: any, b: any) => {
        const dataA = new Date(a.data_participacao || 0).getTime();
        const dataB = new Date(b.data_participacao || 0).getTime();
        return dataA - dataB; // Quem solicitou primeiro vem primeiro
      });
      
      // ✅ OTIMIZADO: Log comentado para reduzir verbosidade
      // logDebug(`📊 Operação ${op.id}: ${participantesConfirmados.length} confirmados, ${solicitacoesPendentes.length} pendentes`);

      // ✅ N-03: POSIÇÃO CRONOLÓGICA REAL (não mais baseada em posicao_fila)
      let minhaParticipacao = null;
      let posicaoCronologica = null;
      
      if (membroId) {
        // logDebug(`🔍 Buscando participação do membro ${membroId} na operação ${op.id}`);
        
        // ✅ CORREÇÃO CRÍTICA: Buscar apenas em participações ATIVAS
        minhaParticipacao = participacoesAtivas.find((p: any) => p.membro_id == membroId);
        
        if (minhaParticipacao) {
          // logDebug(`✅ Participação encontrada: ${minhaParticipacao.estado_visual}`);
          
          // Calcular posição cronológica baseada na data de solicitação
          const participacoesCronologicas = op.participacao
            ?.filter((p: any) => p.data_solicitacao)
            ?.sort((a: any, b: any) => new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime());
          
          posicaoCronologica = participacoesCronologicas?.findIndex((p: any) => p.id === minhaParticipacao.id) + 1;
          
          // logDebug(`📊 Posição cronológica calculada: ${posicaoCronologica} de ${participacoesCronologicas?.length || 0}`);
        } else {
          // logDebug(`❌ Nenhuma participação encontrada para o membro ${membroId}`);
        }
      }
      
      // ✅ FORMATO ESPECIAL PARA SUPERVISOR com includeParticipantes
      if (portal === 'supervisor' && includeParticipantes === 'true') {
        // ✅ MODO LIGHT: Não incluir nome/matrícula quando otimizado
        const todosParticipantes = mode === 'light' 
          ? participacoesAtivas.map((p: any) => ({
              id: p.id,
              membro_id: p.membro_id,
              estado_visual: p.estado_visual,
              status_interno: p.status_interno,
              data_participacao: p.data_participacao // ✅ ADICIONAR DATA PARA ORDENAÇÃO
            }))
          : participacoesAtivas.map((p: any) => ({
              id: p.id,
              membro_id: p.membro_id,
              nome: p.servidor?.nome || 'Nome não encontrado',
              matricula: p.servidor?.matricula || 'N/A',
              estado_visual: p.estado_visual,
              status_interno: p.status_interno,
              data_participacao: p.data_participacao // ✅ ADICIONAR DATA PARA ORDENAÇÃO
            }));
            
        // ✅ OTIMIZADO: Ordenar participantes por data de participação para o modal supervisor
        const participantesOrdenados = [...todosParticipantes].sort((a: any, b: any) => {
          const participacaoA = participacoesAtivas.find((p: any) => p.id === a.id);
          const participacaoB = participacoesAtivas.find((p: any) => p.id === b.id);
          
          if (participacaoA && participacaoB) {
            const dataA = new Date(participacaoA.data_participacao || 0).getTime();
            const dataB = new Date(participacaoB.data_participacao || 0).getTime();
            return dataA - dataB;
          }
          return 0;
        });
        
        // ✅ OTIMIZADO: Log comentado para reduzir verbosidade
        // logDebug(`🎯 Supervisor Modal - Operação ${op.id}: ${todosParticipantes.length} participantes formatados`);

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
          participantes_confirmados: participantesConfirmados.length,
          pessoas_na_fila: naFila.length, // ✅ CORRIGIDO: apenas pessoas realmente na fila (estado_visual = 'NA_FILA')
          total_solicitacoes: todasSolicitacoes.length, // ✅ NOVO: total de solicitações (PENDENTE + NA_FILA) para o calendário
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
        const participacoesComBloqueio = participacoesAtivas.map((p: any) => ({
          ...p,
          bloqueado: p.bloqueado_diretoria || false
        }));

        const resultadoDiretoria = {
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
          // Contadores
          participantesConfirmados: participantesConfirmados.length,
          totalParticipantes: participacoesAtivas.length,
          membrosBloquados: participacoesComBloqueio.filter(p => p.bloqueado).length,
          // Participantes com informações de bloqueio
          participantes: participacoesComBloqueio.filter(p => p.estado_visual === 'CONFIRMADO' || p.estado_visual === 'ADICIONADO_SUP'),
          // Compatibilidade
          statusReal: op.status || 'Disponível',
          regional: op.janela?.regional?.nome || 'Sem Regional'
        };

        return resultadoDiretoria;
      }

      // ✅ FORMATO PADRÃO PARA OUTROS CASOS
      const resultadoPadrao = {
        ...op,
        ativa: op.ativa,
        excluida_temporariamente: op.excluida_temporariamente,
        horario: op.horario, // ✅ NOVO: Horário específico da operação
        participantes_confirmados: participantesConfirmados.length,
        pessoas_na_fila: naFila.length, // ✅ CORRIGIDO: apenas pessoas realmente na fila (estado_visual = 'NA_FILA')
        total_solicitacoes: todasSolicitacoes.length, // ✅ NOVO: total de solicitações (PENDENTE + NA_FILA) para o calendário
        // 🔍 ADICIONAR participacoes no formato esperado pelo tooltip
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
        participantes_detalhes: participantesConfirmados.map((p: any) => ({
          id: p.id,
          estado_visual: p.estado_visual, // ✅ INCLUIR ESTADO VISUAL
          servidor: {
            id: p.servidor?.id,
            nome: p.servidor?.nome || 'Nome não encontrado',
            matricula: p.servidor?.matricula || 'N/A'
          }
        })),
        fila_detalhes: todasSolicitacoes, // ✅ CORRIGIDO: agora são solicitações organizadas cronologicamente
        minha_participacao: minhaParticipacao, // ⭐ CAMPO ESSENCIAL PARA O MODAL
        // Adicionar campos mapeados para a interface do supervisor
        dataOperacao: op.data_operacao,
        limiteParticipantes: op.limite_participantes,
        statusReal: op.status || 'Disponível',
        regional: op.janela?.regional?.nome || 'Sem Regional'
      };
      
      return resultadoPadrao;
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