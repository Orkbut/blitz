-- ====================================================================
-- ROLLBACK: 009_supervisor_superpoder_rollback.sql
-- DESCRIÇÃO: Reverter funções de superpoder do supervisor
-- DATA: 2025-01-05
-- ====================================================================

-- 1. DROPAR FUNÇÕES DE SUPERPODER
DROP FUNCTION IF EXISTS ativar_superpoder_supervisor();
DROP FUNCTION IF EXISTS desativar_superpoder_supervisor();
DROP FUNCTION IF EXISTS status_superpoder_supervisor();

-- 2. REMOVER REGISTRO DA MIGRATION
-- DELETE FROM migrations_log WHERE version = '009';

-- Confirmar rollback
SELECT 'Rollback da migration 009 concluído com sucesso!' as status; 