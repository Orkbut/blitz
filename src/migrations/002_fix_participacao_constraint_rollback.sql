-- ROLLBACK: 002_fix_participacao_constraint.sql
-- Descrição: Remove correções de constraint de participação
-- Data: 19/06/2025

-- =========================================
-- ROLLBACK DAS CORREÇÕES DE CONSTRAINT
-- =========================================

-- Remover constraint corrigida se existir
ALTER TABLE participacao 
DROP CONSTRAINT IF EXISTS uk_participacao_membro_operacao_corrigida;

-- Restaurar constraint original se necessário
-- (Comentado para evitar conflitos - deve ser avaliado caso a caso)
-- ALTER TABLE participacao 
-- ADD CONSTRAINT uk_participacao_membro_operacao 
-- UNIQUE (membro_id, operacao_id);

-- =========================================
-- COMENTÁRIOS DE ROLLBACK
-- =========================================
COMMENT ON TABLE participacao IS 
'Rollback executado: correções de constraint removidas'; 