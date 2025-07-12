'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestRealtimePage() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [events, setEvents] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Teste via API
  const runApiTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-realtime');
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      console.error('Erro no teste:', error);
      setTestResult({ error: error instanceof Error ? error.message : 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  };

  // Teste direto no cliente
  useEffect(() => {
    setStatus('connecting');
    
    const channel = supabase
      .channel('test-client-' + Date.now())
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'operacao' }, 
        (payload) => {
          console.log('🎉 Evento operacao:', payload);
          setEvents(prev => [...prev, { 
            time: new Date().toISOString(), 
            table: 'operacao',
            event: payload.eventType,
            data: payload 
          }]);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participacao' },
        (payload) => {
          console.log('🎉 Evento participacao:', payload);
          setEvents(prev => [...prev, { 
            time: new Date().toISOString(), 
            table: 'participacao',
            event: payload.eventType,
            data: payload 
          }]);
        }
      )
      .subscribe((status) => {
        console.log('📡 Status:', status);
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setStatus('error');
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Teste de insert manual
  const testInsert = async () => {
    try {
      const { data, error } = await supabase
        .from('participacao')
        .insert({
          servidor_id: 1,
          operacao_id: 276,
          estado_participacao: 'SOLICITADO',
          ativa: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Insert realizado:', data);
      
      // Deletar após 2 segundos
      setTimeout(async () => {
        await supabase
          .from('participacao')
          .delete()
          .eq('id', data.id);
        console.log('🗑️ Delete realizado');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro no teste:', error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Teste de Realtime Supabase</h1>
      
      {/* Status da Conexão */}
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Status da Conexão</h2>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${
            status === 'connected' ? 'bg-green-500' : 
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
            status === 'error' ? 'bg-red-500' : 
            'bg-gray-400'
          }`} />
          <span className="font-mono">{status}</span>
        </div>
      </div>

      {/* Botões de Teste */}
      <div className="mb-8 flex gap-4">
        <button
          onClick={runApiTest}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testando...' : 'Testar via API'}
        </button>
        
        <button
          onClick={testInsert}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Inserir Participação Teste
        </button>
        
        <button
          onClick={() => setEvents([])}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Limpar Eventos
        </button>
      </div>

      {/* Resultado do Teste da API */}
      {testResult && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Resultado do Teste da API</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Eventos Recebidos */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Eventos Realtime Recebidos</h2>
        {events.length === 0 ? (
          <p className="text-gray-500">Nenhum evento recebido ainda...</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {events.map((event, index) => (
              <div key={index} className="p-3 bg-white rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">
                    {event.table} - {event.event}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.time).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informações de Debug */}
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold mb-2">Informações de Debug</h3>
        <ul className="text-sm space-y-1">
          <li>URL Supabase: {process.env.NEXT_PUBLIC_SUPABASE_URL}</li>
          <li>Tem Anon Key: {!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Sim' : 'Não'}</li>
          <li>Realtime URL: {(supabase as any).realtimeURL || 'N/A'}</li>
        </ul>
      </div>
    </div>
  );
} 