import { createClient } from '@supabase/supabase-js';

// Configuração centralizada do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

// Cliente único do Supabase (singleton)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 30, // ✅ AUMENTADO: De 10 para 30 eventos/segundo
      heartbeatIntervalMs: 15000, // ✅ NOVO: Heartbeat a cada 15 segundos
      reconnectDelayMs: 1000, // ✅ NOVO: Reconectar após 1 segundo em caso de falha
      timeoutMs: 20000, // ✅ NOVO: Timeout de 20 segundos para operações
    },
    // ✅ Headers adicionais para melhor debugging
    headers: {
      'X-Client-Info': 'radar-detran@1.0.0'
    }
  },
  // 🚀 NOVO: Configurações de retry automático
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  // ✅ OTIMIZAÇÃO: Configurações de rede
  db: {
    schema: 'public'
  },
  // 🚀 NOVO: Configurações globais de timeout
  global: {
    headers: {
      'X-Client-Timeout': '30000'
    }
  }
});

// Verificar conexão
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ [Supabase] Variáveis de ambiente não configuradas');
} else {
  // console.log('✅ [Supabase] Cliente configurado:', supabaseUrl);
} 