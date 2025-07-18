import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ✅ PUT: Definir/Atualizar horário da operação
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ CORREÇÃO: Await params para Next.js 15+
    const resolvedParams = await params;
    const operacaoId = parseInt(resolvedParams.id);
    const { horario, turno, supervisorId } = await request.json();

    // Validações básicas
    if (!supervisorId) {
      return NextResponse.json({
        success: false,
        error: 'Supervisor ID é obrigatório'
      }, { status: 400 });
    }

    // Validar formato do horário (HH:MM)
    if (horario && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horario)) {
      return NextResponse.json({
        success: false,
        error: 'Formato de horário inválido. Use HH:MM (ex: 14:30)'
      }, { status: 400 });
    }

    // Verificar se supervisor existe e tem permissão
    const { data: supervisor, error: supervisorError } = await supabase
      .from('servidor')
      .select('id, perfil, ativo')
      .eq('id', supervisorId)
      .single();

    if (supervisorError || !supervisor) {
      return NextResponse.json({
        success: false,
        error: 'Supervisor não encontrado'
      }, { status: 404 });
    }

    if (supervisor.perfil !== 'Supervisor' || !supervisor.ativo) {
      return NextResponse.json({
        success: false,
        error: 'Apenas supervisores ativos podem definir horários'
      }, { status: 403 });
    }

    // Verificar se operação existe e está ativa
    const { data: operacao, error: operacaoError } = await supabase
      .from('operacao')
      .select('id, ativa, excluida_temporariamente, data_operacao, turno')
      .eq('id', operacaoId)
      .single();

    if (operacaoError || !operacao) {
      return NextResponse.json({
        success: false,
        error: 'Operação não encontrada'
      }, { status: 404 });
    }

    if (!operacao.ativa || operacao.excluida_temporariamente) {
      return NextResponse.json({
        success: false,
        error: 'Não é possível definir horário para operações inativas ou excluídas'
      }, { status: 400 });
    }

    // Atualizar horário e turno da operação
    const updateData: any = { 
      horario: horario || null
    };
    
    // Adicionar turno apenas se foi fornecido
    if (turno !== undefined) {
      updateData.turno = turno || null;
    }

    const { data: operacaoAtualizada, error: updateError } = await supabase
      .from('operacao')
      .update(updateData)
      .eq('id', operacaoId)
      .select('id, horario, turno')
      .single();

    if (updateError) {
      console.error('Erro ao atualizar horário:', updateError);
      return NextResponse.json({
        success: false,
        error: 'Erro interno ao atualizar horário'
      }, { status: 500 });
    }

    // Log da ação para auditoria
    let justificativa = '';
    if (horario && turno) {
      justificativa = `Horário definido: ${horario} | Turno: ${turno}`;
    } else if (horario) {
      justificativa = `Horário definido: ${horario}`;
    } else if (turno) {
      justificativa = `Turno definido: ${turno}`;
    } else {
      justificativa = 'Horário e turno removidos';
    }

    await supabase
      .from('justificativa_obrigatoria')
      .insert({
        contexto: 'DEFINIR_HORARIO_OPERACAO',
        referencia_id: operacaoId,
        justificativa: justificativa,
        usuario_id: supervisorId
      });

    // Determinar ação realizada
    let acao = 'atualizado';
    if (horario && turno) {
      acao = 'horario_e_turno_definidos';
    } else if (horario) {
      acao = 'horario_definido';
    } else if (turno) {
      acao = 'turno_definido';
    } else {
      acao = 'removido';
    }

    // ✅ Realtime atualiza automaticamente via hooks useRealtimeOperacoes

    return NextResponse.json({
      success: true,
      data: {
        operacaoId,
        horario: operacaoAtualizada.horario,
        turno: operacaoAtualizada.turno,
        acao: acao
      }
    });

  } catch (error) {
    console.error('Erro ao definir horário:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// ✅ DELETE: Remover horário da operação
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ CORREÇÃO: Await params para Next.js 15+
    const resolvedParams = await params;
    const operacaoId = parseInt(resolvedParams.id);
    const { supervisorId } = await request.json();

    // Reutilizar a lógica do PUT passando horário como null
    return PUT(request, { params });

  } catch (error) {
    console.error('Erro ao remover horário:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 