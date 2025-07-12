-- ====================================================================
-- ROLLBACK: 006_eventos_operacao_auditoria_rollback.sql
-- DESCRIÇÃO: Reverter sistema de eventos de operações
-- DATA: 2025-01-05
-- ====================================================================

-- 1. REMOVER DA PUBLICAÇÃO REALTIME
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS eventos_operacao;

-- 2. DROPAR TRIGGERS
DROP TRIGGER IF EXISTS trigger_nova_solicitacao ON participacao;
DROP TRIGGER IF EXISTS trigger_aprovacao_participacao ON participacao;
DROP TRIGGER IF EXISTS trigger_cancelamento_participacao ON participacao;
DROP TRIGGER IF EXISTS trigger_limite_expandido ON limite_temporario;

-- 3. DROPAR FUNÇÕES
DROP FUNCTION IF EXISTS trigger_registrar_solicitacao();
DROP FUNCTION IF EXISTS trigger_registrar_aprovacao();
DROP FUNCTION IF EXISTS trigger_registrar_cancelamento();
DROP FUNCTION IF EXISTS trigger_registrar_limite_expandido();
DROP FUNCTION IF EXISTS migrar_eventos_historicos();
DROP FUNCTION IF EXISTS registrar_evento_operacao(INTEGER, VARCHAR, INTEGER, TEXT, JSONB, INTEGER);

-- 4. DROPAR POLÍTICAS RLS
DROP POLICY IF EXISTS "Eventos são públicos para leitura" ON eventos_operacao;
DROP POLICY IF EXISTS "Sistema pode inserir eventos" ON eventos_operacao;

-- 5. DROPAR ÍNDICES
DROP INDEX IF EXISTS idx_eventos_operacao_operacao_id;
DROP INDEX IF EXISTS idx_eventos_operacao_servidor_id;
DROP INDEX IF EXISTS idx_eventos_operacao_tipo_evento;
DROP INDEX IF EXISTS idx_eventos_operacao_data_evento;
DROP INDEX IF EXISTS idx_eventos_operacao_composite;

-- 6. DROPAR TABELA
DROP TABLE IF EXISTS eventos_operacao;

-- 7. REMOVER REGISTRO DA MIGRATION
DELETE FROM migrations_log WHERE version = '006';

-- Confirmar rollback
SELECT 'Rollback da migration 006 concluído com sucesso!' as status; 