-- ====================================================================
-- ROLLBACK: 010_fix_remocao_supervisor_trigger_rollback.sql
-- DESCRIÇÃO: Remover trigger para registrar eventos REMOCAO_SUPERVISOR
-- DATA: 2025-01-05
-- ====================================================================

-- Remover o trigger
DROP TRIGGER IF EXISTS trigger_remocao_supervisor ON participacao;

-- Remover a função
DROP FUNCTION IF EXISTS trigger_registrar_remocao_supervisor();

-- Remover registro da migration
DELETE FROM migrations_log WHERE version = '010'; 