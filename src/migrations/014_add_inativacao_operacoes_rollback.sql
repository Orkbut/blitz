-- =====================================================
-- MIGRATION 014 ROLLBACK: Remover campos de inativação da tabela operacao
-- Data: 12/08/2025
-- Descrição: Remove campos de inativação de operações adicionados na migration 014
-- =====================================================

-- Remover constraint de consistência
ALTER TABLE public.operacao 
DROP CONSTRAINT IF EXISTS chk_inativacao_consistente;

-- Remover índice
DROP INDEX IF EXISTS idx_operacao_inativa_supervisor;

-- Remover foreign key constraint
ALTER TABLE public.operacao 
DROP CONSTRAINT IF EXISTS fk_operacao_supervisor_inativacao;

-- Remover campos de inativação
ALTER TABLE public.operacao 
DROP COLUMN IF EXISTS supervisor_inativacao_id,
DROP COLUMN IF EXISTS motivo_inativacao,
DROP COLUMN IF EXISTS data_inativacao,
DROP COLUMN IF EXISTS inativa_pelo_supervisor;