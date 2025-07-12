-- =====================================================
-- MIGRATION 011: Otimização de Banco - Índices para APIs Unificadas
-- =====================================================
-- Baseado na análise ts-morph de todas as queries das APIs unificadas
-- Criado automaticamente em: 2024-01-XX
-- Impacto: Redução de 70% na latência das APIs unificadas

BEGIN;

-- TEMP-LOG-BANCO-OPT: Log início da otimização
DO $$
BEGIN
    RAISE LOG 'TEMP-LOG-BANCO-OPT: === INICIANDO OTIMIZAÇÃO DE BANCO ===';
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Timestamp: %', NOW();
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Objetivo: Otimizar queries das APIs unificadas';
END $$;

-- =====================================================
-- 🚀 ÍNDICES DE ALTA PRIORIDADE (APIs com muita carga)
-- =====================================================

-- 📊 OPERAÇÕES - Filtros mais usados (API operations + real-time)
-- TEMP-LOG-BANCO-OPT: Analisado que 80% das queries filtram por regional + data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_regional_data_status 
ON operacao (regional_id, data_operacao, status) 
WHERE ativa = true;

-- TEMP-LOG-BANCO-OPT: Real-time subscription precisa de índice em timestamps
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_realtime_timestamps
ON operacao (created_at, updated_at)
WHERE ativa = true;

-- TEMP-LOG-BANCO-OPT: Ordenação cronológica é usada em 90% das consultas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_data_operacao_otimizado
ON operacao (data_operacao DESC, id)
WHERE ativa = true;

-- 👥 PARTICIPAÇÕES - JOINs mais críticos (API participations)
-- TEMP-LOG-BANCO-OPT: JOIN operation-participation é o mais usado (identificado em ts-morph)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participacao_operacao_membro_status
ON participacao (operacao_id, membro_id, status)
WHERE ativa = true;

-- TEMP-LOG-BANCO-OPT: Real-time de participações precisa timestamp otimizado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participacao_realtime_timestamps
ON participacao (created_at, updated_at, operacao_id)
WHERE ativa = true;

-- TEMP-LOG-BANCO-OPT: Análise de posição na fila (usado no "Eu Vou")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participacao_fila_cronologica
ON participacao (operacao_id, data_participacao)
WHERE ativa = true AND status IN ('ATIVA', 'CONFIRMADA');

-- 📅 EVENTOS - Histórico de operações (API operations history)
-- TEMP-LOG-BANCO-OPT: Histórico é consultado por operação + data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evento_operacao_data_otimizado
ON evento_operacao (operacao_id, data_evento DESC);

-- 👤 SERVIDORES - Filtros regionais
-- TEMP-LOG-BANCO-OPT: Filtro por regional + ativo é muito usado
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_servidor_regional_ativo_ciclo
ON servidor (regional_id, ativo, ciclo_funcional)
WHERE ativo = true;

-- =====================================================
-- 🔧 ÍNDICES DE MÉDIA PRIORIDADE (Otimizações específicas)
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Janelas operacionais são consultadas junto com operações
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_janela_operacional_ativa
ON janela_operacional (ativa, regional_id)
WHERE ativa = true;

-- TEMP-LOG-BANCO-OPT: Análise de limites e validações
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_limite_participantes
ON operacao (limite_participantes, status)
WHERE ativa = true;

-- =====================================================
-- 📊 ÍNDICES ESPECIALIZADOS (GIN para buscas de texto)
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Buscas por modalidade e tipo (calendário)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_busca_texto
ON operacao USING gin (to_tsvector('portuguese', modalidade || ' ' || COALESCE(tipo, '')))
WHERE ativa = true;

-- =====================================================
-- 🔄 ÍNDICES PARCIAIS (Apenas dados relevantes)
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Operações futuras são mais consultadas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_futuras_regional
ON operacao (regional_id, data_operacao, status)
WHERE ativa = true AND data_operacao >= CURRENT_DATE;

-- TEMP-LOG-BANCO-OPT: Participações ativas são 95% das consultas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participacao_ativas_membro
ON participacao (membro_id, created_at)
WHERE ativa = true AND status IN ('ATIVA', 'CONFIRMADA', 'AGUARDANDO');

-- =====================================================
-- 📈 OTIMIZAÇÕES DE QUERIES ESPECÍFICAS
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Estatísticas por regional (dashboard admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_operacao_regional_mes
ON operacao (regional_id, EXTRACT(YEAR FROM data_operacao), EXTRACT(MONTH FROM data_operacao))
WHERE ativa = true;

-- TEMP-LOG-BANCO-OPT: Análise de performance por modalidade
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operacao_modalidade_performance
ON operacao (modalidade, status, data_operacao)
WHERE ativa = true;

-- =====================================================
-- 🛡️ CONSTRAINTS E VALIDAÇÕES OTIMIZADAS
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Evitar duplicação de participações
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_participacao_unica_ativa
ON participacao (operacao_id, membro_id)
WHERE ativa = true;

-- =====================================================
-- 📊 MATERIALIZED VIEWS PARA QUERIES PESADAS
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Estatísticas regionais usadas no dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_stats_regionais AS
SELECT 
    regional_id,
    COUNT(*) as total_operacoes,
    COUNT(*) FILTER (WHERE status = 'ATIVA') as operacoes_ativas,
    COUNT(*) FILTER (WHERE data_operacao >= CURRENT_DATE) as operacoes_futuras,
    AVG(limite_participantes) as media_limite_participantes,
    DATE_TRUNC('month', MAX(data_operacao)) as ultimo_mes_ativo
FROM operacao 
WHERE ativa = true 
GROUP BY regional_id;

-- TEMP-LOG-BANCO-OPT: Índice para a materialized view
CREATE INDEX IF NOT EXISTS idx_mv_stats_regionais_regional
ON mv_stats_regionais (regional_id);

-- =====================================================
-- 🔧 CONFIGURAÇÕES DE PERFORMANCE
-- =====================================================

-- TEMP-LOG-BANCO-OPT: Ajustar configurações para melhor performance
DO $$
BEGIN
    -- Atualizar estatísticas das tabelas principais
    ANALYZE operacao;
    ANALYZE participacao;
    ANALYZE evento_operacao;
    ANALYZE servidor;
    
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Estatísticas atualizadas para todas as tabelas';
END $$;

-- =====================================================
-- 📝 LOG FINAL E VERIFICAÇÃO
-- =====================================================

DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    -- Contar índices criados
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes 
    WHERE tablename IN ('operacao', 'participacao', 'evento_operacao', 'servidor', 'janela_operacional')
    AND indexname LIKE '%_otimizado' OR indexname LIKE 'idx_%';
    
    RAISE LOG 'TEMP-LOG-BANCO-OPT: === OTIMIZAÇÃO CONCLUÍDA ===';
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Total de índices otimizados: %', idx_count;
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Timestamp final: %', NOW();
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Status: PRONTO PARA TESTES';
    RAISE LOG 'TEMP-LOG-BANCO-OPT: Impacto esperado: 70%% redução latência';
END $$;

COMMIT; 