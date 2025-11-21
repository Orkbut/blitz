import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const operacaoId = parseInt((await params).id);
    if (isNaN(operacaoId)) {
      return NextResponse.json({ success: false, error: 'ID de operação inválido' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('operacao_coordenadores')
      .select('servidor_id, revogado_em')
      .eq('operacao_id', operacaoId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const ativos = (data || []).filter((r: any) => !r.revogado_em).map((r: any) => r.servidor_id);
    return NextResponse.json({ success: true, data: { servidores_ids: ativos } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const operacaoId = parseInt(resolvedParams.id);
    const body = await request.json();
    const servidorId = parseInt(body?.servidorId);
    const supervisorHeader = request.headers.get('X-Supervisor-Id') || request.headers.get('x-supervisor-id');
    const supervisorId = parseInt(body?.supervisorId || supervisorHeader || '0');

    if (isNaN(operacaoId) || isNaN(servidorId) || isNaN(supervisorId)) {
      return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const { data: supervisor, error: supError } = await supabase
      .from('servidor')
      .select('id, perfil, ativo')
      .eq('id', supervisorId)
      .single();

    if (supError || !supervisor || supervisor.perfil !== 'Supervisor' || !supervisor.ativo) {
      return NextResponse.json({ success: false, error: 'Supervisor não autorizado' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('operacao_coordenadores')
      .upsert(
        {
          operacao_id: operacaoId,
          servidor_id: servidorId,
          designado_por_supervisor_id: supervisorId,
          revogado_por_supervisor_id: null,
          revogado_em: null
        },
        { onConflict: 'operacao_id,servidor_id' }
      )
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const operacaoId = parseInt(resolvedParams.id);
    const body = await request.json();
    const servidorId = parseInt(body?.servidorId);
    const supervisorHeader = request.headers.get('X-Supervisor-Id') || request.headers.get('x-supervisor-id');
    const supervisorId = parseInt(body?.supervisorId || supervisorHeader || '0');

    if (isNaN(operacaoId) || isNaN(servidorId) || isNaN(supervisorId)) {
      return NextResponse.json({ success: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const { data: supervisor, error: supError } = await supabase
      .from('servidor')
      .select('id, perfil, ativo')
      .eq('id', supervisorId)
      .single();

    if (supError || !supervisor || supervisor.perfil !== 'Supervisor' || !supervisor.ativo) {
      return NextResponse.json({ success: false, error: 'Supervisor não autorizado' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('operacao_coordenadores')
      .update({ revogado_em: new Date().toISOString(), revogado_por_supervisor_id: supervisorId })
      .eq('operacao_id', operacaoId)
      .eq('servidor_id', servidorId)
      .is('revogado_em', null)
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
