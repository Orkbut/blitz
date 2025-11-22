import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status') || 'ativas';
    const includeRevogadas = status !== 'ativas';
    const startDateParam = request.nextUrl.searchParams.get('startDate');
    const endDateParam = request.nextUrl.searchParams.get('endDate');
    const fields = request.nextUrl.searchParams.get('fields') || 'full';
    const modalidadeParam = (request.nextUrl.searchParams.get('modalidade') || 'EXCLUDE_BALANCA').toUpperCase();

    const cacheKey = `${status}:${startDateParam || ''}:${endDateParam || ''}:${fields}:${modalidadeParam}`;
    const globalAny: any = globalThis as any;
    globalAny.__coord_cache = globalAny.__coord_cache || new Map<string, { t: number; data: any }>();
    const cacheMap: Map<string, { t: number; data: any }> = globalAny.__coord_cache;
    const now = Date.now();
    const hit = cacheMap.get(cacheKey);
    if (hit && now - hit.t < 60000) {
      const res = NextResponse.json({ success: true, data: hit.data });
      res.headers.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=60');
      res.headers.set('x-cache', 'hit');
      return res;
    }

    type CoordenacaoRow = {
      servidor_id: number;
      operacao_id: number;
      revogado_em: string | null;
      servidor?: ({ id: number; nome: string; matricula: string } | null) | ({ id: number; nome: string; matricula: string }[]) | null;
      operacao?: ({ id: number; data_operacao: string; tipo: string; modalidade: string; status: string } | null) | ({ id: number; data_operacao: string; tipo: string; modalidade: string; status: string }[]) | null;
    };

    let operacaoIdsFiltrados: number[] | null = null;
    if (startDateParam && endDateParam) {
      const { data: operacoesPeriodo, error: errOps } = await supabase
        .from('operacao')
        .select('id, data_operacao')
        .gte('data_operacao', startDateParam)
        .lte('data_operacao', endDateParam);
      if (errOps) {
        return NextResponse.json({ success: false, error: errOps.message }, { status: 500 });
      }
      operacaoIdsFiltrados = (operacoesPeriodo || []).map(op => op.id);
      if (operacaoIdsFiltrados.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    let consulta = supabase
      .from('operacao_coordenadores')
      .select(
        `
        servidor_id,
        operacao_id,
        revogado_em,
        servidor:servidor_id(id,nome,matricula),
        operacao:operacao_id(id,data_operacao,tipo,modalidade,status)
        `
      );

    if (operacaoIdsFiltrados && operacaoIdsFiltrados.length > 0) {
      consulta = consulta.in('operacao_id', operacaoIdsFiltrados);
    }

    const { data: rows, error } = await consulta;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const filtradas: CoordenacaoRow[] = (rows || []).filter((r) => {
      const op = Array.isArray(r.operacao) ? r.operacao[0] : r.operacao;
      const isBalanca = (op?.modalidade ?? null) === 'BALANCA';
      const revogadaPass = includeRevogadas ? true : !r.revogado_em;
      if (!revogadaPass) return false;
      if (modalidadeParam === 'BALANCA_ONLY') {
        return isBalanca;
      }
      if (modalidadeParam === 'EXCLUDE_BALANCA') {
        return !isBalanca;
      }
      return true;
    });

    type CoordenacaoItem = {
      operacao_id: number;
      data_operacao: string | null;
      tipo: string | null;
      modalidade: string | null;
      status: string | null;
      revogado_em: string | null;
    };

    type ServidorCoordenacoes = {
      servidor_id: number;
      nome: string;
      matricula: string;
      ativa_count: number;
      total_count: number;
      coordenacoes: CoordenacaoItem[];
    };

    const porServidor: Record<number, ServidorCoordenacoes> = {};
    for (const r of filtradas) {
      const sid = r.servidor_id;
      const serv = Array.isArray(r.servidor) ? r.servidor[0] : r.servidor;
      const op = Array.isArray(r.operacao) ? r.operacao[0] : r.operacao;
      if (!porServidor[sid]) {
        porServidor[sid] = {
          servidor_id: sid,
          nome: serv?.nome ?? 'Servidor',
          matricula: serv?.matricula ?? '',
          ativa_count: 0,
          total_count: 0,
          coordenacoes: []
        };
      }
      porServidor[sid].total_count += 1;
      if (!r.revogado_em) porServidor[sid].ativa_count += 1;
      porServidor[sid].coordenacoes.push({
        operacao_id: op?.id ?? r.operacao_id,
        data_operacao: op?.data_operacao ?? null,
        tipo: op?.tipo ?? null,
        modalidade: op?.modalidade ?? null,
        status: op?.status ?? null,
        revogado_em: r.revogado_em ?? null
      });
    }

    const lista: ServidorCoordenacoes[] = Object.values(porServidor).sort((a, b) => b.ativa_count - a.ativa_count);

    cacheMap.set(cacheKey, { t: now, data: lista });
    const res = NextResponse.json({ success: true, data: lista });
    res.headers.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=60');
    res.headers.set('x-cache', 'miss');
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
