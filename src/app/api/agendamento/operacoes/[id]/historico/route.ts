import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

interface EventoHistorico {
  id: string;
  tipo: 'SOLICITACAO' | 'APROVACAO' | 'CANCELAMENTO' | 'ADICAO_SUPERVISOR' | 'REMOCAO_SUPERVISOR' | 'REJEICAO' | 'ENTRADA_FILA' | 'PROMOCAO_FILA' | 'LIMITE_EXPANDIDO' | 'OPERACAO_EXCLUIDA' | 'OPERACAO_REATIVADA';
  servidor_nome: string;
  servidor_matricula: string;
  data_evento: string;
  detalhes?: string;
  icone: string;
  cor: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const membroId = searchParams.get('membroId');
  
  if (!membroId) {
    return NextResponse.json({ error: 'membroId é obrigatório' }, { status: 400 });
  }

  const { id } = await params;
  const operacaoId = id;
  console.log(`📊 [HISTÓRICO-API] ========== BUSCANDO HISTÓRICO OPERAÇÃO ${operacaoId} ==========`);
  console.log(`📊 [HISTÓRICO-API] Membro solicitante: ${membroId}`);

  try {
    // 🔥 BUSCAR EVENTOS DA NOVA TABELA DE AUDITORIA
    console.log(`📊 [HISTÓRICO-API] 🔍 Buscando eventos da tabela eventos_operacao...`);
    const { data: eventos, error: errorEventos } = await supabase
      .from('eventos_operacao')
      .select('*')
      .eq('operacao_id', operacaoId)
      .order('data_evento', { ascending: true });

    if (errorEventos) {
      console.error('📊 [HISTÓRICO-API] ❌ Erro ao buscar eventos:', errorEventos);
      throw errorEventos;
    }

    console.log(`📊 [HISTÓRICO-API] ✅ Eventos encontrados:`, eventos?.length || 0);
    console.log(`📊 [HISTÓRICO-API] 📋 Lista de eventos:`, JSON.stringify(eventos, null, 2));

    // 🎨 TRANSFORMAR EVENTOS PARA O FORMATO DO FRONTEND
    const eventosFormatados: EventoHistorico[] = eventos?.map(evento => ({
      id: evento.id.toString(),
      tipo: evento.tipo_evento as EventoHistorico['tipo'],
      servidor_nome: evento.servidor_nome,
      servidor_matricula: evento.servidor_matricula,
      data_evento: evento.data_evento,
      detalhes: evento.detalhes,
      icone: evento.icone,
      cor: evento.cor
    })) || [];

    // 🔍 BUSCAR POSIÇÃO ATUAL DO MEMBRO SOLICITANTE
    let posicaoAtual = null;
    let totalSolicitacoes = 0;
    let minhaParticipacao = null;


    const { data: participacaoAtual } = await supabase
      .from('participacao')
      .select('*')
      .eq('operacao_id', operacaoId)
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .single();

    console.log(`📊 [HISTÓRICO-API] 📋 Minha participação encontrada:`, participacaoAtual);

    if (participacaoAtual) {
      minhaParticipacao = {
        estado_visual: participacaoAtual.estado_visual,
        data_participacao: participacaoAtual.data_participacao
      };

      // Calcular posição cronológica
      console.log(`📊 [HISTÓRICO-API] 🔄 Calculando posição cronológica...`);
      const { data: todasAtivas } = await supabase
        .from('participacao')
        .select('data_participacao, membro_id')
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .order('data_participacao', { ascending: true });

      console.log(`📊 [HISTÓRICO-API] 📋 Todas participações ativas:`, todasAtivas?.length || 0);

      if (todasAtivas) {
        totalSolicitacoes = todasAtivas.length;
        posicaoAtual = todasAtivas.findIndex(p => 
          p.membro_id === parseInt(membroId)
        ) + 1;

        console.log(`📊 [HISTÓRICO-API] 📊 Posição calculada: ${posicaoAtual} de ${totalSolicitacoes}`);
      }
    }

    const response = {
      success: true,
      data: {
        eventos: eventosFormatados,
        posicao_atual: posicaoAtual,
        total_solicitacoes: totalSolicitacoes,
        minha_participacao: minhaParticipacao
      }
    };


    console.log(`📊 [HISTÓRICO-API] Total de eventos: ${eventosFormatados.length}`);
    console.log(`📊 [HISTÓRICO-API] Posição atual do solicitante: ${posicaoAtual || 'Não participando'}`);
    console.log(`📊 [HISTÓRICO-API] 📋 Resposta completa:`, JSON.stringify(response, null, 2));

    return NextResponse.json(response);

  } catch (error) {
    console.error('📊 [HISTÓRICO-API] ❌ Erro:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 