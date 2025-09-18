/**
 * API DE GERENCIAR PARTICIPAÇÃO DO SUPERVISOR
 * 
 * 🔑 REGRAS FUNDAMENTAIS:
 * - O banco de dados é a fonte absoluta da verdade
 * - Todas as operações devem manter consistência com dados do banco
 * - Não pode haver inconsistências entre operações e dados reais
 * 
 * 📋 REGRAS DE NEGÓCIO:
 * - O supervisor pode exceder o limite de participantes que ele mesmo definiu
 * - Existe exceção no banco de dados que permite ao supervisor adicionar mais participantes
 * - Esta exceção é uma regra de negócio válida e intencional
 * - O supervisor tem poderes administrativos para gerenciar participações
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ValidadorLimitesServidor } from '@/core/domain/services/ValidadorLimitesServidor';

// Função auxiliar para forçar atualização e garantir o realtime
async function forceRealtimeUpdate(operacaoId: number) {
  const { error } = await supabase
    .from('operacao')
    .update({ atualizacao_forcada: new Date().toISOString() })
    .eq('id', operacaoId);

  if (error) {
    console.error(`[FORCE_REALTIME_ERROR] Falha ao forçar update para op ${operacaoId}:`, error);
  } else {
    // ✅ OTIMIZADO: Log removido (performance)
  }
}

// POST - Gerenciar participações (adicionar/remover)
export async function POST(request: NextRequest) {
  // 🔍 LOG ESTRATÉGICO: Monitorar origem das chamadas de gerenciar participação
  // Para análise futura - tooltip foi removido em [DATA]
  const body = await request.json();
  console.log(`🔍 [TOOLTIP-MONITORING] API /supervisor/gerenciar-participacao chamada`, {
    acao: body?.acao || 'unknown',
    participacaoId: body?.participacaoId || 'unknown',
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack?.split('\n').slice(0, 3) || []
  });

  try {
    const { acao, membroId, operacaoId, justificativa, participacaoId } = body;

    // ✅ OTIMIZADO: Log removido (performance)

    if (!acao || !['adicionar', 'remover'].includes(acao)) {
      return NextResponse.json({
        success: false,
        error: 'Ação deve ser "adicionar" ou "remover"'
      }, { status: 400 });
    }

    let operacaoAfetada = null;

    if (acao === 'adicionar') {
      if (!operacaoId || !membroId) {
        return NextResponse.json({
          success: false,
          error: 'operacaoId e membroId são obrigatórios para adicionar'
        }, { status: 400 });
      }

      operacaoAfetada = operacaoId;

      // ✅ VERIFICAR SE OPERAÇÃO EXISTE E ESTÁ ATIVA
      const { data: operacao, error: operacaoError } = await supabase
        .from('operacao')
        .select('id, limite_participantes, data_operacao, tipo, modalidade')
        .eq('id', operacaoId)
        .eq('ativa', true)
        .single();

      if (operacaoError || !operacao) {
        console.error(`%c[ERRO_BUSCAR_OPERACAO]`, 'background: #fecaca; color: #991b1b; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
        console.error('Erro operação:', operacaoError);
        
        return NextResponse.json({
          success: false,
          error: 'Operação não encontrada ou inativa'
        }, { status: 404 });
      }

      // ✅ VERIFICAR SE MEMBRO EXISTE E ESTÁ ATIVO
      const { data: membro, error: membroError } = await supabase
        .from('servidor')
        .select('id, nome, matricula')
        .eq('id', membroId)
        .eq('ativo', true)
        .single();

      if (membroError || !membro) {
        console.error(`%c[ERRO_BUSCAR_MEMBRO]`, 'background: #fecaca; color: #991b1b; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
        console.error('Erro membro:', membroError);
        
        return NextResponse.json({
          success: false,
          error: 'Membro não encontrado ou inativo'
        }, { status: 404 });
      }

      // ✅ VERIFICAR SE JÁ EXISTE PARTICIPAÇÃO ATIVA
      const { data: participacaoExistente } = await supabase
        .from('participacao')
        .select('id')
        .eq('membro_id', membroId)
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .single();

      if (participacaoExistente) {
        return NextResponse.json({
          success: false,
          error: 'Membro já está participando desta operação'
        }, { status: 400 });
      }

      // ✅ NOVO: Validar limites (operações no ciclo e diárias no mês)
      try {
        const validador = new ValidadorLimitesServidor(supabase);
        const resultado = await validador.validarLimites({
          servidorId: Number(membroId),
          dataOperacao: operacao.data_operacao,
          tipoOperacao: operacao.tipo,
          modalidade: operacao.modalidade
        });

        if (!resultado.podeConfirmar) {
          return NextResponse.json({
            success: false,
            error: resultado.motivo || 'Limites excedidos para o servidor',
            data: { limites: resultado.limitesAtuais }
          }, { status: 400 });
        }
      } catch (e) {
        console.error('❌ [VALIDADOR_LIMITES] Erro ao validar limites:', e);
        return NextResponse.json({ success: false, error: 'Erro ao validar limites do servidor' }, { status: 500 });
      }

      // 🔑 REGRA DE NEGÓCIO: O supervisor pode exceder o limite de participantes
      // que ele mesmo definiu. Quando o supervisor adiciona um membro diretamente,
      // o membro entra como ADICIONADO_SUP para fins de transparência e auditoria.
      // Funcionalmente é igual a CONFIRMADO, mas permite distinguir a origem da participação.
      const novoEstadoVisual = 'ADICIONADO_SUP';
      const posicaoFila = null;
      
      const { data: novaParticipacao, error: insertError } = await supabase
        .from('participacao')
        .insert({
          membro_id: membroId,
          operacao_id: operacaoId,
          status_interno: 'APROVADO',
          estado_visual: novoEstadoVisual,
          data_participacao: new Date().toISOString(),
          posicao_fila: posicaoFila,
          ativa: true
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`%c[ERRO_INSERIR_PARTICIPACAO]`, 'background: #fecaca; color: #991b1b; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
        console.error('Erro detalhado:', insertError);
        
        return NextResponse.json({
          success: false,
          error: 'Erro interno ao adicionar membro'
        }, { status: 500 });
      }

      // 🚨 NOVA: Registrar justificativa FIFO se fornecida
      if (justificativa && justificativa.trim().length >= 10) {
        await supabase
          .from('justificativa_obrigatoria')
          .insert({
            contexto: 'QUEBRA_FIFO_SUPERVISOR',
            referencia_id: novaParticipacao.id,
            justificativa: justificativa.trim(),
            usuario_id: 1, // TODO: Pegar do contexto de autenticação
            dados_adicionais: {
              operacao_id: operacaoId,
              membro_adicionado: membro.nome,
              membro_matricula: membro.matricula,
              acao: 'ADICIONAR_DIRETO_QUEBRANDO_FIFO'
            }
          });
        // ✅ OTIMIZADO: Log removido (performance)
      }

      // 🚀 NOVA: Força refresh do realtime após adicionar participação
      await forceRealtimeUpdate(operacaoAfetada);

      return NextResponse.json({
        success: true,
        data: {
          participacaoId: novaParticipacao.id,
          estadoVisual: 'ADICIONADO_SUP',
          posicaoFila: null,
          fifoQuebrado: !!justificativa,
          justificativaFifo: justificativa || null,
          membro: {
            id: membro.id,
            nome: membro.nome,
            matricula: membro.matricula
          }
        }
      });

    } else if (acao === 'remover') {
      if (!participacaoId) {
        return NextResponse.json({
          success: false,
          error: 'participacaoId é obrigatório para remover'
        }, { status: 400 });
      }

      // Busca a participação para obter detalhes antes da remoção
      const { data: participacao, error: findError } = await supabase
        .from('participacao')
        .select('id, operacao_id, estado_visual, posicao_fila, servidor!inner(nome, matricula)')
        .eq('id', participacaoId)
        .single();

      if (findError || !participacao) {
        return NextResponse.json({ success: false, error: 'Participação não encontrada' }, { status: 404 });
      }

      const operacaoAfetada = participacao.operacao_id;
      const eraConfirmado = participacao.estado_visual === 'CONFIRMADO' || participacao.estado_visual === 'ADICIONADO_SUP';
      const eraDaFila = participacao.estado_visual === 'NA_FILA';
      const posicaoNaFila = participacao.posicao_fila;

      // 🎯 DELETAR POR ID (PAYLOAD REALTIME CORRETO!)
      const { error: deletarError } = await supabase
        .from('participacao')
        .delete()
        .eq('id', participacao.id);  // ✅ DELETE POR ID = PAYLOAD REALTIME COM operacao_id!

      if (deletarError) {
        console.error('❌ [REMOVER] ERRO NO DELETE SUPABASE:', deletarError);
        return NextResponse.json({
          success: false,
          error: 'Erro ao remover participação'
        }, { status: 500 });
      }

      // ✅ LÓGICA DE REORGANIZAÇÃO
      let participantePromovido = null;

      if (eraConfirmado) {
        // **PROMOÇÃO AUTOMÁTICA REMOVIDA**
        // Nenhuma ação automática é tomada para promover o próximo da fila.
        // A vaga simplesmente fica disponível.
      } else {
        // Se o membro removido estava na fila, a fila precisa ser reorganizada.
        await reorganizarFilaAposRemocao(operacaoAfetada, posicaoNaFila);
      }

      // Limpar a variável para garantir que não seja enviada na resposta
      participantePromovido = null;

      // Montar a mensagem de sucesso
      let message = 'Membro removido com sucesso!';
      if (eraConfirmado) {
        message = 'Membro removido com sucesso e uma vaga foi aberta na operação.';
      }

      // 🚀 NOVA: Força refresh do realtime após remover participação
      await forceRealtimeUpdate(operacaoAfetada);

      return NextResponse.json({
        success: true,
        message,
        data: {
          removido: true,
          promovido: participantePromovido // Sempre será null
        }
      });

    }
  } catch (error) {
    console.error('❌ [GERENCIAR-PARTICIPACAO] ERRO GERAL:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

async function promoverPrimeiroDaFila(operacaoId: number) {
  // Implementação removida (não utilizada nesta versão)
}

async function reorganizarFilaAposRemocao(operacaoId: number, posicaoRemovida: number) {
  try {
    // Buscar membros na fila com posição maior que a removida
    const { data: fila, error } = await supabase
      .from('participacao')
      .select('id, posicao_fila')
      .eq('operacao_id', operacaoId)
      .eq('estado_visual', 'NA_FILA')
      .gt('posicao_fila', posicaoRemovida)
      .order('posicao_fila', { ascending: true });

    if (error) return;

    // Atualizar posições decrementando 1
    for (const item of fila || []) {
      await supabase
        .from('participacao')
        .update({ posicao_fila: (item.posicao_fila ?? 2) - 1 })
        .eq('id', item.id);
    }
  } catch {}
}

async function reorganizarFilaAposPromocao(operacaoId: number) {
  // Implementação removida (não utilizada nesta versão)
}