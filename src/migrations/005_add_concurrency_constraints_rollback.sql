-- =====================================================
-- ROLLBACK: Constraints de Concorrência
-- =====================================================

-- Remover triggers
DROP TRIGGER IF EXISTS trg_after_cancelamento ON participacao;
DROP TRIGGER IF EXISTS trg_check_limite_participantes ON participacao;

-- Remover funções
DROP FUNCTION IF EXISTS after_cancelamento();
DROP FUNCTION IF EXISTS processar_fila_espera(INTEGER);
DROP FUNCTION IF EXISTS check_limite_participantes();

-- Remover constraint única
ALTER TABLE participacao 
DROP CONSTRAINT IF EXISTS uk_membro_operacao_ativa;

-- Remover índices
DROP INDEX IF EXISTS idx_participacao_operacao_confirmados;
DROP INDEX IF EXISTS idx_participacao_membro_ativa;

-- Remover colunas de versão (se não existiam antes)
-- ALTER TABLE operacao DROP COLUMN IF EXISTS version;
-- ALTER TABLE participacao DROP COLUMN IF EXISTS version; 