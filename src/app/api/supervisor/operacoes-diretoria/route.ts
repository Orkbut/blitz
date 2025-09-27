import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Validar headers de autenticação
    const supervisorId = request.headers.get('x-supervisor-id');
    const regionalId = request.headers.get('x-regional-id');
    
    if (!supervisorId || !regionalId) {
      return NextResponse.json(
        { error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    // Buscar operações que estão aguardando diretoria ou aprovadas
    const { data: operacoes, error } = await supabase
      .from('operacao')
      .select(`
        id,
        data_operacao,
        modalidade,
        status,
        janela_operacional!inner (
          regional_id
        ),
        participacao!inner (
          servidor!inner (
            nome,
            matricula,
            perfil
          ),
          estado_visual
        )
      `)
      .eq('janela_operacional.regional_id', regionalId)
      .in('status', ['AGUARDANDO_DIRETORIA', 'APROVADO'])
      .eq('participacao.estado_visual', 'CONFIRMADO')
      .order('data_operacao', { ascending: true });

    if (error) {
      console.error('Erro ao buscar operações:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Transformar dados para o formato esperado
    const operacoesFormatadas = operacoes?.flatMap(op => 
      (op.participacao as any[]).map((part: any) => ({
        id: op.id,
        data_operacao: op.data_operacao,
        modalidade: op.modalidade,
        status: op.status,
        servidor_nome: part.servidor.nome,
        matricula: part.servidor.matricula,
        perfil: part.servidor.perfil,
        estado_visual: part.estado_visual
      }))
    ) || [];

    return NextResponse.json(operacoesFormatadas);
  } catch (error) {
    console.error('Erro na API operacoes-diretoria:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}