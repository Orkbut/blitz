-- ====================================================================
-- MIGRATION: 009_supervisor_superpoder.sql
-- DESCRIÇÃO: Função para ativar/desativar superpoder do supervisor
-- DATA: 2025-01-05
-- ====================================================================

-- 1. FUNÇÃO PARA ATIVAR SUPERPODER DO SUPERVISOR
CREATE OR REPLACE FUNCTION ativar_superpoder_supervisor()
RETURNS void AS $$
BEGIN
    -- Ativa o superpoder do supervisor na sessão atual
    PERFORM set_config('app.supervisor_override', 'true', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FUNÇÃO PARA DESATIVAR SUPERPODER DO SUPERVISOR
CREATE OR REPLACE FUNCTION desativar_superpoder_supervisor()
RETURNS void AS $$
BEGIN
    -- Desativa o superpoder do supervisor na sessão atual
    PERFORM set_config('app.supervisor_override', 'false', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FUNÇÃO PARA VERIFICAR STATUS DO SUPERPODER
CREATE OR REPLACE FUNCTION status_superpoder_supervisor()
RETURNS boolean AS $$
BEGIN
    RETURN COALESCE(current_setting('app.supervisor_override', true), 'false') = 'true';
END;
$$ LANGUAGE plpgsql;

-- 4. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON FUNCTION ativar_superpoder_supervisor() IS 
'Ativa o superpoder do supervisor para operações especiais que ignoram constraints normais';

COMMENT ON FUNCTION desativar_superpoder_supervisor() IS 
'Desativa o superpoder do supervisor, restaurando validações normais';

COMMENT ON FUNCTION status_superpoder_supervisor() IS 
'Retorna true se o superpoder do supervisor está ativo na sessão atual';

-- 5. REGISTRAR MIGRAÇÃO
-- INSERT INTO migrations_log (version, description, applied_at) 
-- VALUES ('009', 'Adicionar funções de superpoder do supervisor', NOW())
-- ON CONFLICT (version) DO NOTHING; 