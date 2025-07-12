-- ✅ ROLLBACK MIGRAÇÃO 006: Reverter campos do Sistema de Realtime Aprimorado
-- Executar este arquivo para desfazer as mudanças da migração 006

-- 1. Remover índices criados
DROP INDEX IF EXISTS idx_operacao_updated_at;
DROP INDEX IF EXISTS idx_operacao_atualizacao_forcada;
DROP INDEX IF EXISTS idx_participacao_operacao_updated;

-- 2. Remover triggers
DROP TRIGGER IF EXISTS set_timestamp_operacao ON operacao;
DROP TRIGGER IF EXISTS set_timestamp_participacao ON participacao;

-- 3. Remover função trigger
DROP FUNCTION IF EXISTS trigger_set_timestamp();

-- 4. Remover campo atualizacao_forcada
ALTER TABLE operacao 
DROP COLUMN IF EXISTS atualizacao_forcada;

-- 5. Reverter REPLICA IDENTITY (opcional, pode querer manter para outros usos)
-- ALTER TABLE operacao REPLICA IDENTITY DEFAULT;
-- ALTER TABLE participacao REPLICA IDENTITY DEFAULT;
-- ALTER TABLE justificativa_obrigatoria REPLICA IDENTITY DEFAULT;
-- ALTER TABLE historico_modificacao REPLICA IDENTITY DEFAULT;

-- Verificar estrutura final
\d operacao;
\d participacao; 