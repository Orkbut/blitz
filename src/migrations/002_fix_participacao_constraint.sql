-- Migração para corrigir constraint de participação
-- Problema: A constraint atual impede múltiplos registros inativos (histórico)
-- Solução: Permitir apenas UM registro ativo por membro/operação

-- 1. Remover constraint problemática
ALTER TABLE participacao DROP CONSTRAINT IF EXISTS uk_participacao_membro_operacao;

-- 2. Criar constraint que permite histórico (múltiplos registros inativos)
-- Usando índice único condicional (apenas quando ativa = true)
CREATE UNIQUE INDEX uk_participacao_membro_operacao_ativa 
ON participacao (membro_id, operacao_id) 
WHERE ativa = true;

-- 3. Comentário explicativo
COMMENT ON INDEX uk_participacao_membro_operacao_ativa IS 
'Permite apenas uma participação ativa por membro/operação, mas mantém histórico de participações inativas'; 