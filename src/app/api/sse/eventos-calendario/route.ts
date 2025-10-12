import { NextRequest } from 'next/server';

// SSE de Eventos do Calendário (supervisor) com polling via API interna existente
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const supervisorId = searchParams.get('supervisorId') || '1';
  const regionalId = searchParams.get('regionalId') || '5';
  const intervalMs = parseInt(searchParams.get('intervalMs') || '7000', 10);

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

      const fetchEvents = async () => {
        try {
          const response = await fetch(`http://localhost:3000/api/comunicacao/eventos-calendario?supervisorId=${supervisorId}&regionalId=${regionalId}`);
          const json = await response.json();
          if (!json?.success) {
            send('error', { message: 'Falha ao buscar eventos' });
            return [];
          }
          return json.data || [];
        } catch (err: any) {
          send('error', { message: err?.message || 'unknown error' });
          return [];
        }
      };

      const fetchAndDiff = async () => {
        const list = await fetchEvents();

        // Snapshot inicial
        if (lastMap.size === 0) {
          send('snapshot', list);
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
      };

      await fetchAndDiff();
      heartbeat();

      timer = setInterval(fetchAndDiff, Math.max(3000, intervalMs));
      heartbeatTimer = setInterval(heartbeat, 30000);

      send('ready', { ok: true });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}