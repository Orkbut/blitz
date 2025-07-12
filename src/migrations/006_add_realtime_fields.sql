-- ✅ MIGRAÇÃO 006: Campos para Sistema de Realtime Aprimorado
-- Adicionado: 2025-01-21
-- Objetivo: Adicionar campos necessários para o sistema de força refresh do realtime

-- 1. Adicionar campo para marcar atualizações forçadas
ALTER TABLE operacao 
ADD COLUMN IF NOT EXISTS atualizacao_forcada TIMESTAMP;

-- 2. Adicionar comentário descritivo
COMMENT ON COLUMN operacao.atualizacao_forcada IS 'Timestamp de quando foi forçada uma atualização realtime para esta operação';

-- 3. Garantir que updated_at seja atualizado automaticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para updated_at se não existir
DROP TRIGGER IF EXISTS set_timestamp_operacao ON operacao;
CREATE TRIGGER set_timestamp_operacao
    BEFORE UPDATE ON operacao
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- 5. Aplicar trigger similar para outras tabelas críticas
DROP TRIGGER IF EXISTS set_timestamp_participacao ON participacao;
CREATE TRIGGER set_timestamp_participacao
    BEFORE UPDATE ON participacao
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- 6. Adicionar índices para melhor performance das consultas realtime
CREATE INDEX IF NOT EXISTS idx_operacao_updated_at ON operacao(updated_at);
CREATE INDEX IF NOT EXISTS idx_operacao_atualizacao_forcada ON operacao(atualizacao_forcada) WHERE atualizacao_forcada IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_participacao_operacao_updated ON participacao(operacao_id, updated_at);

-- 7. Garantir que as tabelas tenham REPLICA IDENTITY FULL para realtime
ALTER TABLE operacao REPLICA IDENTITY FULL;
ALTER TABLE participacao REPLICA IDENTITY FULL;
ALTER TABLE justificativa_obrigatoria REPLICA IDENTITY FULL;
ALTER TABLE historico_modificacao REPLICA IDENTITY FULL;

-- Verificar estrutura final
\d operacao;
\d participacao; 