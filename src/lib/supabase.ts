import { createClient } from '@supabase/supabase-js';

// Configuração centralizada do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

// 🚀 CONFIGURAÇÃO OTIMIZADA para REALTIME VERDADEIRO
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    // ✅ CONFIGURAÇÃO ANTI-POLLING: Otimizada para realtime verdadeiro
    params: {
      eventsPerSecond: 10, // Padrão do Supabase
      log_level: 'info', // Para debug quando necessário
    },
    // ✅ HEARTBEAT: Para conexões estáveis
    heartbeatIntervalMs: 30000,
    // ✅ TIMEOUT: Para reconexões rápidas
    timeout: 10000,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  // ✅ OTIMIZAÇÃO GLOBAL: Para requisições mais rápidas
  global: {
    headers: {
      'X-Client-Info': 'radar-detran-realtime-optimized'
    }
  }
});



// ✅ FUNÇÃO PARA DEBUG: Verificar conexão
export async function verificarConexaoSupabase(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('operacao').select('id').limit(1);
    if (error) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// 🎯 FUNÇÃO: Configurar autenticação do Realtime
export function configurarAuthRealtime(): boolean {
  try {
    // Buscar dados do usuário logado
    const membroAuth = localStorage.getItem('membroAuth');
    const supervisorAuth = localStorage.getItem('supervisorAuth');
    const adminAuth = localStorage.getItem('admin_token');

    let userData = null;

    if (membroAuth) {
      userData = JSON.parse(membroAuth);
    } else if (supervisorAuth) {
      userData = JSON.parse(supervisorAuth);
    } else if (adminAuth) {
      userData = {
        id: 999,
        matricula: 'admin',
        nome: 'Administrador',
        perfil: 'Admin',
        regionalId: 0
      };
    }

    if (!userData) {
      return false;
    }

    // ✅ SOLUÇÃO SIMPLES: Use apenas o anonKey (sem JWT customizado)
    // Como as tabelas não têm RLS, o anonKey é suficiente
    supabase.realtime.setAuth(supabaseAnonKey);
    
    return true;
  } catch (error) {
    return false;
  }
} 