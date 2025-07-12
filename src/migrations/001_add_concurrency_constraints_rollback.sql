-- ROLLBACK: 001_add_concurrency_constraints.sql
-- Descrição: Remove constraints de concorrência para rollback seguro
-- Data: 19/06/2025

-- =========================================
-- 1. REMOVER TRIGGER DE LIMITE DE PARTICIPANTES
-- =========================================
DROP TRIGGER IF EXISTS enforce_limite_participantes ON participacao;

-- =========================================
-- 2. REMOVER FUNÇÃO DE VERIFICAÇÃO DE LIMITE
-- =========================================
DROP FUNCTION IF EXISTS check_limite_participantes();

-- =========================================
-- 3. REMOVER CONSTRAINT DE EXCLUSIVIDADE DIÁRIA
-- =========================================
DROP INDEX IF EXISTS uk_membro_data_ativa;

-- =========================================
-- 4. REMOVER ÍNDICES DE PERFORMANCE
-- =========================================
DROP INDEX IF EXISTS idx_participacao_operacao_ativa;
DROP INDEX IF EXISTS idx_operacao_data_status;
DROP INDEX IF EXISTS idx_participacao_estado_visual;
DROP INDEX IF EXISTS idx_participacao_fila;

-- =========================================
-- 5. REMOVER FUNÇÃO DE LOCK
-- =========================================
DROP FUNCTION IF EXISTS lock_operacao_for_update(INTEGER);

-- =========================================
-- 6. ATUALIZAR ESTATÍSTICAS
-- =========================================
ANALYZE participacao;
ANALYZE operacao;

-- =========================================
-- COMENTÁRIOS DE ROLLBACK
-- =========================================
COMMENT ON TABLE participacao IS 
'Rollback executado: constraints de concorrência removidas';

COMMENT ON TABLE operacao IS 
'Rollback executado: constraints de concorrência removidas'; 