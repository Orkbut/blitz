-- ============================================================================
-- ROLLBACK MIGRAÇÃO 004: Remover campo horário da tabela operacao
-- ============================================================================
-- Objetivo: Reverter adição do campo horário caso necessário
-- Data: 2025-01-31
-- Autor: Sistema Radar Detran

BEGIN;

-- Remover índice
DROP INDEX IF EXISTS idx_operacao_horario;

-- Remover campo horário da tabela operacao
ALTER TABLE operacao 
DROP COLUMN IF EXISTS horario;

-- Remover registro da migração
DELETE FROM migrations_log WHERE version = '004';

COMMIT; 