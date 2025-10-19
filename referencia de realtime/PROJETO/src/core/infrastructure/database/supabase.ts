import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase MCP - Projeto RADAR
const supabaseUrl = 'https://umcejyqkfhvxaiyvmqac.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU';

// Cliente configurado para uso em toda aplicação
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Não persistir sessão no localStorage (sistema interno)
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  }
});

// Função utilitária para verificar conexão
export async function verificarConexaoSupabase(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('parametros_sistema')
      .select('count', { count: 'exact', head: true });
    
    return !error && data !== null;
  } catch (error) {
    console.error('Erro na conexão Supabase:', error);
    return false;
  }
}

// Tipos das tabelas - Gerados do banco MCP Supabase
export interface Regional {
  id: number;
  nome: string;
  codigo: string;
  ativo: boolean;
  criado_em: string;
}

export interface Servidor {
  id: number;
  matricula: string;
  nome: string;
  email?: string;
  perfil: 'Membro' | 'Supervisor';
  regional_id: number;
  ativo: boolean;
  criado_em: string;
}

export interface Operacao {
  id: number;
  janela_id: number;
  data_operacao: string;
  turno: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  limite_participantes: number;
  status?: string;
  ativa: boolean;
  criado_em: string;
}

export interface Participacao {
  id: number;
  membro_id: number;
  operacao_id: number;
  data_participacao: string;
  status_interno: string;
  estado_visual?: 'DISPONIVEL' | 'NA_FILA' | 'CONFIRMADO';
  posicao_fila?: number;
  ativa: boolean;
}

export interface ParametroSistema {
  id: number;
  nome_parametro: string;
  valor_atual: string;
  tipo_valor: 'INTEGER' | 'DECIMAL' | 'STRING' | 'BOOLEAN';
  descricao?: string;
  categoria?: string;
  pode_alterar_runtime: boolean;
  valido_apartir: string;
  criado_em: string;
  atualizado_em: string;
} 