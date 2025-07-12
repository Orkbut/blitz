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
        .select('id, limite_participantes, data_operacao')
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
    console.error('Erro na API de gerenciar participação:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// ✅ FUNÇÃO AUXILIAR: Promover primeiro da fila
async function promoverPrimeiroDaFila(operacaoId: number) {
  try {
    // Buscar primeiro da fila
    const { data: primeiroFila } = await supabase
      .from('participacao')
      .select(`
        id,
        servidor!inner(nome, matricula)
      `)
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .eq('estado_visual', 'NA_FILA')
      .order('posicao_fila', { ascending: true })
      .limit(1)
      .single();

    if (primeiroFila) {
      // Promover para confirmado
      const { error: promoverError } = await supabase
        .from('participacao')
        .update({
          estado_visual: 'CONFIRMADO',
          status_interno: 'CONFIRMADO',
          posicao_fila: null
        })
        .eq('id', primeiroFila.id);

      if (!promoverError) {
        // Reorganizar posições da fila
        await reorganizarFilaAposPromocao(operacaoId);

        return {
          id: primeiroFila.id,
          nome: (primeiroFila.servidor as any).nome,
          matricula: (primeiroFila.servidor as any).matricula
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erro ao promover primeiro da fila:', error);
    return null;
  }
}

// ✅ FUNÇÃO AUXILIAR: Reorganizar fila após remoção
async function reorganizarFilaAposRemocao(operacaoId: number, posicaoRemovida: number) {
  try {
    // Buscar todos na fila com posição maior que a removida
    const { data: filaAjustar } = await supabase
      .from('participacao')
      .select('id, posicao_fila')
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .eq('estado_visual', 'NA_FILA')
      .gt('posicao_fila', posicaoRemovida)
      .order('posicao_fila', { ascending: true });

    if (filaAjustar && filaAjustar.length > 0) {
      // Diminuir posição de todos
      for (const pessoa of filaAjustar) {
        const novaPositao = pessoa.posicao_fila - 1;
        await supabase
          .from('participacao')
          .update({ posicao_fila: novaPositao })
          .eq('id', pessoa.id);
      }
    }
  } catch (error) {
    console.error('Erro ao reorganizar fila:', error);
  }
}

// ✅ FUNÇÃO AUXILIAR: Reorganizar fila após promoção
async function reorganizarFilaAposPromocao(operacaoId: number) {
  try {
    // Buscar todos na fila ordenados por posição
    const { data: filaAtual } = await supabase
      .from('participacao')
      .select('id, posicao_fila')
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .eq('estado_visual', 'NA_FILA')
      .order('posicao_fila', { ascending: true });

    if (filaAtual && filaAtual.length > 0) {
      // Reajustar posições sequencialmente
      for (let i = 0; i < filaAtual.length; i++) {
        const novaPosicao = i + 1;
        if (filaAtual[i].posicao_fila !== novaPosicao) {
          await supabase
            .from('participacao')
            .update({ posicao_fila: novaPosicao })
            .eq('id', filaAtual[i].id);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao reorganizar fila após promoção:', error);
  }
} 