-- Migration: Criar tabela de sessões de administrador (opcional para auditoria)
-- Arquivo: 013_admin_sessions_table.sql

-- Tabela para rastrear sessões de administrador (segurança e auditoria)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  login VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  logged_out_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_created_at ON public.admin_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active ON public.admin_sessions(is_active);

-- Trigger para limpar sessões expiradas automaticamente
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar sessões expiradas como inativas
  UPDATE public.admin_sessions 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
  
  -- Remover sessões muito antigas (mais de 30 dias)
  DELETE FROM public.admin_sessions 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa a limpeza a cada inserção
CREATE TRIGGER trigger_cleanup_admin_sessions
  AFTER INSERT ON public.admin_sessions
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_admin_sessions();

-- Comentários para documentação
COMMENT ON TABLE public.admin_sessions IS 'Tabela de auditoria e controle de sessões do portal de administração';
COMMENT ON COLUMN public.admin_sessions.token_hash IS 'Hash SHA256 do token de sessão para segurança';
COMMENT ON COLUMN public.admin_sessions.login IS 'Login do administrador';
COMMENT ON COLUMN public.admin_sessions.ip_address IS 'Endereço IP da sessão';
COMMENT ON COLUMN public.admin_sessions.user_agent IS 'User agent do navegador';
COMMENT ON COLUMN public.admin_sessions.expires_at IS 'Data/hora de expiração da sessão';
COMMENT ON COLUMN public.admin_sessions.logged_out_at IS 'Data/hora do logout (se aplicável)';
COMMENT ON COLUMN public.admin_sessions.is_active IS 'Indica se a sessão está ativa'; 