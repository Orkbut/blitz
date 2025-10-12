import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SSE de Operações com polling delta simples
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const membroId = searchParams.get('membroId');
  const portal = searchParams.get('portal') || 'membro';
  const includeParticipantes = searchParams.get('includeParticipantes') === 'true';
  const includeInactive = searchParams.get('includeInactive') === 'true';
  const janelaId = searchParams.get('janela_id');
  const tipo = searchParams.get('tipo');
  const intervalMs = parseInt(searchParams.get('intervalMs') || '5000', 10);

  const encoder = new TextEncoder();
  let eventId = 1;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`id: ${eventId++}\n`));
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const heartbeat = () => {
        controller.enqueue(encoder.encode(`event: heartbeat\n`));
        controller.enqueue(encoder.encode(`data: {"t": ${Date.now()}}\n\n`));
      };

      let lastMap = new Map<number, any>();
      let timer: any;
      let heartbeatTimer: any;

      const fetchAndDiff = async () => {
        try {
          // Seleção adaptada ao portal
          let selectQuery = `*`;
          if (portal === 'supervisor') {
            selectQuery = `*, participacao!left(id, membro_id, estado_visual, status_interno, data_participacao, ativa)`;
          } else {
            selectQuery = `*, participacao!left(id, membro_id, estado_visual, data_participacao, ativa)`;
          }

          let query = supabase.from('operacao').select(selectQuery);

          if (!includeInactive) {
            query = query.eq('ativa', true);
          }

          if (portal !== 'supervisor') {
            query = query.eq('excluida_temporariamente', false);
          }

          if (membroId && portal !== 'supervisor' && portal !== 'diretoria') {
            const { data: membro } = await supabase
              .from('servidor')
              .select(`regional_id`)
              .eq('id', membroId)
              .eq('ativo', true)
              .single();

            if (membro?.regional_id) {
              const { data: janelasRegional } = await supabase
                .from('janela_operacional')
                .select('id')
                .eq('regional_id', membro.regional_id);

              const janelaIds = janelasRegional?.map(j => j.id) || [];
              if (janelaIds.length > 0) {
                query = query.in('janela_id', janelaIds);
              } else {
                query = query.eq('id', -1);
              }
            }
          }

          if (startDate) query = query.gte('data_operacao', startDate);
          if (endDate) query = query.lte('data_operacao', endDate);
          if (janelaId) query = query.eq('janela_id', parseInt(janelaId));
          if (tipo) query = query.eq('tipo', tipo);

          const { data: list, error } = await query.order('data_operacao', { ascending: true });
          if (error) {
            send('error', { message: error.message });
            return;
          }

          // Inicial: enviar snapshot
          if (lastMap.size === 0) {
            send('snapshot', list || []);
            (list || []).forEach((item: any) => lastMap.set(item.id, item));
            return;
          }

          const newMap = new Map<number, any>();
          (list || []).forEach((item: any) => newMap.set(item.id, item));

          // Upserts
          for (const [id, item] of newMap.entries()) {
            const prev = lastMap.get(id);
            if (!prev) {
              send('upsert', item);
            } else {
              // Diferença superficial por JSON
              try {
                const a = JSON.stringify(prev);
                const b = JSON.stringify(item);
                if (a !== b) {
                  send('upsert', item);
                }
              } catch {
                send('upsert', item);
              }
            }
          }

          // Deletes
          for (const id of lastMap.keys()) {
            if (!newMap.has(id)) {
              send('delete', { id });
            }
          }

          lastMap = newMap;
        } catch (err: any) {
          send('error', { message: err?.message || 'unknown error' });
        }
      };

      // Primeiro fetch imediato
      await fetchAndDiff();
      heartbeat();

      timer = setInterval(fetchAndDiff, Math.max(2000, intervalMs));
      heartbeatTimer = setInterval(heartbeat, 30000);

      // Encerramento limpo quando a conexão é fechada pelo cliente
      // Nota: Next.js encerrará automaticamente quando a resposta for abortada
      const close = () => {
        clearInterval(timer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {}
      };

      // Detectar fechamento via cancel do stream (em alguns ambientes)
      // Não há hook direto aqui, porém quando o Response é abortado, timers param
      // Em produção, o fechamento ocorre ao encerrar a aba ou navegar
      // Expor uma mensagem final
      send('ready', { ok: true });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evitar buffering em proxies como Nginx
      'X-Accel-Buffering': 'no',
    },
  });
}